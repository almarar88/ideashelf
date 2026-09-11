import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const svg = readFileSync("public/icon.svg", "utf8");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--no-proxy-server"] });
const page = await browser.newPage();

// Launcher icon densities, plus the adaptive-icon foreground (which must sit
// inside a 66% safe zone because the launcher masks and animates it).
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const RES = "android/app/src/main/res";

const shot = async (html, w, h, out) => {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  writeFileSync(out, buf);
};

const full = (size) =>
  `<body style="margin:0"><div style="width:${size}px;height:${size}px">${svg.replace("<svg", `<svg width="${size}" height="${size}"`)}</div></body>`;

// Foreground: the mask glyph only, no plate — the launcher supplies the shape.
const foreground = (size) => {
  const inner = Math.round(size * 0.62);
  const pad = Math.round((size - inner) / 2);
  const glyph = svg.replace(/<rect width="512" height="512" rx="118" fill="#0B0910"\/>/, "");
  return `<body style="margin:0"><div style="width:${size}px;height:${size}px;display:grid;place-items:center">
    <div style="width:${inner}px;height:${inner}px;margin:${pad}px">${glyph.replace("<svg", `<svg width="${inner}" height="${inner}"`)}</div>
  </div></body>`;
};

for (const [density, size] of Object.entries(DENSITIES)) {
  const dir = `${RES}/mipmap-${density}`;
  mkdirSync(dir, { recursive: true });
  await shot(full(size), size, size, `${dir}/ic_launcher.png`);
  await shot(full(size), size, size, `${dir}/ic_launcher_round.png`);
  await shot(foreground(Math.round(size * 1.5)), Math.round(size * 1.5), Math.round(size * 1.5), `${dir}/ic_launcher_foreground.png`);
}

// Play Store listing icon.
mkdirSync("android/app/src/main/res/drawable", { recursive: true });
await shot(full(512), 512, 512, "play-store-icon.png");

// Splash: the glyph centered on the app's black ground.
for (const [density, mult] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
  const w = Math.round(320 * mult), h = Math.round(480 * mult);
  const g = Math.round(120 * mult);
  const dir = `${RES}/drawable-${density}`;
  mkdirSync(dir, { recursive: true });
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<body style="margin:0;background:#000;width:${w}px;height:${h}px;display:grid;place-items:center">
    <div style="width:${g}px;height:${g}px">${svg.replace("<svg", `<svg width="${g}" height="${g}"`)}</div></body>`);
  writeFileSync(`${dir}/splash.png`, await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } }));
}
mkdirSync(`${RES}/drawable`, { recursive: true });
await page.setViewportSize({ width: 320, height: 480 });
await page.setContent(`<body style="margin:0;background:#000;width:320px;height:480px;display:grid;place-items:center">
  <div style="width:120px;height:120px">${svg.replace("<svg", '<svg width="120" height="120"')}</div></body>`);
writeFileSync(`${RES}/drawable/splash.png`, await page.screenshot({ clip: { x: 0, y: 0, width: 320, height: 480 } }));

await browser.close();
console.log("icons + splash generated");
