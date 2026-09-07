import { buildChartConfig } from '../lib/chart.js';

let pass = 0, fail = 0;
function check(label, ok, got, want) {
  if (ok) { pass++; console.log(`   OK   ${label}`); }
  else { fail++; console.log(`   FAIL ${label}\n        기대: ${JSON.stringify(want)}\n        실제: ${JSON.stringify(got)}`); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n【chart.js】');

// (1) bar + aggregate='avg' — 같은 x값이 여러 번 나올 때 평균이 맞게 계산되는지
{
  const collection = {
    columns: [{ name: '메뉴', type: 'text' }, { name: '잔반량', type: 'number' }],
    rows: [
      ['김치찌개', '10'],
      ['김치찌개', '20'],
      ['불고기', '5'],
    ],
  };
  const viz = { chartType: 'bar', xColumn: '메뉴', yColumn: '잔반량', aggregate: 'avg' };
  const cfg = buildChartConfig(collection, viz);

  check('bar avg: 라벨 순서(처음 등장 순)', eq(cfg.data && cfg.data.labels, ['김치찌개', '불고기']),
    cfg.data && cfg.data.labels, ['김치찌개', '불고기']);
  check('bar avg: 김치찌개 평균 15', cfg.data && cfg.data.datasets[0].data[0] === 15,
    cfg.data && cfg.data.datasets[0].data, [15, 5]);
  check('bar avg: 불고기 평균 5', cfg.data && cfg.data.datasets[0].data[1] === 5,
    cfg.data && cfg.data.datasets[0].data, [15, 5]);
  check('bar avg: type이 bar', cfg.type === 'bar', cfg.type, 'bar');
}

// (2) bar + aggregate='count' 동작
{
  const collection = {
    columns: [{ name: '메뉴', type: 'text' }, { name: '잔반량', type: 'number' }],
    rows: [
      ['김치찌개', '10'],
      ['김치찌개', '20'],
      ['불고기', '5'],
      ['불고기', ''], // yColumn이 비어 있어도 count에서는 상관없다
    ],
  };
  const viz = { chartType: 'bar', xColumn: '메뉴', yColumn: '잔반량', aggregate: 'count' };
  const cfg = buildChartConfig(collection, viz);

  check('bar count: 라벨', eq(cfg.data && cfg.data.labels, ['김치찌개', '불고기']),
    cfg.data && cfg.data.labels, ['김치찌개', '불고기']);
  check('bar count: 개수', eq(cfg.data && cfg.data.datasets[0].data, [2, 2]),
    cfg.data && cfg.data.datasets[0].data, [2, 2]);
}

// (3) scatter에서 x/y 둘 다 숫자인 행만 점으로 남는지
{
  const collection = {
    columns: [{ name: '배식량', type: 'number' }, { name: '섭취량', type: 'number' }],
    rows: [
      ['100', '90'],
      ['200', '사과'],   // y가 문자 → 제외
      ['바나나', '50'],  // x가 문자 → 제외
      ['150', '120'],
    ],
  };
  const viz = { chartType: 'scatter', xColumn: '배식량', yColumn: '섭취량' };
  const cfg = buildChartConfig(collection, viz);

  check('scatter: 점 2개만 남음', cfg.data && cfg.data.datasets[0].data.length === 2,
    cfg.data && cfg.data.datasets[0].data, '길이 2');
  check('scatter: 점 값', eq(cfg.data && cfg.data.datasets[0].data, [{ x: 100, y: 90 }, { x: 150, y: 120 }]),
    cfg.data && cfg.data.datasets[0].data, [{ x: 100, y: 90 }, { x: 150, y: 120 }]);
  check('scatter: type이 scatter', cfg.type === 'scatter', cfg.type, 'scatter');
}

// (4) pie에서 카테고리별 개수가 맞는지
{
  const collection = {
    columns: [{ name: '장르', type: 'text' }],
    rows: [['댄스'], ['발라드'], ['댄스'], ['힙합'], ['댄스']],
  };
  const viz = { chartType: 'pie', xColumn: '장르' };
  const cfg = buildChartConfig(collection, viz);

  check('pie: 라벨(첫 등장 순)', eq(cfg.data && cfg.data.labels, ['댄스', '발라드', '힙합']),
    cfg.data && cfg.data.labels, ['댄스', '발라드', '힙합']);
  check('pie: 개수', eq(cfg.data && cfg.data.datasets[0].data, [3, 1, 1]),
    cfg.data && cfg.data.datasets[0].data, [3, 1, 1]);
}

// (5) yColumn을 안 골랐을 때 bar/line/scatter가 { error } 를 돌려주는지
{
  const collection = {
    columns: [{ name: '메뉴', type: 'text' }, { name: '잔반량', type: 'number' }],
    rows: [['김치찌개', '10'], ['불고기', '5']],
  };

  const bar = buildChartConfig(collection, { chartType: 'bar', xColumn: '메뉴', yColumn: '', aggregate: 'avg' });
  check('bar: yColumn 없으면 error', typeof bar.error === 'string' && bar.error.length > 0, bar, '{ error }');

  const line = buildChartConfig(collection, { chartType: 'line', xColumn: '메뉴', yColumn: '' });
  check('line: yColumn 없으면 error', typeof line.error === 'string' && line.error.length > 0, line, '{ error }');

  const scatter = buildChartConfig(collection, { chartType: 'scatter', xColumn: '메뉴', yColumn: '' });
  check('scatter: yColumn 없으면 error', typeof scatter.error === 'string' && scatter.error.length > 0, scatter, '{ error }');
}

// 추가: xColumn이 비었을 때, pie는 xColumn만으로 error 나는지도 함께 확인
{
  const collection = {
    columns: [{ name: '메뉴', type: 'text' }, { name: '잔반량', type: 'number' }],
    rows: [['김치찌개', '10']],
  };
  const pie = buildChartConfig(collection, { chartType: 'pie', xColumn: '' });
  check('pie: xColumn 없으면 error', typeof pie.error === 'string' && pie.error.length > 0, pie, '{ error }');

  const bar = buildChartConfig(collection, { chartType: 'bar', xColumn: '', yColumn: '잔반량', aggregate: 'avg' });
  check('bar: xColumn 없으면 error', typeof bar.error === 'string' && bar.error.length > 0, bar, '{ error }');
}

console.log(`\n합계: ${pass} 성공 / ${fail} 실패\n`);
process.exit(fail > 0 ? 1 : 0);
