import { unmergeGrid, mergeHeaderRows, carryForwardCols } from '../lib/header-merge.js';

let pass = 0, fail = 0;
function check(label, ok, got, want) {
  if (ok) { pass++; console.log(`   OK   ${label}`); }
  else { fail++; console.log(`   FAIL ${label}\n        기대: ${JSON.stringify(want)}\n        실제: ${JSON.stringify(got)}`); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n【header-merge.js】');

// ── unmergeGrid ─────────────────────────────────────────────────────────────
{
  // "지역"이 A1:A2로 세로 병합, "인구"가 B1:C1로 가로 병합된 표
  const grid = [
    ['지역', '인구', ''],
    ['', '남', '여'],
    ['서울', '100', '110'],
  ];
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // 지역 세로 병합
    { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } }, // 인구 가로 병합
  ];
  const out = unmergeGrid(grid, merges);
  check('세로 병합 값 복사', out[1][0] === '지역', out[1][0], '지역');
  check('가로 병합 값 복사', out[0][2] === '인구', out[0][2], '인구');
  check('원본은 바뀌지 않음', grid[1][0] === '', grid[1][0], '');
}

{
  const out = unmergeGrid([['a', 'b'], ['c', 'd']], []);
  check('병합 없으면 값 그대로', eq(out, [['a', 'b'], ['c', 'd']]), out, [['a', 'b'], ['c', 'd']]);
}

{
  const out = unmergeGrid([['a']], null);
  check('merges가 배열이 아니어도 죽지 않음', eq(out, [['a']]), out, [['a']]);
}

// ── mergeHeaderRows ────────────────────────────────────────────────────────

// 1) 헤더 1줄 — 가장 흔한 경우
{
  const grid = [
    ['메뉴', '잔반율'],
    ['김치찌개', '48'],
    ['불고기', '10'],
  ];
  const res = mergeHeaderRows(grid, 1);
  check('1줄 헤더 열이름', eq(res.columns.map((c) => c.name), ['메뉴', '잔반율']),
    res.columns.map((c) => c.name), ['메뉴', '잔반율']);
  check('1줄 헤더 데이터 2행', res.rows.length === 2, res.rows.length, 2);
  check('1줄 헤더 자료형(잔반율=수치형)', res.columns[1].type === 'number', res.columns[1].type, 'number');
}

// 2) 헤더 2줄, ">" 로 이어붙이기 (인구 / 남·여)
{
  const grid = [
    ['지역', '인구', '인구'],
    ['', '남', '여'],
    ['서울', '100', '110'],
    ['부산', '50', '55'],
  ];
  const res = mergeHeaderRows(grid, 2);
  check('2줄 헤더 ">" 로 이어붙임', eq(res.columns.map((c) => c.name), ['지역', '인구>남', '인구>여']),
    res.columns.map((c) => c.name), ['지역', '인구>남', '인구>여']);
  check('세로 병합 중복 제거(지역이 지역>지역 안 됨)', res.columns[0].name === '지역', res.columns[0].name, '지역');
  check('2줄 헤더 데이터 2행', res.rows.length === 2, res.rows.length, 2);
  check('2줄 헤더 값 매핑', res.rows[0][1] === '100' && res.rows[0][2] === '110',
    res.rows[0], ['서울', '100', '110']);
}

// 3) 헤더 3줄 — 사용자가 요청한 "1>2>3" 형태
{
  const grid = [
    ['구분', '2020', '2020'],
    ['', '상반기', '상반기'],
    ['', '1월', '2월'],
    ['A', '10', '20'],
  ];
  const res = mergeHeaderRows(grid, 3);
  check('3줄 헤더 이어붙임', res.columns[1].name === '2020>상반기>1월', res.columns[1].name, '2020>상반기>1월');
  check('3줄 헤더 데이터 1행', res.rows.length === 1, res.rows.length, 1);
}

// 4) 헤더 줄에 빈 값이 섞여도 건너뛴다
{
  const grid = [
    ['이름', ''],
    ['', '값'],
    ['a', '1'],
  ];
  const res = mergeHeaderRows(grid, 2);
  check('빈 조각은 건너뜀', eq(res.columns.map((c) => c.name), ['이름', '값']),
    res.columns.map((c) => c.name), ['이름', '값']);
}

// 5) 헤더가 전부 비면 자동 이름
{
  const grid = [
    ['이름', ''],
    ['a', '1'],
  ];
  const res = mergeHeaderRows(grid, 1);
  check('빈 헤더는 자동 이름', res.columns[1].name === '이름없음(2번째 열)', res.columns[1].name, '이름없음(2번째 열)');
}

