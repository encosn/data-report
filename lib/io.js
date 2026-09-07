/**
 * io.js
 * ─────────────────────────────────────────────────────────────────────────────
 * "데이터 수집" 단계에서 학생이 올린 파일(xlsx/xls/csv/txt)을 읽어
 * { columns, rows } 표 모양으로 바꿔 주는 일을 담당한다.
 *
 * 이 앱은 자매 앱 data-cleaner 와 달리 "이미 표 모양인 파일"만 다루면 되므로
 * 병합 셀 복원 같은 복잡한 처리는 하지 않는다. 다만 한글 인코딩(CP949) 문제는
 * 똑같이 생기므로 그 처리(detectEncoding/decodeText/detectDelimiter)는 그대로 가져왔다.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as XLSX from 'xlsx';
import { inferColumnType } from './util.js';
import { unmergeGrid } from './header-merge.js';

/** 이 앱이 열 수 있는 파일 종류 */
export const ACCEPT = '.xlsx,.xls,.csv,.txt';
/** 교실 노트북에서 버틸 수 있는 크기 한계 */
export const MAX_BYTES = 20 * 1024 * 1024;

/**
 * 파일이 어떤 글자 방식으로 저장되었는지 알아낸다.
 *
 *  ① 맨 앞 3바이트가 EF BB BF 이면 "UTF-8 도장(BOM)"이 찍힌 UTF-8 이다.
 *  ② UTF-8 규칙에 맞는지 엄격하게(fatal) 검사해 본다. 통과하면 UTF-8.
 *  ③ 검사에서 걸리면 CP949(EUC-KR) 로 본다.
 */
export function detectEncoding(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return 'utf-8-bom';
  const probe = u8.length > 1_000_000 ? u8.subarray(0, 1_000_000 - 4) : u8;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(probe);
    return 'utf-8';
  } catch {
    return 'euc-kr';
  }
}

/**
 * 바이트를 글자로 바꾼다.
 * @param {ArrayBuffer} buf
 * @param {string} [force] 'utf-8' | 'euc-kr' 로 강제하고 싶을 때
 */
export function decodeText(buf, force) {
  const enc = force || detectEncoding(buf);
  const label = enc === 'euc-kr' ? 'euc-kr' : 'utf-8';
  const text = new TextDecoder(label).decode(buf);
  // BOM(U+FEFF)을 떼지 않으면 첫 열 이름 앞에 보이지 않는 글자가 붙어 이름 대조가 어긋난다.
  // ※ 눈에 보이지 않는 글자라서 소스에 직접 쓰지 않고 \uFEFF 로 적는다.
  return { text: text.replace(/^\uFEFF/, ''), encoding: enc };
}

/** CSV 의 칸 구분 기호를 알아낸다. */
export function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '').slice(0, 8);
  if (!lines.length) return ',';
  const cands = [',', ';', '\t', '|'];
  let best = ',', bestScore = -1;
  for (const d of cands) {
    const counts = lines.map(l => l.split(d).length);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    if (avg < 2) continue;
    const variance = counts.reduce((a, b) => a + (b - avg) ** 2, 0) / counts.length;
    const score = avg - variance * 3;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

/**
 * 파일 하나를 읽어 { columns, rows, notices } 표 모양으로 만든다.
 * @param {File|{name:string, size?:number, arrayBuffer:() => Promise<ArrayBuffer>}} file
 * @returns {Promise<{columns: {name:string, type:string}[], rows: string[][], notices: {level:string, message:string}[]}>}
 */
export async function readTable(file) {
  const notices = [];
  const empty = { columns: [], rows: [], notices };

  const size = typeof file.size === 'number' ? file.size : 0;
  if (size > MAX_BYTES) {
    notices.push({ level: 'warn', message: '파일 크기가 20MB 를 넘어서 읽지 않았어요. 더 작은 파일로 다시 시도해 주세요.' });
    return empty;
  }

  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);

  // 확장자만 믿지 않고 실제 바이트를 본다. PK = xlsx(zip), D0CF11E0 = 옛 xls.
  const isZip = u8[0] === 0x50 && u8[1] === 0x4B;
  const isOldXls = u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0;

  let workbook;
  if (isZip || isOldXls) {
    // 진짜 엑셀 파일 — 인코딩 걱정이 없다.
    workbook = XLSX.read(buf, { type: 'array', raw: false });
  } else {
    // 글자 파일(csv/txt) — 인코딩과 구분자를 자동 판별한다.
    const dec = decodeText(buf);
    if (dec.encoding === 'euc-kr') {
      notices.push({ level: 'info', message: 'CP949로 저장되어 있어 한글이 깨지지 않게 읽었습니다.' });
    }
    const delimiter = detectDelimiter(dec.text);
    workbook = XLSX.read(dec.text, { type: 'string', raw: false, FS: delimiter });
  }

  const sheetName = workbook.SheetNames[0];
  const ws = sheetName ? workbook.Sheets[sheetName] : null;
  if (!ws) {
    notices.push({ level: 'warn', message: '파일에서 표를 찾지 못했어요. 파일이 비어 있지 않은지 확인해 주세요.' });
    return empty;
  }

  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  const headerRow = aoa.length ? aoa[0].map(v => String(v ?? '')) : [];
  // 완전히 빈 파일이면 빈 문자열 칸 하나짜리 헤더만 남는다 — 진짜 헤더가 없는 것으로 본다.
  if (!aoa.length || headerRow.every(h => h.trim() === '')) {
    notices.push({ level: 'warn', message: '파일에 내용이 없어요. 다른 파일을 선택해 주세요.' });
    return empty;
  }
  const dataRows = aoa.slice(1)
    .map(r => headerRow.map((_, i) => String(r[i] ?? '')))
    .filter(r => r.some(v => v.trim() !== '')); // 완전히 빈 행은 건너뛴다

  const columns = headerRow.map((name, i) => ({
    name,
    type: inferColumnType(dataRows.map(r => r[i])),
  }));

  if (!dataRows.length) {
    notices.push({ level: 'warn', message: '헤더(열 이름) 말고는 데이터가 없어요.' });
  }

  return { columns, rows: dataRows, notices };
}

