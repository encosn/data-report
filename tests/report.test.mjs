import { createDefaultState } from '../lib/state.js';
import { buildReportHtml } from '../lib/report.js';

let pass = 0, fail = 0;
function check(label, ok, got, want) {
  if (ok) { pass++; console.log(`   OK   ${label}`); }
  else { fail++; console.log(`   FAIL ${label}\n        기대: ${JSON.stringify(want)}\n        실제: ${JSON.stringify(got)}`); }
}

console.log('\n【report.js】');

// 기본 상태 + 몇 개 필드를 채운 상태를 만든다
function makeFilledState(question) {
  const state = createDefaultState();
  state.topic.question = question;
  state.collection.source = '학급 설문조사';
  state.collection.methods = ['설문조사', '관찰'];
  state.collection.columns = [
    { name: '메뉴', type: 'text' },
    { name: '잔반량(g)', type: 'number' },
  ];
  state.collection.rows = [
    ['김치찌개', '120'],
    ['불고기', '30'],
  ];
  state.analysis.answers = {
    q1: '잔반량이 가장 많은 메뉴는 김치찌개였다.',
    q2: '국물 요리일수록 잔반이 많았다.',
    q3: '매운 음식을 싫어하는 학생이 많아서인 것 같다.',
    q4: '잔반이 많은 메뉴는 배식량을 줄이자고 건의할 수 있다.',
    };
  return state;
}

// (1) 반환값이 문자열이고 '<html'을 포함하는가
{
  const state = makeFilledState('우리 학교 급식 메뉴별 잔반량은 어떻게 다를까?');
  const html = buildReportHtml(state, null);
  check('문자열 반환', typeof html === 'string', typeof html, 'string');
  check('<html 포함', html.includes('<html'), html.includes('<html'), true);
}

// (2) topic.question 값이 결과에 포함되는가
{
  const question = '요일별로 도서관 대출 권수는 어떻게 달라질까?';
  const state = makeFilledState(question);
  const html = buildReportHtml(state, null);
  check('탐구 질문 포함', html.includes(question), html.includes(question), true);
}

// (3) 위험한 문자(<script>)가 이스케이프되어 실제 태그로 남지 않는가
{
  const state = makeFilledState('<script>alert(1)</script>');
  const html = buildReportHtml(state, null);
  check('script 태그가 그대로 남지 않음', !html.includes('<script>alert(1)</script>'),
    html.includes('<script>alert(1)</script>'), false);
  check('이스케이프된 형태로 포함됨', html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),
    html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
}

// (4) analysis.answers 의 값들이 결과에 포함되는가
{
  const state = makeFilledState('우리 반 친구들이 좋아하는 음악 장르는 무엇일까?');
  const html = buildReportHtml(state, null);
  for (const key of Object.keys(state.analysis.answers)) {
    const answer = state.analysis.answers[key];
    check(`분석 답변 포함(${key})`, html.includes(answer), html.includes(answer), true);
  }
}

// (5) chartImageDataUrl 이 null일 때도 에러 없이 문자열을 반환하는가
{
  const state = makeFilledState('최근 10년간 내가 좋아하는 음식의 물가는 얼마나 올랐을까?');
  let html, threw = false;
  try {
    html = buildReportHtml(state, null);
  } catch {
    threw = true;
  }
  check('null 그래프여도 에러 없음', threw === false, threw, false);
  check('null 그래프 안내 문구 포함', html.includes('그래프를 아직 그리지 않았어요'),
    html.includes('그래프를 아직 그리지 않았어요'), true);
}

// 추가 확인: 그래프가 있을 때는 <img> 태그가 들어가는가
{
  const state = makeFilledState('요일별 도서관 대출 권수');
  const fakeDataUrl = 'data:image/png;base64,aGVsbG8=';
  const html = buildReportHtml(state, fakeDataUrl);
  check('그래프 이미지 태그 포함', html.includes(`<img class="report-chart-img" src="${fakeDataUrl}"`),
    html.includes(fakeDataUrl), true);
}

// 추가 확인: 표(수집 데이터)가 셀 값을 포함하는가
{
  const state = makeFilledState('표 확인용 질문');
  const html = buildReportHtml(state, null);
  check('표 헤더 포함', html.includes('메뉴') && html.includes('잔반량(g)'), true, true);
  check('표 데이터 포함', html.includes('김치찌개') && html.includes('불고기'), true, true);
}

// 추가 확인: 학번·이름을 주면 보고서에 채워져서 나오는가 (전달하지 않으면 빈 밑줄만)
{
  const state = makeFilledState('학번·이름 확인용 질문');
  const htmlWithout = buildReportHtml(state, null);
  check('학번·이름 없이도 에러 없음(빈 밑줄)', htmlWithout.includes('report-blank-line'), true, true);

  const htmlWith = buildReportHtml(state, null, { studentId: '10203', name: '홍길동' });
  check('학번이 채워져서 나옴', htmlWith.includes('10203'), htmlWith.includes('10203'), true);
  check('이름이 채워져서 나옴', htmlWith.includes('홍길동'), htmlWith.includes('홍길동'), true);
}

// 추가 확인: 학번·이름에 위험한 문자가 있어도 이스케이프되는가
{
  const state = makeFilledState('학번·이름 XSS 확인용 질문');
  const html = buildReportHtml(state, null, { studentId: '1', name: '<script>alert(2)</script>' });
  check('이름의 script 태그가 그대로 남지 않음', !html.includes('<script>alert(2)</script>'),
    html.includes('<script>alert(2)</script>'), false);
}

console.log(`\n합계: ${pass} 성공 / ${fail} 실패\n`);
process.exit(fail > 0 ? 1 : 0);
