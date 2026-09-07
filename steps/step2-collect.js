/**
 * step2-collect.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 2단계 · 데이터 수집.
 * 수집 방법·출처를 기록하고, [파일 업로드] 또는 [표에 직접 입력] 중 하나로
 * 실제 데이터 표(columns/rows)를 만든다. 두 탭은 같은 데이터를 공유하며
 * (renderGridInto 하나를 함께 쓴다), 열/행 추가·삭제처럼 구조가 바뀔 때만
 * ctx.update로 state에 반영한다. 텍스트 입력(출처, 열 이름, 셀 값)은
 * 매 keystroke마다 갱신하지 않고 로컬 배열/DOM에만 두었다가 필요한 시점에 반영한다.
 *
 * 파일을 올리면 곧바로 표로 만들지 않고 "헤더 확인" 이라는 별도 화면으로 먼저
 * 넘어간다. 공공데이터포털 등에서 받은 파일은 열 이름(헤더)이 여러 줄이거나
 * 셀이 병합된 경우가 흔하고 파일마다 모양이 달라서, 자동으로 추측하는 대신
 * 학생이 미리보기를 보고 몇 번째 줄까지가 헤더인지 직접 정하게 한다
 * (lib/header-merge.js 의 mergeHeaderRows 참고).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { COLLECTION_METHODS } from '../lib/state.js';
import { isBlank, escapeHtml } from '../lib/util.js';
import { readRawGrid, ACCEPT, MAX_BYTES } from '../lib/io.js';
import { mergeHeaderRows, carryForwardCols } from '../lib/header-merge.js';
import { applySelection, selectionCounts, normalizeSelection, rowMatchesQuery } from '../lib/select.js';

const PREVIEW_MAX_ROWS = 20;
const MAX_HEADER_ROW_COUNT = 10;

/**
 * 어느 탭이 열려 있는지는 **모듈 수준**에 둔다.
 * ctx.update()가 불리면 main.js가 화면을 통째로 다시 그리면서 render()가 처음부터 다시 실행되는데,
 * 이 값을 render() 안의 지역 변수로 두면 "표에 직접 입력" 탭에서 행/열을 추가할 때마다
 * 화면이 "파일 업로드" 탭으로 튕겨 돌아간다.
 */
let activeTab = 'file'; // 'file' | 'table'

