import { createDefaultState, loadState, saveState, resetState } from '../lib/state.js';

let pass = 0, fail = 0;
function check(label, ok, got, want) {
  if (ok) { pass++; console.log(`   OK   ${label}`); }
  else { fail++; console.log(`   FAIL ${label}\n        기대: ${JSON.stringify(want)}\n        실제: ${JSON.stringify(got)}`); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// state.js 내부에서만 쓰는 저장 키. loadState()가 export하지 않으므로,
// 가짜 localStorage에 "예전 버전" 데이터를 직접 찔러 넣어볼 때만 이 상수를 쓴다.
const STORAGE_KEY = 'data-report-state-v1';

console.log('\n【state.js】');

/* ── 1) createDefaultState()의 모양 검사 ───────────────────────────────── */
{
  const s = createDefaultState();
  check('step === 0', s.step === 0, s.step, 0);
  check('topic.question === ""', s.topic.question === '', s.topic.question, '');
  check('collection.methods 빈 배열', eq(s.collection.methods, []), s.collection.methods, []);
  check('collection.source === ""', s.collection.source === '', s.collection.source, '');
  check('collection.columns 길이 2', s.collection.columns.length === 2, s.collection.columns.length, 2);
  check('collection.columns 내용',
    eq(s.collection.columns, [{ name: '항목', type: 'text' }, { name: '값', type: 'number' }]),
    s.collection.columns, [{ name: '항목', type: 'text' }, { name: '값', type: 'number' }]);
  check('collection.rows 길이 2', s.collection.rows.length === 2, s.collection.rows.length, 2);
  check('collection.rows 내용', eq(s.collection.rows, [['', ''], ['', '']]), s.collection.rows, [['', ''], ['', '']]);
  check('visualization.chartType === "bar"', s.visualization.chartType === 'bar', s.visualization.chartType, 'bar');
  check('visualization.xColumn === ""', s.visualization.xColumn === '', s.visualization.xColumn, '');
  check('visualization.yColumn === ""', s.visualization.yColumn === '', s.visualization.yColumn, '');
  check('visualization.aggregate === "avg"', s.visualization.aggregate === 'avg', s.visualization.aggregate, 'avg');
  check('analysis.answers 키 4개(q1~q4)',
    eq(Object.keys(s.analysis.answers).sort(), ['q1', 'q2', 'q3', 'q4']),
    Object.keys(s.analysis.answers).sort(), ['q1', 'q2', 'q3', 'q4']);
  check('analysis.answers 전부 빈 문자열', Object.values(s.analysis.answers).every((v) => v === ''),
    s.analysis.answers, { q1: '', q2: '', q3: '', q4: '' });

  // 호출마다 새 객체를 만들어야 한다 (하나를 고치면 다른 것도 같이 바뀌는 참조 공유 버그 방지)
  const s2 = createDefaultState();
  s2.collection.rows[0][0] = '변경됨';
  check('createDefaultState()는 호출마다 독립된 객체를 돌려줌',
    s.collection.rows[0][0] === '', s.collection.rows[0][0], '');
}

/* ── 2) localStorage가 아예 없는 환경(Node 기본값)에서의 동작 ────────────── */
{
  check('시작 시점에는 globalThis.localStorage가 등록되어 있지 않음',
    typeof globalThis.localStorage === 'undefined', typeof globalThis.localStorage, 'undefined');

  let loaded, loadThrew = false;
  try { loaded = loadState(); } catch { loadThrew = true; }
  check('localStorage 없어도 loadState()가 에러를 던지지 않음', loadThrew === false, loadThrew, false);
  check('localStorage 없으면 loadState()는 기본값을 돌려줌',
    eq(loaded, createDefaultState()), loaded, createDefaultState());

  let saveThrew = false;
  try { saveState(createDefaultState()); } catch { saveThrew = true; }
  check('localStorage 없어도 saveState()가 에러를 던지지 않음', saveThrew === false, saveThrew, false);

  let resetThrew = false, resetResult;
  try { resetResult = resetState(); } catch { resetThrew = true; }
  check('localStorage 없어도 resetState()가 에러를 던지지 않음', resetThrew === false, resetThrew, false);
  check('localStorage 없으면 resetState()도 기본값을 돌려줌',
    eq(resetResult, createDefaultState()), resetResult, createDefaultState());
}

/* ── 메모리 기반 가짜 localStorage 등록 ──────────────────────────────────
   store를 let으로 두고 아래 클로저가 변수 자체를 참조하게 해서,
   이후 테스트 블록마다 store = {} 로 재할당하면 저장소를 간단히 비울 수 있다. */
let store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

/* ── 3) 저장 → 불러오기 왕복(round-trip) ─────────────────────────────── */
{
  store = {};
  const custom = createDefaultState();
  custom.step = 3;
  custom.topic.question = '급식 메뉴별 잔반량은 얼마나 될까?';
  custom.collection.methods = ['설문조사', '관찰'];
  custom.collection.source = '학교 급식실 기록';
  custom.collection.columns = [{ name: '요일', type: 'text' }, { name: '잔반(kg)', type: 'number' }];
  custom.collection.rows = [['월요일', '12'], ['화요일', '8'], ['수요일', '15']];
  custom.visualization.chartType = 'line';
  custom.visualization.xColumn = '요일';
  custom.visualization.yColumn = '잔반(kg)';
  custom.analysis.answers.q1 = '수요일이 가장 많았다';

  saveState(custom);
  check('saveState() 후 가짜 저장소에 문자열로 저장됨',
    typeof store[STORAGE_KEY] === 'string', typeof store[STORAGE_KEY], 'string');

  const loaded = loadState();
  check('round-trip: 전체 상태가 저장했던 값과 일치', eq(loaded, custom), loaded, custom);
  check('round-trip: topic.question', loaded.topic.question === custom.topic.question,
    loaded.topic.question, custom.topic.question);
  check('round-trip: collection.rows', eq(loaded.collection.rows, custom.collection.rows),
    loaded.collection.rows, custom.collection.rows);
  check('round-trip: analysis.answers.q1', loaded.analysis.answers.q1 === custom.analysis.answers.q1,
    loaded.analysis.answers.q1, custom.analysis.answers.q1);
  check('round-trip: step', loaded.step === custom.step, loaded.step, custom.step);
}

/* ── 4) 일부 필드가 빠진 "예전 버전" 저장값도 안전하게 복원되는지 ───────── */
{
  // 4-1) 최상위 필드(topic)만 있고 나머지 통째로 없음
  store = {};
  store[STORAGE_KEY] = JSON.stringify({ topic: { question: '예전 질문' } });
  let loaded, threw = false;
  try { loaded = loadState(); } catch { threw = true; }
  check('예전 버전(최상위 필드 누락)에도 에러 없음', threw === false, threw, false);
  check('있던 필드(topic.question)는 유지됨', loaded && loaded.topic.question === '예전 질문',
    loaded && loaded.topic.question, '예전 질문');
  check('없던 필드(collection.columns)는 기본값으로 채워짐',
    eq(loaded.collection.columns, createDefaultState().collection.columns),
    loaded.collection.columns, createDefaultState().collection.columns);
  check('없던 필드(collection.rows)는 기본값으로 채워짐',
    eq(loaded.collection.rows, createDefaultState().collection.rows),
    loaded.collection.rows, createDefaultState().collection.rows);
  check('없던 필드(visualization)는 기본값으로 채워짐',
    eq(loaded.visualization, createDefaultState().visualization),
    loaded.visualization, createDefaultState().visualization);
  check('없던 필드(analysis.answers)는 기본값으로 채워짐',
    eq(loaded.analysis.answers, createDefaultState().analysis.answers),
    loaded.analysis.answers, createDefaultState().analysis.answers);

  // 4-2) 더 깊은 곳(analysis.answers)만 일부 필드가 빠진 경우
  store = {};
  store[STORAGE_KEY] = JSON.stringify({ analysis: { answers: { q1: '내가 쓴 답' } } });
  const loaded2 = loadState();
  check('analysis.answers 중 있던 q1은 유지됨', loaded2.analysis.answers.q1 === '내가 쓴 답',
    loaded2.analysis.answers.q1, '내가 쓴 답');
  check('analysis.answers 중 없던 q2는 기본값("")', loaded2.analysis.answers.q2 === '',
    loaded2.analysis.answers.q2, '');
  check('analysis.answers 중 없던 q3은 기본값("")', loaded2.analysis.answers.q3 === '',
    loaded2.analysis.answers.q3, '');
  check('analysis.answers 중 없던 q4는 기본값("")', loaded2.analysis.answers.q4 === '',
    loaded2.analysis.answers.q4, '');

  // 4-3) 저장된 값이 JSON으로 파싱조차 안 되는 경우(완전히 깨진 문자열)
  store = {};
  store[STORAGE_KEY] = '{ 이건 JSON이 아님';
  let brokenLoaded, brokenThrew = false;
  try { brokenLoaded = loadState(); } catch { brokenThrew = true; }
  check('JSON 파싱 실패 시에도 에러를 던지지 않음', brokenThrew === false, brokenThrew, false);
  check('JSON 파싱 실패 시 기본값을 돌려줌',
    eq(brokenLoaded, createDefaultState()), brokenLoaded, createDefaultState());
}

/* ── 5) resetState() 이후 loadState()가 다시 기본값을 돌려주는지 ─────────── */
{
  store = {};
  const custom = createDefaultState();
  custom.topic.question = '리셋하면 지워질 질문';
  saveState(custom);
  check('resetState() 호출 전에는 저장된 값이 불러와짐',
    loadState().topic.question === '리셋하면 지워질 질문', loadState().topic.question, '리셋하면 지워질 질문');

  const afterReset = resetState();
  check('resetState()는 기본값을 돌려줌', eq(afterReset, createDefaultState()), afterReset, createDefaultState());
  check('resetState() 후 가짜 저장소에서 키가 삭제됨', !(STORAGE_KEY in store), (STORAGE_KEY in store), false);
  check('resetState() 후 loadState()도 기본값을 돌려줌',
    eq(loadState(), createDefaultState()), loadState(), createDefaultState());
}

console.log(`\n합계: ${pass} 성공 / ${fail} 실패\n`);
process.exit(fail > 0 ? 1 : 0);
