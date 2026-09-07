/**
 * util.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 여러 lib/steps 파일이 함께 쓰는 아주 작은 순수 함수 모음.
 * DOM을 쓰지 않으므로 Node 테스트에서도 그대로 가져다 쓸 수 있다.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** "1,234", "12.5%", " 30 ", "₩1000" 처럼 사람이 보기 좋게 쓴 숫자도 숫자로 본다. */
export function looksNumeric(v) {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v !== 'string') return false;
  const s = v.replace(/[,\s 　₩원$%]/g, '');
  if (s === '' || s === '-') return false;
  return Number.isFinite(Number(s));
}

/** looksNumeric 이 true 인 값을 실제 JS 숫자로 바꾼다. 아니면 NaN. */
export function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  const s = v.replace(/[,\s 　₩원$%]/g, '');
  return s === '' || s === '-' ? NaN : Number(s);
}

/** 값이 "비었다"고 볼 수 있는가 (null/undefined/빈 문자열) */
export function isBlank(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

/**
 * 한 열의 값들을 보고 '수치형'인지 '텍스트형'인지 추정한다.
 * 비어 있지 않은 값 중 80% 이상이 숫자로 보이면 '수치형'으로 추천한다 (추천일 뿐, 학생이 바꿀 수 있다).
 */
export function inferColumnType(values) {
  const filled = (values || []).filter(v => !isBlank(v));
  if (filled.length === 0) return 'text';
  const numericCount = filled.filter(looksNumeric).length;
  return numericCount / filled.length >= 0.8 ? 'number' : 'text';
}

export function sum(nums) {
  return nums.reduce((a, b) => a + b, 0);
}

export function average(nums) {
  return nums.length ? sum(nums) / nums.length : 0;
}

/** 순서를 유지하면서 중복을 없앤다 */
export function uniq(arr) {
  return [...new Set(arr)];
}

/** 자바스크립트 문자열 안전 이스케이프 (보고서 HTML 조립 시 XSS/깨짐 방지용) */
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
