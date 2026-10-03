// Headless behaviour trace of caset: drives the deck through 36 states and records what a
// user (and a screen reader) can observe. Never opens a visible window.
//   npx wrangler dev --port 8787 &      (from the repo root)
//   node test/trace.mjs test/out.json   then   node test/compare.mjs test/out.json
// BASE=http://localhost:8787 by default. Optional 2nd arg: screenshot prefix.
// The selectors below (#status, .key[data-action] .key-lbl, .case[data-id], .track[data-i],
// #liner, #liner-body, .lang button[data-lang], #stage) are part of the behaviour contract.
import { createRequire } from "module";
import { execSync } from "child_process";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require(execSync("npm root -g").toString().trim() + "/playwright"); }
const { chromium } = pw;
const [out, shots] = process.argv.slice(2);
const BASE = process.env.BASE || "http://localhost:8787";
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("requestfailed", (r) => errors.push(`requestfailed: ${r.url()}`));
const W = (ms) => page.waitForTimeout(ms);
const trace = [];
async function snap(label) {
  const s = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const norm = (s) => (s || "").replace(/\d+:\d\d \//g, "T /").replace(/\s+/g, " ").trim();
    return {
      hash: location.hash, title: document.title, status: q("#status").textContent,
      keys: [...document.querySelectorAll(".key")].map((b) => `${b.dataset.action}:${b.getAttribute("aria-pressed")}:${b.querySelector(".key-lbl").textContent}:${b.getAttribute("aria-label") || ""}`).join("|"),
      shelf: [...document.querySelectorAll(".case")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.id).join(","),
      shelfLabels: [...document.querySelectorAll(".case")].map((b) => b.getAttribute("aria-label")).join("|"),
      lang: document.documentElement.lang + "/" + q("#liner").lang,
      langBtns: [...document.querySelectorAll(".lang button")].map((b) => b.getAttribute("aria-pressed")).join(","),
      liner: norm(q("#liner-body").innerText),
      tape: q("#liner").style.getPropertyValue("--tape") + q("#liner").style.getPropertyValue("--tape-ink"),
      current: q(".track[aria-current]")?.dataset.i ?? null,
      missing: !!q(".missing"),
      body: document.body.className,
      keyBoxes: [...document.querySelectorAll(".key")].map((b) => b.style.cssText).join("|").length > 0,
    };
  });
  trace.push({ label, ...s });
  if (shots) await page.screenshot({ path: `${shots}-${trace.length}.png` });
}
const key = (a) => page.click(`.key[data-action="${a}"]`, { force: true });
// clear the live region, run an action, then wait until the deck announces the expected result
async function op(fn, re, ms = 30000) {
  await page.evaluate(() => { document.querySelector("#status").textContent = ""; });
  await fn();
  await page.waitForFunction((src) => new RegExp(src).test(document.querySelector("#status").textContent), re.source, { timeout: ms });
  await W(250);
}
const hashTo = (h) => () => page.evaluate((h) => { location.hash = h; }, h);
const clickCase = (id) => () => page.click(`.case[data-id="${id}"]`);
await page.goto(`${BASE}/?t=${Date.now()}`);
await page.evaluate(() => localStorage.setItem("caset-lang", "en"));
await W(1500);
await op(hashTo("#moonshot/b/2"), /loaded/); await snap("deep link");
await op(() => key("play"), /^Playing/); await snap("play");
await op(() => key("stop"), /^Stopped/); await snap("stop");
await op(() => page.keyboard.press("ArrowRight"), /^Fast forward/); await W(500);
await op(() => key("stop"), /^Stopped/); await snap("forward then stop");
await op(() => key("play"), /^Playing/); await key("play"); await W(300); await snap("play twice");
await op(() => key("stop"), /^Stopped/);
await op(() => key("flip"), /^Side A$/); await snap("flip");
await op(() => page.click(".track >> nth=2"), /^Winding/); await snap("click track 3 winding");
await page.waitForFunction(() => /^Playing/.test(document.querySelector("#status").textContent) || document.querySelector('.key[data-action="play"]').getAttribute("aria-pressed") === "true", null, { timeout: 30000 });
await W(300); await snap("click track 3 arrived");
await op(() => key("stop"), /^Stopped/);
await op(clickCase("ocean"), /^Ocean, side A loaded/); await snap("shelf ocean");
await op(hashTo("#voices/a/1"), /^Voices, side A loaded/); await snap("hash voices a1 (held)");
await op(() => key("play"), /^Playing/); await W(1500); await snap("play held");
await op(() => key("stop"), /^Stopped/);
await page.click('.lang button[data-lang="es"]'); await W(200); await snap("ES");
await op(() => key("play"), /^Reproduciendo/); await op(() => key("stop"), /^Detenido/); await snap("ES play stop");
await page.click('.lang button[data-lang="en"]'); await W(200); await snap("EN");
await key("rewind"); await W(300); await snap("rewind at start");
await op(hashTo("#MOONSHOT/A/3"), /^Moonshot, side A loaded/); await snap("uppercase hash");
await hashTo("#nope/x/1")(); await W(500); await snap("bad hash");
await hashTo("#moonshot/a/3")(); await W(500); await snap("same track hash");
await op(() => key("forward"), /^Fast forward/);
await page.waitForFunction(() => document.querySelector("#status").textContent === "End of side", null, { timeout: 60000 }); await W(300); await snap("forward to end");
await key("play"); await W(400); await snap("play at end");
await page.keyboard.press("Space"); await W(300); await snap("space at end");
await op(() => key("rewind"), /^Rewinding/); await W(600); await op(() => key("stop"), /^Stopped/); await snap("rewind a bit");
await op(() => key("eject"), /^Deck empty/); await snap("eject");
await key("play"); await W(300); await snap("play empty");
await key("flip"); await W(300); await snap("flip empty");
// a tape picked while another is loading, then a flip pressed mid-load (ignored), then another tape
await page.evaluate(() => { document.querySelector("#status").textContent = ""; });
await page.click('.case[data-id="words"]'); await W(150); await key("flip"); await W(150);
await page.click('.case[data-id="music"]');
await page.waitForFunction(() => location.hash === "#music/a/1" && /loaded/.test(document.querySelector("#status").textContent), null, { timeout: 60000 }); await W(500); await snap("queue during load");
await op(clickCase("now"), /^Now, side A loaded/);
await page.evaluate(() => { document.querySelector("#status").textContent = ""; });
await key("flip"); await W(150); await page.click('.case[data-id="live"]');
await page.waitForFunction(() => location.hash === "#live/a/1" && /loaded/.test(document.querySelector("#status").textContent), null, { timeout: 60000 }); await W(500); await snap("queue during flip");
await op(() => key("flip"), /^Side B$/); await snap("live side B");
await op(clickCase("ocean"), /^Ocean/); await op(clickCase("live"), /^Live, side B loaded/); await snap("side memory");
await op(() => key("eject"), /^Deck empty/); await snap("eject 2");
await page.setViewportSize({ width: 390, height: 844 }); await W(800);
await op(clickCase("ocean"), /^Ocean, side A loaded/); await snap("phone ocean");
await page.emulateMedia({ reducedMotion: "reduce" }); await W(300);
await op(clickCase("moonshot"), /^Moonshot, side A loaded/); await snap("reduced motion load");
await op(() => key("flip"), /^Side B$/); await snap("reduced motion flip");
await page.evaluate(() => { const gl = document.querySelector("#stage").getContext("webgl2"); gl?.getExtension("WEBGL_lose_context")?.loseContext(); });
await W(800); await snap("context lost");
await op(() => key("play"), /^Playing/); await snap("play after context lost");
await op(() => key("eject"), /^Deck empty/); await snap("eject no gl");
const fs = await import("fs");
fs.writeFileSync(out, JSON.stringify({ trace, errors }, null, 1));
await browser.close();
console.log(`${trace.length} snapshots, ${errors.length} console issues`);
