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

  if (cfg.TITLE) {
    document.title = cfg.TITLE;
    const h1 = document.querySelector('.title');
    if (h1) h1.lastChild && (h1.lastChild.textContent = ' Attendance Leaderboard');
  }

  if (!cfg.SHEET_ID || cfg.SHEET_ID.startsWith('REPLACE_')) {
    configHint.hidden = false;
  }

  async function fetchSheetData() {
    if (!cfg.SHEET_ID) throw new Error('Missing SHEET_ID in config.js');
    const gid = cfg.GID || '0';
    const url = `https://docs.google.com/spreadsheets/d/${cfg.SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;
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
    let nameIdx = -1, attendanceIdx = -1, eventsIdx = -1;
    cols.forEach((c, i) => {
      const lc = (c || '').toLowerCase();
      if (nameIdx === -1 && lc === wantName) nameIdx = i;
      if (attendanceIdx === -1 && lc === wantAttendance) attendanceIdx = i;
      if (wantEvents && eventsIdx === -1 && lc === wantEvents) eventsIdx = i;
    });
    return { nameIdx, attendanceIdx, eventsIdx };
  }

  function toEntries(cols, rows) {
    const { nameIdx, attendanceIdx, eventsIdx } = indexColumns(cols);
    if (nameIdx === -1 || attendanceIdx === -1) {
      throw new Error('Could not find required columns. Check config.js COLUMNS.');
    }

    const entries = [];
    for (const r of rows) {
      const name = String(r[nameIdx] ?? '').trim();
      const attendance = Number(r[attendanceIdx] ?? 0);
      const events = eventsIdx >= 0 ? Number(r[eventsIdx] ?? 0) : 0;
      if (!name) continue;
      entries.push({ name, attendance, events });
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
    // Assign ranks with ties
    let lastScore = null;
    let lastRank = 0;
    return sorted.map((e, idx) => {
      if (e.effective !== lastScore) {
        lastRank = idx + 1;
        lastScore = e.effective;
      }
      return { ...e, rank: lastRank };
    });
  }

  function renderPodium(ranked) {
    podium.innerHTML = '';
    const top3 = ranked.slice(0, 3);
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

  function renderTable(ranked) {
    tableBody.innerHTML = '';
    let count = 0;
    // Determine separator position only in +Events mode
    let insertAt = -1;
    const threshold = Number(cfg.THRESHOLD);
    if (currentMode() === 'plus' && Number.isFinite(threshold)) {
      for (let i = 0; i < ranked.length; i++) {
        if (Number(ranked[i].effective) < threshold) { insertAt = i; break; }
      }
      if (!(insertAt > 0 && insertAt < ranked.length)) insertAt = -1; // must be between two people
    }

    for (let i = 0; i < ranked.length; i++) {
      const item = ranked[i];
      if (i === insertAt) {
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
        <td class="rank-cell">${item.rank}</td>
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

  let cachedEntries = null;

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
        const { cols, rows } = await fetchSheetData();
        cachedEntries = toEntries(cols, rows);
      }
      let entries = cachedEntries;
      const query = searchInput.value || '';
      entries = filterEntries(entries, query);
      const ranked = rankEntries(entries, currentMode());
      renderPodium(ranked);
      renderTable(ranked);
      updatedAt.textContent = 'Updated ' + new Date().toLocaleString();
      updateScoreHeader();
    } catch (err) {
      console.error(err);
      updatedAt.textContent = '';
      tableBody.innerHTML = '<tr><td colspan="3">Failed to load data. Check config.js and sharing settings.</td></tr>';
    }
  }

  searchInput.addEventListener('input', () => refresh());
  refreshBtn.addEventListener('click', () => refresh());

  if (modeSwitch) {
    const toggle = () => {
      const mode = currentMode() === 'base' ? 'plus' : 'base';
      modeSwitch.setAttribute('data-mode', mode);
      modeSwitch.setAttribute('aria-pressed', mode === 'plus' ? 'true' : 'false');
      updateScoreHeader();
      // Re-render using cached data
      if (cachedEntries) {
        let entries = filterEntries(cachedEntries, searchInput.value || '');
        const ranked = rankEntries(entries, currentMode());
        renderPodium(ranked);
        renderTable(ranked);
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
  refresh();
})();

