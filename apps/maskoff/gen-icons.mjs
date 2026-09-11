/**
 * Renders every icon asset from design/icon-art.mjs.
 *
 *   npm run icons
 *
 * Requires playwright (npm i -D playwright) — Chromium is used purely as an
 * SVG rasterizer, so the committed PNGs always match the vector source.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { background, foreground, icon } from "./design/icon-art.mjs";

const RES = "android/app/src/main/res";
const LAUNCHER = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
// Adaptive layers are authored at 108dp; the launcher shows the middle 72dp.
const ADAPTIVE = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const SPLASH = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
  args: ["--no-sandbox", "--no-proxy-server"],
});
const page = await browser.newPage();

async function raster(markup, size, out, { transparent = true, height = size } = {}) {
  await page.setViewportSize({ width: size, height });
  await page.setContent(
    `<body style="margin:0;width:${size}px;height:${height}px">${markup}</body>`,
  );
  writeFileSync(
    out,
    await page.screenshot({
      omitBackground: transparent,
      clip: { x: 0, y: 0, width: size, height },
    }),
  );
}

const at = (svg, size) => svg.replace('width="1024" height="1024"', `width="${size}" height="${size}"`);

const rounded = icon({ rounded: true });
const bleed = icon({ rounded: false });
const bg = background();
const fg = foreground();

// --- Android launcher icons (legacy + round) --------------------------------
for (const [density, size] of Object.entries(LAUNCHER)) {
  const dir = `${RES}/mipmap-${density}`;
  mkdirSync(dir, { recursive: true });
  await raster(at(rounded, size), size, `${dir}/ic_launcher.png`);
  await raster(at(rounded, size), size, `${dir}/ic_launcher_round.png`);
}

// --- Android adaptive layers -----------------------------------------------
for (const [density, size] of Object.entries(ADAPTIVE)) {
  const dir = `${RES}/mipmap-${density}`;
  mkdirSync(dir, { recursive: true });
  await raster(at(fg, size), size, `${dir}/ic_launcher_foreground.png`);
  await raster(at(bg, size), size, `${dir}/ic_launcher_background.png`, { transparent: false });
}

// --- Splash: the mark on the app's black ground -----------------------------
for (const [density, mult] of Object.entries(SPLASH)) {
  const dir = `${RES}/drawable-${density}`;
  mkdirSync(dir, { recursive: true });
  const w = Math.round(320 * mult);
  const h = Math.round(480 * mult);
  const g = Math.round(132 * mult);
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<body style="margin:0;background:#06050A;width:${w}px;height:${h}px;display:grid;place-items:center">
       <div style="width:${g}px;height:${g}px">${at(rounded, g)}</div></body>`,
  );
  writeFileSync(`${dir}/splash.png`, await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } }));
}
mkdirSync(`${RES}/drawable`, { recursive: true });
await page.setViewportSize({ width: 320, height: 480 });
await page.setContent(
  `<body style="margin:0;background:#06050A;width:320px;height:480px;display:grid;place-items:center">
     <div style="width:132px;height:132px">${at(rounded, 132)}</div></body>`,
);
writeFileSync(`${RES}/drawable/splash.png`, await page.screenshot({ clip: { x: 0, y: 0, width: 320, height: 480 } }));

// --- Web / PWA --------------------------------------------------------------
mkdirSync("public", { recursive: true });
writeFileSync("public/icon.svg", rounded);       // purpose: any — masks itself
writeFileSync("public/icon-maskable.svg", bleed); // purpose: maskable — full bleed
await raster(at(rounded, 512), 512, "public/icon-512.png");
await raster(at(rounded, 192), 192, "public/icon-192.png");
await raster(at(rounded, 180), 180, "public/apple-touch-icon.png", { transparent: false });

// --- Store listing ----------------------------------------------------------
mkdirSync("design/out", { recursive: true });
await raster(at(bleed, 512), 512, "design/out/play-store-icon-512.png", { transparent: false });
await raster(at(rounded, 1024), 1024, "design/out/icon-1024.png");

await browser.close();
console.log("icons generated");
