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
    let nameIdx = -1, attendanceIdx = -1;
    cols.forEach((c, i) => {
      const lc = (c || '').toLowerCase();
      if (nameIdx === -1 && lc === wantName) nameIdx = i;
      if (attendanceIdx === -1 && lc === wantAttendance) attendanceIdx = i;
    });
    return { nameIdx, attendanceIdx };
  }

  function toEntries(cols, rows) {
    const { nameIdx, attendanceIdx } = indexColumns(cols);
    if (nameIdx === -1 || attendanceIdx === -1) {
      throw new Error('Could not find required columns. Check config.js COLUMNS.');
    }

    const entries = [];
    for (const r of rows) {
      const name = String(r[nameIdx] ?? '').trim();
      const attendance = Number(r[attendanceIdx] ?? 0);
      if (!name) continue;
      entries.push({ name, attendance });
    }
    return entries;
  }

  function rankEntries(entries) {
    // Sort desc by attendance, then name asc
    const sorted = [...entries].sort((a, b) => {
      if (b.attendance !== a.attendance) return b.attendance - a.attendance;
      return a.name.localeCompare(b.name);
    });
    // Assign ranks with ties
    let lastScore = null;
    let lastRank = 0;
    return sorted.map((e, idx) => {
      if (e.attendance !== lastScore) {
        lastRank = idx + 1;
        lastScore = e.attendance;
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
      card.innerHTML = `
        <div class="medal ${medalClass[i]}" aria-hidden="true"></div>
        <div class="rank">${labels[i]}</div>
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="score">${item.attendance}</div>
      `;
      podium.appendChild(card);
    }
  }

  function renderTable(ranked) {
    tableBody.innerHTML = '';
    let count = 0;
    for (const item of ranked) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="rank-cell">${item.rank}</td>
        <td class="name-cell">${escapeHtml(item.name)}</td>
        <td class="score-cell">${item.attendance}</td>
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

  async function refresh() {
    tableBody.innerHTML = '<tr class="skeleton"><td colspan="3">Loading…</td></tr>';
    podium.innerHTML = '';
    try {
      const { cols, rows } = await fetchSheetData();
      let entries = toEntries(cols, rows);
      const query = searchInput.value || '';
      entries = filterEntries(entries, query);
      const ranked = rankEntries(entries);
      renderPodium(ranked);
      renderTable(ranked);
      updatedAt.textContent = 'Updated ' + new Date().toLocaleString();
    } catch (err) {
      console.error(err);
      updatedAt.textContent = '';
      tableBody.innerHTML = '<tr><td colspan="3">Failed to load data. Check config.js and sharing settings.</td></tr>';
    }
  }

  searchInput.addEventListener('input', () => refresh());
  refreshBtn.addEventListener('click', () => refresh());

  // Initial load
  refresh();
})();

