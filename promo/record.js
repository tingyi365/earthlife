/* EarthLife 宣傳影片素材錄影：
   開 earthlife.pages.dev 實際玩一輪，分 5 個亮點場景各錄一段 webm。
   技巧：viewport 960x1708 + html zoom:2 → 遊戲以 2x 實際像素渲染，錄影清晰。 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "scenes");
const URL = "https://earthlife.pages.dev";
const VW = 960, VH = 1708;

const ZOOM_CSS = `
  html { zoom: 2; }
  ::-webkit-scrollbar { display: none !important; }
  html { scrollbar-width: none; }
`;

async function newScenePage(ctx) {
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    // 固定世界跑馬燈隨機性無所謂；只求首訪乾淨
  });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.addStyleTag({ content: ZOOM_CSS });
  await page.waitForTimeout(800);
  return page;
}

async function smoothScroll(page, to, ms) {
  await page.evaluate(([to]) => window.scrollTo({ top: to, behavior: "smooth" }), [to]);
  await page.waitForTimeout(ms);
}

async function saveVideo(page, name) {
  const v = page.video();
  await page.close();
  const p = await v.path();
  const dest = path.join(OUT, name + ".webm");
  fs.copyFileSync(p, dest);
  console.log("saved", name, fs.statSync(dest).size);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    recordVideo: { dir: OUT, size: { width: VW, height: VH } },
    locale: "zh-TW",
    timezoneId: "Asia/Taipei",
  });

  /* ---- S1 開始畫面 ---- */
  let page = await newScenePage(ctx);
  await page.waitForTimeout(2500);
  await smoothScroll(page, 400, 1500);
  await smoothScroll(page, 0, 1200);
  await saveVideo(page, "s1_start");

  /* ---- S2 抽卡投胎（開局抽出身）---- */
  page = await newScenePage(ctx);
  await page.waitForTimeout(600);
  await page.click('button:has-text("抽卡投胎")');
  await page.waitForTimeout(2800);
  await smoothScroll(page, 500, 1800);
  await smoothScroll(page, 900, 1600);
  await saveVideo(page, "s2_birth");

  /* ---- S3 事件選擇（連玩多個事件，露出梗圖選項）---- */
  page = await newScenePage(ctx);
  await page.click('button[onclick="startGame()"]');
  await page.waitForTimeout(1200);
  await page.click('button:has-text("帶著這套配裝出生")');
  await page.waitForTimeout(1500);
  for (let i = 0; i < 9; i++) {
    const alive = await page.evaluate(() => typeof S !== "undefined" && S.alive);
    if (!alive) break;
    await page.waitForSelector(".choices .choice, .choices .btn", { timeout: 8000 }).catch(() => {});
    const btns = await page.$$(".choices .choice, .choices .btn");
    if (!btns.length) break;
    const pick = btns[Math.floor(Math.random() * btns.length)];
    await pick.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(450);
    await pick.click().catch(() => {});
    await page.waitForTimeout(1250);
  }
  await saveVideo(page, "s3_events");

  /* ---- S4 稀有死法 + 死亡結算 ---- */
  page = await newScenePage(ctx);
  await page.click('button[onclick="startGame()"]');
  await page.waitForTimeout(900);
  await page.click('button:has-text("帶著這套配裝出生")');
  await page.waitForTimeout(1200);
  // 快速玩幾個事件累積人生，再觸發稀有死法「網路成癮猝死」
  for (let i = 0; i < 4; i++) {
    await page.waitForSelector(".choices .choice, .choices .btn", { timeout: 8000 }).catch(() => {});
    const btns = await page.$$(".choices .choice, .choices .btn");
    if (!btns.length) break;
    await btns[0].click().catch(() => {});
    await page.waitForTimeout(700);
  }
  await page.evaluate(() => {
    S.age = Math.max(S.age, 28);
    S.flags = S.flags || {};
    S.flags.specialDeath = "netaddict";
    die();
  });
  await page.waitForTimeout(2600);
  await smoothScroll(page, 700, 1800);
  await smoothScroll(page, 1500, 1800);
  await smoothScroll(page, 2400, 1800);
  await saveVideo(page, "s4_death");

  /* ---- S5 收藏館：死法圖鑑 + 成就 ---- */
  page = await newScenePage(ctx);
  await page.evaluate(() => {
    // 種一批已解鎖的圖鑑（純展示用，動 localStorage 不動遊戲檔案）
    const key = (x) => x.id || x.key || x.k;
    DEATHBOOK.slice(0, 34).forEach((d) => { SAVE.deaths[key(d)] = true; });
    ACHIEVEMENTS.slice(0, 80).forEach((a) => { SAVE.ach[key(a)] = true; });
    Object.keys(SAVE.origins || {});
    ORIGINS.slice(0, 12).forEach((o) => { SAVE.origins[key(o)] = true; });
    COLL_TAB = "death"; COLL_FILTER = "all";
    screenCollection();
  });
  await page.waitForTimeout(2200);
  await smoothScroll(page, 800, 1800);
  await smoothScroll(page, 1700, 1800);
  await page.evaluate(() => { COLL_TAB = "ach"; renderCollection(); window.scrollTo(0, 0); });
  await page.waitForTimeout(2000);
  await smoothScroll(page, 900, 1600);
  await saveVideo(page, "s5_coll");

  await ctx.close();
  await browser.close();
  console.log("ALL DONE");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
