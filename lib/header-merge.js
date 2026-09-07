/**
 * header-merge.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 공공데이터포털 등에서 받은 파일은 열 이름(헤더)이 한 줄이 아니라 여러 줄이거나
 * 셀이 병합되어 있는 경우가 많고, 그 모양이 파일마다 다 다르다. 이 파일은 그런
 * "날 것 그대로의 표"(raw grid)를 받아서, 학생이 미리보기를 보고 직접 고른
 * 헤더 줄 수만큼 위에서부터 순서대로 이어 붙여 하나의 열 이름으로 만든다.
 *
 * 자매 앱 data-cleaner(lib/parse.js)는 헤더 줄 수를 점수로 자동 추정하지만,
 * 이 앱은 자동 추정을 하지 않는다 — 파일마다 구조가 달라 추정이 자주 틀리므로,
 * "헤더 확인" 화면(steps/step2-collect.js)에서 미리보기를 보며 학생이 직접 정하게 한다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { isBlank, inferColumnType } from './util.js';

/**
 * 가장 긴 행의 길이(= 열 개수)를 구한다.
 * ⚠️ `Math.max(...배열)` 을 쓰면 안 된다 — 전개 연산자는 인자를 스택에 다 올리기 때문에
 * 행이 12만 개쯤 넘어가면 `RangeError: Maximum call stack size exceeded` 로 죽는다.
 * 공공데이터 CSV 는 20만 행이라도 6MB 남짓이라 이 앱의 20MB 한도를 쉽게 통과한다.
 */
function maxRowLength(rows) {
  let max = 0;
  for (const row of rows) {
    const len = Array.isArray(row) ? row.length : 0;
    if (len > max) max = len;
  }
  return max;
}

/** 한 행이 통째로 비어 있는가 (모든 칸이 빈 값) */
function isEmptyRow(row) {
  if (!Array.isArray(row)) return true;
  for (const v of row) if (!isBlank(v)) return false;
  return true;
}

/**
 * 병합 범위(SheetJS !merges 형식: {s:{r,c}, e:{r,c}})를 이용해 2차원 배열의
 * 병합된 칸을 값으로 채운다. 병합의 왼쪽 위(anchor) 칸의 값을 병합 범위 안의
 * 모든 칸에 복사한다. 원본 배열은 바꾸지 않고 새 배열을 돌려준다.
 * @param {string[][]} grid
 * @param {{s:{r:number,c:number}, e:{r:number,c:number}}[]} merges
 * @returns {string[][]}
 */
export function unmergeGrid(grid, merges) {
  const src = Array.isArray(grid) ? grid : [];
  const nRows = src.length;
  const nCols = maxRowLength(src);

  const out = new Array(nRows);
  for (let r = 0; r < nRows; r++) {
    const row = src[r] || [];
    const copy = new Array(nCols);
    for (let c = 0; c < nCols; c++) copy[c] = row[c] !== undefined ? row[c] : '';
    out[r] = copy;
  }

  if (!Array.isArray(merges)) return out;
  for (const m of merges) {
    if (!m || !m.s || !m.e) continue;
    const r0 = m.s.r, c0 = m.s.c, r1 = m.e.r, c1 = m.e.c;
    if (r0 < 0 || c0 < 0 || r1 >= nRows || c1 >= nCols || r1 < r0 || c1 < c0) continue;
    const anchor = out[r0][c0];
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (r === r0 && c === c0) continue;
        out[r][c] = anchor;
      }
    }
  }
  return out;
}

/**
 * "헤더 열"(왼쪽에서부터 headerColCount 개)의 빈 칸을 바로 위 값으로 채운다(캐리포워드).
 *
 * 왜 필요한가: 공공데이터 통계표는 같은 값이 이어질 때 아래 칸을 비워 두는 일이 아주 많다.
 *   시도   시군구  인구
 *   서울   종로    100
 *         중구     90    ← "서울"이 생략됨 (사람 눈에는 여전히 서울)
 *         용산     80
 *   부산   중구     70
 * 이걸 그대로 두면 "시도"로 막대그래프를 그렸을 때 서울 막대 하나에 빈 칸이 잔뜩 생긴다.
 * 그래서 헤더 열로 지정한 칸만 위 값을 이어 쓴다. 오른쪽의 실제 측정값 열은 건드리지 않는다
 * (그건 진짜 결측치일 수 있다).
 *
 * 상위 열의 값이 바뀌면 그 오른쪽 열들의 이어쓰기는 초기화한다.
 * (예: "부산"이 새로 나오면서 시군구가 비어 있으면, 앞의 "중구"를 잘못 물려주지 않는다)
 *
 * @param {string[][]} grid
 * @param {number} headerRowCount - 이 행부터 데이터로 본다
 * @param {number} headerColCount - 왼쪽에서부터 이어쓰기를 적용할 열 개수
 * @returns {string[][]} 새 배열 (원본은 바꾸지 않는다)
 */