// 6) 이름이 겹치면 유일하게 만든다
{
  const grid = [
    ['값', '값'],
    ['1', '2'],
  ];
  const res = mergeHeaderRows(grid, 1);
  check('겹치는 이름 유일화', eq(res.columns.map((c) => c.name), ['값', '값(2)']),
    res.columns.map((c) => c.name), ['값', '값(2)']);
}

// 7) 완전히 빈 데이터 행은 제외한다
{
  const grid = [
    ['이름', '값'],
    ['a', '1'],
    ['', ''],
    ['b', '2'],
  ];
  const res = mergeHeaderRows(grid, 1);
  check('빈 데이터 행 제외', res.rows.length === 2, res.rows.length, 2);
}

// 8) headerRowCount가 grid 크기를 넘으면 안전하게 줄어든다
{
  const grid = [['이름', '값'], ['a', '1']];
  const res = mergeHeaderRows(grid, 10);
  check('헤더 줄 수가 grid보다 크면 안전하게 처리', res.rows.length === 1, res.rows.length, 1);
}

// ── carryForwardCols ───────────────────────────────────────────────────────

// 9) 통계표에서 생략된 상위 항목을 위 값으로 이어 쓴다
{
  const grid = [
    ['시도', '시군구', '인구'],
    ['서울', '종로', '100'],
    ['', '중구', '90'],
    ['', '용산', '80'],
    ['부산', '중구', '70'],
  ];
  const out = carryForwardCols(grid, 1, 1);
  check('캐리포워드: 생략된 시도 채움', eq(out.map((r) => r[0]), ['시도', '서울', '서울', '서울', '부산']),
    out.map((r) => r[0]), ['시도', '서울', '서울', '서울', '부산']);
  check('캐리포워드: 데이터 열은 안 건드림', out[2][2] === '90', out[2][2], '90');
  check('캐리포워드: 원본 불변', grid[2][0] === '', grid[2][0], '');
}

// 10) 헤더 행은 캐리포워드 대상이 아니다
{
  const grid = [
    ['시도', '인구'],
    ['', '값'],
    ['서울', '100'],
  ];
  const out = carryForwardCols(grid, 2, 1);
  check('캐리포워드: 헤더 행(2번째 줄)은 그대로 빈 칸', out[1][0] === '', out[1][0], '');
}

// 11) 상위 열이 바뀌면 하위 열의 이어쓰기는 초기화된다 (잘못된 값 물려주기 방지)
{
  const grid = [
    ['시도', '시군구', '값'],
    ['서울', '종로', '1'],
    ['', '중구', '2'],
    ['부산', '', '3'],   // 시도가 바뀌었는데 시군구가 비어 있다 → "중구"를 물려주면 안 된다
  ];
  const out = carryForwardCols(grid, 1, 2);
  check('캐리포워드: 상위가 바뀌면 하위는 초기화', out[3][1] === '', out[3][1], '');
  check('캐리포워드: 바뀐 상위 값은 그대로', out[3][0] === '부산', out[3][0], '부산');
}

// 12) headerColCount가 0이면 아무것도 바꾸지 않는다
{
  const grid = [['a', 'b'], ['', 'c']];
  const out = carryForwardCols(grid, 1, 0);
  check('캐리포워드: 0이면 그대로', eq(out, grid), out, grid);
}

// ── mergeHeaderRows + headerColCount 통합 ─────────────────────────────────

// 13) 헤더 열을 지정하면 캐리포워드가 결과 데이터에 반영된다
{
  const grid = [
    ['시도', '시군구', '2023년'],
    ['시도', '시군구', '인구'],
    ['서울', '종로', '100'],
    ['', '중구', '90'],
    ['부산', '중구', '70'],
  ];
  const res = mergeHeaderRows(grid, 2, { headerColCount: 2 });
  check('헤더열: 열 이름은 그대로 만들어짐', eq(res.columns.map((c) => c.name), ['시도', '시군구', '2023년>인구']),
    res.columns.map((c) => c.name), ['시도', '시군구', '2023년>인구']);
  check('헤더열: 생략된 시도가 채워짐', eq(res.rows.map((r) => r[0]), ['서울', '서울', '부산']),
    res.rows.map((r) => r[0]), ['서울', '서울', '부산']);
  check('헤더열: 지정한 열은 텍스트형', res.columns[0].type === 'text' && res.columns[1].type === 'text',
    [res.columns[0].type, res.columns[1].type], ['text', 'text']);
  check('헤더열: 나머지 열은 자동 추정(숫자)', res.columns[2].type === 'number', res.columns[2].type, 'number');
}

