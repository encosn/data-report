import { looksNumeric, toNumber, isBlank, inferColumnType, sum, average, uniq, escapeHtml }
  from '../lib/util.js';

let pass = 0, fail = 0;
function check(label, ok, got, want) {
  if (ok) { pass++; console.log(`   OK   ${label}`); }
  else { fail++; console.log(`   FAIL ${label}\n        기대: ${JSON.stringify(want)}\n        실제: ${JSON.stringify(got)}`); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n【util.js】');

check('looksNumeric 콤마 숫자', looksNumeric('1,234') === true, looksNumeric('1,234'), true);
check('looksNumeric 퍼센트', looksNumeric('12.5%') === true, looksNumeric('12.5%'), true);
check('looksNumeric 원화', looksNumeric('₩1000') === true, looksNumeric('₩1000'), true);
check('looksNumeric 빈 문자열', looksNumeric('') === false, looksNumeric(''), false);
check('looksNumeric 하이픈만', looksNumeric('-') === false, looksNumeric('-'), false);
check('looksNumeric 글자', looksNumeric('사과') === false, looksNumeric('사과'), false);
check('looksNumeric 숫자 타입', looksNumeric(42) === true, looksNumeric(42), true);
check('looksNumeric NaN', looksNumeric(NaN) === false, looksNumeric(NaN), false);

check('toNumber 콤마', toNumber('1,234') === 1234, toNumber('1,234'), 1234);
check('toNumber 퍼센트', toNumber('12.5%') === 12.5, toNumber('12.5%'), 12.5);
check('toNumber 실패시 NaN', Number.isNaN(toNumber('사과')), toNumber('사과'), NaN);

check('isBlank null', isBlank(null) === true, isBlank(null), true);
check('isBlank 공백', isBlank('   ') === true, isBlank('   '), true);
check('isBlank 값 있음', isBlank('0') === false, isBlank('0'), false);

check('inferColumnType 수치형', inferColumnType(['1', '2', '3', '']) === 'number',
  inferColumnType(['1', '2', '3', '']), 'number');
check('inferColumnType 텍스트형', inferColumnType(['사과', '바나나', '1']) === 'text',
  inferColumnType(['사과', '바나나', '1']), 'text');
check('inferColumnType 전부 빈값', inferColumnType(['', '', '']) === 'text',
  inferColumnType(['', '', '']), 'text');

check('sum', sum([1, 2, 3]) === 6, sum([1, 2, 3]), 6);
check('average', average([2, 4, 6]) === 4, average([2, 4, 6]), 4);
check('average 빈 배열', average([]) === 0, average([]), 0);
check('uniq', eq(uniq([1, 1, 2, 3, 3]), [1, 2, 3]), uniq([1, 1, 2, 3, 3]), [1, 2, 3]);

check('escapeHtml 태그', escapeHtml('<script>') === '&lt;script&gt;', escapeHtml('<script>'), '&lt;script&gt;');
check('escapeHtml 따옴표', escapeHtml(`it's "ok"`) === 'it&#39;s &quot;ok&quot;',
  escapeHtml(`it's "ok"`), 'it&#39;s &quot;ok&quot;');
check('escapeHtml null', escapeHtml(null) === '', escapeHtml(null), '');

console.log(`\n합계: ${pass} 성공 / ${fail} 실패\n`);
process.exit(fail > 0 ? 1 : 0);
