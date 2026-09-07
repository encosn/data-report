/**
 * state.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 이 앱 전체가 공유하는 단 하나의 상태(수행평가 진행 데이터)를 정의하고,
 * 학생의 브라우저 localStorage 에만 저장한다 — 어떤 서버로도 전송하지 않는다.
 *
 * ⚠️ 이름·학번 등 학생을 특정할 수 있는 개인정보 필드는 이 상태에 절대 두지 않는다.
 *    (프로젝트 규칙: "학생 개인정보를 수집·저장하는 기능은 만들지 않는다")
 * ─────────────────────────────────────────────────────────────────────────────
 */

const STORAGE_KEY = 'data-report-state-v1';

/** 위저드 단계 순서. state.step 은 이 배열의 인덱스다. */
export const STEPS = ['intro', 'topic', 'collect', 'visualize', 'analyze', 'report'];

export const STEP_LABELS = {
  intro: '시작하기',
  topic: '문제 정의',
  collect: '데이터 수집',
  visualize: '데이터 시각화',
  analyze: '데이터 분석',
  report: '보고서',
};

/** 교과서(비상교육 중학 정보2, II.데이터 단원)의 "정리하기"에 나오는 수집 방법 */
export const COLLECTION_METHODS = [
  '설문조사', '관찰', '인터뷰', '센서로 측정', '공공데이터 사이트에서 다운로드', '기타',
];

export const CHART_TYPES = [
  { value: 'bar', label: '막대그래프', emoji: '📊', hint: '항목별 크기를 비교할 때 써요. (예: 메뉴별 평균 잔반량)' },
  { value: 'line', label: '꺾은선그래프', emoji: '📈', hint: '시간에 따라 어떻게 바뀌는지 볼 때 써요. (예: 연도별 물가 변화)' },
  { value: 'scatter', label: '산점도', emoji: '🔵', hint: '두 수치 사이에 관계(상관관계)가 있는지 볼 때 써요. (예: 배식량과 섭취량)' },
  { value: 'pie', label: '원그래프', emoji: '🥧', hint: '전체에서 각 항목이 차지하는 비율을 볼 때 써요. (예: 급식 메뉴 종류별 비율)' },
];

/** 막대그래프에서 같은 x값이 여러 번 나올 때 어떻게 합칠지 */
export const AGGREGATES = [
  { value: 'avg', label: '평균' },
  { value: 'sum', label: '합계' },
  { value: 'count', label: '개수' },
];

/** 데이터 의미 해석 단계의 가이드 질문 (교과서의 "데이터 의미 해석" 예시를 따랐다) */
export const ANALYSIS_QUESTIONS = [
  {
    key: 'q1',
    text: '그래프에서 가장 크게(많이) 나타난 것과 가장 작게(적게) 나타난 것은 무엇인가요?',
    hint: '표에서 가장 큰 값과 가장 작은 값을 찾아 항목 이름과 함께 적어 보세요. 예) "잔반율이 가장 높은 메뉴는 국/찌개류였다."',
  },
  {
    key: 'q2',
    text: '데이터 사이에서 어떤 관계나 규칙이 보이나요?',
    hint: '산점도라면 점들이 한쪽으로 몰려 올라가는지(양의 상관관계), 흩어져 있는지(관계 없음)를 살펴보세요. 막대·꺾은선그래프라면 어떤 항목이 꾸준히 높거나 낮은지, 시간이 지나며 늘어나는지 줄어드는지를 봐요.',
  },
  {
    key: 'q3',
    text: '왜 이런 결과가 나왔을지 이유를 생각해서 적어 보세요.',
    hint: '데이터만으로는 알 수 없는 "왜"를 자신의 경험이나 상식을 근거로 추측해 보는 단계예요. 정답은 없어요.',
  },
  {
    key: 'q4',
    text: '이 분석 결과를 바탕으로 어떤 주장을 하거나, 실생활 문제를 해결하는 데 어떻게 활용할 수 있을까요?',
    hint: '예) "잔반율이 높은 메뉴는 적게 배식해서 음식물 쓰레기를 줄이자고 건의할 수 있다." 처럼 데이터에 근거한 주장을 만들어 보세요.',
  },
];

/** 이 앱이 다루는 성취기준 (표시용) */
export const STANDARDS = [
  { code: '9정02-02', text: '문제 해결에 적합한 데이터를 수집하고, 목적에 맞게 구분하여 관리한다.' },
  { code: '9정02-03', text: '실생활의 데이터를 표, 다이어그램 등 다양한 형태로 구조화한다.' },
  { code: '9정02-04', text: '사례를 중심으로 데이터 간의 관계를 파악하고, 데이터에 기반하여 의미를 해석한다.' },
];

/** 문제 정의 단계에서 보여줄 예시 (교과서 실습 사례를 각색) */
export const TOPIC_EXAMPLES = [
  '우리 학교 급식 메뉴별 잔반량(잔반율)은 어떻게 다를까?',
  '최근 10년간 내가 좋아하는 음식의 물가는 얼마나 올랐을까?',
  '우리 반 친구들이 좋아하는 음악 장르는 무엇일까?',
  '요일별로 도서관 대출 권수는 어떻게 달라질까?',
];

export function createDefaultState() {
  return {
    step: 0,
    topic: { question: '' },
    collection: {
      methods: [],
      source: '',
      columns: [
        { name: '항목', type: 'text' },
        { name: '값', type: 'number' },
      ],
      rows: [
        ['', ''],
        ['', ''],
      ],
      // 어떤 열·행을 다음 단계로 넘길지 (columns/rows와 길이가 같은 boolean 배열).
      // 원본 표는 그대로 두고 "고른 것"만 따로 기억한다 → 되돌아와서 다시 고를 수 있다.
      // 3·4·5단계는 lib/select.js 의 applySelection()이 걸러 준 표만 본다.
      colSelected: [true, true],
      rowSelected: [true, true],
    },
    visualization: {
      chartType: 'bar',
      xColumn: '',
      yColumn: '',
      aggregate: 'avg',
    },
    analysis: {
      answers: { q1: '', q2: '', q3: '', q4: '' },
    },
  };
}

/** localStorage 에서 상태를 불러온다. 없거나 망가졌으면 기본값을 돌려준다. */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    // 예전 버전에서 저장된 값에 새 필드가 없을 수 있으니 기본값과 얕게 합친다.
    const base = createDefaultState();
    return {
      ...base,
      ...parsed,
      topic: { ...base.topic, ...(parsed.topic || {}) },
      collection: { ...base.collection, ...(parsed.collection || {}) },
      visualization: { ...base.visualization, ...(parsed.visualization || {}) },
      analysis: {
        ...base.analysis,
        ...(parsed.analysis || {}),
        answers: { ...base.analysis.answers, ...((parsed.analysis || {}).answers || {}) },
      },
    };
  } catch {
    return createDefaultState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 공간이 꽉 찬 경우 등 — 조용히 무시한다. 진행 자체는 메모리에 남아 있으므로 계속 쓸 수 있다.
  }
}

/** "처음부터 다시 하기" — 저장된 진행 내용을 지우고 기본값을 돌려준다. */
export function resetState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
  return createDefaultState();
}
