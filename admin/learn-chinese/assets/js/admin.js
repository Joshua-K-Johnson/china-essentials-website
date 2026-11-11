(() => {
  const config = window.LEARN_CHINESE_ADMIN_CONFIG;
  const storeKey = 'learnChineseAdminSession';
  const session = {
    get() { try { return JSON.parse(sessionStorage.getItem(storeKey) || 'null'); } catch { return null; } },
    set(value) { sessionStorage.setItem(storeKey, JSON.stringify(value)); },
    clear() { sessionStorage.removeItem(storeKey); },
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt = (value) => value == null ? '—' : new Intl.NumberFormat().format(value);
  const date = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—';
  const dateTime = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
  const jwtClaims = (token) => { try { return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); } catch { return {}; } };
  const apiHeaders = (token) => ({ 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${token}` });
  let authClientPromise;
  const getAuthClient = () => {
    authClientPromise ??= import('https://esm.sh/@supabase/supabase-js@2.57.4?bundle')
      .then(({ createClient }) => createClient(config.supabaseUrl, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }));
    return authClientPromise;
  };
  const requireAuthData = ({ data, error }) => {
    if (error) throw new Error(error.message || 'Authentication request failed.');
    return data;
  };
  const verifiedTotp = (factors) => (factors?.totp || []).find((factor) => factor.status === 'verified');
  const authScreen = $('#auth-screen');
  const loginForm = $('#login-form');
  const mfaPanel = $('#mfa-panel');
  const loginMessage = $('#login-message');
  let loginAccessToken = null;
  let challengeId = null;
  let factorId = null;
  let pendingEnrollment = null;

  const showMessage = (message, isError = true) => {
    if (!loginMessage) return;
    loginMessage.textContent = message;
    loginMessage.className = `notice ${isError ? 'notice-error' : 'notice-success'}`;
    loginMessage.hidden = !message;
  };
  const hideAuth = () => { if (authScreen) authScreen.hidden = true; document.body.classList.remove('auth-open'); };
  const showAuth = () => { if (authScreen) authScreen.hidden = false; document.body.classList.add('auth-open'); };
  const acceptSession = (result) => {
    const token = result.access_token;
    if (!token || jwtClaims(token).aal !== 'aal2') throw new Error('Complete two-step verification before continuing.');
    session.set({ access_token: token, refresh_token: result.refresh_token, expires_at: Date.now() + Number(result.expires_in || 3600) * 1000 });
    hideAuth();
    window.dispatchEvent(new CustomEvent('admin:authenticated'));
  };
  const renderEnrollment = (factor) => {
    pendingEnrollment = factor;
    const totp = factor?.totp;
    $('#mfa-title').textContent = 'Set up administrator verification';
    $('#mfa-instructions').textContent = 'Scan this code in an authenticator app, then enter the six-digit code to confirm setup.';
    $('#mfa-qr').src = totp?.qr_code || '';
    $('#mfa-qr').hidden = !totp?.qr_code;
    $('#mfa-secret').textContent = totp?.secret || '';
    $('#mfa-secret-wrap').hidden = !totp?.secret;
    $('#mfa-code-label').textContent = 'Authenticator code';
    $('#mfa-verify').textContent = 'Verify and continue';
    mfaPanel.hidden = false;
    $('#mfa-code').focus();
  };
  const beginMfa = async (authResult) => {
    loginAccessToken = authResult.access_token;
    const supabase = await getAuthClient();
    const factors = requireAuthData(await supabase.auth.mfa.listFactors());
    const existing = verifiedTotp(factors);
    if (!existing) {
      let factor;
      try {
        factor = requireAuthData(await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Learn Chinese Admin' }));
      } catch {
        throw new Error('Authenticator setup is required. Check the Supabase Auth MFA settings and try again.');
      }
      factorId = factor.id;
      renderEnrollment(factor);
      return;
    }
    factorId = existing.id;
    const challenge = requireAuthData(await supabase.auth.mfa.challenge({ factorId }));
    challengeId = challenge.id;
    $('#mfa-title').textContent = 'Verify your sign-in';
    $('#mfa-instructions').textContent = 'Enter the current six-digit code from your authenticator app.';
    $('#mfa-qr').hidden = true;
    $('#mfa-secret-wrap').hidden = true;
    $('#mfa-code-label').textContent = 'Authenticator code';
    $('#mfa-verify').textContent = 'Verify and continue';
    mfaPanel.hidden = false;
    $('#mfa-code').focus();
  };
  const refreshSession = async (current) => {
    if (!current?.refresh_token) return null;
    try {
      const supabase = await getAuthClient();
      const { session: refreshed } = requireAuthData(await supabase.auth.setSession({
        access_token: current.access_token,
        refresh_token: current.refresh_token,
      }));
      if (!refreshed?.access_token || jwtClaims(refreshed.access_token).aal !== 'aal2') return null;
      const next = { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, expires_at: refreshed.expires_at * 1000 };
      session.set(next);
      return next;
    } catch { session.clear(); return null; }
  };
  const currentSession = async () => {
    let current = session.get();
    if (!current) return null;
    if (current.expires_at < Date.now() + 60000) current = await refreshSession(current);
    if (!current || jwtClaims(current.access_token).aal !== 'aal2') { session.clear(); return null; }
    return current;
  };
  const request = async (payload) => {
    const current = await currentSession();
    if (!current) { showAuth(); throw new Error('Your administrator session expired. Please sign in again.'); }
    const response = await fetch(config.functionUrl, { method: 'POST', headers: apiHeaders(current.access_token), body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) { session.clear(); showAuth(); throw new Error('Your session expired. Please sign in again.'); }
    if (response.status === 403) throw new Error(result.error === 'admin_mfa_required' ? 'Administrator two-step verification is required.' : 'This account has not been approved for administrator access.');
    if (!response.ok) throw new Error('Dashboard data is temporarily unavailable. Please try again.');
    return result.data;
  };
  window.AdminDashboard = { request, fmt, date, dateTime, esc, currentSession, async logout() {
    const current = session.get();
    if (current?.access_token) {
      try {
        const supabase = await getAuthClient();
        await supabase.auth.setSession({ access_token: current.access_token, refresh_token: current.refresh_token });
        await supabase.auth.signOut();
      } catch { /* Clear the local session even if sign-out cannot reach Auth. */ }
    }
    session.clear();
    location.href = '/admin/learn-chinese/';
  } };

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('button[type="submit"]', loginForm);
    button.disabled = true;
    showMessage('Signing in…', false);
    try {
      const email = $('#admin-email').value.trim();
      const password = $('#admin-password').value;
      const supabase = await getAuthClient();
      const result = requireAuthData(await supabase.auth.signInWithPassword({ email, password }));
      if (jwtClaims(result.session.access_token).aal === 'aal2') acceptSession(result.session);
      else await beginMfa(result.session);
    } catch (error) { showMessage(error.message || 'Unable to sign in.'); }
    finally { button.disabled = false; }
  });
  $('#mfa-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#mfa-verify');
    button.disabled = true;
    try {
      const code = $('#mfa-code').value.replace(/\s/g, '');
      let challenge = challengeId;
      const supabase = await getAuthClient();
      if (pendingEnrollment) {
        const value = requireAuthData(await supabase.auth.mfa.challenge({ factorId }));
        challenge = value.id;
      }
      const result = requireAuthData(await supabase.auth.mfa.verify({ factorId, challengeId: challenge, code }));
      pendingEnrollment = null;
      challengeId = null;
      acceptSession(result.session);
    } catch (error) { showMessage(error.message || 'That code could not be verified. Check it and try again.'); }
    finally { button.disabled = false; }
  });
  $('#cancel-mfa')?.addEventListener('click', async () => {
    if (loginAccessToken) try { const supabase = await getAuthClient(); await supabase.auth.signOut(); } catch { /* Drop the in-memory session even if Auth cannot be reached. */ }
    session.clear(); loginAccessToken = null; pendingEnrollment = null; challengeId = null; factorId = null; mfaPanel.hidden = true; showMessage('Sign in again when you are ready.', false);
  });
  $('#logout')?.addEventListener('click', (event) => { event.preventDefault(); window.AdminDashboard.logout(); });
  $('#menu-toggle')?.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  $('#global-search')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = $('#global-search-input').value.trim();
    if (location.pathname.startsWith('/admin/learn-chinese/users/')) {
      const input = $('#user-search');
      if (input) { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }
      return;
    }
    location.href = '/admin/learn-chinese/users/' + (value ? `?q=${encodeURIComponent(value)}` : '');
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-drawer]')) { document.body.classList.remove('drawer-open'); $('#user-drawer')?.setAttribute('aria-hidden','true'); }
    if (event.target.closest('[data-close-sidebar]')) document.body.classList.remove('sidebar-open');
  });
  const boot = async () => {
    if (!config || !config.publishableKey) { showAuth(); showMessage('Supabase public configuration is missing.'); return; }
    const value = await currentSession();
    if (!value) showAuth(); else hideAuth();
    document.body.dataset.adminReady = 'true';
  };
  boot();
})();
