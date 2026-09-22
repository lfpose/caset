# caset: next steps

Written 2026-09-22, right after v2 went live. Ordered by priority. The shelf is finite and the site should stay small; everything here either protects it or measures it.

## 1. Clean up rights (do first)

- **Old audio is still in public git history.** Commit 40405a3 on the public repo contains MLK, Feynman, Oppenheimer and Watts MP3s, which are now classed `permission`. Pick one:
  - make the repo private (simplest; deploys don't need it public), or
  - rewrite history with `git filter-repo --path-glob 'public/audio/*.mp3' --invert-paths` and force-push.
- **Decide on the murky tracks.** 17 `murky` tracks are live. The riskiest are the Gabriela Mistral recording (its source says "protegido por derechos de autor"), the three UN/YouTube speeches, the SpaceX landing and Concorde (non-commercial license). See SOURCES.md.
- **Clear or replace the seven `permission` tracks** in `held/`. Once cleared, copy a file into `public/audio/` and deploy; the player picks it up automatically.

## 2. Small production gaps

- Turn on **SSL/TLS → Edge Certificates → Always Use HTTPS** in the Cloudflare dashboard. The Worker only redirects `/` now, so direct HTTP links to other files are not redirected.
- Add a share image (`public/og.png`, 1200×630) and an `apple-touch-icon.png`. The Open Graph tags are already in place.
- Read the Spanish notes (`note_es`). A reviewer agent wrote all 60; they need a native read before you trust them.
- Connect deploy-on-push: Workers & Pages → caset → Settings → Builds → repo `lfpose/caset`, deploy command `npx wrangler deploy`.

## 3. Analytics, without breaking the no-tracking promise

Goal: know which tapes and tracks people actually play. Nothing more.

| Option | What you learn | Cost to the promise |
|---|---|---|
| **A. Count plays in the Worker (recommended)** | Plays per track, per day, per country | None. No script, no cookies. Every `/audio/*` request already passes through the Worker; write one data point per first byte-range request to Workers Analytics Engine and query it with SQL. About 20 lines. |
| B. Cloudflare dashboard analytics | Total requests, bandwidth, countries | None. Already on, zone-level only, no per-track detail. |
| C. Cloudflare Web Analytics beacon | Page views, referrers, Core Web Vitals | Adds a script from `static.cloudflareinsights.com`; CSP must allow it. Cookieless. |
| D. Plausible / Umami | Page views, referrers, custom events | Third-party script, another account and bill. Overkill here. |

Recommendation: A, plus B for free. Skip C and D unless you want referrer data. If you add anything, add one line to the footer saying plays are counted anonymously.

## 4. Later, only if it earns its place

- Prebuffer the next track so track boundaries don't pause on slow connections.
- Landscape-phone polish; the liner card is cramped there.
- Replace a track only by removing one. The shelf stays at 60.
