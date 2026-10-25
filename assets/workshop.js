(() => {
  const workshop = Object.freeze({
    price: '$29 USD',
    sessions: Object.freeze([
      Object.freeze({
        id: 'session_1',
        name: 'Session 1',
        chinaDate: 'Thursday, August 6, 2026',
        chinaTime: '9:00–10:30 PM Asia/Shanghai',
        easternDate: 'Thursday, August 6, 2026',
        easternTime: '9:00–10:30 AM ET'
      }),
      Object.freeze({
        id: 'session_2',
        name: 'Session 2',
        chinaDate: 'Saturday, August 8, 2026',
        chinaTime: '10:00–11:30 AM Asia/Shanghai',
        easternDate: 'Friday, August 7, 2026',
        easternTime: '10:00–11:30 PM ET'
      }),
      Object.freeze({
        id: 'session_3',
        name: 'Session 3',
        chinaDate: 'Sunday, August 9, 2026',
        chinaTime: '10:00–11:30 AM Asia/Shanghai',
        easternDate: 'Saturday, August 8, 2026',
        easternTime: '10:00–11:30 PM ET'
      })
    ])
  });

  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);

  document.querySelectorAll('[data-price]').forEach((element) => { element.textContent = workshop.price; });
  document.querySelectorAll('[data-session-cta]').forEach((link) => { link.href = '#registration'; });

  const sessionOptions = document.querySelector('[data-session-options]');
  if (sessionOptions) {
    sessionOptions.innerHTML = workshop.sessions.map((session) => `
      <label class="cr-session-option">
        <input type="radio" name="sessionId" value="${escapeHtml(session.id)}" required>
        <span class="cr-session-card">
          <span class="cr-session-name">${escapeHtml(session.name)}</span>
          <span class="cr-session-time"><b>China</b><strong>${escapeHtml(session.chinaDate)}</strong><small>${escapeHtml(session.chinaTime)}</small></span>
          <span class="cr-session-time"><b>Eastern</b><strong>${escapeHtml(session.easternDate)}</strong><small>${escapeHtml(session.easternTime)}</small></span>
        </span>
      </label>
    `).join('');
  }

  const form = document.querySelector('#workshop-registration');
  const submitButton = document.querySelector('[data-registration-submit]');
  const formStatus = document.querySelector('[data-form-status]');
  const sandboxBanner = document.querySelector('[data-sandbox-banner]');
  const confirmation = document.querySelector('[data-confirmation]');
  const resumeButton = document.querySelector('[data-resume-payment]');
  let sandboxEnabled = false;
  let registrationEnabled = false;
  let registrationId = sessionStorage.getItem('workshopRegistrationId');
  const clientReferenceId = sessionStorage.getItem('workshopClientReferenceId') || crypto.randomUUID();
  const browserToken = sessionStorage.getItem('workshopBrowserToken') || `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
  sessionStorage.setItem('workshopClientReferenceId', clientReferenceId);
  sessionStorage.setItem('workshopBrowserToken', browserToken);

  class ApiError extends Error {
    constructor(message, { status = 0, nonJson = false } = {}) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.nonJson = nonJson;
    }
  }

  const api = async (path, options = {}) => {
    const response = await fetch(`/api/workshop/${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
    });
    const responseText = await response.text();
    let body = {};
    try { body = responseText ? JSON.parse(responseText) : {}; } catch {
      throw new ApiError(`The checkout service returned HTTP ${response.status} without a JSON response.`, {
        status: response.status,
        nonJson: true
      });
    }
    if (!response.ok && response.status !== 202) {
      throw new ApiError(body.error?.message || 'The request could not be completed.', { status: response.status });
    }
    return body;
  };

  const updateSubmitState = () => {
    if (!submitButton || !form) return;
    submitButton.disabled = !registrationEnabled || !form.checkValidity();
    submitButton.textContent = registrationEnabled
      ? 'Continue to secure payment — $29'
      : 'Registration opening soon';
  };

  const setStatus = (message) => {
    if (formStatus) formStatus.textContent = message;
  };

  const stripCheckoutParameters = () => {
    const url = new URL(window.location.href);
    ['sandbox_test', 'paypal_return', 'paypal_cancel', 'token', 'PayerID', 'reconcile_only', 'registration_id', 'capture_diag'].forEach((key) => url.searchParams.delete(key));
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const showConfirmation = (status, { cancelled = false } = {}) => {
    if (!confirmation || !form || !resumeButton) return;
    form.hidden = true;
    confirmation.hidden = false;
    const joiningReady = Boolean(status.joiningDetailsReady && status.joinUrl);
    confirmation.querySelector('[data-confirmation-title]').textContent = cancelled
      ? 'PayPal Sandbox checkout was cancelled.'
      : status.paymentConfirmed
        ? 'Your test payment is confirmed.'
        : 'Your Sandbox registration is ready.';
    confirmation.querySelector('[data-confirmation-message]').textContent = cancelled
      ? 'No payment was taken. You can safely resume the same Sandbox order without creating another registration.'
      : status.message;
    confirmation.querySelector('[data-confirmation-name]').textContent = status.attendeeName;
    confirmation.querySelector('[data-confirmation-session]').textContent = status.session.name;
    confirmation.querySelector('[data-confirmation-china]').textContent = `${status.session.chinaDate}, ${status.session.chinaTime}`;
    confirmation.querySelector('[data-confirmation-eastern]').textContent = `${status.session.easternDate}, ${status.session.easternTime}`;
    confirmation.querySelector('[data-confirmation-payment]').textContent = status.paymentConfirmed ? 'Confirmed — $29 USD Sandbox' : 'Not captured';
    const zoomLink = confirmation.querySelector('[data-zoom-link]');
    zoomLink.hidden = !joiningReady;
    if (joiningReady) zoomLink.href = status.joinUrl;
    resumeButton.hidden = status.paymentConfirmed;
  };

  const registrationStatus = () => api(`registration-status?id=${encodeURIComponent(registrationId)}`);

  const continueWithOrder = async (order) => {
    sessionStorage.setItem('workshopPayPalOrderId', order.orderId);
    if (order.approvalUrl) {
      window.location.assign(order.approvalUrl);
      return;
    }
    if (order.readyForCapture) {
      const status = await api('paypal/capture-order', {
        method: 'POST',
        body: JSON.stringify({ registrationId, orderId: order.orderId })
      });
      showConfirmation(status);
      return;
    }
    throw new Error('The PayPal Sandbox order is not ready. Please try again.');
  };

  const launchPayPal = async () => {
    if (!registrationId || !resumeButton || !confirmation) return;
    resumeButton.disabled = true;
    resumeButton.textContent = 'Opening PayPal…';
    try {
      const order = await api('paypal/create-order', {
        method: 'POST',
        body: JSON.stringify({ registrationId })
      });
      await continueWithOrder(order);
    } catch (error) {
      resumeButton.disabled = false;
      resumeButton.textContent = 'Resume PayPal checkout';
      confirmation.querySelector('[data-confirmation-message]').textContent = error.message;
    }
  };

  resumeButton?.addEventListener('click', launchPayPal);

  form?.addEventListener('input', updateSubmitState);
  form?.addEventListener('change', updateSubmitState);
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!registrationEnabled || !submitButton || !formStatus || !form.reportValidity()) return;
    submitButton.disabled = true;
    submitButton.textContent = 'Preparing secure checkout…';
    setStatus('Saving your registration before opening PayPal.');
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.clientReferenceId = clientReferenceId;
      payload.browserToken = browserToken;
      const saved = await api('registrations', { method: 'POST', body: JSON.stringify(payload) });
      registrationId = saved.registrationId;
      sessionStorage.setItem('workshopRegistrationId', registrationId);
      const order = await api('paypal/create-order', { method: 'POST', body: JSON.stringify({ registrationId }) });
      await continueWithOrder(order);
    } catch (error) {
      if (registrationId) {
        try {
          showConfirmation(await registrationStatus());
        } catch {
          setStatus(error.message);
        }
      } else {
        updateSubmitState();
        setStatus(error.message);
      }
    }
  });

  const initialiseCheckout = async () => {
    const url = new URL(window.location.href);
    const access = url.searchParams.get('sandbox_test');
    const configPath = access ? `config?access=${encodeURIComponent(access)}` : 'config';
    try {
      const config = await api(configPath);
       sandboxEnabled = config.sandboxEnabled === true && config.environment === 'sandbox';
       registrationEnabled = config.registrationEnabled === true;
    } catch {
      sandboxEnabled = false;
    }
    if (sandboxEnabled && sandboxBanner) {
      sandboxBanner.hidden = false;
      setStatus('Sandbox testing is enabled. No real payment will be taken.');
    }
    updateSubmitState();

    const returned = url.searchParams.get('paypal_return') === '1';
    const cancelled = url.searchParams.get('paypal_cancel') === '1';
    const orderId = url.searchParams.get('token');
    const reconcileOnly = url.searchParams.get('reconcile_only') === '1';
    const reconciliationRegistrationId = url.searchParams.get('registration_id');
    if ((reconcileOnly || returned) && /^[0-9a-f-]{36}$/i.test(reconciliationRegistrationId || '')) {
      registrationId = reconciliationRegistrationId;
    }
    if (!registrationEnabled || !registrationId) {
      if (access) stripCheckoutParameters();
      return;
    }

    try {
      if (returned && orderId) {
        const reconciliation = await api('paypal/reconcile-order', {
          method: 'POST',
          body: JSON.stringify({ registrationId, orderId })
        });
        if (reconciliation.paymentConfirmed) {
          showConfirmation(reconciliation);
          stripCheckoutParameters();
          return;
        }
        if (reconcileOnly) {
          setStatus(`PayPal order state: ${reconciliation.paypalOrderState}. No capture was attempted.`);
          return;
        }
        if (reconciliation.paypalOrderState !== 'APPROVED') {
          setStatus(`PayPal order state: ${reconciliation.paypalOrderState}. No capture was attempted.`);
          return;
        }

        let status;
        try {
          status = await api('paypal/capture-order', {
            method: 'POST',
            body: JSON.stringify({ registrationId, orderId })
          });
        } catch (captureError) {
          if (!(captureError instanceof ApiError) || captureError.status !== 502) throw captureError;
          const recovered = await api('paypal/reconcile-order', {
            method: 'POST',
            body: JSON.stringify({ registrationId, orderId })
          });
          if (recovered.paymentConfirmed) {
            showConfirmation(recovered);
            stripCheckoutParameters();
            return;
          }
          setStatus(`PayPal order state: ${recovered.paypalOrderState}. Capture was not confirmed and was not retried.`);
          return;
        }
        showConfirmation(status);
        stripCheckoutParameters();
        return;
      }
      const status = await registrationStatus();
      if (cancelled || status.paymentConfirmed || status.status === 'payment_created') showConfirmation(status, { cancelled });
      if (cancelled) stripCheckoutParameters();
    } catch (error) {
      setStatus(error.message);
    }
  };

  const heroButton = document.querySelector('.cr-hero [data-session-cta]');
  const stickyCta = document.querySelector('[data-sticky-cta]');
  if (heroButton && stickyCta && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => { stickyCta.hidden = entry.isIntersecting; }, { threshold: 0 });
    observer.observe(heroButton);
  }

  initialiseCheckout();
})();
