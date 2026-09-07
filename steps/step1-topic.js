/**
 * step1-topic.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 1단계 · 문제 정의 — 무엇을 알아보고 싶은지 질문 형태로 적는다.
 * ⚠️ textarea 입력 중에는 ctx.update()를 호출하지 않는다(재렌더로 인한 포커스·IME 유실 방지).
 *    "다음" 버튼의 활성/비활성만 입력 시 즉시 갱신하고, state 반영은 버튼 클릭 시점에 한다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { TOPIC_EXAMPLES } from '../lib/state.js';
import { escapeHtml } from '../lib/util.js';

export function render(container, ctx) {
  const savedQuestion = ctx.state.topic.question || '';

  container.innerHTML = `
    <div class="card">
      <div class="step-title">1단계 · 문제 정의</div>
      <p class="step-desc">무엇을 알아보고 싶은지 질문 형태로 적어 보세요</p>

      <label class="field-label" for="topic-question">탐구 질문</label>
      <textarea id="topic-question" rows="3"
        placeholder="예) 우리 학교 급식 메뉴별 잔반량은 어떻게 다를까?">${escapeHtml(savedQuestion)}</textarea>

      <div>
        <button type="button" class="hint-toggle" data-action="toggle-hint">예시 보기</button>
      </div>
      <div class="hint-box" data-role="examples" hidden>
        <b>이런 질문은 어때요?</b>
        <ul style="margin:8px 0 0; padding-left:20px;">
          ${TOPIC_EXAMPLES.map(ex => `<li>${escapeHtml(ex)}</li>`).join('')}
        </ul>
      </div>

      <div class="warn-box" data-role="validation-msg" hidden></div>

      <div class="btn-row">
        <button type="button" class="btn btn-outline" data-action="prev">이전</button>
        <button type="button" class="btn btn-primary" data-action="next">다음</button>
      </div>
    </div>
  `;

  const textarea = container.querySelector('#topic-question');
  const nextBtn = container.querySelector('[data-action="next"]');
  const prevBtn = container.querySelector('[data-action="prev"]');
  const hintBox = container.querySelector('[data-role="examples"]');
  const hintToggleBtn = container.querySelector('[data-action="toggle-hint"]');
  const validationMsg = container.querySelector('[data-role="validation-msg"]');

  // "다음"은 항상 눌리지만(조건이 안 맞으면 흐리게만 보이고), 눌렀을 때 무엇이
  // 빠졌는지 알려준다 — 진짜 disabled로 막으면 클릭 자체가 안 일어나 안내할 수 없다.
  function updateNextLook() {
    nextBtn.classList.toggle('btn-pending', textarea.value.trim().length === 0);
  }
  updateNextLook();

  // 매 keystroke마다 여기서는 DOM 속성만 바꾼다 — ctx.update()는 절대 호출하지 않는다.
  textarea.addEventListener('input', () => {
    updateNextLook();
    if (textarea.value.trim().length > 0) validationMsg.hidden = true;
  });

  // 예시 보기/닫기는 이 화면만의 로컬 UI 상태라 ctx.update 없이 DOM만 토글한다.
  hintToggleBtn.addEventListener('click', () => {
    const isHidden = hintBox.hasAttribute('hidden');
    if (isHidden) {
      hintBox.removeAttribute('hidden');
      hintToggleBtn.textContent = '예시 닫기';
    } else {
      hintBox.setAttribute('hidden', '');
      hintToggleBtn.textContent = '예시 보기';
    }
  });

  prevBtn.addEventListener('click', () => ctx.goBack());

  nextBtn.addEventListener('click', () => {
    const question = textarea.value.trim();
    if (question.length === 0) {
      validationMsg.textContent = '⚠️ 탐구 질문을 입력해야 다음으로 갈 수 있어요.';
      validationMsg.hidden = false;
      textarea.focus();
      return;
    }
    ctx.update({ topic: { question } });
    ctx.goNext();
  });
}
