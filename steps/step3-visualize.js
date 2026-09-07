/**
 * step3-visualize.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 3단계 · 데이터 시각화
 * 앞 단계에서 모은 표 데이터를 훑어보고, 그래프 종류·가로축·세로축·집계 방식을
 * 고르면 ../lib/chart.js 로 Chart.js 그래프를 그린다. 이 파일은 상태를 직접
 * 계산하지 않고 chart.js의 buildChartConfig()/renderChart()에 맡긴다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { CHART_TYPES, AGGREGATES } from '../lib/state.js';
import { buildChartConfig, renderChart } from '../lib/chart.js';
import { applySelection } from '../lib/select.js';

export function render(container, ctx) {
  const { state, update, goBack, goNext } = ctx;
  // 2단계에서 체크한 열·행만 쓴다 (원본 표는 state.collection에 그대로 남아 있다)
  const collection = applySelection(state.collection);
  const viz = state.visualization;
  const columns = collection.columns || [];
  const numberColumns = columns.filter((c) => c.type === 'number');

  container.innerHTML = `
    <style>
      /* 이 파일 전용 레이아웃 보조 클래스 (기존 클래스와 겹치지 않게 viz3- 접두어) */
      .viz3-row { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 20px; }
      .viz3-field { flex: 1; min-width: 220px; }
      .viz3-section-title { margin-top: 24px; }
    </style>
    <div class="card">
      <div class="step-title">3단계 · 데이터 시각화</div>
      <p class="step-desc">모은 데이터를 그래프로 그려 봐요. 그래프 종류를 고르고 가로축·세로축에 놓을 열을 정하면 아래에 그래프가 바로 그려져요.</p>

      <h3>수집한 데이터</h3>
      <div class="table-wrap" id="preview-table-wrap"></div>

      <h3 class="viz3-section-title">그래프 종류 고르기</h3>
      <div class="chip-group" id="chart-type-chips"></div>
      <div class="hint-box" id="chart-type-hint"></div>

      <div class="viz3-row">
        <div class="viz3-field">
          <label class="field-label" id="x-col-label" for="x-col-select">가로축 열</label>
          <select id="x-col-select"></select>
        </div>
        <div class="viz3-field" id="y-col-wrap">
          <label class="field-label" for="y-col-select">세로축(수치) 열</label>
          <select id="y-col-select"></select>
        </div>
      </div>
      <div class="warn-box" id="pie-notice" style="display:none;">
        원그래프는 분류할 열 하나만 고르면 돼요. 고른 열의 값이 같은 것끼리 묶어서 비율을 보여줘요.
      </div>

      <div class="viz3-field" id="aggregate-wrap" style="margin-top:16px;">
        <label class="field-label" for="aggregate-select">같은 항목의 값이 여러 개면?</label>
        <select id="aggregate-select"></select>
      </div>

      <div class="chart-wrap" id="chart-wrap">
        <canvas id="chart-canvas"></canvas>
      </div>
      <div class="warn-box" id="chart-error" style="display:none;"></div>

      <div class="btn-row">
        <button type="button" class="btn btn-outline" id="btn-prev">이전</button>
        <button type="button" class="btn btn-primary" id="btn-next">다음</button>
      </div>
    </div>
  `;

  // 표 미리 보기 — 읽기 전용(input 없이 텍스트만). 사용자가 입력한 값을 innerHTML에
  // 직접 넣지 않고 DOM을 만들어 textContent로 채워 XSS를 막는다.
  container.querySelector('#preview-table-wrap').appendChild(buildPreviewTable(collection));

  // 그래프 종류 chip — 하나만 선택되는 라디오처럼 동작.
  const chipGroup = container.querySelector('#chart-type-chips');
  const hintBox = container.querySelector('#chart-type-hint');
  CHART_TYPES.forEach((ct) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (viz.chartType === ct.value ? ' is-selected' : '');
    chip.textContent = `${ct.emoji} ${ct.label}`;
    chip.addEventListener('click', () => {
      update({ visualization: { chartType: ct.value } });
    });
    chipGroup.appendChild(chip);
  });
  const currentType = CHART_TYPES.find((ct) => ct.value === viz.chartType) || CHART_TYPES[0];
  hintBox.textContent = currentType.hint;

  // 가로축 select — 산점도는 두 축 모두 수치형이어야 하므로 수치형 열만 보여준다.
  const xSelect = container.querySelector('#x-col-select');
  const xLabel = container.querySelector('#x-col-label');
  const isScatter = viz.chartType === 'scatter';
  xLabel.textContent = isScatter ? '가로축(수치) 열' : '가로축(분류) 열';
  fillColumnSelect(xSelect, isScatter ? numberColumns : columns, viz.xColumn);
  xSelect.addEventListener('change', () => {
    update({ visualization: { xColumn: xSelect.value } });
  });

  // 세로축 select — 항상 수치형 열만. 원그래프는 세로축이 필요 없어 통째로 숨긴다.
  const yWrap = container.querySelector('#y-col-wrap');
  const ySelect = container.querySelector('#y-col-select');
  const pieNotice = container.querySelector('#pie-notice');
  const isPie = viz.chartType === 'pie';
  if (isPie) {
    yWrap.style.display = 'none';
    pieNotice.style.display = 'block';
  } else {
    yWrap.style.display = '';
    pieNotice.style.display = 'none';
    fillColumnSelect(ySelect, numberColumns, viz.yColumn);
    ySelect.addEventListener('change', () => {
      update({ visualization: { yColumn: ySelect.value } });
    });
  }

  // 집계 방식 select — 막대그래프일 때만 보여준다.
  const aggWrap = container.querySelector('#aggregate-wrap');
  if (viz.chartType === 'bar') {
    aggWrap.style.display = '';
    const aggSelect = container.querySelector('#aggregate-select');
    AGGREGATES.forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a.value;
      opt.textContent = a.label;
      if (a.value === viz.aggregate) opt.selected = true;
      aggSelect.appendChild(opt);
    });
    aggSelect.addEventListener('change', () => {
      update({ visualization: { aggregate: aggSelect.value } });
    });
  } else {
    aggWrap.style.display = 'none';
  }

  // 그래프 그리기 — 렌더될 때마다 현재 상태로 다시 계산해서 그린다.
  const chartWrap = container.querySelector('#chart-wrap');
  const errorBox = container.querySelector('#chart-error');
  const canvas = container.querySelector('#chart-canvas');
  const config = buildChartConfig(collection, viz);
  const nextBtn = container.querySelector('#btn-next');

  if (config.error) {
    chartWrap.style.display = 'none';
    errorBox.style.display = 'block';
    errorBox.textContent = config.error;
    nextBtn.classList.add('btn-pending');
  } else {
    chartWrap.style.display = '';
    errorBox.style.display = 'none';
    renderChart(canvas, config);
    nextBtn.classList.remove('btn-pending');
  }

  container.querySelector('#btn-prev').addEventListener('click', () => goBack());
  nextBtn.addEventListener('click', () => {
    if (config.error) {
      errorBox.style.display = 'block';
      errorBox.textContent = '⚠️ ' + config.error;
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    goNext();
  });
}

/** 열 목록으로 <select> 옵션을 채운다. 고를 열이 없으면 안내 문구만 넣고 비활성화한다. */
function fillColumnSelect(selectEl, cols, currentValue) {
  selectEl.innerHTML = '';

  if (!cols || cols.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '(고를 수 있는 열이 없어요)';
    selectEl.appendChild(opt);
    selectEl.disabled = true;
    return;
  }

  selectEl.disabled = false;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '선택하세요';
  selectEl.appendChild(placeholder);

  let matched = false;
  cols.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    if (c.name === currentValue) {
      opt.selected = true;
      matched = true;
    }
    selectEl.appendChild(opt);
  });
  if (!matched) placeholder.selected = true;
}

/** 수집한 표를 읽기 전용(<table class="data-grid">)으로 만든다. input은 두지 않는다. */
function buildPreviewTable(collection) {
  const columns = collection.columns || [];
  const rows = collection.rows || [];

  const table = document.createElement('table');
  table.className = 'data-grid';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  columns.forEach((c) => {
    const th = document.createElement('th');
    th.textContent = c.name;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    row.forEach((cell) => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  return table;
}