export function render(container, ctx) {
  const { state } = ctx;

  // 화면에 보여줄 데이터(로컬 작업 사본). "다음" 또는 구조적 변경(열/행 추가·삭제,
  // 헤더 확인 화면에서 "이 설정으로 사용하기") 시점에만 ctx.update로 실제 state에 반영한다.
  let columns = state.collection.columns.map((c) => ({ name: c.name, type: c.type }));
  let rows = state.collection.rows.map((r) => [...r]);
  // 어떤 열·행을 다음 단계로 넘길지. columns/rows와 길이를 항상 맞춰 둔다.
  let colSelected = normalizeSelection(state.collection.colSelected, columns.length);
  let rowSelected = normalizeSelection(state.collection.rowSelected, rows.length);
  let rowQuery = ''; // 행 검색어 (화면에서 감추기만 할 뿐 데이터는 그대로 둔다)

  // "헤더 확인" 화면 전용 로컬 상태 — 파일을 올렸을 때만 쓰인다. state에는 절대 들어가지 않는다.
  let mode = 'collect'; // 'collect' | 'header-preview'
  let pendingGrid = null; // readRawGrid() 결과(문자열 2차원 배열, 병합은 이미 풀려 있음)
  let pendingFileName = '';
  let pendingHeaderCount = 1;
  let pendingHeaderColCount = 0;
  let pendingNotices = [];
  let pendingSource = null; // 「헤더 확인」으로 넘어갈 때 아직 저장 안 된 출처 입력값을 챙겨 둔다

  function renderCurrent() {
    container.innerHTML = '';
    if (mode === 'header-preview') renderHeaderPreviewScreen();
    else renderCollectScreen();
  }

  function backToCollect() {
    mode = 'collect';
    renderCurrent();
  }

  /* ══════════════════════════════════════════════════════════════════════
     화면 A · 평소 데이터 수집 화면 (수집 방법 · 출처 · 업로드/직접입력 탭 · 표)
     ══════════════════════════════════════════════════════════════════════ */
  function renderCollectScreen() {
    container.innerHTML = `
      <div class="card">
        <div class="step-title">2단계 · 데이터 수집</div>
        <div class="step-desc">어떤 방법으로, 어디서 데이터를 모았는지 기록하고, 파일을 올리거나 표에 직접 입력해서 데이터를 만들어 보세요.</div>

        <label class="field-label">수집 방법 (여러 개 고를 수 있어요)</label>
        <div class="chip-group" id="methodChips"></div>

        <label class="field-label" style="margin-top:22px;">데이터 출처</label>
        <input type="text" id="sourceInput" placeholder="예: 우리 학교 급식실 잔반 기록, 국가통계포털(KOSIS) ...">

        <div class="warn-box">⚠️ 이름 등 개인정보가 들어간 데이터는 넣지 않아요.</div>

        <label class="field-label" style="margin-top:26px;">데이터 표 만들기</label>
        <div class="tab-row">
          <button type="button" class="tab-btn is-active" id="tabFileBtn">📁 파일 업로드</button>
          <button type="button" class="tab-btn" id="tabTableBtn">✏️ 표에 직접 입력</button>
        </div>

        <div id="panelFile">
          <div class="dropzone" id="dropzone">
            <div style="font-size:20px;font-weight:700;">📁 여기로 파일을 끌어다 놓거나 눌러서 선택하세요</div>
            <div style="margin-top:8px;">지원 형식: xlsx, xls, csv, txt (최대 ${Math.round(MAX_BYTES / 1024 / 1024)}MB)</div>
          </div>
          <input type="file" id="fileInput" style="display:none;">
          <div id="fileNotices"></div>
          <div id="fileGridWrap" style="margin-top:16px;"></div>
        </div>

        <div id="panelTable" style="display:none;">
          <div id="tableGridWrap"></div>
        </div>

        <div class="warn-box" id="validationMsg" hidden></div>

        <div class="btn-row">
          <button type="button" class="btn btn-outline" id="prevBtn">← 이전 단계</button>
          <button type="button" class="btn btn-primary" id="nextBtn">다음 단계 →</button>
        </div>
      </div>
    `;

    const sourceInput = container.querySelector('#sourceInput');
    const tabFileBtn = container.querySelector('#tabFileBtn');
    const tabTableBtn = container.querySelector('#tabTableBtn');
    const panelFile = container.querySelector('#panelFile');
    const panelTable = container.querySelector('#panelTable');
    const dropzone = container.querySelector('#dropzone');
    const fileInput = container.querySelector('#fileInput');
    const fileNotices = container.querySelector('#fileNotices');
    const fileGridWrap = container.querySelector('#fileGridWrap');
    const tableGridWrap = container.querySelector('#tableGridWrap');
    const prevBtn = container.querySelector('#prevBtn');
    const nextBtn = container.querySelector('#nextBtn');
    const validationMsg = container.querySelector('#validationMsg');

    // 「헤더 확인」으로 갔다 온 사이 아직 state에 저장되지 않은 출처 입력값이 있으면 그것을 살려 준다.
    sourceInput.value = pendingSource !== null ? pendingSource : (state.collection.source || '');
    fileInput.accept = ACCEPT;

    // ── 수집 방법 칩 ────────────────────────────────────────────────────
    const methodChipsEl = container.querySelector('#methodChips');
    COLLECTION_METHODS.forEach((method) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (state.collection.methods.includes(method) ? ' is-selected' : '');
      chip.style.fontFamily = 'inherit';
      chip.textContent = method;
      chip.addEventListener('click', () => {
        const methods = state.collection.methods.includes(method)
          ? state.collection.methods.filter((m) => m !== method)
          : [...state.collection.methods, method];
        // 칩 클릭은 즉시 재렌더되므로, 그 사이 입력해 둔 출처/표 내용도 함께 흘려 보내 잃지 않게 한다.
        ctx.update({ collection: { methods, source: sourceInput.value, columns, rows, colSelected, rowSelected } });
      });
      methodChipsEl.appendChild(chip);
    });

    // 출처는 텍스트 입력이라 keystroke마다 update하지 않고 blur 시점에만 반영한다.
    // ⚠️ 이때 columns/rows도 함께 넘겨야 한다. source만 넘기면 update → renderAll 이 일어나면서
    //    아직 state에 없던 표 편집 내용(셀 값, 열 이름)이 옛 state 값으로 되돌아가 사라진다.
    sourceInput.addEventListener('blur', () => {
      if (sourceInput.value === (state.collection.source || '')) return; // 안 바뀌었으면 재렌더하지 않는다
      ctx.update({ collection: { source: sourceInput.value, columns, rows, colSelected, rowSelected } });
    });

    // ── 탭 전환 ─────────────────────────────────────────────────────────
    function applyTab() {
      tabFileBtn.classList.toggle('is-active', activeTab === 'file');
      tabTableBtn.classList.toggle('is-active', activeTab === 'table');
      panelFile.style.display = activeTab === 'file' ? '' : 'none';
      panelTable.style.display = activeTab === 'table' ? '' : 'none';
    }
    tabFileBtn.addEventListener('click', () => {
      activeTab = 'file';
      applyTab();
      renderGridInto(fileGridWrap); // 다른 탭에서 편집했을 수 있으니 최신 값으로 다시 그린다
    });
    tabTableBtn.addEventListener('click', () => {
      activeTab = 'table';
      applyTab();
      renderGridInto(tableGridWrap);
    });
    applyTab();

    // ── "다음" 조건 — **체크해서 고른 것만** 기준으로 본다 (안 고른 열·행은 넘어가지 않으므로)
    // 무엇이 빠졌는지 구체적으로 알려주기 위해 disabled로 막지 않고, 조건마다 이유를 모아 돌려준다.
    function checkMissing() {
      const missing = [];
      const picked = applySelection({ columns, rows, colSelected, rowSelected });
      if (picked.columns.length < 2) missing.push('다음으로 넘길 열을 2개 이상 체크해야 해요.');
      if (picked.rows.length < 2) missing.push('다음으로 넘길 행을 2개 이상 체크해야 해요.');
      const filledRows = picked.rows.filter((r) => r.some((v) => !isBlank(v)));
      if (picked.rows.length >= 2 && filledRows.length < 1) missing.push('값이 채워진 행이 하나 이상 있어야 해요.');
      if (!picked.columns.some((c) => c.type === 'number')) {
        missing.push('체크한 열 중에 숫자(수치형) 자료형이 하나 이상 있어야 해요. 그래프를 그리려면 숫자 데이터가 필요해요.');
      }
      return missing;
    }

    function updateNextButtonState() {
      const missing = checkMissing();
      nextBtn.classList.toggle('btn-pending', missing.length > 0);
      if (missing.length === 0) validationMsg.hidden = true;
      updateCountLabels();
    }

    /** 화면 곳곳의 "고른 열 N/M · 고른 행 P/Q" 표시를 갱신한다 */
    function updateCountLabels() {
      const c = selectionCounts({ columns, rows, colSelected, rowSelected });
      container.querySelectorAll('[data-role="pick-count"]').forEach((el) => {
        el.textContent = `고른 열 ${c.colChecked}/${c.colTotal}개 · 고른 행 ${c.rowChecked}/${c.rowTotal}개`;
      });
    }

    // 열/행 추가·삭제처럼 구조가 바뀔 때만 호출 — 이 시점에 state에 반영하고 전체를 다시 그린다.
    function commitStructuralChange() {
      ctx.update({ collection: { source: sourceInput.value, columns, rows, colSelected, rowSelected } });
    }

    // ── 표(그리드) 그리기 — 파일 업로드 탭과 표 입력 탭이 함께 쓰는 공용 함수 ────
    function renderGridInto(hostEl) {
      hostEl.innerHTML = '';

      // ── 안내 + 검색 + 전체 선택/해제 ─────────────────────────────────
      const pickHint = document.createElement('div');
      pickHint.className = 'hint-box';
      pickHint.innerHTML = '☑️ <b>체크한 열·행만 다음 단계로 넘어가요.</b> 필요 없는 것은 체크를 끄면 되고, ' +
        '아래 검색창에 낱말을 넣으면 그 낱말이 든 행만 보여요(예: "서울"). 체크를 끄는 것은 <b>지우는 게 아니라서</b> ' +
        '언제든 다시 켤 수 있어요.';
      hostEl.appendChild(pickHint);

      const topToolbar = document.createElement('div');
      topToolbar.className = 'grid-toolbar';
      topToolbar.style.alignItems = 'center';

      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = '🔎 행 검색 (예: 서울)';
      searchInput.value = rowQuery;
      searchInput.style.maxWidth = '220px';

      const selectAllBtn = document.createElement('button');
      selectAllBtn.type = 'button';
      selectAllBtn.className = 'btn btn-outline';
      selectAllBtn.textContent = '보이는 행 모두 체크';
      selectAllBtn.style.minHeight = '40px';
      selectAllBtn.style.fontSize = '15px';
      selectAllBtn.style.padding = '6px 14px';

      const clearAllBtn = document.createElement('button');
      clearAllBtn.type = 'button';
      clearAllBtn.className = 'btn btn-outline';
      clearAllBtn.textContent = '보이는 행 모두 해제';
      clearAllBtn.style.minHeight = '40px';
      clearAllBtn.style.fontSize = '15px';
      clearAllBtn.style.padding = '6px 14px';

      const countLabel = document.createElement('span');
      countLabel.dataset.role = 'pick-count';
      countLabel.style.fontWeight = '700';
      countLabel.style.color = 'var(--color-primary-dark)';

      const addColBtn = document.createElement('button');
      addColBtn.type = 'button';
      addColBtn.className = 'btn btn-secondary';
      addColBtn.textContent = '+ 열 추가';
      addColBtn.addEventListener('click', () => {
        columns = [...columns, { name: `열${columns.length + 1}`, type: 'text' }];
        rows = rows.map((r) => [...r, '']);
        colSelected = [...colSelected, true];
        commitStructuralChange();
      });

      topToolbar.appendChild(searchInput);
      topToolbar.appendChild(selectAllBtn);
      topToolbar.appendChild(clearAllBtn);
      topToolbar.appendChild(addColBtn);
      topToolbar.appendChild(countLabel);
      hostEl.appendChild(topToolbar);

      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      const table = document.createElement('table');
      table.className = 'data-grid';

      // 헤더 행 : (맨 왼쪽 = 행 전체 체크) + 열마다 [체크박스 · 열 이름 · 자료형 · 열 삭제]
      const thead = document.createElement('thead');
      const headTr = document.createElement('tr');

      // 맨 왼쪽 칸 — 행 삭제 버튼이 있는 열의 머리. 여기에 "보이는 행 전체 체크" 상자를 둔다.
      const actionTh = document.createElement('th');
      actionTh.style.minWidth = '104px';
      const allRowBox = document.createElement('label');
      allRowBox.style.display = 'flex';
      allRowBox.style.flexDirection = 'column';
      allRowBox.style.alignItems = 'center';
      allRowBox.style.gap = '4px';
      allRowBox.style.fontSize = '13px';
      allRowBox.style.color = 'var(--color-text-soft)';
      allRowBox.style.cursor = 'pointer';
      const allRowCb = document.createElement('input');
      allRowCb.type = 'checkbox';
      allRowCb.style.width = '22px';
      allRowCb.style.height = '22px';
      const visibleRowIdx = rows.map((_, i) => i).filter((i) => rowMatchesQuery(rows[i], rowQuery));
      allRowCb.checked = visibleRowIdx.length > 0 && visibleRowIdx.every((i) => rowSelected[i]);
      allRowCb.addEventListener('change', () => {
        visibleRowIdx.forEach((i) => { rowSelected[i] = allRowCb.checked; });
        renderGridInto(hostEl);
        updateNextButtonState();
      });
      allRowBox.appendChild(allRowCb);
      const allRowText = document.createElement('span');
      allRowText.textContent = '행 고르기';
      allRowBox.appendChild(allRowText);
      actionTh.appendChild(allRowBox);
      headTr.appendChild(actionTh);

      columns.forEach((col, ci) => {
        const th = document.createElement('th');
        const box = document.createElement('div');
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.gap = '6px';
        box.style.minWidth = '130px';

        // 이 열을 다음 단계로 넘길지 고르는 체크박스
        const colPick = document.createElement('label');
        colPick.style.display = 'flex';
        colPick.style.alignItems = 'center';
        colPick.style.gap = '6px';
        colPick.style.fontSize = '14px';
        colPick.style.cursor = 'pointer';
        const colCb = document.createElement('input');
        colCb.type = 'checkbox';
        colCb.style.width = '20px';
        colCb.style.height = '20px';
        colCb.checked = colSelected[ci] !== false;
        colCb.addEventListener('change', () => {
          colSelected[ci] = colCb.checked;
          th.style.opacity = colCb.checked ? '' : '0.45';
          // 이 열에 속한 데이터 칸도 함께 흐리게 해서 "안 넘어간다"는 것을 눈에 보이게 한다
          table.querySelectorAll(`tbody td[data-col="${ci}"]`).forEach((td) => {
            td.style.opacity = colCb.checked ? '' : '0.45';
          });
          updateNextButtonState();
        });
        colPick.appendChild(colCb);
        const colPickText = document.createElement('span');
        colPickText.textContent = '이 열 쓰기';
        colPick.appendChild(colPickText);
        box.appendChild(colPick);

        if (colSelected[ci] === false) th.style.opacity = '0.45';

        const nameLabel = document.createElement('span');
        nameLabel.textContent = '열 이름';
        nameLabel.style.fontSize = '13px';
        nameLabel.style.color = 'var(--color-text-soft)';
        box.appendChild(nameLabel);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'colname-input';
        nameInput.placeholder = '열 이름을 입력하세요';
        nameInput.value = col.name;
        nameInput.addEventListener('input', () => {
          columns[ci].name = nameInput.value; // 로컬에만 반영 (포커스 유지)
        });
        box.appendChild(nameInput);

        const typeLabel = document.createElement('span');
        typeLabel.textContent = '자료형';
        typeLabel.style.fontSize = '13px';
        typeLabel.style.color = 'var(--color-text-soft)';
        box.appendChild(typeLabel);

        const typeSelect = document.createElement('select');
        const optText = document.createElement('option');
        optText.value = 'text';
        optText.textContent = '텍스트';
        const optNumber = document.createElement('option');
        optNumber.value = 'number';
        optNumber.textContent = '숫자';
        typeSelect.appendChild(optText);
        typeSelect.appendChild(optNumber);
        typeSelect.value = col.type === 'number' ? 'number' : 'text';
        typeSelect.addEventListener('change', () => {
          columns[ci].type = typeSelect.value;
          updateNextButtonState();
        });
        box.appendChild(typeSelect);

        if (columns.length > 1) {
          const delColBtn = document.createElement('button');
          delColBtn.type = 'button';
          delColBtn.className = 'btn btn-danger';
          delColBtn.textContent = '열 삭제';
          delColBtn.style.minHeight = '36px';
          delColBtn.style.fontSize = '14px';
          delColBtn.style.padding = '6px 12px';
          delColBtn.addEventListener('click', () => {
            columns = columns.filter((_, i) => i !== ci);
            rows = rows.map((r) => r.filter((_, i) => i !== ci));
            colSelected = colSelected.filter((_, i) => i !== ci);
            commitStructuralChange();
          });
          box.appendChild(delColBtn);
        }

        th.appendChild(box);
        headTr.appendChild(th);
      });
      thead.appendChild(headTr);
      table.appendChild(thead);

      // 데이터 행 — 맨 왼쪽 칸에 [체크박스][행 삭제] 를 둔다
      const tbody = document.createElement('tbody');
      rows.forEach((row, ri) => {
        const tr = document.createElement('tr');
        // 검색어에 안 맞는 행은 숨긴다 (지우는 것이 아니라 화면에서만 감춘다)
        if (!rowMatchesQuery(row, rowQuery)) tr.style.display = 'none';

        const actionTd = document.createElement('td');
        actionTd.style.whiteSpace = 'nowrap';
        const actionBox = document.createElement('div');
        actionBox.style.display = 'flex';
        actionBox.style.alignItems = 'center';
        actionBox.style.gap = '8px';

        const rowCb = document.createElement('input');
        rowCb.type = 'checkbox';
        rowCb.style.width = '22px';
        rowCb.style.height = '22px';
        rowCb.style.flexShrink = '0';
        rowCb.checked = rowSelected[ri] !== false;
        rowCb.title = '체크한 행만 다음 단계로 넘어가요';
        rowCb.addEventListener('change', () => {
          rowSelected[ri] = rowCb.checked;
          tr.style.opacity = rowCb.checked ? '' : '0.45';
          updateNextButtonState();
        });
        actionBox.appendChild(rowCb);
        if (rowSelected[ri] === false) tr.style.opacity = '0.45';

        if (rows.length > 1) {
          const delRowBtn = document.createElement('button');
          delRowBtn.type = 'button';
          delRowBtn.className = 'btn btn-danger';
          delRowBtn.textContent = '행 삭제';
          delRowBtn.style.minHeight = '36px';
          delRowBtn.style.fontSize = '14px';
          delRowBtn.style.padding = '6px 12px';
          delRowBtn.addEventListener('click', () => {
            rows = rows.filter((_, i) => i !== ri);
            rowSelected = rowSelected.filter((_, i) => i !== ri);
            commitStructuralChange();
          });
          actionBox.appendChild(delRowBtn);
        }
        actionTd.appendChild(actionBox);
        tr.appendChild(actionTd);

        columns.forEach((_, ci) => {
          const td = document.createElement('td');
          td.dataset.col = String(ci);
          if (colSelected[ci] === false) td.style.opacity = '0.45';
          const cellInput = document.createElement('input');
          cellInput.type = 'text';
          cellInput.value = row[ci] ?? '';
          cellInput.addEventListener('input', () => {
            rows[ri][ci] = cellInput.value; // 로컬에만 반영 (포커스 유지)
            updateNextButtonState();
          });
          td.appendChild(cellInput);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      hostEl.appendChild(wrap);

      // ── 검색·전체선택 동작 연결 (표를 다 그린 뒤에 걸어야 tr을 찾을 수 있다) ──
      searchInput.addEventListener('input', () => {
        rowQuery = searchInput.value;
        // 재렌더하지 않고 보이기/숨기기만 바꾼다 → 검색창 포커스가 유지된다
        const trs = tbody.querySelectorAll('tr');
        rows.forEach((r, i) => {
          if (trs[i]) trs[i].style.display = rowMatchesQuery(r, rowQuery) ? '' : 'none';
        });
        // "보이는 행 전체 체크" 상자의 상태도 다시 계산한다
        const vis = rows.map((_, i) => i).filter((i) => rowMatchesQuery(rows[i], rowQuery));
        allRowCb.checked = vis.length > 0 && vis.every((i) => rowSelected[i]);
      });

      function setVisibleRows(checked) {
        rows.forEach((r, i) => {
          if (rowMatchesQuery(r, rowQuery)) rowSelected[i] = checked;
        });
        renderGridInto(hostEl);
        updateNextButtonState();
      }
      selectAllBtn.addEventListener('click', () => setVisibleRows(true));
      clearAllBtn.addEventListener('click', () => setVisibleRows(false));

      // 방금 만든 개수 표시를 채운다 (탭을 바꿔 이 함수만 다시 불릴 때도 비어 있지 않도록)
      updateCountLabels();

      const bottomToolbar = document.createElement('div');
      bottomToolbar.className = 'grid-toolbar';
      const addRowBtn = document.createElement('button');
      addRowBtn.type = 'button';
      addRowBtn.className = 'btn btn-secondary';
      addRowBtn.textContent = '+ 행 추가';
      addRowBtn.addEventListener('click', () => {
        rows = [...rows, columns.map(() => '')];
        rowSelected = [...rowSelected, true];
        commitStructuralChange();
      });
      bottomToolbar.appendChild(addRowBtn);
      hostEl.appendChild(bottomToolbar);
    }

    // ── 파일 업로드 ─────────────────────────────────────────────────────
    function showNotice(target, level, message) {
      const box = document.createElement('div');
      box.className = level === 'warn' ? 'warn-box' : 'hint-box';
      box.textContent = message;
      target.appendChild(box);
    }

    async function handleFile(file) {
      fileNotices.innerHTML = '';
      showNotice(fileNotices, 'info', `"${file.name}" 파일을 읽는 중이에요...`);

      let result;
      try {
        result = await readRawGrid(file);
      } catch {
        fileNotices.innerHTML = '';
        showNotice(fileNotices, 'warn', '파일을 읽는 중 문제가 생겼어요. 다른 파일을 선택해 주세요.');
        return;
      }

      fileNotices.innerHTML = '';
      if (!result.grid || result.grid.length === 0) {
        showNotice(fileNotices, 'warn', '파일에서 표를 읽지 못했어요. 파일 형식을 확인하고 다시 시도해 주세요.');
        (result.notices || []).forEach((n) => showNotice(fileNotices, n.level, n.message));
        return;
      }

      // 표 모양은 알았지만 헤더가 몇 줄인지는 아직 모른다 — 별도 화면에서 학생이 정하게 한다.
      // 「헤더 확인」 화면에는 출처 입력칸이 없으므로, 아직 blur되지 않아 저장 안 된 값을 여기서 챙겨 둔다.
      pendingSource = sourceInput.value;
      pendingGrid = result.grid;
      pendingFileName = file.name;
      pendingHeaderCount = 1;
      pendingHeaderColCount = 0;
      pendingNotices = result.notices || [];
      mode = 'header-preview';
      renderCurrent();
    }

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) handleFile(file);
      fileInput.value = ''; // 같은 파일을 다시 골라도 change가 일어나도록 비워 둔다
    });

    // ── 초기 그리기 ─────────────────────────────────────────────────────
    renderGridInto(fileGridWrap);
    renderGridInto(tableGridWrap);
    updateNextButtonState();

    // ── 이전 / 다음 ─────────────────────────────────────────────────────
    prevBtn.addEventListener('click', () => ctx.goBack());
    nextBtn.addEventListener('click', () => {
      const missing = checkMissing();
      if (missing.length > 0) {
        validationMsg.innerHTML = '⚠️ 아직 다음으로 갈 수 없어요:<br>' + missing.map((m) => '· ' + m).join('<br>');
        validationMsg.hidden = false;
        validationMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      validationMsg.hidden = true;
      // 원본 표(columns/rows)는 그대로 저장하고, "무엇을 골랐는지"만 함께 넘긴다.
      // 3·4·5단계는 applySelection()으로 걸러 보므로, 되돌아오면 원래 표가 그대로 남아 있다.
      ctx.update({
        collection: {
          methods: state.collection.methods, source: sourceInput.value,
          columns, rows, colSelected, rowSelected,
        },
      });
      ctx.goNext();
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     화면 B · 헤더 확인 (파일 업로드 직후에만 보이는 별도 화면)
     공공데이터포털 파일은 열 이름이 여러 줄로 되어 있는 경우가 많아서,
     "몇 번째 줄까지가 열 이름인가요?"를 학생이 미리보기를 보며 직접 정한다.
     ══════════════════════════════════════════════════════════════════════ */
  function renderHeaderPreviewScreen() {
    const grid = pendingGrid || [];
    const totalRows = grid.length;
    const totalCols = totalRows ? Math.max(...grid.map((r) => r.length)) : 0;
    const maxHeaderCount = Math.max(1, Math.min(MAX_HEADER_ROW_COUNT, totalRows - 1 || 1));
    // 데이터 열이 최소 하나는 남아야 한다
    const maxHeaderColCount = Math.max(0, totalCols - 1);

    const noticesHtml = pendingNotices.map((n) =>
      `<div class="${n.level === 'warn' ? 'warn-box' : 'hint-box'}">${escapeHtml(n.message)}</div>`
    ).join('');

    container.innerHTML = `
      <div class="card">
        <div class="step-title">헤더 확인</div>
        <p class="step-desc">
          "${escapeHtml(pendingFileName)}" 파일을 불러왔어요. 공공데이터포털 등에서 받은 파일은 열 이름(헤더)이
          여러 줄이거나, 왼쪽 몇 칸이 항목 이름인 경우가 많아요. 아래 미리보기를 보고
          <b>어디까지가 헤더인지</b> 정해 주세요.
        </p>
        ${noticesHtml}

        <div style="display:flex; gap:28px; flex-wrap:wrap; margin-top:20px;">
          <div>
            <label class="field-label" for="headerCountInput">헤더로 쓸 <b>줄(행)</b> 수 &nbsp;⬇️</label>
            <input type="number" id="headerCountInput" min="1" max="${maxHeaderCount}" value="${pendingHeaderCount}"
              style="width:110px;">
            <p class="step-desc" style="font-size:14px; margin:6px 0 0; max-width:320px;">
              위에서부터 몇 줄이 열 이름인가요? 고른 줄들은 <b>"&gt;"</b>로 이어 붙여요.
              (예: 3줄 → "2023년&gt;상반기&gt;방문객수")
            </p>
          </div>
          <div>
            <label class="field-label" for="headerColCountInput">헤더로 쓸 <b>칸(열)</b> 수 &nbsp;➡️</label>
            <input type="number" id="headerColCountInput" min="0" max="${maxHeaderColCount}" value="${pendingHeaderColCount}"
              style="width:110px;">
            <p class="step-desc" style="font-size:14px; margin:6px 0 0; max-width:340px;">
              왼쪽에서부터 몇 칸이 <b>항목 이름</b>인가요? (예: 시도·시군구) 지정하면
              <b>생략되어 빈 칸으로 남은 값을 위에서 이어 채워</b> 주고, 숫자처럼 보여도 이름(텍스트)으로 둬요.
              필요 없으면 0으로 두세요.
            </p>
          </div>
        </div>

        <h3 style="margin-top:24px;">합쳐질 열 이름 미리보기</h3>
        <div class="badge-row" id="mergedNamesPreview"></div>

        <h3 style="margin-top:24px;">표 미리보기 <span style="font-weight:400; font-size:15px; color:var(--color-text-soft);">(열은 전체 ${totalCols}개, 행은 최대 ${PREVIEW_MAX_ROWS}개)</span></h3>
        <p class="step-desc" style="font-size:14px;">
          <span style="background:var(--color-primary-light); padding:2px 8px; border-radius:4px; font-weight:700;">진한 청록색</span> = 헤더로 고른 줄 ·
          <span style="background:#fff4e6; padding:2px 8px; border-radius:4px; font-weight:700;">주황색</span> = 헤더로 고른 칸 ·
          <span style="color:var(--color-primary-dark); font-weight:700;">청록 글씨</span> = 이어 채워 준 값
        </p>
        <div class="table-wrap" id="rawPreviewWrap"></div>
        ${totalRows > PREVIEW_MAX_ROWS ? `<p class="step-desc" style="font-size:14px;">전체 ${totalRows}행 중 ${PREVIEW_MAX_ROWS}행만 보여드려요 (나머지도 데이터로는 그대로 쓰여요).</p>` : ''}

        <div class="btn-row" style="margin-top:24px;">
          <button type="button" class="btn btn-outline" id="cancelHeaderBtn">취소</button>
          <button type="button" class="btn btn-primary" id="confirmHeaderBtn">이 설정으로 사용하기</button>
        </div>
      </div>
    `;

    const headerCountInput = container.querySelector('#headerCountInput');
    const headerColCountInput = container.querySelector('#headerColCountInput');
    const mergedPreviewEl = container.querySelector('#mergedNamesPreview');
    const rawPreviewWrap = container.querySelector('#rawPreviewWrap');

    function renderRawTable() {
      rawPreviewWrap.innerHTML = '';
      // 캐리포워드를 적용한 결과를 보여 줘야 학생이 "이어 채우기"의 효과를 눈으로 확인할 수 있다.
      const carried = carryForwardCols(grid, pendingHeaderCount, pendingHeaderColCount);
      const table = document.createElement('table');
      table.className = 'data-grid';
      const tbody = document.createElement('tbody');
      carried.slice(0, PREVIEW_MAX_ROWS).forEach((row, ri) => {
        const tr = document.createElement('tr');
        const isHeaderRow = ri < pendingHeaderCount;
        if (isHeaderRow) {
          tr.style.background = 'var(--color-primary-light)';
          tr.style.fontWeight = '700';
        }
        for (let c = 0; c < totalCols; c++) {
          const td = document.createElement('td');
          td.textContent = row[c] ?? '';
          if (!isHeaderRow && c < pendingHeaderColCount) {
            td.style.background = '#fff4e6';
            td.style.fontWeight = '700';
            // 원래 비어 있었는데 채워진 칸은 색으로 구분해 준다
            const original = grid[ri] && grid[ri][c] !== undefined ? String(grid[ri][c]).trim() : '';
            if (original === '' && (row[c] ?? '') !== '') {
              td.style.color = 'var(--color-primary-dark)';
            }
          }
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      rawPreviewWrap.appendChild(table);
    }

    function renderMergedPreview() {
      const merged = mergeHeaderRows(grid, pendingHeaderCount, { headerColCount: pendingHeaderColCount });
      mergedPreviewEl.innerHTML = '';
      merged.columns.forEach((c, i) => {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = i < pendingHeaderColCount ? `🏷️ ${c.name}` : c.name;
        if (i < pendingHeaderColCount) {
          badge.style.background = '#fff4e6';
          badge.style.color = '#7a4b00';
        }
        mergedPreviewEl.appendChild(badge);
      });
    }

    function refreshPreviews() {
      renderRawTable();
      renderMergedPreview();
    }

    refreshPreviews();

    // 범위를 벗어난 값을 치면 화면의 숫자도 실제 적용값으로 고쳐 준다
    // (안 그러면 "12"라고 쓰여 있는데 실제로는 4줄만 적용되어 학생이 헷갈린다).
    headerCountInput.addEventListener('input', () => {
      pendingHeaderCount = Math.max(1, Math.min(maxHeaderCount, parseInt(headerCountInput.value, 10) || 1));
      if (headerCountInput.value !== String(pendingHeaderCount)) {
        headerCountInput.value = String(pendingHeaderCount);
      }
      refreshPreviews();
    });

    headerColCountInput.addEventListener('input', () => {
      const raw = parseInt(headerColCountInput.value, 10);
      pendingHeaderColCount = Math.max(0, Math.min(maxHeaderColCount, Number.isFinite(raw) ? raw : 0));
      if (headerColCountInput.value !== String(pendingHeaderColCount)) {
        headerColCountInput.value = String(pendingHeaderColCount);
      }
      refreshPreviews();
    });

    container.querySelector('#cancelHeaderBtn').addEventListener('click', () => {
      pendingGrid = null;
      backToCollect();
    });

    container.querySelector('#confirmHeaderBtn').addEventListener('click', () => {
      const merged = mergeHeaderRows(grid, pendingHeaderCount, { headerColCount: pendingHeaderColCount });
      columns = merged.columns;
      rows = merged.rows;
      // 새 표가 들어왔으니 선택은 "전부 고른 상태"로 새로 맞춘다 (길이가 달라졌으므로 그대로 두면 어긋난다)
      colSelected = normalizeSelection(null, columns.length);
      rowSelected = normalizeSelection(null, rows.length);
      pendingGrid = null;
      // ⚠️ 반드시 state에 반영한다. 로컬 변수에만 담아 두면, 이후 아무 ctx.update(수집 방법 칩 클릭,
      //    출처 입력칸 blur 등)가 일어나는 순간 render()가 처음부터 다시 돌면서 state의 옛 값으로
      //    되돌아가 **올린 파일이 통째로 사라진다.**
      mode = 'collect';
      const patch = { collection: { columns, rows, colSelected, rowSelected } };
      if (pendingSource !== null) patch.collection.source = pendingSource;
      pendingSource = null;
      ctx.update(patch); // update가 renderAll을 부르므로 여기서 renderCurrent를 또 부르지 않는다
    });
  }

  renderCurrent();
}
