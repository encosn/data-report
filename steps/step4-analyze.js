/**
 * step4-analyze.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 4단계 · 데이터 분석
 * 3단계에서 만든 그래프를 작게 다시 보여주고, 그 그래프를 보면서 4개의 가이드
 * 질문(ANALYSIS_QUESTIONS)에 답을 쓰게 한다. 답변은 "다음" 버튼을 누를 때
 * 한 번에 state 에 반영한다(입력 중 매 keystroke 마다 ctx.update 를 부르지 않음).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { ANALYSIS_QUESTIONS } from '../lib/state.js';
import { buildChartConfig, renderChart } from '../lib/chart.js';
import { applySelection } from '../lib/select.js';

const MIN_ANSWER_LENGTH = 5;

export function render(container, ctx) {
  const { state } = ctx;

  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'card';

  const title = document.createElement('div');
  title.className = 'step-title';
  title.textContent = '4단계 · 데이터 분석';
  card.appendChild(title);

  const desc = document.createElement('div');
  desc.className = 'step-desc';
  desc.textContent = '그래프를 보면서 아래 질문에 답해 보세요. 데이터가 말해 주는 것을 읽어내는 것이 데이터 분석의 핵심이에요.';
  card.appendChild(desc);

  // ── 참고용 그래프(작게 다시 그리기) ──────────────────────────────────
  const chartWrap = document.createElement('div');
  chartWrap.className = 'chart-wrap';
  chartWrap.style.maxWidth = '480px';
  chartWrap.style.margin = '0 auto 20px';
  card.appendChild(chartWrap);

  // 2단계에서 체크한 열·행만 쓴다
  const config = buildChartConfig(applySelection(state.collection), state.visualization);
  if (config && config.error) {
    const errMsg = document.createElement('p');
    errMsg.style.margin = '0';
    errMsg.style.color = 'var(--color-text-soft)';
    errMsg.textContent = `그래프를 표시할 수 없어요: ${config.error}`;
    chartWrap.appendChild(errMsg);
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 220;
    chartWrap.appendChild(canvas);
    renderChart(canvas, config);
  }

  // ── 질문 4개 ─────────────────────────────────────────────────────────
  const textareas = {};

  ANALYSIS_QUESTIONS.forEach((q, idx) => {
    const section = document.createElement('div');
    section.style.marginBottom = idx === ANALYSIS_QUESTIONS.length - 1 ? '0' : '24px';

    const label = document.createElement('label');
    label.className = 'field-label';
    label.textContent = `${idx + 1}. ${q.text}`;
    label.htmlFor = `analyze-${q.key}`;
    section.appendChild(label);

    const textarea = document.createElement('textarea');
    textarea.id = `analyze-${q.key}`;
    textarea.value = (state.analysis.answers && state.analysis.answers[q.key]) || '';
    section.appendChild(textarea);
    textareas[q.key] = textarea;

    // 힌트 보기/닫기 토글 — 로컬 UI 상태일 뿐이라 ctx.update 를 부르지 않는다.
    const hintToggle = document.createElement('button');
    hintToggle.type = 'button';
    hintToggle.className = 'hint-toggle';
    hintToggle.textContent = '힌트 보기';
    section.appendChild(hintToggle);

    const hintBox = document.createElement('div');
    hintBox.className = 'hint-box';
    hintBox.textContent = q.hint;
    hintBox.style.display = 'none';
    section.appendChild(hintBox);

    hintToggle.addEventListener('click', () => {
      const showing = hintBox.style.display !== 'none';
      hintBox.style.display = showing ? 'none' : 'block';
      hintToggle.textContent = showing ? '힌트 보기' : '힌트 닫기';
    });

    // 가벼운 UI 갱신(다음 버튼 활성/비활성)만 여기서 처리하고, state 반영은 하지 않는다.
    textarea.addEventListener('input', updateNextButtonState);

    card.appendChild(section);
  });

  // ── 이전/다음 버튼 ────────────────────────────────────────────────────
  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'btn btn-secondary';
  backBtn.textContent = '이전';
  backBtn.addEventListener('click', () => {
    ctx.update({ analysis: { answers: collectAnswers() } });
    ctx.goBack();
  });

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'btn btn-primary';
  nextBtn.textContent = '다음';
  nextBtn.addEventListener('click', () => {
    const missingNums = findMissingQuestionNumbers();
    if (missingNums.length > 0) {
      validationMsg.textContent = `⚠️ ${missingNums.join(', ')}번 질문에 답을 ${MIN_ANSWER_LENGTH}자 이상 더 자세히 적어 주세요.`;
      validationMsg.hidden = false;
      validationMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    validationMsg.hidden = true;
    ctx.update({ analysis: { answers: collectAnswers() } });
    ctx.goNext();
  });

  btnRow.appendChild(backBtn);
  btnRow.appendChild(nextBtn);

  const validationMsg = document.createElement('div');
  validationMsg.className = 'warn-box';
  validationMsg.hidden = true;
  card.appendChild(validationMsg);
  card.appendChild(btnRow);

  container.appendChild(card);

  function collectAnswers() {
    const answers = {};
    ANALYSIS_QUESTIONS.forEach((q) => {
      answers[q.key] = textareas[q.key].value;
    });
    return answers;
  }

  function findMissingQuestionNumbers() {
    const nums = [];
    ANALYSIS_QUESTIONS.forEach((q, idx) => {
      if (textareas[q.key].value.trim().length < MIN_ANSWER_LENGTH) nums.push(idx + 1);
    });
    return nums;
  }

  function updateNextButtonState() {
    const missingNums = findMissingQuestionNumbers();
    nextBtn.classList.toggle('btn-pending', missingNums.length > 0);
    if (missingNums.length === 0) validationMsg.hidden = true;
  }

  updateNextButtonState();
}
