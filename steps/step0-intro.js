/**
 * step0-intro.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 0단계 · 시작 화면 — 앱 소개, 성취기준 배지, 진행 5단계 안내, 시작/이어서 하기 버튼.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { STANDARDS } from '../lib/state.js';

/** 진행 순서 안내 카드 5개 (표시용 상수, 사용자 입력 아님) */
const STEP_INTRO_LIST = [
  { num: 1, emoji: '❓', title: '문제 정의', desc: '무엇을 알아볼지 질문으로 정해요' },
  { num: 2, emoji: '📥', title: '데이터 수집', desc: '설문·관찰 등으로 자료를 모아요' },
  { num: 3, emoji: '📊', title: '데이터 시각화', desc: '표를 그래프로 나타내요' },
  { num: 4, emoji: '🔍', title: '데이터 분석', desc: '그래프를 보고 의미를 해석해요' },
  { num: 5, emoji: '📝', title: '보고서', desc: '탐구 과정을 정리해요' },
];

export function render(container, ctx) {
  // 이미 진행한 내용(문제 정의 질문)이 있으면 "이어서 하기" 화면으로 바꾼다.
  const hasProgress = ctx.state.topic.question.trim().length > 0;

  container.innerHTML = `
    <style>
      /* 이 파일 전용 클래스 — 다른 파일과 겹치지 않도록 s0- 접두어를 붙였다 */
      .s0-steps-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        margin: 14px 0 24px;
      }
      .s0-step-box {
        border: 2px solid var(--color-border);
        border-radius: 12px;
        padding: 16px 10px;
        background: #fafcfb;
        text-align: center;
      }
      .s0-step-emoji { font-size: 28px; }
      .s0-step-num { font-size: 14px; font-weight: 800; color: var(--color-primary-dark); margin: 4px 0 6px; }
      .s0-step-name { font-weight: 700; margin-bottom: 4px; font-size: 17px; }
      .s0-step-desc { font-size: 14px; color: var(--color-text-soft); }
    </style>

    <div class="card">
      <h1>데이터 탐구 수행평가</h1>
      <p class="step-desc">데이터를 모으고, 그래프로 나타내고, 의미를 해석해 보아요</p>

      <div class="badge-row">
        ${STANDARDS.map(s => `<span class="badge">[${s.code}] ${s.text}</span>`).join('')}
      </div>

      <h3>이렇게 진행해요</h3>
      <div class="s0-steps-grid">
        ${STEP_INTRO_LIST.map(s => `
          <div class="s0-step-box">
            <div class="s0-step-emoji">${s.emoji}</div>
            <div class="s0-step-num">${s.num}단계</div>
            <div class="s0-step-name">${s.title}</div>
            <div class="s0-step-desc">${s.desc}</div>
          </div>
        `).join('')}
      </div>

      ${hasProgress ? `
        <div class="hint-box">
          이전에 진행하던 내용이 있어요. "이어서 하기"를 누르면 그 내용부터 계속할 수 있어요.
        </div>
      ` : ''}

      <div class="hint-box">
        이 앱은 이름 등 개인정보를 입력받거나 저장하지 않아요. 입력한 내용은 이 컴퓨터의 브라우저에만 남아요.
      </div>

      <div class="${hasProgress ? 'btn-row' : 'btn-row-end'}">
        ${hasProgress ? `<button type="button" class="btn btn-outline" data-action="reset">처음부터 다시 하기</button>` : ''}
        <button type="button" class="btn btn-primary" data-action="start">${hasProgress ? '이어서 하기' : '시작하기'}</button>
      </div>
    </div>
  `;

  container.querySelector('[data-action="start"]').addEventListener('click', () => {
    ctx.goNext();
  });

  const resetBtn = container.querySelector('[data-action="reset"]');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => ctx.resetAll());
  }
}
