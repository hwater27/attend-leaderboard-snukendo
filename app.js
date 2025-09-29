(function () {
  const cfg = window.LEADERBOARD_CONFIG || {};

  const g = (sel) => document.querySelector(sel);
  const tableBody = g('#tableBody');
  const rowCount = g('#rowCount');
  const updatedAt = g('#updatedAt');
  const podium = g('#podium');
  const searchInput = g('#searchInput');
  const refreshBtn = g('#refreshBtn');
  const configHint = g('#configHint');
  const modeSwitch = g('#modeSwitch');
  const scoreHeader = g('#scoreHeader');
  const pager = g('#pager');
  const termButton = document.getElementById('termButton');
  const termListEl = document.getElementById('termList');

  const PAGE_SIZE = 10;
  let currentPage = 1;

  function totalPages(count) {
    return Math.max(1, Math.ceil(count / PAGE_SIZE));
  }

  function renderPager(total) {
    if (!pager) return;
    pager.innerHTML = '';
    if (total <= PAGE_SIZE) return;
    const pages = totalPages(total);
    for (let p = 1; p <= pages; p++) {
      const start = (p - 1) * PAGE_SIZE + 1;
      const end = Math.min(p * PAGE_SIZE, total);
      const btn = document.createElement('button');
      btn.className = 'page-btn';
      btn.type = 'button';
      btn.textContent = `${start}-${end}`;
      if (p === currentPage) btn.setAttribute('aria-current', 'page');
      btn.addEventListener('click', () => setPage(p));
      pager.appendChild(btn);
    }
  }

  function setPage(page) {
    currentPage = Math.max(1, page);
    if (cachedEntries) {
      let entries = filterEntries(cachedEntries, searchInput.value || '');
      const ranked = rankEntries(entries, currentMode());
      const pages = totalPages(ranked.length);
      if (currentPage > pages) currentPage = pages;
      renderPodium(ranked);
      renderTable(ranked);
      renderPager(ranked.length);
    }
  }

  if (cfg.TITLE) {
    document.title = cfg.TITLE;
    const h1 = document.querySelector('.title');
    if (h1) h1.lastChild && (h1.lastChild.textContent = ' Attendance Leaderboard');
  }

  if (!cfg.SHEET_ID || cfg.SHEET_ID.startsWith('REPLACE_')) {
    configHint.hidden = false;
  }

  async function fetchSheetData(sheetNameOverride) {
    if (!cfg.SHEET_ID) throw new Error('Missing SHEET_ID in config.js');
    const nameFromCfg = cfg.SHEET_NAME && String(cfg.SHEET_NAME).trim().length > 0 ? String(cfg.SHEET_NAME).trim() : '';
    const useName = (sheetNameOverride && String(sheetNameOverride).trim().length > 0) ? String(sheetNameOverride).trim() : nameFromCfg;
    const gid = cfg.GID || '0';
    const tqx = 'out:json';
    const sheetParam = useName ? `sheet=${encodeURIComponent(useName)}` : `gid=${gid}`;
    const url = `https://docs.google.com/spreadsheets/d/${cfg.SHEET_ID}/gviz/tq?tqx=${tqx}&${sheetParam}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch sheet: ' + res.status);
    const txt = await res.text();

    // gviz returns JS function wrapper; extract JSON payload
    const json = JSON.parse(txt.replace(/^[\s\S]*?({.*})[\s\S]*$/, '$1'));
    const cols = (json.table && json.table.cols) ? json.table.cols.map(c => (c.label || c.id || '').trim()) : [];
    const rows = (json.table && json.table.rows) ? json.table.rows.map(r => (r.c || []).map(c => (c ? c.v : null))) : [];
    return { cols, rows };
  }

  function indexColumns(cols) {
    const wantName = (cfg.COLUMNS && cfg.COLUMNS.name) ? cfg.COLUMNS.name.toLowerCase() : 'name';
    const wantAttendance = (cfg.COLUMNS && cfg.COLUMNS.attendance) ? cfg.COLUMNS.attendance.toLowerCase() : 'attendance';
    const wantEvents = (cfg.COLUMNS && cfg.COLUMNS.events) ? cfg.COLUMNS.events.toLowerCase() : null;
    const wantBoard = (cfg.COLUMNS && cfg.COLUMNS.board) ? cfg.COLUMNS.board.toLowerCase() : null;
    let nameIdx = -1, attendanceIdx = -1, eventsIdx = -1, boardIdx = -1;
    cols.forEach((c, i) => {
      const lc = (c || '').toLowerCase();
      if (nameIdx === -1 && lc === wantName) nameIdx = i;
      if (attendanceIdx === -1 && lc === wantAttendance) attendanceIdx = i;
      if (wantEvents && eventsIdx === -1 && lc === wantEvents) eventsIdx = i;
      if (wantBoard && boardIdx === -1 && lc === wantBoard) boardIdx = i;
    });
    return { nameIdx, attendanceIdx, eventsIdx, boardIdx };
  }

  function toEntries(cols, rows) {
    const { nameIdx, attendanceIdx, eventsIdx, boardIdx } = indexColumns(cols);
    if (nameIdx === -1 || attendanceIdx === -1) {
      throw new Error('Could not find required columns. Check config.js COLUMNS.');
    }

    const entries = [];
    for (const r of rows) {
      const name = String(r[nameIdx] ?? '').trim();
      const attendance = Number(r[attendanceIdx] ?? 0);
      const events = eventsIdx >= 0 ? Number(r[eventsIdx] ?? 0) : 0;
      const boardCell = boardIdx >= 0 ? (r[boardIdx] ?? '') : '';
      const isBoard = (boardCell === true) || (String(boardCell).trim().toLowerCase() === 'o') || (String(boardCell).trim().toLowerCase() === 'true');
      if (!name) continue;
      entries.push({ name, attendance, events, isBoard });
    }
    return entries;
  }

  function rankEntries(entries, mode) {
    const usePlus = mode === 'plus';
    const scored = entries.map(e => ({
      ...e,
      effective: usePlus ? Number(e.attendance) + Number(e.events || 0) : Number(e.attendance)
    }));
    // Sort desc by attendance, then name asc
    const sorted = [...scored].sort((a, b) => {
      if (b.effective !== a.effective) return b.effective - a.effective;
      return a.name.localeCompare(b.name);
    });
    // Assign ranks with ties, excluding board members from rank counting
    let lastNonBoardScore = null;
    let lastRank = 0;
    let nonBoardCount = 0;
    const out = [];
    for (const e of sorted) {
      if (e.isBoard) {
        out.push({ ...e, rank: null });
        continue;
      }
      if (e.effective !== lastNonBoardScore) {
        lastRank = nonBoardCount + 1;
        lastNonBoardScore = e.effective;
      }
      nonBoardCount += 1;
      out.push({ ...e, rank: lastRank });
    }
    return out;
  }

  function renderPodium(ranked) {
    podium.innerHTML = '';
    const top3 = ranked.filter(i => !i.isBoard).slice(0, 3);
    const medalClass = ['gold', 'silver', 'bronze'];
    const labels = ['1st', '2nd', '3rd'];
    for (let i = 0; i < top3.length; i++) {
      const item = top3[i];
      const card = document.createElement('div');
      card.className = 'podium-card';
      const scoreHtml = (currentMode() === 'plus')
        ? `<span class="score-total">${item.effective}</span><span class="score-details">(${item.attendance}+<span class=\"events-count\">${item.events || 0}</span>)</span>`
        : `<span class="score-total">${item.effective}</span>`;
      card.innerHTML = `
        <div class="medal ${medalClass[i]}" aria-hidden="true"></div>
        <div class="rank">${labels[i]}</div>
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="score">${scoreHtml}</div>
      `;
      podium.appendChild(card);
    }
  }

  function renderTable(ranked, thresholdIdx) {
    tableBody.innerHTML = '';
    let count = 0;
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, ranked.length);
    const threshold = Number(cfg.THRESHOLD);

    for (let i = startIdx; i < endIdx; i++) {
      const item = ranked[i];
      if (currentMode() === 'plus' && Number.isFinite(threshold) && typeof thresholdIdx === 'number' && item && item._idx === thresholdIdx) {
        const sep = document.createElement('tr');
        sep.className = 'sep-row';
        const td = document.createElement('td');
        td.colSpan = 3;
        td.innerHTML = `<div class="separator"><div class="line"></div><div class="bubble">동경대 교류전을 위한 최소 참여 조건은 출석 ${threshold}회입니다!</div></div>`;
        sep.appendChild(td);
        tableBody.appendChild(sep);
      }
      const tr = document.createElement('tr');
      const scoreHtml = (currentMode() === 'plus')
        ? `<span class="score-total">${item.effective}</span><span class="score-details">(${item.attendance}+<span class=\"events-count\">${item.events || 0}</span>)</span>`
        : `<span class="score-total">${item.effective}</span>`;
      tr.innerHTML = `
        <td class="rank-cell">${item.isBoard ? '<span class="tag-board">임원</span>' : item.rank}</td>
        <td class="name-cell">${escapeHtml(item.name)}</td>
        <td class="score-cell">${scoreHtml}</td>
      `;
      tableBody.appendChild(tr);
      count++;
    }
    rowCount.textContent = count ? `${count} members` : '';
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[ch]);
  }

  function filterEntries(entries, q) {
    if (!q) return entries;
    const needle = q.toLowerCase();
    return entries.filter(e => e.name.toLowerCase().includes(needle));
  }

  function filterRanked(ranked, q) {
    if (!q) return ranked;
    const needle = q.toLowerCase();
    return ranked.filter(e => e.name.toLowerCase().includes(needle));
  }

  let cachedEntries = null;
  let _rankedAll = [];
  let _rankedFiltered = [];
  let _thresholdIdx = -1;
  let selectedTerm = '';
  let defaultTerm = '';

  function computeDefaultTerm(now = new Date()) {
    const y = now.getFullYear();
    const m = now.getMonth() + 1; // 1-12
    if (m >= 3 && m <= 8) return `${y}-1`;
    if (m >= 9) return `${y}-2`;
    return `${y - 1}-2`; // Jan-Feb -> previous year's second semester
  }

  function buildTermList(startYear = 2024) {
    const terms = [];
    const now = new Date();
    const end = computeDefaultTerm(now);
    const [endY, endS] = end.split('-').map((v, i) => i === 0 ? parseInt(v, 10) : parseInt(v, 10));
    for (let y = startYear; y <= endY; y++) {
      terms.push(`${y}-1`);
      if (y < endY || (y === endY && endS === 2)) terms.push(`${y}-2`);
    }
    return terms;
  }

  function renderTermList(terms) {
    if (!termListEl || !termButton) return;
    termListEl.innerHTML = '';
    for (const term of terms) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'term-item';
      item.setAttribute('role', 'option');
      if (term === defaultTerm) item.classList.add('current-term');
      if (term === selectedTerm) item.setAttribute('aria-selected', 'true');
      item.textContent = term;
      item.addEventListener('click', () => {
        termListEl.hidden = true;
        termButton.setAttribute('aria-expanded', 'false');
        if (selectedTerm !== term) {
          selectedTerm = term;
          termButton.textContent = term;
          currentPage = 1;
          cachedEntries = null; // force refetch for new sheet
          refresh();
        }
      });
      termListEl.appendChild(item);
    }
  }

  function currentMode() {
    return (modeSwitch && modeSwitch.getAttribute('data-mode') === 'plus') ? 'plus' : 'base';
  }

  function updateScoreHeader() {
    if (!scoreHeader) return;
    scoreHeader.textContent = currentMode() === 'plus' ? 'Attendance (+Events)' : 'Attendance';
  }

  async function refresh() {
    tableBody.innerHTML = '<tr class="skeleton"><td colspan="3">Loading…</td></tr>';
    podium.innerHTML = '';
    try {
      if (!cachedEntries) {
        const { cols, rows } = await fetchSheetData(selectedTerm);
        cachedEntries = toEntries(cols, rows);
      }
      const query = searchInput.value || '';
      // Compute global ranking first
      _rankedAll = rankEntries(cachedEntries, currentMode()).map((e, idx) => ({ ...e, _idx: idx }));
      // Compute global threshold index on full ranking
      _thresholdIdx = -1;
      if (currentMode() === 'plus' && Number.isFinite(Number(cfg.THRESHOLD))) {
        for (let i = 0; i < _rankedAll.length; i++) {
          if (Number(_rankedAll[i].effective) < Number(cfg.THRESHOLD)) { _thresholdIdx = i; break; }
        }
        if (!(_thresholdIdx > 0 && _thresholdIdx < _rankedAll.length)) _thresholdIdx = -1;
      }
      // Then filter for display
      _rankedFiltered = filterRanked(_rankedAll, query);
      // Clamp current page within bounds in case the result count changed
      const pages = totalPages(_rankedFiltered.length);
      if (currentPage > pages) currentPage = pages;
      renderPodium(_rankedAll);
      renderTable(_rankedFiltered, _thresholdIdx);
      renderPager(_rankedFiltered.length);
      updatedAt.textContent = 'Updated ' + new Date().toLocaleString();
      updateScoreHeader();
    } catch (err) {
      console.error(err);
      updatedAt.textContent = '';
      const message = (selectedTerm && selectedTerm === defaultTerm)
        ? '본 학기의 출석 리더보드는 아직 제공되지 않습니다.'
        : 'Failed to load data. Check config.js and sharing settings.';
      tableBody.innerHTML = `<tr><td colspan="3">${message}</td></tr>`;
    }
  }

  searchInput.addEventListener('input', () => { currentPage = 1; refresh(); });
  refreshBtn.addEventListener('click', () => refresh());

  if (modeSwitch) {
    const toggle = () => {
      const mode = currentMode() === 'base' ? 'plus' : 'base';
      modeSwitch.setAttribute('data-mode', mode);
      modeSwitch.setAttribute('aria-pressed', mode === 'plus' ? 'true' : 'false');
      updateScoreHeader();
      // Re-render using cached data
      if (cachedEntries) {
        currentPage = 1;
        const query = searchInput.value || '';
        _rankedAll = rankEntries(cachedEntries, currentMode()).map((e, idx) => ({ ...e, _idx: idx }));
        _thresholdIdx = -1;
        if (currentMode() === 'plus' && Number.isFinite(Number(cfg.THRESHOLD))) {
          for (let i = 0; i < _rankedAll.length; i++) {
            if (Number(_rankedAll[i].effective) < Number(cfg.THRESHOLD)) { _thresholdIdx = i; break; }
          }
          if (!(_thresholdIdx > 0 && _thresholdIdx < _rankedAll.length)) _thresholdIdx = -1;
        }
        _rankedFiltered = filterRanked(_rankedAll, query);
        renderPodium(_rankedAll);
        renderTable(_rankedFiltered, _thresholdIdx);
        renderPager(_rankedFiltered.length);
      } else {
        refresh();
      }
    };
    modeSwitch.addEventListener('click', toggle);
    modeSwitch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  }

  // Initial load
  // Initialize term selector
  defaultTerm = computeDefaultTerm();
  selectedTerm = defaultTerm;
  if (termButton && termListEl) {
    termButton.textContent = selectedTerm;
    const terms = buildTermList(2024);
    renderTermList(terms);
    termButton.addEventListener('click', () => {
      const expanded = termButton.getAttribute('aria-expanded') === 'true';
      termButton.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      termListEl.hidden = expanded;
    });
    document.addEventListener('click', (e) => {
      if (!termListEl.hidden && !termListEl.contains(e.target) && !termButton.contains(e.target)) {
        termListEl.hidden = true;
        termButton.setAttribute('aria-expanded', 'false');
      }
    });
  }

  refresh();
})();

