(() => {
  const d = window.AdminDashboard;
  if (!d) return;
  const $ = (s) => document.querySelector(s);
  const body = $('#users-body');
  const errorBox = $('#page-error');
  const state = { page: 1, pageSize: 20, total: 0, search: '', premium: 'all', status: 'all', level: 'all', sort: 'created_at', direction: 'desc', selected: null };
  let debounce;
  const showError = (message) => { errorBox.textContent = message; errorBox.hidden = !message; };
  const loadStats = async () => {
    try {
      const data = await d.request({ action: 'overview', days: 7 });
      $('#total-users').textContent = d.fmt(data.total_users);
      $('#new-users').textContent = d.fmt(data.new_users_week);
      $('#premium-users').textContent = d.fmt(data.premium_users);
    } catch (error) { showError(error.message || 'Account statistics are unavailable.'); }
  };
  const initials = (value) => String(value || '?').trim().split(/\s+/).slice(0,2).map((part) => part[0] || '').join('').toUpperCase() || '?';
  const renderUsers = (response) => {
    const users = response.users || [];
    state.total = response.total || 0;
    $('#result-count').textContent = `${d.fmt(state.total)} accounts`;
    $('#page-summary').textContent = state.total ? `Showing ${(state.page-1)*state.pageSize+1}–${Math.min(state.page*state.pageSize,state.total)} of ${d.fmt(state.total)}` : 'No matching accounts';
    $('#page-number').textContent = String(state.page);
    $('#prev-page').disabled = state.page <= 1;
    $('#next-page').disabled = state.page * state.pageSize >= state.total;
    if (!users.length) { body.innerHTML = '<tr><td colspan="7" class="empty-cell">No learner accounts match these filters.</td></tr>'; return; }
    body.innerHTML = users.map((user) => {
      const display = user.display_name || 'Learner';
      const premium = user.is_premium ? '<span class="access-pill premium">Premium</span>' : '<span class="access-pill">Free</span>';
      const status = user.status === 'suspended' ? '<span class="status-pill suspended">Suspended</span>' : '<span class="status-pill active">Active</span>';
      const studying = user.currently_studying ? `HSK ${d.esc(user.currently_studying)}` : 'Not set';
      return `<tr data-id="${d.esc(user.id)}"><td><div class="user-cell"><span class="user-initials" aria-hidden="true">${d.esc(initials(display))}</span><span><button class="user-name-button" type="button" data-id="${d.esc(user.id)}">${d.esc(display)}</button><span class="user-email">${d.esc(user.email || 'No email')}</span></span></div></td><td><span class="role-label">Learner</span></td><td>${studying}</td><td>${premium}</td><td>${d.date(user.created_at)}</td><td>${d.date(user.last_activity)}</td><td>${status}</td></tr>`;
    }).join('');
  };
  const load = async () => {
    showError('');
    body.innerHTML = '<tr><td colspan="7" class="loading-cell">Loading accounts…</td></tr>';
    try {
      const result = await d.request({ action: 'users', ...state });
      renderUsers(result);
    } catch (error) {
      body.innerHTML = '<tr><td colspan="7" class="empty-cell">Account list could not be loaded.</td></tr>';
      showError(error.message || 'Unable to load accounts.');
    }
  };
  const detailRow = (label, value, extra = '') => `<dt>${label}</dt><dd class="${extra}">${value}</dd>`;
  const loadDetail = async (id) => {
    state.selected = id;
    document.body.classList.add('drawer-open');
    const drawer = $('#user-drawer');
    drawer.setAttribute('aria-hidden','false');
    $('#detail-name').textContent = 'Loading profile…';
    $('#detail-content').innerHTML = '<div class="detail-placeholder">Loading account details…</div>';
    try {
      const user = await d.request({ action: 'user', userId: id });
      if (!user) throw new Error('This account could not be found.');
      const display = user.display_name || 'Learner';
      $('#detail-name').textContent = display;
      const learning = user.learning || {}, premium = user.premium || {};
      const statusClass = user.status === 'suspended' ? 'suspended' : 'active';
      $('#detail-content').innerHTML = `<div class="detail-profile"><span class="user-initials" aria-hidden="true">${d.esc(initials(display))}</span><div><h3>${d.esc(display)}</h3><p>${d.esc(user.email || 'No email')}</p></div></div>
        <section class="detail-section"><h3>Account details</h3><dl class="detail-list">${detailRow('Email',d.esc(user.email||'—'))}${detailRow('Supabase user ID',d.esc(user.id),'detail-id')}${detailRow('Joined',d.dateTime(user.created_at))}${detailRow('Currently studying',user.studying_level?`HSK ${d.esc(user.studying_level)}`:'Not set')}${detailRow('Proficiency',user.proficiency_level?`HSK ${d.esc(user.proficiency_level)}`:'Not set')}${detailRow('Status',`<span class="status-pill ${statusClass}">${d.esc(user.status)}</span>`)}</dl></section>
        <section class="detail-section"><h3>Premium access</h3><dl class="detail-list">${detailRow('Access',premium.is_premium?'Premium':'Free')}${detailRow('Source',d.esc(premium.source||'—'))}${detailRow('Expires',d.dateTime(premium.expires_at))}</dl></section>
        <section class="detail-section"><h3>Learning summary <span class="panel-caption">Lifetime / current profile</span></h3><dl class="detail-list">${detailRow('Cards reviewed',d.fmt(learning.cards_reviewed))}${detailRow('Study sessions',d.fmt(learning.sessions))}${detailRow('Current streak',`${d.fmt(learning.current_streak)} days`)}${detailRow('Grammar completed',`${d.fmt(learning.grammar_completed)} / ${d.fmt(learning.grammar_total)}`)}${detailRow('Personal decks',d.fmt(learning.personal_decks))}${detailRow('Last recorded study',d.date(learning.last_activity))}</dl></section>
        <p class="panel-caption">Profile photos are stored locally on learners’ devices and are not available to administrators.</p>`;
    } catch (error) {
      $('#detail-name').textContent = 'User details';
      $('#detail-content').innerHTML = `<div class="detail-placeholder">${d.esc(error.message || 'Unable to load user details.')}</div>`;
    }
  };
  const query = new URLSearchParams(location.search).get('q');
  if (query) { $('#user-search').value = query; $('#global-search-input').value = query; state.search = query; }
  const applyFilters = () => {
    state.page = 1;
    state.search = $('#user-search').value.trim();
    state.premium = $('#premium-filter').value;
    state.status = $('#status-filter').value;
    state.level = $('#level-filter').value;
    load();
  };
  $('#user-search').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(applyFilters, 280); });
  ['premium-filter','status-filter','level-filter'].forEach((id) => $(`#${id}`).addEventListener('change', applyFilters));
  body.addEventListener('click', (event) => { const button = event.target.closest('[data-id]'); if (button) loadDetail(button.dataset.id); });
  $('#prev-page').addEventListener('click', () => { if (state.page>1) { state.page--; load(); } });
  $('#next-page').addEventListener('click', () => { if (state.page*state.pageSize<state.total) { state.page++; load(); } });
  document.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => { const column = button.dataset.sort; state.direction = state.sort === column && state.direction === 'desc' ? 'asc' : 'desc'; state.sort = column; load(); }));
  const initialize = () => { loadStats(); load(); };
  window.addEventListener('admin:authenticated', initialize);
  d.currentSession().then((value) => { if (value) initialize(); });
  window.addEventListener('popstate', () => { document.body.classList.remove('drawer-open'); $('#user-drawer').setAttribute('aria-hidden','true'); });
})();
