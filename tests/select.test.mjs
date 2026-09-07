import { applySelection, normalizeSelection, selectionCounts, rowMatchesQuery } from '../lib/select.js';

let pass = 0, fail = 0;
function check(label, ok, got, want) {
  if (ok) { pass++; console.log(`   OK   ${label}`); }
  else { fail++; console.log(`   FAIL ${label}\n        기대: ${JSON.stringify(want)}\n        실제: ${JSON.stringify(got)}`); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n【select.js】');

const sample = {
  columns: [{ name: '시도', type: 'text' }, { name: '시군구', type: 'text' }, { name: '인구', type: 'number' }],
  rows: [
    ['서울', '종로', '100'],
    ['서울', '중구', '90'],
    ['부산', '해운대', '70'],
  ],
};

// ── normalizeSelection ─────────────────────────────────────────────────────
check('normalize: 없으면 전부 true', eq(normalizeSelection(undefined, 3), [true, true, true]),
  normalizeSelection(undefined, 3), [true, true, true]);
check('normalize: 짧으면 나머지 true', eq(normalizeSelection([false], 3), [false, true, true]),
  normalizeSelection([false], 3), [false, true, true]);
check('normalize: 길면 잘라낸다', eq(normalizeSelection([true, false, true, false], 2), [true, false]),
  normalizeSelection([true, false, true, false], 2), [true, false]);
check('normalize: 배열이 아니어도 안전', eq(normalizeSelection(null, 2), [true, true]),
  normalizeSelection(null, 2), [true, true]);

// ── applySelection ─────────────────────────────────────────────────────────
{
  const res = applySelection(sample);
  check('선택 없으면 원본 그대로', res.columns.length === 3 && res.rows.length === 3,
    { c: res.columns.length, r: res.rows.length }, { c: 3, r: 3 });
}
{
  // 가운데 열(시군구)만 빼기
  const res = applySelection({ ...sample, colSelected: [true, false, true] });
  check('열 고르기: 열 2개만 남음', eq(res.columns.map((c) => c.name), ['시도', '인구']),
    res.columns.map((c) => c.name), ['시도', '인구']);
  check('열 고르기: 각 행에서도 그 열이 빠짐', eq(res.rows[0], ['서울', '100']), res.rows[0], ['서울', '100']);
  check('열 고르기: 행 수는 그대로', res.rows.length === 3, res.rows.length, 3);
}
{
  // 첫째·셋째 행만
  const res = applySelection({ ...sample, rowSelected: [true, false, true] });
  check('행 고르기: 행 2개만 남음', res.rows.length === 2, res.rows.length, 2);
  check('행 고르기: 남은 값 확인', eq(res.rows.map((r) => r[1]), ['종로', '해운대']),
    res.rows.map((r) => r[1]), ['종로', '해운대']);
  check('행 고르기: 열 수는 그대로', res.columns.length === 3, res.columns.length, 3);
}
{
  // 행·열 동시에
  const res = applySelection({ ...sample, colSelected: [true, false, true], rowSelected: [false, true, true] });
  check('행+열 동시', eq(res.rows, [['서울', '90'], ['부산', '70']]), res.rows, [['서울', '90'], ['부산', '70']]);
  check('행+열 동시 열 이름', eq(res.columns.map((c) => c.name), ['시도', '인구']),
    res.columns.map((c) => c.name), ['시도', '인구']);
}
{
  // 전부 해제
  const res = applySelection({ ...sample, colSelected: [false, false, false], rowSelected: [false, false, false] });
  check('전부 해제하면 빈 표', res.columns.length === 0 && res.rows.length === 0,
    { c: res.columns.length, r: res.rows.length }, { c: 0, r: 0 });
}
{
  // 원본을 바꾸지 않는다
  const copy = JSON.parse(JSON.stringify(sample));
  applySelection({ ...copy, colSelected: [true, false, true] });
  check('원본 불변', eq(copy, sample), copy, sample);
}
{
  // 빈 입력에도 죽지 않는다
  const res = applySelection({});
  check('빈 collection에도 안전', eq(res, { columns: [], rows: [] }), res, { columns: [], rows: [] });
  const res2 = applySelection(null);
  check('null에도 안전', eq(res2, { columns: [], rows: [] }), res2, { columns: [], rows: [] });
}

// ── selectionCounts ────────────────────────────────────────────────────────
{
  const c = selectionCounts({ ...sample, colSelected: [true, false, true], rowSelected: [true, true, false] });
  check('개수 세기', eq(c, { colTotal: 3, colChecked: 2, rowTotal: 3, rowChecked: 2 }), c,
    { colTotal: 3, colChecked: 2, rowTotal: 3, rowChecked: 2 });
}

// ── rowMatchesQuery ────────────────────────────────────────────────────────
check('검색: 빈 검색어는 모두 통과', rowMatchesQuery(['서울', '종로'], '') === true,
  rowMatchesQuery(['서울', '종로'], ''), true);
check('검색: 아무 칸이나 맞으면 통과', rowMatchesQuery(['서울', '종로', '100'], '종로') === true,
  rowMatchesQuery(['서울', '종로', '100'], '종로'), true);
check('검색: 부분 일치', rowMatchesQuery(['해운대구'], '해운') === true, rowMatchesQuery(['해운대구'], '해운'), true);
check('검색: 안 맞으면 false', rowMatchesQuery(['서울', '종로'], '부산') === false,
  rowMatchesQuery(['서울', '종로'], '부산'), false);
check('검색: 숫자 칸도 검색됨', rowMatchesQuery(['서울', '100'], '100') === true,
  rowMatchesQuery(['서울', '100'], '100'), true);
check('검색: 대소문자 무시', rowMatchesQuery(['Seoul'], 'seoul') === true, rowMatchesQuery(['Seoul'], 'seoul'), true);
check('검색: 앞뒤 공백 무시', rowMatchesQuery(['서울'], '  서울  ') === true, rowMatchesQuery(['서울'], '  서울  '), true);

console.log(`\n합계: ${pass} 성공 / ${fail} 실패\n`);
process.exit(fail > 0 ? 1 : 0);
