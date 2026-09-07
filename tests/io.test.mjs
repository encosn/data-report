import * as XLSX from 'xlsx';
import { ACCEPT, MAX_BYTES, detectEncoding, decodeText, detectDelimiter, readTable, readRawGrid }
  from '../lib/io.js';

let pass = 0, fail = 0;
function check(label, ok, got, want) {
  if (ok) { pass++; console.log(`   OK   ${label}`); }
  else { fail++; console.log(`   FAIL ${label}\n        기대: ${JSON.stringify(want)}\n        실제: ${JSON.stringify(got)}`); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 테스트 문자열을 File 을 흉내낸 가짜 파일 객체로 만든다 */
function fakeFile(name, text, encoding = 'utf-8') {
  const nodeBuf = Buffer.from(text, encoding === 'euc-kr' ? 'utf-8' : 'utf-8');
  const buf = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength);
  return { name, size: buf.byteLength, arrayBuffer: () => Promise.resolve(buf) };
}

console.log('\n【io.js】');

check('ACCEPT 값', ACCEPT === '.xlsx,.xls,.csv,.txt', ACCEPT, '.xlsx,.xls,.csv,.txt');
check('MAX_BYTES 값', MAX_BYTES === 20 * 1024 * 1024, MAX_BYTES, 20 * 1024 * 1024);

/* ── detectEncoding / decodeText 단위 테스트 ─────────────────────────── */
{
  const utf8Buf = Buffer.from('안녕하세요', 'utf-8');
  const ab = utf8Buf.buffer.slice(utf8Buf.byteOffset, utf8Buf.byteOffset + utf8Buf.byteLength);
  check('detectEncoding: 일반 UTF-8', detectEncoding(ab) === 'utf-8', detectEncoding(ab), 'utf-8');

  const bomBuf = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('안녕', 'utf-8')]);
  const abBom = bomBuf.buffer.slice(bomBuf.byteOffset, bomBuf.byteOffset + bomBuf.byteLength);
  check('detectEncoding: UTF-8 BOM', detectEncoding(abBom) === 'utf-8-bom', detectEncoding(abBom), 'utf-8-bom');
  const decBom = decodeText(abBom);
  check('decodeText: BOM 제거됨', decBom.text === '안녕', decBom.text, '안녕');

  // CP949(EUC-KR)로 실제 인코딩한 바이트를 직접 만든다 ("가" = 0xB0 0xA1 in EUC-KR).
  const eucKrBuf = Buffer.from([0xB0, 0xA1, 0xB0, 0xA1]); // "가가"
  const abEuc = eucKrBuf.buffer.slice(eucKrBuf.byteOffset, eucKrBuf.byteOffset + eucKrBuf.byteLength);
  check('detectEncoding: EUC-KR 판정', detectEncoding(abEuc) === 'euc-kr', detectEncoding(abEuc), 'euc-kr');
  const decEuc = decodeText(abEuc);
  check('decodeText: EUC-KR 디코딩', decEuc.text === '가가', decEuc.text, '가가');
}

/* ── detectDelimiter 단위 테스트 ──────────────────────────────────────── */
{
  check('detectDelimiter: 쉼표', detectDelimiter('이름,나이\n철수,15\n영희,14') === ',',
    detectDelimiter('이름,나이\n철수,15\n영희,14'), ',');
  check('detectDelimiter: 세미콜론', detectDelimiter('이름;나이\n철수;15\n영희;14') === ';',
    detectDelimiter('이름;나이\n철수;15\n영희;14'), ';');
  check('detectDelimiter: 탭', detectDelimiter('이름\t나이\n철수\t15\n영희\t14') === '\t',
    detectDelimiter('이름\t나이\n철수\t15\n영희\t14'), '\t');
}

/* ── readTable 통합 테스트 (CSV) ──────────────────────────────────────── */
{
  const csv = '이름,점수\n철수,90\n영희,85\n민수,70';
  const table = await readTable(fakeFile('점수.csv', csv));
  check('readTable: 열 이름', eq(table.columns.map(c => c.name), ['이름', '점수']),
    table.columns.map(c => c.name), ['이름', '점수']);
  check('readTable: 데이터 3행', table.rows.length === 3, table.rows.length, 3);
  check('readTable: 첫 행 값', eq(table.rows[0], ['철수', '90']), table.rows[0], ['철수', '90']);
}

/* ── readTable: 열 자료형 추정 ────────────────────────────────────────── */
{
  const csv = '항목,값,설명\n사과,10,맛있다\n바나나,20,달다\n포도,15,새콤하다';
  const table = await readTable(fakeFile('열.csv', csv));
  check('readTable: 텍스트 열', table.columns[0].type === 'text', table.columns[0].type, 'text');
  check('readTable: 숫자 열', table.columns[1].type === 'number', table.columns[1].type, 'number');
  check('readTable: 텍스트 열(설명)', table.columns[2].type === 'text', table.columns[2].type, 'text');
}

