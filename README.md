# caset

A small cassette player that lives at [caset.cl](https://caset.cl).

Zero build: plain files in `public/`, served as Cloudflare Workers static assets. The 3D scene is [three.js](https://threejs.org) r186, vendored in `public/vendor/` (no CDN, no trackers, no external fonts). A one-function Worker in `src/` redirects HTTP to HTTPS.

```sh
npm install
npm run dev      # http://localhost:8787
npm run deploy
```

Controls: space plays/stops, arrow keys wind, the 3D keys are clickable too.