// 14) 헤더 열은 숫자처럼 보여도 텍스트형으로 둔다 (연도 코드 등)
{
  const grid = [
    ['연도', '값'],
    ['2020', '10'],
    ['2021', '20'],
  ];
  const withHeaderCol = mergeHeaderRows(grid, 1, { headerColCount: 1 });
  check('헤더열: 숫자로 보여도 텍스트형', withHeaderCol.columns[0].type === 'text',
    withHeaderCol.columns[0].type, 'text');
  const without = mergeHeaderRows(grid, 1);
  check('헤더열 미지정이면 숫자로 추정', without.columns[0].type === 'number', without.columns[0].type, 'number');
}

// 15) 헤더 열이 전체 열 수 이상이면 데이터 열이 하나는 남도록 줄인다
{
  const grid = [['a', 'b'], ['1', '2']];
  const res = mergeHeaderRows(grid, 1, { headerColCount: 5 });
  check('헤더열: 과도한 값은 nCols-1로 제한', res.columns[1].type !== 'text' || res.columns.length === 2,
    res.columns.map((c) => c.type), '마지막 열은 헤더열이 아님');
}

// 16) 기존 호출 방식(3번째 인자 없음)이 그대로 동작한다
{
  const grid = [['이름', '값'], ['a', '1']];
  const res = mergeHeaderRows(grid, 1);
  check('옵션 없이 호출해도 동작', eq(res.columns.map((c) => c.name), ['이름', '값']),
    res.columns.map((c) => c.name), ['이름', '값']);
}

// ── 적대적 검토에서 찾은 결함들 (2026-08-04 수정) ──────────────────────────

// 17) 유령 행: 캐리포워드가 빈 행을 되살리면 안 된다
{
  const grid = [
    ['지역', '인구'],
    ['서울', '100'],
    ['', ''],
    ['', ''],
    ['부산', '200'],
  ];
  const without = mergeHeaderRows(grid, 1, { headerColCount: 0 });
  const withCol = mergeHeaderRows(grid, 1, { headerColCount: 1 });
  check('유령행: 헤더열 0일 때 2행', without.rows.length === 2, without.rows.length, 2);
  check('유령행: 헤더열 1이어도 여전히 2행', withCol.rows.length === 2, withCol.rows.length, 2);
  check('유령행: 값도 그대로', eq(withCol.rows, [['서울', '100'], ['부산', '200']]),
    withCol.rows, [['서울', '100'], ['부산', '200']]);
}

// 18) 빈 행이 중간에 있어도 캐리포워드 자체는 끊기지 않는다
{
  const grid = [
    ['시도', '시군구', '값'],
    ['서울', '종로', '10'],
    ['', '', ''],          // 완전히 빈 줄 (제외되어야 함)
    ['', '중구', '20'],     // "서울"이 계속 이어져야 함
  ];
  const res = mergeHeaderRows(grid, 1, { headerColCount: 2 });
  check('유령행: 빈 줄 제외 후 2행', res.rows.length === 2, res.rows.length, 2);
  check('유령행: 빈 줄 건너뛰고도 캐리포워드 유지', res.rows[1][0] === '서울', res.rows[1][0], '서울');
}

// 19) 앞뒤 공백 차이를 "값이 바뀐 것"으로 보지 않는다
{
  const grid = [
    ['시도', '시군구', '값'],
    ['서울', '종로', '10'],
    ['서울 ', '', '20'],   // 뒤에 공백 — 같은 "서울"로 봐야 한다
    ['서울', '', '30'],
  ];
  const res = mergeHeaderRows(grid, 1, { headerColCount: 2 });
  check('공백: 하위 열이 잘못 초기화되지 않음', eq(res.rows.map((r) => r[1]), ['종로', '종로', '종로']),
    res.rows.map((r) => r[1]), ['종로', '종로', '종로']);
  check('공백: 헤더 열 값이 정리되어 한 항목으로 모임', eq(res.rows.map((r) => r[0]), ['서울', '서울', '서울']),
    res.rows.map((r) => r[0]), ['서울', '서울', '서울']);
}

// 20) 행이 아주 많아도 전개 연산자로 죽지 않는다 (RangeError 방지)
{
  const big = [['지역', '값']];
  for (let i = 0; i < 200000; i++) big.push([i % 2 === 0 ? '서울' : '', String(i)]);
  let threw = null;
  let res = null;
  try {
    res = mergeHeaderRows(big, 1, { headerColCount: 1 });
  } catch (e) {
    threw = String(e && e.message);
  }
  check('대용량: 20만 행에서 RangeError가 나지 않음', threw === null, threw, null);
  check('대용량: 행 수가 맞음', res && res.rows.length === 200000, res && res.rows.length, 200000);
  check('대용량: 캐리포워드도 정상', res && res.rows[1][0] === '서울', res && res.rows[1][0], '서울');
}

console.log(`\n합계: ${pass} 성공 / ${fail} 실패\n`);
process.exit(fail > 0 ? 1 : 0);
