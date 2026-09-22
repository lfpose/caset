# caset

A small cassette player that lives at [caset.cl](https://caset.cl).

Zero build: plain files in `public/`, served as Cloudflare Workers static assets. The 3D scene is [three.js](https://threejs.org) r186, vendored minified in `public/vendor/` (no CDN, no trackers, no external fonts). A small Worker in `src/` runs only for the page, `/audio-status` and `/audio/*` (see `run_worker_first` in `wrangler.jsonc`): it redirects HTTP to HTTPS, answers which audio files exist, and serves byte ranges for audio. Everything else is served as plain static assets. For HTTP requests to other paths, turn on "Always Use HTTPS" for the caset.cl zone in the Cloudflare dashboard.

```sh
npm install
npm run dev      # http://localhost:8787
npm run deploy
```

Controls: space plays/stops, arrow keys wind, the 3D keys are clickable too. Pick a track from the list; the whole side is one continuous tape.

## Audio

Ten cassettes, two sides of three tracks each, are described in `public/tapes.json` (title, who, date, duration, English and Spanish notes, rights, and a credit line where the source asks for one). The audio lives at `public/audio/<cassette>/<track>.mp3`.

Where every recording came from, and its licence, is in `SOURCES.md`. Tracks marked `permission` are not deployed: their files sit in the gitignored `held/` folder, and on the site they run silent and name the missing file.