/* ── readTable: 빈 행 건너뛰기 ────────────────────────────────────────── */
{
  const csv = '이름,나이\n철수,15\n,\n영희,14\n \t ,   ';
  const table = await readTable(fakeFile('빈행.csv', csv));
  check('readTable: 빈 행 제외 후 2행', table.rows.length === 2, table.rows.length, 2);
  check('readTable: 남은 행 값 확인', eq(table.rows.map(r => r[0]), ['철수', '영희']),
    table.rows.map(r => r[0]), ['철수', '영희']);
}

/* ── readTable: 세미콜론 구분자 파일도 잘 읽는지 ─────────────────────── */
{
  const csv = '지역;인구\n서울;900\n부산;300';
  const table = await readTable(fakeFile('구분자.csv', csv));
  check('readTable: 세미콜론 파일 열 이름', eq(table.columns.map(c => c.name), ['지역', '인구']),
    table.columns.map(c => c.name), ['지역', '인구']);
  check('readTable: 세미콜론 파일 행 수', table.rows.length === 2, table.rows.length, 2);
}

/* ── readTable: 빈 파일 / 헤더만 있는 파일 ───────────────────────────── */
{
  const empty = await readTable(fakeFile('빈파일.csv', ''));
  check('readTable: 빈 파일은 columns/rows 가 빈 배열', empty.columns.length === 0 && empty.rows.length === 0,
    { columns: empty.columns.length, rows: empty.rows.length }, { columns: 0, rows: 0 });
  check('readTable: 빈 파일은 안내 메시지 있음', empty.notices.length > 0, empty.notices, '길이 > 0');

  const headerOnly = await readTable(fakeFile('헤더만.csv', '이름,나이'));
  check('readTable: 헤더만 있으면 열은 있고 행은 0', headerOnly.columns.length === 2 && headerOnly.rows.length === 0,
    { columns: headerOnly.columns.length, rows: headerOnly.rows.length }, { columns: 2, rows: 0 });
}

/* ── readTable: 파일 크기 초과 ────────────────────────────────────────── */
{
  const bigFile = { name: '큰파일.csv', size: MAX_BYTES + 1, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) };
  const res = await readTable(bigFile);
  check('readTable: 크기 초과 파일은 읽지 않음', res.columns.length === 0 && res.rows.length === 0,
    res, '빈 결과');
  check('readTable: 크기 초과 안내 메시지', res.notices.some(n => n.level === 'warn'),
    res.notices, 'warn 알림 포함');
}

/* ── readRawGrid: 병합 없는 CSV는 헤더/데이터 구분 없이 통째로 grid로 ────── */
{
  const csv = '메뉴,잔반율\n김치찌개,48\n불고기,10';
  const res = await readRawGrid(fakeFile('원본.csv', csv));
  check('readRawGrid CSV: 3행 그대로', res.grid.length === 3, res.grid.length, 3);
  check('readRawGrid CSV: 첫 행이 헤더 그대로', eq(res.grid[0], ['메뉴', '잔반율']), res.grid[0], ['메뉴', '잔반율']);
}

/* ── readRawGrid: xlsx 병합 셀을 값으로 채워서 돌려주는지 ─────────────────── */
{
  // "지역"이 A1:A2 세로 병합, "인구"가 B1:C1 가로 병합된 시트를 직접 만든다.
  const aoa = [
    ['지역', '인구', ''],
    ['', '남', '여'],
    ['서울', '100', '110'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
    { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const xlsxFile = { name: '병합.xlsx', size: out.length, arrayBuffer: () => Promise.resolve(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)) };

  const res = await readRawGrid(xlsxFile);
  check('readRawGrid xlsx: 세로 병합 값 채움', res.grid[1][0] === '지역', res.grid[1][0], '지역');
  check('readRawGrid xlsx: 가로 병합 값 채움', res.grid[0][2] === '인구', res.grid[0][2], '인구');
  check('readRawGrid xlsx: 병합 안내 메시지', res.notices.some((n) => n.message.includes('병합된 칸')),
    res.notices, '병합 안내 포함');
}

/* ── readRawGrid: 빈 파일 / 크기 초과 ─────────────────────────────────────── */
{
  const empty = await readRawGrid(fakeFile('빈파일.csv', ''));
  check('readRawGrid: 빈 파일은 grid가 빈 배열', empty.grid.length === 0, empty.grid.length, 0);

  const bigFile = { name: '큰파일.csv', size: MAX_BYTES + 1, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) };
  const big = await readRawGrid(bigFile);
  check('readRawGrid: 크기 초과 파일은 읽지 않음', big.grid.length === 0, big.grid.length, 0);
  check('readRawGrid: 크기 초과 안내 메시지', big.notices.some((n) => n.level === 'warn'), big.notices, 'warn 포함');
}

console.log(`\n합계: ${pass} 성공 / ${fail} 실패\n`);
process.exit(fail > 0 ? 1 : 0);
