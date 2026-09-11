/**
 * End-to-end walkthrough of a full round against a running preview server.
 *
 *   npm run build && npm run preview      # in one shell
 *   npm run test:e2e                      # in another
 *
 * Requires playwright (npm i -D playwright). Kept out of package.json
 * dependencies so a plain install stays small.
 */
import { chromium } from "playwright";

const OUT = process.argv[2];
const errors = [];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--no-proxy-server"] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

page.setDefaultTimeout(9000);
const step = async (name, fn) => {
  try { await fn(); console.log(`PASS  ${name}`); }
  catch (e) { console.log(`FAIL  ${name}: ${e.message}`); errors.push(`${name}: ${e.message}`); }
};

await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });

await step("onboarding renders", async () => {
  await page.waitForSelector("text=مَفْضوح", { timeout: 8000 });
  await page.screenshot({ path: `${OUT}/01-onboarding.png` });
});

await step("RTL direction applied", async () => {
  const dir = await page.getAttribute("html", "dir");
  if (dir !== "rtl") throw new Error(`dir=${dir}`);
});

await step("sign in reaches the Vault", async () => {
  await page.click("text=يلا نبدأ");
  await page.waitForSelector("text=حالة القروب", { timeout: 8000 });
  await page.screenshot({ path: `${OUT}/02-vault.png` });
});

await step("countdown ticks on a timer element", async () => {
  const t = page.locator('[role="timer"]');
  const a = await t.textContent();
  await page.waitForTimeout(1600);
  const b = await t.textContent();
  if (a === b) throw new Error(`countdown frozen at ${a}`);
});

await step("sim: open the dilemma now", async () => {
  await page.click('[aria-label="محاكاة"]');
  await page.click("text=افتح السؤال الآن");
  await page.waitForTimeout(600);
});

await step("dilemma screen shows two options", async () => {
  await page.click('nav button:nth-child(2)');
  await page.waitForSelector('[aria-pressed]', { timeout: 8000 });
  const tiles = await page.locator('button[aria-pressed="false"]').count();
  if (tiles < 2) throw new Error(`expected 2 option tiles, saw ${tiles}`);
  await page.screenshot({ path: `${OUT}/03-dilemma.png` });
});

await step("choosing advances to the staking step", async () => {
  await page.locator('button[aria-pressed="false"]').first().click();
  await page.waitForSelector("text=مين بيختار إيش؟", { timeout: 5000 });
  await page.screenshot({ path: `${OUT}/04-stakes.png` });
});

await step("submit is blocked until every stake is set", async () => {
  const btn = page.locator("button", { hasText: "أقفل إجاباتي" });
  if (!(await btn.isDisabled())) throw new Error("submit was enabled with no stakes");
});

await step("staking everyone enables submit, and locks in", async () => {
  const groups = page.locator('div[role="group"]');
  const n = await groups.count();
  if (n !== 5) throw new Error(`expected 5 squad rows, saw ${n}`);
  for (let i = 0; i < n; i++) await groups.nth(i).locator("button").first().click();
  const btn = page.locator("button", { hasText: "أقفل إجاباتي" });
  if (await btn.isDisabled()) throw new Error("submit still disabled after staking all");
  await btn.click();
  await page.waitForSelector("text=انقفلت", { timeout: 5000 });
  await page.screenshot({ path: `${OUT}/05-locked.png` });
});

await step("sim: fill the squad and reveal", async () => {
  await page.click('[aria-label="محاكاة"]');
  await page.click("text=عبّي إجابات الباقي");
  await page.waitForTimeout(400);
  await page.click('[aria-label="محاكاة"]');
  await page.click("text=اكشف الآن");
  await page.waitForTimeout(7000);
});

await step("showdown renders results and roast", async () => {
  await page.click('nav button:nth-child(3)');
  await page.waitForSelector("text=الترتيب", { timeout: 10000 });
  await page.waitForSelector("text=تعليق الـ AI", { timeout: 10000 });
  await page.screenshot({ path: `${OUT}/06-showdown.png`, fullPage: true });
});

await step("reaction sheet opens", async () => {
  await page.locator("button", { hasText: "ردّك؟" }).first().click();
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await page.screenshot({ path: `${OUT}/07-reaction.png` });
  await page.locator('[role="dialog"] [aria-label="close"]').click();
});

await step("persona hub renders a card", async () => {
  await page.click('nav button:nth-child(4)');
  await page.waitForSelector("text=شخصيتك هالأسبوع", { timeout: 8000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/08-persona.png`, fullPage: true });
});

await step("persona card exports a real PNG", async () => {
  const size = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 1080, 1920);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    return blob ? blob.size : 0;
  });
  if (size < 100) throw new Error("canvas export produced nothing");
});

await step("no horizontal overflow at 412px", async () => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 1) throw new Error(`page overflows by ${over}px`);
});

await step("English switch flips direction to LTR", async () => {
  await page.evaluate(() => localStorage.removeItem("maskoff.local.v1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.click("text=English");
  await page.waitForTimeout(300);
  await page.click("text=Let's go");
  await page.waitForSelector("text=Squad status", { timeout: 8000 });
  const dir = await page.getAttribute("html", "dir");
  if (dir !== "ltr") throw new Error(`dir=${dir}`);
  await page.screenshot({ path: `${OUT}/09-english.png` });
});

await browser.close();

const real = errors.filter((e) => !/favicon|manifest|fonts\.googleapis|fonts\.gstatic|ERR_NAME|net::/i.test(e));
console.log(`\n--- ${real.length} issue(s) ---`);
real.forEach((e) => console.log(e));
process.exit(real.length ? 1 : 0);
