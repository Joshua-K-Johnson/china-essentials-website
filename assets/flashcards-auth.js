(() => {
  "use strict";

  const button = document.querySelector("[data-auth-open-app]");
  const status = document.querySelector("[data-auth-status]");
  if (!(button instanceof HTMLButtonElement) || !(status instanceof HTMLElement)) {
    return;
  }

  const mode = document.body.dataset.authMode;
  const callbackPath = mode === "recovery" ? "reset-password" : "confirmed";
  const source = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const allowedKeys = [
    "code",
    "error",
    "error_code",
    "error_description",
    "type",
  ];
  const forwarded = new URLSearchParams();

  for (const key of allowedKeys) {
    const value = source.get(key) ?? fragment.get(key);
    if (value !== null) forwarded.set(key, value);
  }

  const hasCode = forwarded.has("code");
  const hasError =
    forwarded.has("error") ||
    forwarded.has("error_code") ||
    forwarded.has("error_description");
  const query = forwarded.toString();

  // Remove sensitive callback material from browser history and the address bar.
  window.history.replaceState(null, "", window.location.pathname);

  if (hasCode) {
    status.dataset.state = "ready";
    status.textContent = mode === "recovery"
      ? "Your secure reset session is ready. Open Learn Chinese to choose a new password."
      : "Your email has been verified. Open Learn Chinese to finish signing in.";
    button.disabled = false;
  } else if (hasError) {
    status.dataset.state = "error";
    status.textContent =
      "This email link is invalid or has expired. Open Learn Chinese to request a new one.";
    button.disabled = false;
  } else {
    status.dataset.state = "error";
    status.textContent =
      "This page does not contain a valid authentication response. Request a new email from Learn Chinese.";
    button.disabled = true;
  }

  button.addEventListener("click", () => {
    if (button.disabled || query.length === 0) return;
    window.location.assign(
      `chinaflashcards://auth-callback/${callbackPath}?${query}`,
    );
  });
})();
