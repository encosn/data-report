/**
 * select.js
 * ─────────────────────────────────────────────────────────────────────────────
 * "표에서 원하는 행·열만 골라내기"를 담당하는 순수 함수 모음.
 *
 * 왜 지우지 않고 체크로 고르는가?
 *   "행 삭제" 버튼은 되돌릴 수 없다. 반면 체크는 껐다 켰다 할 수 있고, 검색과 함께 쓰면
 *   수십 줄을 한 번에 고를 수 있다. 그래서 원본 표는 state에 그대로 두고,
 *   **무엇을 고를지(colSelected/rowSelected)만 따로 기억**한다.
 *   3·4·5단계(시각화·분석·보고서)는 applySelection()이 걸러 준 표만 본다.
 *   → 학생이 2단계로 되돌아오면 원래 표가 그대로 남아 있어 다시 고를 수 있다.
 *
 * 선택 상태는 columns/rows와 길이가 같은 boolean 배열이다. 열·행을 추가·삭제할 때
 * 같이 splice하면 되므로 번호가 어긋날 일이 없다.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** 길이 n짜리 boolean 배열을 만든다. 기존 값이 있으면 최대한 살리고 모자란 만큼 true로 채운다. */
export function normalizeSelection(selection, n) {
  const out = new Array(n);
  const src = Array.isArray(selection) ? selection : [];
  for (let i = 0; i < n; i++) out[i] = i < src.length ? src[i] !== false : true;
  return out;
}

/**
 * 체크된 열·행만 남긴 표를 돌려준다.
 * @param {{columns: {name:string,type:string}[], rows: string[][],
 *          colSelected?: boolean[], rowSelected?: boolean[]}} collection
 * @returns {{columns: {name:string,type:string}[], rows: string[][]}}
 */
export function applySelection(collection) {
  const columns = Array.isArray(collection && collection.columns) ? collection.columns : [];
  const rows = Array.isArray(collection && collection.rows) ? collection.rows : [];
  const colSel = normalizeSelection(collection && collection.colSelected, columns.length);
  const rowSel = normalizeSelection(collection && collection.rowSelected, rows.length);

  const keptColIdx = [];
  for (let c = 0; c < columns.length; c++) if (colSel[c]) keptColIdx.push(c);

  const outColumns = keptColIdx.map((c) => columns[c]);
  const outRows = [];
  for (let r = 0; r < rows.length; r++) {
    if (!rowSel[r]) continue;
    const row = rows[r] || [];
    outRows.push(keptColIdx.map((c) => (row[c] !== undefined ? row[c] : '')));
  }
  return { columns: outColumns, rows: outRows };
}

/** 고른 개수 요약 (화면에 "고른 열 3/5 · 고른 행 12/40"처럼 보여 주기 위한 값) */
export function selectionCounts(collection) {
  const columns = Array.isArray(collection && collection.columns) ? collection.columns : [];
  const rows = Array.isArray(collection && collection.rows) ? collection.rows : [];
  const colSel = normalizeSelection(collection && collection.colSelected, columns.length);
  const rowSel = normalizeSelection(collection && collection.rowSelected, rows.length);
  return {
    colTotal: columns.length,
    colChecked: colSel.filter(Boolean).length,
    rowTotal: rows.length,
    rowChecked: rowSel.filter(Boolean).length,
  };
}

/**
 * 한 행이 검색어와 맞는가 (행의 아무 칸이나 검색어를 담고 있으면 맞는 것으로 본다).
 * 검색어가 비어 있으면 모두 맞는 것으로 본다.
 */
export function rowMatchesQuery(row, query) {
  const q = String(query == null ? '' : query).trim().toLowerCase();
  if (q === '') return true;
  if (!Array.isArray(row)) return false;
  for (const v of row) {
    if (String(v == null ? '' : v).toLowerCase().includes(q)) return true;
  }
  return false;
}
