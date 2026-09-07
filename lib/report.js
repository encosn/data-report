/**
 * report.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 수집 → 시각화 → 분석 단계의 결과를 하나의 완전히 독립된 HTML 문서로 묶어
 * 인쇄하거나 제출할 수 있는 보고서를 만든다.
 * DOM을 쓰지 않는 buildReportHtml()은 순수 함수라 Node 테스트로 바로 검증할 수 있다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { ANALYSIS_QUESTIONS, STANDARDS } from './state.js';
import { escapeHtml } from './util.js';
import { applySelection } from './select.js';

/** 수집한 데이터를 <table> HTML로 만든다 (헤더 행 포함). 사용자 입력값은 모두 escapeHtml을 거친다. */
function buildTableHtml(columns, rows) {
  const cols = Array.isArray(columns) ? columns : [];
  const rws = Array.isArray(rows) ? rows : [];
  if (cols.length === 0) {
    return '<p class="report-empty">수집한 데이터가 없어요.</p>';
  }
  const thead = `<tr>${cols.map((c) => `<th>${escapeHtml(c && c.name)}</th>`).join('')}</tr>`;
  const tbody = rws
    .map((row) => {
      const cells = cols
        .map((_, i) => `<td>${escapeHtml(Array.isArray(row) ? row[i] : '')}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table class="report-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

/** 데이터 분석 문항과 학생 답변을 나란히 HTML로 만든다. */
function buildAnalysisHtml(analysis) {
  const answers = (analysis && analysis.answers) || {};
  return ANALYSIS_QUESTIONS.map((q) => {
    const raw = answers[q.key];
    const hasAnswer = raw !== undefined && raw !== null && String(raw).trim() !== '';
    const answerHtml = hasAnswer
      ? escapeHtml(raw)
      : '<span class="report-empty">(답변 없음)</span>';
    return `
      <div class="qa-block">
        <p class="qa-question">${escapeHtml(q.text)}</p>
        <p class="qa-answer">${answerHtml}</p>
      </div>`;
  }).join('');
}

/** 이 앱이 다루는 성취기준 목록을 HTML로 만든다. */
function buildStandardsHtml() {
  return `<ul class="standards-list">${STANDARDS.map(
    (s) => `<li><span class="standard-code">[${escapeHtml(s.code)}]</span> ${escapeHtml(s.text)}</li>`
  ).join('')}</ul>`;
}

/**
 * 완전히 독립된 보고서 HTML 문서를 문자열로 만들어 반환한다.
 * 다운로드한 파일 하나만으로 열려야 하므로 <style>을 인라인으로 포함하고
 * 외부 style.css는 링크하지 않는다.
 *
 * @param {object} state - createDefaultState()와 같은 모양의 전체 상태
 * @param {string|null} chartImageDataUrl - 'data:image/png;base64,...' 또는 그래프를 못 그렸으면 null
 * @param {{name?: string, studentId?: string}} [studentInfo] - 학번·이름. 이 값은 state에 들어있지
 *   않다(저장되지 않는다) — 보고서를 내려받는 그 순간에만 화면의 입력칸에서 읽어와 이 함수에 전달된다.
 * @returns {string} <!DOCTYPE html>부터 </html>까지의 전체 HTML 문서
 */
export function buildReportHtml(state, chartImageDataUrl, studentInfo) {
  const topic = (state && state.topic) || {};
  const collection = (state && state.collection) || {};
  const methods = Array.isArray(collection.methods) ? collection.methods : [];

  const methodsText = methods.length ? methods.map((m) => escapeHtml(m)).join(', ') : '(선택 안 함)';
  const sourceText =
    collection.source && String(collection.source).trim() !== ''
      ? escapeHtml(collection.source)
      : '(작성 안 함)';
  const questionText =
    topic.question && String(topic.question).trim() !== ''
      ? escapeHtml(topic.question)
      : '(작성 안 함)';

  // 보고서에도 2단계에서 체크한 열·행만 넣는다 (3·4단계 그래프와 같은 자료를 보여 주기 위함)
  const picked = applySelection(collection);
  const tableHtml = buildTableHtml(picked.columns, picked.rows);

  // chartImageDataUrl은 앱이 canvas에서 만든 data URL이므로 형식만 확인하고 그대로 쓴다(이스케이프 대상 아님).
  const chartHtml =
    typeof chartImageDataUrl === 'string' && chartImageDataUrl.startsWith('data:image')
      ? `<img class="report-chart-img" src="${chartImageDataUrl}" alt="데이터 그래프">`
      : '<p class="report-empty">그래프를 아직 그리지 않았어요.</p>';

  const analysisHtml = buildAnalysisHtml(state && state.analysis);
  const standardsHtml = buildStandardsHtml();

  const studentId = studentInfo && studentInfo.studentId ? String(studentInfo.studentId).trim() : '';
  const studentName = studentInfo && studentInfo.name ? String(studentInfo.name).trim() : '';
  const studentIdHtml = studentId
    ? `<span class="report-filled-line">${escapeHtml(studentId)}</span>`
    : '<span class="report-blank-line"></span>';
  const studentNameHtml = studentName
    ? `<span class="report-filled-line">${escapeHtml(studentName)}</span>`
    : '<span class="report-blank-line"></span>';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>데이터 탐구 수행평가 보고서</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
    font-size: 18px;
    line-height: 1.6;
    color: #222;
    max-width: 900px;
    margin: 0 auto;
    padding: 40px 24px 80px;
    background: #fff;
  }
  h1 {
    font-size: 30px;
    text-align: center;
    margin-bottom: 32px;
  }
  h2 {
    font-size: 22px;
    border-bottom: 3px solid #4a5df9;
    padding-bottom: 6px;
    margin-top: 0;
  }
  .report-section {
    margin-bottom: 36px;
  }
  .report-name-line {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    font-size: 18px;
  }
  .report-blank-line {
    display: inline-block;
    width: 200px;
    border-bottom: 1px solid #333;
    height: 1.4em;
  }
  .report-filled-line {
    display: inline-block;
    min-width: 80px;
    border-bottom: 1px solid #333;
    padding: 0 4px 2px;
    font-weight: bold;
  }
  .report-question {
    font-size: 20px;
    font-weight: bold;
    background: #f2f4ff;
    border-radius: 8px;
    padding: 14px 18px;
  }
  .report-empty {
    color: #888;
    font-style: normal;
  }
  .report-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
  }
  .report-table th, .report-table td {
    border: 1px solid #999;
    padding: 8px 10px;
    text-align: center;
  }
  .report-table th {
    background: #eef0ff;
  }
  .report-chart-wrap {
    text-align: center;
    margin-top: 12px;
  }
  .report-chart-img {
    max-width: 100%;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 8px;
  }
  .qa-block {
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px dashed #ccc;
  }
  .qa-block:last-child {
    border-bottom: none;
  }
  .qa-question {
    font-weight: bold;
    margin-bottom: 6px;
  }
  .qa-answer {
    margin: 0;
    white-space: pre-wrap;
  }
  .standards-list {
    padding-left: 20px;
  }
  .standards-list li {
    margin-bottom: 8px;
  }
  .standard-code {
    font-weight: bold;
    color: #4a5df9;
  }
  @media print {
    body { padding: 0 12px; }
  }
</style>
</head>
<body>
  <h1>데이터 탐구 수행평가 보고서</h1>

  <section class="report-section report-name-line">
    <span>학번:</span>${studentIdHtml}
    <span>이름:</span>${studentNameHtml}
  </section>

  <section class="report-section">
    <h2>1. 탐구 질문</h2>
    <p class="report-question">${questionText}</p>
  </section>

  <section class="report-section">
    <h2>2. 데이터 수집</h2>
    <p><strong>수집 방법:</strong> ${methodsText}</p>
    <p><strong>출처:</strong> ${sourceText}</p>
  </section>

  <section class="report-section">
    <h2>3. 수집한 데이터</h2>
    ${tableHtml}
  </section>

  <section class="report-section">
    <h2>4. 데이터 시각화</h2>
    <div class="report-chart-wrap">${chartHtml}</div>
  </section>

  <section class="report-section">
    <h2>5. 데이터 분석</h2>
    ${analysisHtml}
  </section>

  <section class="report-section">
    <h2>6. 관련 성취기준</h2>
    ${standardsHtml}
  </section>
</body>
</html>`;
}

/**
 * 보고서 HTML 문자열을 파일로 다운로드한다 (브라우저 전용 API 사용).
 * @param {string} html - buildReportHtml()이 만든 HTML 문자열
 * @param {string} [filename='데이터탐구_보고서.html']
 */
export function downloadReportHtml(html, filename = '데이터탐구_보고서.html') {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