/**
 * 파일을 헤더 추정 없이 "날 것 그대로의 표"(문자열 2차원 배열)로 읽는다.
 * 병합된 셀(공공데이터포털 파일에 흔하다)은 값을 복사해서 편다. 헤더가 몇 줄인지는
 * 아직 정하지 않은 상태다 — mergeHeaderRows()에 넘겨 학생이 고른 줄 수로 합치기 전 단계.
 * @param {File|{name:string, size?:number, arrayBuffer:() => Promise<ArrayBuffer>}} file
 * @returns {Promise<{grid: string[][], notices: {level:string, message:string}[]}>}
 */
export async function readRawGrid(file) {
  const notices = [];
  const empty = { grid: [], notices };

  const size = typeof file.size === 'number' ? file.size : 0;
  if (size > MAX_BYTES) {
    notices.push({ level: 'warn', message: '파일 크기가 20MB 를 넘어서 읽지 않았어요. 더 작은 파일로 다시 시도해 주세요.' });
    return empty;
  }

  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  const isZip = u8[0] === 0x50 && u8[1] === 0x4B;
  const isOldXls = u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0;

  let workbook;
  if (isZip || isOldXls) {
    workbook = XLSX.read(buf, { type: 'array', raw: false });
  } else {
    const dec = decodeText(buf);
    if (dec.encoding === 'euc-kr') {
      notices.push({ level: 'info', message: 'CP949로 저장되어 있어 한글이 깨지지 않게 읽었습니다.' });
    }
    const delimiter = detectDelimiter(dec.text);
    workbook = XLSX.read(dec.text, { type: 'string', raw: false, FS: delimiter });
  }

  const sheetName = workbook.SheetNames[0];
  const ws = sheetName ? workbook.Sheets[sheetName] : null;
  if (!ws) {
    notices.push({ level: 'warn', message: '파일에서 표를 찾지 못했어요. 파일이 비어 있지 않은지 확인해 주세요.' });
    return empty;
  }

  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
    .map((row) => row.map((v) => String(v ?? '')));
  // 완전히 빈 CSV/시트도 XLSX가 칸 하나짜리 빈 행([['']])을 돌려줄 때가 있어
  // "모든 칸이 빈 값"인 경우까지 함께 빈 파일로 본다.
  if (!aoa.length || aoa.every((row) => row.every((v) => v.trim() === ''))) {
    notices.push({ level: 'warn', message: '파일에 내용이 없어요. 다른 파일을 선택해 주세요.' });
    return empty;
  }

  // !merges 는 시트의 절대 좌표를 쓰므로, !ref 의 시작 위치(대부분 A1=0,0)만큼 빼서
  // sheet_to_json 결과(0번째 행/열부터 시작하는 aoa)와 좌표를 맞춘다.
  const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 } };
  const rawMerges = Array.isArray(ws['!merges']) ? ws['!merges'] : [];
  const merges = rawMerges.map((m) => ({
    s: { r: m.s.r - range.s.r, c: m.s.c - range.s.c },
    e: { r: m.e.r - range.s.r, c: m.e.c - range.s.c },
  }));

  const grid = merges.length ? unmergeGrid(aoa, merges) : aoa;
  if (merges.length) {
    notices.push({ level: 'info', message: `병합된 칸 ${merges.length}곳을 값으로 채웠습니다.` });
  }

  return { grid, notices };
}
