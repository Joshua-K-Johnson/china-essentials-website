# China Essentials website

Static website and authentication landing pages for `chinaessentials.app`. The site uses plain HTML, CSS and JavaScript with no build-time dependencies, analytics, credentials or remotely hosted fonts.

## Cloudflare Pages deployment

Use a Cloudflare Pages project connected to the repository containing this folder.

Exact build settings:

- **Production branch:** the repository's production branch (usually `main`)
- **Framework preset:** None
- **Root directory:** `/` (repository root; leave the Cloudflare field blank if it represents the repository root)
- **Build command:** `exit 0`
- **Build output directory:** `website`
- **Environment variables:** the static site needs none; the gated Workshop Sandbox backend uses the bindings documented in `docs/workshop_registration_backend.md`

Then:

1. In Cloudflare, open **Workers & Pages → Create → Pages → Connect to Git**.
2. Select the China Essentials repository and production branch.
3. Enter the exact build settings above and deploy.
4. In the Pages project's **Custom domains** area, add `chinaessentials.app` and optionally `www.chinaessentials.app`.
5. Choose one canonical hostname and redirect the other to it at the Cloudflare zone level.
6. After DNS and TLS are active, verify these URLs return HTTP 200 over HTTPS:
   - `https://chinaessentials.app/`
   - `https://chinaessentials.app/privacy/`
   - `https://chinaessentials.app/delete-account/`
   - `https://chinaessentials.app/terms/`
   - `https://chinaessentials.app/support/`
   - `https://chinaessentials.app/auth/confirmed/`
   - `https://chinaessentials.app/auth/reset-password/`
   - `https://chinaessentials.app/flashcards/auth/confirmed/`
   - `https://chinaessentials.app/flashcards/auth/reset-password/`
   - `https://chinaessentials.app/.well-known/apple-app-site-association`
   - `https://chinaessentials.app/.well-known/assetlinks.json`
7. Confirm the association files are served directly, without redirects, with `Content-Type: application/json`.

Directory-based `index.html` pages provide clean URLs. `_redirects` canonicalises equivalent paths without trailing slashes, and `_headers` supplies security, cache and association-file headers.

Pages Functions are limited to `/api/workshop/*` by `website/_routes.json`; ordinary static requests do not invoke the Worker.

## Local preview

From the repository root:

```sh
python3 -m http.server 4173 --directory website
```

Then open `http://127.0.0.1:4173/`.

## Required review before production

### Android association file — deployment blocker

`website/.well-known/assetlinks.json` contains this deliberate placeholder:

`REPLACE_WITH_REAL_ANDROID_SHA256_SIGNING_CERTIFICATE_FINGERPRINT`

Do **not** treat the Android association file as production-ready until that value is replaced with the real SHA-256 fingerprint for the certificate that signs the distributed Android app. The value normally uses colon-separated uppercase hexadecimal pairs. Use the fingerprint for the actual release signing path (for example, the Google Play App Signing certificate when Play App Signing is used), not an invented or debug fingerprint.

### Privacy and terms

The public Privacy Policy and account-deletion page reflect the current app implementation as of their effective date. Review them whenever authentication, storage, analytics, advertising, purchases, service providers, retention practices or the in-app deletion flow changes. The Terms of Use remain a draft requiring owner or legal review before broad production launch.

### App links

- Confirm the iOS app includes the Associated Domains entitlement for `applinks:chinaessentials.app`.
- Confirm the Android manifest contains the intended verified HTTPS intent filters after the real certificate fingerprint is added.
- Confirm `chinaessentials://auth-callback` is registered by the mobile app before relying on the buttons.
- Confirm `chinaflashcards://auth-callback` is registered by China Flashcards before relying on the Flashcards fallback buttons.
- The original China Essentials auth pages do not display, collect or process query parameters, tokens, authorisation codes or passwords.
- The Flashcards auth pages remove callback data from browser history immediately, never display or persist it, and forward only allowlisted callback fields to the app after an explicit button press. Password changes happen only inside the app.

## Maintenance

- Keep association files at the exact extensionless/JSON paths under `.well-known`.
- Update legal effective dates when policies change.
- Re-check third-party app instructions regularly because their interfaces can change.
- If image assets change, retain the official logo rather than substituting a new mark.