export function carryForwardCols(grid, headerRowCount, headerColCount) {
  const src = Array.isArray(grid) ? grid : [];
  const out = src.map((row) => (Array.isArray(row) ? row.slice() : []));
  const m = Math.max(0, Math.round(headerColCount) || 0);
  if (m === 0) return out;

  const carry = new Array(m).fill('');
  const startRow = Math.max(0, Math.round(headerRowCount) || 0);
  for (let r = startRow; r < out.length; r++) {
    for (let c = 0; c < m; c++) {
      const raw = out[r][c];
      if (!isBlank(raw)) {
        // ⚠️ 반드시 앞뒤 공백을 지운 값끼리 비교한다. "서울" 과 "서울 " 을 다른 값으로 보면
        //    실제로는 안 바뀐 상위 항목이 바뀐 것으로 오인되어 하위 열이 잘못 초기화되고,
        //    그래프에서도 눈에 똑같아 보이는 항목이 둘로 갈라진다.
        const cur = String(raw).trim();
        if (carry[c] !== cur) for (let k = c + 1; k < m; k++) carry[k] = '';
        carry[c] = cur;
        out[r][c] = cur; // 헤더 열은 이름표이므로 공백을 정리해 둔다
      } else {
        out[r][c] = carry[c];
      }
    }
  }
  return out;
}

/**
 * 헤더로 쓸 줄 수(headerRowCount)만큼 위에서부터 이어 붙여 열 이름을 만들고,
 * 그 아래를 데이터 행으로 돌려준다.
 *
 * 이름 만드는 규칙
 *  1) 헤더 각 줄의 값을 위→아래 순서로 모으되, 빈 값은 건너뛴다.
 *  2) 바로 위 조각과 값이 같으면 중복이므로 한 번만 쓴다
 *     (세로로 병합된 칸을 펴면 같은 값이 그대로 반복되기 때문 — 예: "지역"+"지역" → "지역").
 *  3) 남은 조각이 여러 개면 sep(기본 '>')으로 이어 붙인다. 예) "인구"+"남" → "인구>남".
 *  4) 전부 비면 "이름없음(N번째 열)".
 *  5) 이름이 겹치면 "이름(2)", "이름(3)"처럼 유일하게 만든다.
 *
 * 헤더 열(headerColCount)을 지정하면 그 열들은 "이름표 열"로 보고
 *  · 빈 칸을 위 값으로 이어 쓰고(carryForwardCols)
 *  · 자료형을 무조건 '텍스트'로 둔다 (측정값이 아니라 항목 이름이므로)
 * 열 자체를 합치지는 않는다 — 시도·시군구를 따로 두어야 학생이 원하는 쪽을 가로축으로 고를 수 있다.
 *
 * @param {string[][]} grid - unmergeGrid를 거친(또는 병합이 없는) 전체 표
 * @param {number} headerRowCount - 1 이상. grid.length보다 크면 grid.length-1로 줄인다.
 * @param {{sep?: string, headerColCount?: number}} [options]
 * @returns {{columns: {name:string, type:string}[], rows: string[][]}}
 */
export function mergeHeaderRows(grid, headerRowCount, options = {}) {
  const { sep = '>', headerColCount = 0 } = options;
  const src = Array.isArray(grid) ? grid : [];
  const n = Math.max(1, Math.min(Math.round(headerRowCount) || 1, Math.max(src.length - 1, 1)));
  const nCols = maxRowLength(src);
  // 데이터 열이 최소 하나는 남아야 하므로 헤더 열은 nCols-1 개까지만 인정한다.
  const m = Math.max(0, Math.min(Math.round(headerColCount) || 0, Math.max(nCols - 1, 0)));

  // 이름은 헤더 행(0..n-1)에서 만들고, 캐리포워드는 데이터 행(n 이후)에만 적용되므로
  // 순서는 상관없지만, 데이터 값은 반드시 캐리포워드를 마친 grid에서 가져와야 한다.
  const carried = carryForwardCols(src, n, m);

  const used = new Map();
  const rawNames = [];
  for (let c = 0; c < nCols; c++) {
    const parts = [];
    for (let r = 0; r < n; r++) {
      const v = src[r] && src[r][c] !== undefined ? String(src[r][c]).trim() : '';
      if (v === '') continue;
      if (parts.length && parts[parts.length - 1] === v) continue; // 바로 위와 같으면 중복 skip
      parts.push(v);
    }
    let name = parts.join(sep);
    if (name === '') name = `이름없음(${c + 1}번째 열)`;
    if (used.has(name)) {
      let k = used.get(name) + 1;
      while (used.has(`${name}(${k})`)) k++;
      used.set(name, k);
      name = `${name}(${k})`;
    }
    used.set(name, used.get(name) || 1);
    rawNames.push(name);
  }

  // ⚠️ "완전히 빈 행"인지는 반드시 **원본(src)** 을 보고 판단한다.
  //    캐리포워드를 마친 carried 를 기준으로 판단하면, 원래 텅 비어 있던 줄에 이미 헤더 열 값이
  //    채워져 있어서 빈 행이 아니게 되고 → 유령 데이터 행으로 되살아난다.
  //    (CSV 중간의 빈 줄이나 엑셀 !ref 가 실제보다 아래까지 잡힌 파일에서 아주 흔하다.
  //     그대로 두면 원그래프·막대그래프(개수)의 숫자가 틀린다.)
  const dataRows = [];
  for (let r = n; r < carried.length; r++) {
    if (isEmptyRow(src[r])) continue;
    const row = carried[r];
    dataRows.push(rawNames.map((_, c) => (row && row[c] !== undefined ? String(row[c]) : '')));
  }

  const columns = rawNames.map((name, c) => ({
    name,
    // 헤더 열은 항목 이름이므로 숫자처럼 보여도 '텍스트'로 둔다 (학생이 표에서 바꿀 수 있다)
    type: c < m ? 'text' : inferColumnType(dataRows.map((r) => r[c])),
  }));

  return { columns, rows: dataRows };
}
