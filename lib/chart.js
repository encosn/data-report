/**
 * chart.js
 * ─────────────────────────────────────────────────────────────────────────────
 * "데이터 시각화" 단계에서 쓰는 그래프 관련 함수 모음.
 * - buildChartConfig(): 수집한 표 데이터(state.collection)와 시각화 설정(state.visualization)을
 *   보고 Chart.js 생성자에 그대로 넣을 수 있는 순수 설정 객체를 만든다. DOM을 쓰지 않으므로
 *   Node 테스트에서도 그대로 가져다 쓸 수 있다.
 * - renderChart(): 실제 <canvas> 에 Chart.js로 그린다(DOM이 있어야 동작).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Chart, registerables } from 'chart.js';
import { looksNumeric, toNumber, isBlank, sum, average } from './util.js';

Chart.register(...registerables);

// 앱 팀 색상(#12b886, hub 메인페이지의 "데이터" 영역 색)을 기준으로 한 카테고리 색상 팔레트.
// 팔레트 검증(dataviz 스킬의 validate_palette.js)을 통과한 4색 조합 — 카테고리(pie)처럼
// 색이 여러 개 필요할 때 이 순서대로 순환해서 쓴다.
const PALETTE = ['#12b886', '#2a78d6', '#eb6834', '#4a3aa7'];

function colorAt(i) {
  return PALETTE[i % PALETTE.length];
}

function colIndex(columns, name) {
  return (columns || []).findIndex((c) => c.name === name);
}

function baseOptions() {
  return {
    responsive: true,
    plugins: {
      legend: { display: true, position: 'bottom' },
    },
  };
}

/**
 * 수집한 표 데이터(collection)와 시각화 설정(viz)을 보고
 * new Chart() 에 그대로 넣을 수 있는 설정 객체를 만든다.
 * 필요한 값이 없거나 그릴 데이터가 하나도 없으면 { error: '한국어 메시지' } 를 돌려준다.
 */
