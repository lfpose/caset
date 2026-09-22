// Runs only for the routes listed in wrangler.jsonc (run_worker_first): the page itself,
// /audio-status and /audio/*. Everything else (scripts, vendor files, covers) is served
// straight from static assets and never invokes the Worker.
//
// - Plain HTTP to the page is redirected to HTTPS (cf-visitor, so `wrangler dev` is left alone).
// - GET /audio-status?src=/audio/a.mp3&src=... answers which audio files exist, so the
//   player can run a missing track silently without requesting (and 404ing) the file.
// - Audio gets byte ranges, which the asset layer does not answer by itself.
const AUDIO_PATH = /^\/audio\/[a-z0-9/_-]+\.(mp3|m4a|ogg|opus|wav)$/i;
const AUDIO_CACHE = "public, max-age=86400, stale-while-revalidate=604800";
const STATUS_MAX = 12; // one cassette is six tracks; leave room, but not much

async function audioStatus(url, env) {
  const srcs = [...new Set(url.searchParams.getAll("src"))].filter((s) => AUDIO_PATH.test(s)).slice(0, STATUS_MAX);
  const out = {};
  await Promise.all(srcs.map(async (src) => {
    const r = await env.ASSETS.fetch(new Request(new URL(src, url), { method: "HEAD" }));
    out[src] = r.ok;
  }));
  return new Response(JSON.stringify(out), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // which files exist only changes on a deploy
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}

// The original request goes to the asset layer as is, so If-None-Match still gets a 304.
// A Range is then cut here: whole-file ranges ("bytes=0-", what browsers send first) are
// streamed through; only a true partial range is buffered and sliced.
async function audioRange(request, env) {
  const res = await env.ASSETS.fetch(request);
  if (res.status !== 200) return res; // 304, 404, or a 206 if the asset layer ever answers ranges
  const headers = new Headers(res.headers);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", AUDIO_CACHE);
  const full = () => new Response(res.body, { status: 200, headers });

  const range = request.headers.get("range");
  if (!range) return full();
  // If-Range: only answer the range if the client's copy is this exact version
  const ifRange = request.headers.get("if-range");
  if (ifRange && ifRange !== res.headers.get("etag") && ifRange !== res.headers.get("last-modified")) return full();
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  // multiple ranges, bad syntax or a reversed range: ignore the Range header (RFC 9110 14.2)
  if (!m || (m[1] === "" && m[2] === "")) return full();
  if (m[1] !== "" && m[2] !== "" && Number(m[2]) < Number(m[1])) return full();

  const cl = res.headers.get("content-length");
  let buf = null;
  let size;
  if (cl && /^\d+$/.test(cl)) size = Number(cl);
  else { buf = await res.arrayBuffer(); size = buf.byteLength; }

  let start, end;
  if (m[1] === "") {
    const n = Number(m[2]);
    start = n === 0 ? size : Math.max(0, size - n); // "bytes=-0" can never be satisfied
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size) {
    if (!buf) res.body?.cancel();
    headers.set("content-range", `bytes */${size}`);
    headers.delete("content-length");
    headers.set("cache-control", "no-store");
    return new Response(null, { status: 416, headers });
  }
  headers.set("content-range", `bytes ${start}-${end}/${size}`);
  headers.set("content-length", String(end - start + 1));
  if (!buf && start === 0 && end === size - 1) return new Response(res.body, { status: 206, headers });
  if (!buf) buf = await res.arrayBuffer();
  return new Response(buf.slice(start, end + 1), { status: 206, headers });
}

export default {
  async fetch(request, env) {
    const visitor = request.headers.get("cf-visitor");
    const url = new URL(request.url);
    if (visitor && visitor.includes('"http"')) {
      return Response.redirect(`https://${url.host}${url.pathname}${url.search}`, 301);
    }
    if (url.pathname === "/audio-status" && request.method === "GET") return audioStatus(url, env);
    if (request.method === "GET" && AUDIO_PATH.test(url.pathname)) return audioRange(request, env);
    return env.ASSETS.fetch(request);
  },
};
