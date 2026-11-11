(() => {
  const d = window.AdminDashboard;
  if (!d) return;
  const $ = (s) => document.querySelector(s);
  const errorBox = $('#page-error');
  const showError = (message) => { errorBox.textContent = message; errorBox.hidden = !message; };
  const renderActivity = (points) => {
    const target = $('#activity-chart');
    if (!points?.length || !points.some((item) => Number(item.count) > 0)) {
      target.innerHTML = '<div class="empty-state"><span aria-hidden="true">⌁</span><p>No recorded study activity in this period.</p></div>';
      target.setAttribute('aria-label', 'No recorded study activity in this period');
      return;
    }
    const width = 690, height = 168, left = 38, right = 8, top = 12, bottom = 24;
    const values = points.map((p) => Number(p.count) || 0);
    const max = Math.max(1, ...values);
    const plotW = width-left-right, plotH = height-top-bottom;
    const coords = values.map((value, i) => ({
      x: left + (points.length === 1 ? plotW / 2 : i * plotW / (points.length-1)),
      y: top + plotH - (value / max) * plotH,
      value,
      date: points[i].date,
    }));
    const path = coords.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${path} L${coords.at(-1).x},${height-bottom} L${coords[0].x},${height-bottom} Z`;
    const guides = [0,.5,1].map((ratio) => {
      const y = top + plotH * ratio;
      const label = Math.round(max * (1-ratio));
      return `<line class="chart-grid" x1="${left}" x2="${width-right}" y1="${y}" y2="${y}"/><text class="chart-axis" x="${left-8}" y="${y+3}" text-anchor="end">${label}</text>`;
    }).join('');
    const labelIndices = [...new Set([0, Math.floor((points.length-1)/2), points.length-1])];
    const labels = labelIndices.map((i) => `<text class="chart-axis" x="${coords[i].x}" y="${height-5}" text-anchor="${i===0?'start':i===points.length-1?'end':'middle'}">${new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(`${points[i].date}T12:00:00`))}</text>`).join('');
    const dots = coords.map((p,i) => `<circle class="chart-dot ${i===coords.length-1?'last':''}" cx="${p.x}" cy="${p.y}" r="${i===coords.length-1?5:3.5}"><title>${new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(`${p.date}T12:00:00`))}: ${p.value} learners</title></circle>`).join('');
    target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily active learners, chart scale from zero to ${max}"><defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16a89a" stop-opacity=".32"/><stop offset="1" stop-color="#16a89a" stop-opacity=".04"/></linearGradient></defs>${guides}<path class="chart-area" d="${area}"/><path class="chart-line" d="${path}"/>${dots}${labels}</svg>`;
  };
  const renderHsk = (levels) => {
    const target = $('#hsk-chart');
    const values = Array.isArray(levels) ? levels : [];
    const max = Math.max(1, ...values.map((item) => Number(item.count)||0));
    const width = 650, height = 112, plotTop = 9, plotBottom = 82, group = width / Math.max(1, values.length);
    const bars = values.map((item, index) => {
      const count = Number(item.count)||0;
      const barHeight = count ? Math.max(3, count/max*64) : 3;
      const x = index*group + group*.25;
      const label = item.level === '7-9' ? 'HSK 7–9' : `HSK ${item.level}`;
      return `<g><title>${d.esc(label)}: ${d.fmt(count)} learners</title><rect x="${x}" y="${plotBottom-barHeight}" width="${group*.5}" height="${barHeight}" rx="4" fill="${index===3?'#14877e':'#8dd2ca'}"/><text x="${index*group+group/2}" y="100" text-anchor="middle" fill="#405665" font-size="10">${d.esc(label)}</text><text x="${index*group+group/2}" y="${Math.max(plotTop+10,plotBottom-barHeight-4)}" text-anchor="middle" fill="#233642" font-size="10" font-weight="700">${d.fmt(count)}</text></g>`;
    }).join('');
    target.innerHTML = values.length ? `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Learner counts by currently selected HSK level">${bars}</svg>` : '<p class="loading">No profile level data available.</p>';
  };
  const load = async () => {
    showError('');
    $('#activity-chart').innerHTML = '<p class="loading">Loading learning activity…</p>';
    $('#hsk-chart').innerHTML = '<p class="loading">Loading level counts…</p>';
    try {
      const days = Number($('#date-range').value);
      const data = await d.request({ action: 'overview', days });
      $('#total-users').textContent = d.fmt(data.total_users);
      $('#active-learners').textContent = d.fmt(data.active_learners);
      $('#premium-users').textContent = d.fmt(data.premium_users);
      $('#expiring-grants').textContent = d.fmt(data.expiring_grants);
      $('#period-label').textContent = `Last ${data.period_days} days`;
      renderActivity(data.daily_active);
      renderHsk(data.hsk_levels);
    } catch (error) {
      showError(error.message || 'Dashboard data is unavailable.');
      $('#activity-chart').innerHTML = '<div class="empty-state"><p>Study activity could not be loaded.</p></div>';
      $('#hsk-chart').innerHTML = '<p class="loading">Level counts unavailable.</p>';
    }
  };
  $('#date-range').addEventListener('change', load);
  window.addEventListener('admin:authenticated', load);
  d.currentSession().then((value) => { if (value) load(); });
})();
