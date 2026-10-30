# Security

PageInk imports web pages that someone else wrote and shows them to you, and it lets anyone on the internet ask its server to fetch a page. Both are risky by nature, so this document says what is protected, how, and what is not.

## Reporting a problem

Please do not open a public issue for a security problem. Use GitHub's private reporting: **Security → Report a vulnerability** on <https://github.com/Saketh567/pageink>. Include what you did and what happened. There is no bounty, but reports are read and fixed promptly.

## What is protected, and how

### 1. The server must not be turned against the internal network (SSRF)

`/api/fetch` and `/api/render` fetch addresses chosen by strangers. Protections, all in `api/_lib/`:

- **Only public web addresses** (`guard.ts`): `http`/`https` only, ports 80 and 443 only, no credentials in the address, no IP-address hosts, and every address a name resolves to must be public (private, loopback, link-local, cloud-metadata and mapped-IPv6 ranges are refused).
- **The connection is pinned** (`safe-fetch.ts`): the address that was checked is the address connected to, so a DNS server that answers differently the second time (DNS rebinding) gains nothing. Redirects are followed by hand, at most five, and every hop is checked again.
- **The headless browser is forced through a pinning proxy** (`pin-proxy.ts`): Chrome does no DNS of its own. Every page, image, script and redirect it requests is resolved and checked by the proxy, which refuses internal addresses, odd ports, and even `localhost`.
- **Request-level rules in the browser** (`render-guard.ts`): no WebSockets, event streams, pings or media; at most 400 requests and 40 MB per render, so a page cannot use the renderer to flood another site.
- **Browser hardening**: the package's `--disable-web-security` and `--disable-site-isolation-trials` flags are removed; WebRTC is off; the final address is re-checked, so Chrome's error page is never returned as if it were the site.
- **Size and time caps**: 4 MB per page, 10 s to download, 16 s of scrolling and 20 s to load when rendering; responses over Vercel's limit are refused cleanly.
- **Saved pictures, styles and fonts** come through `/api/asset`, which has the same checks (same-origin only, rate limited, public addresses only, pinned connection, redirects re-checked, 4 MB cap). It returns only pictures, stylesheets and fonts; anything else is refused. Responses carry `Content-Security-Policy: default-src 'none'; sandbox`, `Content-Disposition: attachment` and `nosniff`, so a stored file can never run as a page. SVGs are cleaned before they are stored, and saved files are only ever used as `blob:` pictures, styles and fonts.
- **No information leaks**: errors never echo network details or the address; responses are never cached; URLs are never logged.

### 2. Imported pages must not run code or steal data

A page is untrusted. It is cleaned and then shown in a sandbox (`src/import/sanitize.ts`, `src/viewer/viewer.ts`):

- DOMPurify removes scripts, frames, objects, embeds, forms, `<base>`, `srcdoc`, `ping`, `formaction` and `meta refresh`.
- Each snapshot carries its own policy (`script-src 'none'; object-src 'none'; form-action 'none'`) and is displayed in an iframe with `sandbox="allow-same-origin"` and **no `allow-scripts`**, so nothing in it can execute.
- Lazy-image attributes are copied to `src` only on images and sources, and only for relative, `http(s)` or image `data:` addresses (never `javascript:`, `file:` or `blob:`).
- Links inside a page are never followed on their own. Only `http(s)` links are offered, and they open with `noopener`.

### 3. The app itself

- **Headers** (`vercel.json`): a strict Content-Security-Policy (`script-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `form-action 'self'`, `frame-ancestors 'none'`), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy: same-origin`, and a locked-down Permissions-Policy.
- **Your data stays on your device** (IndexedDB). Nothing is uploaded. The optional access key is stored locally and is not included in backups.
- **Restoring a backup is treated as untrusted input** (`src/store/backup.ts`): size limits, strict shape checks, only `http(s)` addresses (so `javascript:` or malformed addresses are refused), the page origin is derived rather than trusted, unknown kinds are refused, and every saved copy is cleaned again on the way in. A bad file is rejected whole.
- **Updates**: the installed app updates itself in the background and offers a reload chip.
- **Debug tools**: `?debug=1` shows a pointer log only; the developer console loads only on a device that opted in (`localStorage['pageink.eruda'] = '1'`).

### 4. Who may call the API

Calls must come from the PageInk app itself (same origin, checked with `Sec-Fetch-Site` or `Origin` against `Host`), or carry the optional `APP_KEY`. Each visitor is rate limited per address (20 fetches and 5 renders per minute), and each server instance has a ceiling. Other websites' scripts cannot call the API from a browser.

### 5. Supply chain

CI runs with read-only permissions, uses a pinned Node version, and fails on critical dependency vulnerabilities. Dependabot proposes updates weekly.

## What is NOT fully protected (known limits)

These are honest gaps, ordered by how much they matter.

1. **The same-origin check is not authentication.** A script outside a browser (for example `curl`) can set the same headers a browser sets, so it can use the API. The only defences are the rate limits below and the caps above. *Fix when needed:* add Vercel BotID or Cloudflare Turnstile (a token the server verifies before doing any work).
2. **Rate limits are counted per server instance.** Vercel runs many instances, so a determined attacker can multiply the limits. *Fix when needed:* a shared counter (Upstash Redis rate limit) plus a daily global budget.
3. **Cost.** Renders use real compute (up to about 50 s of Chrome each). Until a shared limiter exists, set a **spend limit and alerts** in Vercel (Settings → Billing → Spend Management) and a **Firewall rate-limit rule** for `/api/*` (Firewall → Add rule → Rate limit, for example 30 requests per minute per IP). These are dashboard settings only the project owner can make.
4. **Snapshots share the app's origin.** The sandbox has no scripts, but `allow-same-origin` is needed so the app can read the page to place marks. Everything therefore rests on the sanitizer. A stronger design serves snapshots from a separate origin; that is a larger redesign and is on the backlog. Mitigations: strict snapshot policy, no `allow-scripts`, DOMPurify kept current by weekly updates, sanitizer tests with hostile inputs.
5. **`base-uri` allows http(s)** in the app's CSP so a snapshot's `<base>` can resolve relative pictures. It would matter only if an attacker could inject markup into the app's own document, which `script-src 'self'` and the sanitizer prevent.
6. **A dependency advisory** (a memory-exhaustion issue in a protocol library bundled with `puppeteer-core`, which PageInk does not use) is open. Upgrading needs a matching Chrome build and a live render test; Dependabot will propose it.
7. **Pages can track you until they are saved.** A page that has not been saved for offline still loads its pictures and styles from the original site, which sees your address. Once saved (the card says "Saved offline") it loads everything from your device. `Referrer-Policy: no-referrer` stops the site learning which page you were on in the meantime.

## For the project owner: dashboard steps that add real protection

1. Vercel → project → **Settings → Billing / Spend Management**: set a monthly cap and alerts.
2. Vercel → **Firewall → Rules**: add a rate limit on paths starting `/api/` (for example 30 per minute per IP), and enable **Attack Challenge Mode** if you ever see abuse.
3. GitHub → **Settings → Code security**: enable **Private vulnerability reporting**, **Dependabot alerts** and **Secret scanning**.
4. GitHub → **Settings → Branches**: protect `main` (require the CI check to pass before merge).
5. Never put secrets in variables that start with `VITE_`: they are shipped to every visitor's browser.