export function buildChartConfig(collection, viz) {
  const columns = (collection && collection.columns) || [];
  const rows = (collection && collection.rows) || [];
  const chartType = viz && viz.chartType;
  const xColumn = viz && viz.xColumn;
  const yColumn = viz && viz.yColumn;
  const aggregate = (viz && viz.aggregate) || 'avg';

  // 원그래프는 분류할 열(xColumn) 하나만 있으면 된다.
  if (chartType === 'pie') {
    if (isBlank(xColumn)) return { error: '분류할 열을 골라 주세요.' };
    const xIdx = colIndex(columns, xColumn);
    if (xIdx === -1) return { error: '분류할 열을 골라 주세요.' };

    const order = [];
    const counts = new Map();
    for (const row of rows) {
      const v = row[xIdx];
      if (isBlank(v)) continue;
      if (!counts.has(v)) { counts.set(v, 0); order.push(v); }
      counts.set(v, counts.get(v) + 1);
    }
    if (order.length === 0) return { error: '그래프를 그릴 데이터가 없어요.' };

    return {
      type: 'pie',
      data: {
        labels: order,
        datasets: [{
          label: xColumn,
          data: order.map((label) => counts.get(label)),
          backgroundColor: order.map((_, i) => colorAt(i)),
        }],
      },
      options: baseOptions(),
    };
  }

  // 막대·꺾은선·산점도는 모두 가로축(xColumn)이 필요하다.
  if (isBlank(xColumn)) return { error: '가로축으로 쓸 열을 골라 주세요.' };
  const xIdx = colIndex(columns, xColumn);
  if (xIdx === -1) return { error: '가로축으로 쓸 열을 골라 주세요.' };

  if (chartType === 'scatter') {
    if (isBlank(yColumn)) return { error: '세로축으로 쓸 수치형 열을 골라 주세요.' };
    const yIdx = colIndex(columns, yColumn);
    if (yIdx === -1) return { error: '세로축으로 쓸 수치형 열을 골라 주세요.' };

    const points = [];
    for (const row of rows) {
      const xv = row[xIdx];
      const yv = row[yIdx];
      if (!looksNumeric(xv) || !looksNumeric(yv)) continue; // 숫자가 아닌 값이 섞인 행은 건너뛴다
      points.push({ x: toNumber(xv), y: toNumber(yv) });
    }
    if (points.length === 0) return { error: '가로축과 세로축이 모두 숫자인 데이터가 없어요.' };

    return {
      type: 'scatter',
      data: {
        datasets: [{
          label: `${xColumn} / ${yColumn}`,
          data: points,
          backgroundColor: colorAt(0),
        }],
      },
      options: baseOptions(),
    };
  }

  // 막대·꺾은선은 세로축(yColumn, 수치형)도 필요하다.
  if (isBlank(yColumn)) return { error: '세로축으로 쓸 수치형 열을 골라 주세요.' };
  const yIdx = colIndex(columns, yColumn);
  if (yIdx === -1) return { error: '세로축으로 쓸 수치형 열을 골라 주세요.' };

  if (chartType === 'line') {
    const labels = [];
    const data = [];
    for (const row of rows) {
      const xv = row[xIdx];
      const yv = row[yIdx];
      if (isBlank(xv) || !looksNumeric(yv)) continue;
      labels.push(xv);
      data.push(toNumber(yv));
    }
    if (data.length === 0) return { error: '그래프를 그릴 수 있는 데이터가 없어요.' };

    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: yColumn,
          data,
          borderColor: colorAt(0),
          backgroundColor: colorAt(0),
          fill: false,
        }],
      },
      options: baseOptions(),
    };
  }

  // 기본값: 막대그래프. 같은 x값이 여러 번 나오면 aggregate(평균/합계/개수)로 하나로 합친다.
  const order = [];
  if (aggregate === 'count') {
    const counts = new Map();
    for (const row of rows) {
      const xv = row[xIdx];
      if (isBlank(xv)) continue;
      if (!counts.has(xv)) { counts.set(xv, 0); order.push(xv); }
      counts.set(xv, counts.get(xv) + 1);
    }
    if (order.length === 0) return { error: '그래프를 그릴 데이터가 없어요.' };

    return {
      type: 'bar',
      data: {
        labels: order,
        datasets: [{
          label: `${xColumn}별 개수`,
          data: order.map((label) => counts.get(label)),
          backgroundColor: colorAt(0),
        }],
      },
      options: baseOptions(),
    };
  }

  const groups = new Map(); // x값 -> 그 x값에 속한 수치 배열
  for (const row of rows) {
    const xv = row[xIdx];
    const yv = row[yIdx];
    if (isBlank(xv) || !looksNumeric(yv)) continue;
    if (!groups.has(xv)) { groups.set(xv, []); order.push(xv); }
    groups.get(xv).push(toNumber(yv));
  }
  if (order.length === 0) return { error: '그래프를 그릴 수 있는 데이터가 없어요.' };

  const aggLabel = aggregate === 'sum' ? '합계' : '평균';
  return {
    type: 'bar',
    data: {
      labels: order,
      datasets: [{
        label: `${yColumn} (${aggLabel})`,
        data: order.map((label) => {
          const nums = groups.get(label);
          return aggregate === 'sum' ? sum(nums) : average(nums);
        }),
        backgroundColor: colorAt(0),
      }],
    },
    options: baseOptions(),
  };
}

/**
 * canvas 엘리먼트에 config 를 그린다. config 에 error 가 있으면 그리지 않고 null을 돌려준다
 * (호출하는 쪽에서 error 메시지를 화면에 보여주면 된다).
 * 같은 canvas에 이미 그려진 그래프가 있으면 지우고 새로 그린다.
 */
export function renderChart(canvas, config) {
  if (!config || config.error) return null;

  if (canvas.__chartInstance) {
    canvas.__chartInstance.destroy();
    canvas.__chartInstance = null;
  }

  const chart = new Chart(canvas, config);
  canvas.__chartInstance = chart;
  return chart;
}
