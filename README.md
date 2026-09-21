# caset

A small cassette player that lives at [caset.cl](https://caset.cl).

Zero build: plain files in `public/`, served as Cloudflare Workers static assets. The 3D scene is [three.js](https://threejs.org) r186, vendored in `public/vendor/` (no CDN, no trackers, no external fonts). A one-function Worker in `src/` redirects HTTP to HTTPS.

```sh
npm install
npm run dev      # http://localhost:8787
npm run deploy
```

Controls: space plays/stops, arrow keys wind, the 3D keys are clickable too. Pick a track from the list; the whole side is one continuous tape.

## Audio

`public/audio/` holds thirteen short historical recordings (mono MP3, 80 kbps, loudness-normalised) and `tracks.json` with their order and durations. Sources are archive.org, firstsounds.org, NASA and a few YouTube uploads; several are public domain, others (MLK, Alan Watts, BBC, NBC material) remain under copyright and are here as a personal listening tape, not for redistribution.
