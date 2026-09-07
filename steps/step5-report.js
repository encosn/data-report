/**
 * step5-report.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 5단계 · 보고서 확인 및 제출.
 * 지금까지 입력한 내용(문제 정의 → 데이터 수집 → 시각화 → 분석)을 한 화면에
 * 미리보기로 모아 보여주고, HTML 보고서 파일 저장 / 인쇄(PDF) / 구글 클래스룸
 * 열기 / 처음부터 다시 하기를 제공한다. 이 단계에서는 상태를 새로 바꾸지 않는다
 * (마지막 단계이므로 확인·제출용 화면).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { STANDARDS, ANALYSIS_QUESTIONS } from '../lib/state.js';
import { escapeHtml, isBlank } from '../lib/util.js';
import { buildChartConfig, renderChart } from '../lib/chart.js';
import { buildReportHtml, downloadReportHtml } from '../lib/report.js';
import { applySelection } from '../lib/select.js';

export function render(container, ctx) {
  const { state } = ctx;
  const topic = state.topic || {};
  const rawCollection = state.collection || {};
  // 2단계에서 체크한 열·행만 보고서에 넣는다. (methods/source는 걸러지지 않으므로 원본에서 읽는다)
  const picked = applySelection(rawCollection);
  const collection = { ...rawCollection, columns: picked.columns, rows: picked.rows };
  const visualization = state.visualization || {};
  const analysis = state.analysis || {};

  const methods = Array.isArray(collection.methods) ? collection.methods : [];
  const columns = Array.isArray(collection.columns) ? collection.columns : [];
  const rows = Array.isArray(collection.rows) ? collection.rows : [];

  const questionText = isBlank(topic.question) ? '(작성 안 함)' : escapeHtml(topic.question);
  const methodsText = methods.length ? methods.map((m) => escapeHtml(m)).join(', ') : '(선택 안 함)';
  const sourceText = isBlank(collection.source) ? '(작성 안 함)' : escapeHtml(collection.source);

  // 수집한 데이터 표 미리보기
  const tableHtml = columns.length === 0
    ? '<p class="step-desc">수집한 데이터가 없어요.</p>'
    : `<div class="table-wrap"><table class="data-grid">
        <thead><tr>${columns.map((c) => `<th>${escapeHtml(c && c.name)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${columns
          .map((_, i) => `<td>${escapeHtml(Array.isArray(row) ? row[i] : '')}</td>`)
          .join('')}</tr>`).join('')}</tbody>
      </table></div>`;

  // 데이터 분석 문항 + 학생 답변
  const analysisHtml = ANALYSIS_QUESTIONS.map((q) => {
    const raw = analysis.answers && analysis.answers[q.key];
    const answerHtml = isBlank(raw)
      ? '<span style="color:var(--color-text-soft);">(답변 없음)</span>'
      : escapeHtml(raw);
    return `<div class="report-section">
        <p><strong>${escapeHtml(q.text)}</strong></p>
        <p style="white-space:pre-wrap;">${answerHtml}</p>
      </div>`;
  }).join('');

  // 관련 성취기준 배지
  const standardsHtml = `<div class="badge-row">${STANDARDS
    .map((s) => `<span class="badge">[${escapeHtml(s.code)}] ${escapeHtml(s.text)}</span>`)
    .join('')}</div>`;

  container.innerHTML = `
    <div class="card">
      <div class="step-title">5단계 · 보고서 확인 및 제출</div>
      <p class="step-desc">지금까지 정리한 탐구 질문, 수집한 데이터, 그래프, 분석 내용을 한 번에 확인하고
        보고서 파일로 저장해 제출하세요.</p>

      <div class="report-section" style="display:flex; gap:24px; justify-content:flex-end; align-items:center; flex-wrap:wrap;">
        <label style="display:flex; align-items:center; gap:8px; font-size:18px;">
          학번:
          <input type="text" id="studentIdInput" placeholder="예: 10203"
            style="width:110px; border:none; border-bottom:2px solid var(--color-text-soft); background:transparent; font-size:18px; padding:4px; font-family:inherit;">
        </label>
        <label style="display:flex; align-items:center; gap:8px; font-size:18px;">
          이름:
          <input type="text" id="studentNameInput" placeholder="이름"
            style="width:140px; border:none; border-bottom:2px solid var(--color-text-soft); background:transparent; font-size:18px; padding:4px; font-family:inherit;">
        </label>
      </div>
      <p class="step-desc no-print" style="text-align:right; font-size:14px; margin-top:-8px;">
        ⚠️ 학번·이름은 저장되지 않아요. 새로고침하면 다시 입력해야 해요 — 보고서를 저장하거나 인쇄하기 직전에 적어 주세요.
      </p>

      <div class="report-section">
        <h3>1. 탐구 질문</h3>
        <p>${questionText}</p>
      </div>

      <div class="report-section">
        <h3>2. 데이터 수집</h3>
        <p><strong>수집 방법:</strong> ${methodsText}</p>
        <p><strong>출처:</strong> ${sourceText}</p>
      </div>

      <div class="report-section">
        <h3>3. 수집한 데이터</h3>
        ${tableHtml}
      </div>

      <div class="report-section">
        <h3>4. 데이터 시각화</h3>
        <div class="chart-wrap">
          <canvas id="reportChartCanvas"></canvas>
          <p id="chartErrorMsg" class="warn-box" style="display:none;"></p>
        </div>
      </div>

      <div class="report-section">
        <h3>5. 데이터 분석</h3>
        ${analysisHtml}
      </div>

      <div class="report-section">
        <h3>6. 관련 성취기준</h3>
        ${standardsHtml}
      </div>
    </div>

    <div class="card no-print">
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="saveReportBtn">보고서 파일로 저장</button>
        <button type="button" class="btn btn-secondary" id="printReportBtn">인쇄하기 (PDF로 저장)</button>
      </div>
      <div class="btn-row" style="margin-top:16px; align-items:center;">
        <div>
          <button type="button" class="btn btn-outline" id="classroomBtn">구글 클래스룸 열기</button>
          <p class="step-desc" style="margin:10px 0 0; font-size:16px;">내려받은 보고서 파일을 과제 제출 화면에서 첨부해 제출하세요.</p>
        </div>
        <button type="button" class="btn btn-danger" id="resetAllBtn">처음부터 다시 하기</button>
      </div>
    </div>

    <div class="btn-row no-print">
      <button type="button" class="btn btn-outline" id="prevStepBtn">이전</button>
    </div>
  `;

  // 그래프 다시 그리기 (3단계와 같은 visualization 설정을 그대로 사용)
  const canvas = container.querySelector('#reportChartCanvas');
  const errorMsg = container.querySelector('#chartErrorMsg');
  const chartConfig = buildChartConfig(collection, visualization);
  let chartRendered = false;

  if (chartConfig.error) {
    canvas.style.display = 'none';
    errorMsg.textContent = chartConfig.error;
    errorMsg.style.display = 'block';
  } else {
    renderChart(canvas, chartConfig);
    chartRendered = true;
  }

  container.querySelector('#saveReportBtn').addEventListener('click', () => {
    const dataUrl = chartRendered ? canvas.toDataURL('image/png') : null;
    const studentInfo = {
      studentId: container.querySelector('#studentIdInput').value,
      name: container.querySelector('#studentNameInput').value,
    };
    const html = buildReportHtml(ctx.state, dataUrl, studentInfo);
    downloadReportHtml(html);
  });

  container.querySelector('#printReportBtn').addEventListener('click', () => {
    window.print();
  });

  container.querySelector('#classroomBtn').addEventListener('click', () => {
    window.open('https://classroom.google.com', '_blank');
  });

  container.querySelector('#resetAllBtn').addEventListener('click', () => {
    ctx.resetAll();
  });

  container.querySelector('#prevStepBtn').addEventListener('click', () => {
    ctx.goBack();
  });
}
