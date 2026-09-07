/**
 * main.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 위저드 전체를 조립하는 파일. 진행 표시줄을 그리고, 현재 단계에 맞는
 * steps/*.js 모듈의 render() 를 호출한다. 각 단계 모듈은 서로를 모르며,
 * 오직 이 파일이 넘겨주는 ctx(state, update, goNext, goBack, goToStep)를 통해서만
 * 상태를 읽고 바꾼다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { loadState, saveState, resetState, STEPS, STEP_LABELS } from './lib/state.js';

import { render as renderIntro } from './steps/step0-intro.js';
import { render as renderTopic } from './steps/step1-topic.js';
import { render as renderCollect } from './steps/step2-collect.js';
import { render as renderVisualize } from './steps/step3-visualize.js';
import { render as renderAnalyze } from './steps/step4-analyze.js';
import { render as renderReport } from './steps/step5-report.js';

const STEP_RENDERERS = [renderIntro, renderTopic, renderCollect, renderVisualize, renderAnalyze, renderReport];

let state = loadState();
const appEl = document.getElementById('app');

/** 얕은 재귀 병합. 배열은 병합하지 않고 통째로 교체한다(호출하는 쪽이 새 배열을 넘긴다). */
function deepMerge(base, patch) {
  const out = { ...base };
  for (const key of Object.keys(patch)) {
    const pv = patch[key];
    const bv = base[key];
    const bothPlainObjects =
      pv && typeof pv === 'object' && !Array.isArray(pv) &&
      bv && typeof bv === 'object' && !Array.isArray(bv);
    out[key] = bothPlainObjects ? deepMerge(bv, pv) : pv;
  }
  return out;
}

function update(patch) {
  state = deepMerge(state, patch);
  saveState(state);
  renderAll();
}

function goNext() {
  if (state.step >= STEPS.length - 1) return;
  state = { ...state, step: state.step + 1 };
  saveState(state);
  renderAll();
  window.scrollTo(0, 0);
}

function goBack() {
  if (state.step <= 0) return;
  state = { ...state, step: state.step - 1 };
  saveState(state);
  renderAll();
  window.scrollTo(0, 0);
}

/** 진행 표시줄이나 "이전 단계 다시 보기" 용 — 이미 지나온 단계로만 이동을 허용한다. */
function goToStep(n) {
  if (n < 0 || n > state.step) return;
  state = { ...state, step: n };
  saveState(state);
  renderAll();
  window.scrollTo(0, 0);
}

function resetAll() {
  const ok = window.confirm('처음부터 다시 시작할까요? 지금까지 입력한 내용이 모두 사라져요.');
  if (!ok) return;
  state = resetState();
  renderAll();
  window.scrollTo(0, 0);
}

function buildProgressBar() {
  const bar = document.createElement('div');
  bar.className = 'progress-bar no-print';
  STEPS.forEach((key, i) => {
    const cell = document.createElement('div');
    cell.className = 'progress-step' +
      (i < state.step ? ' is-done' : '') +
      (i === state.step ? ' is-current' : '');
    cell.textContent = `${i + 1}. ${STEP_LABELS[key]}`;
    if (i < state.step) {
      cell.addEventListener('click', () => goToStep(i));
    }
    bar.appendChild(cell);
  });
  return bar;
}

function renderAll() {
  appEl.innerHTML = '';
  appEl.appendChild(buildProgressBar());

  const container = document.createElement('div');
  appEl.appendChild(container);

  const ctx = { state, update, goNext, goBack, goToStep, resetAll };
  STEP_RENDERERS[state.step](container, ctx);
}

renderAll();
