/* 抓三張高畫質遊戲截圖（給 preview.png 拼圖用）＋渲染 preview.html → preview.png */
const { chromium } = require("playwright");
const path = require("path");

const URL = "https://earthlife.pages.dev";

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 420, height: 760 },
    deviceScaleFactor: 2,
    locale: "zh-TW", timezoneId: "Asia/Taipei",
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.addStyleTag({ content: "::-webkit-scrollbar{display:none!important}" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(__dirname, "scenes", "shot_start.png") });

  // 死亡結算（網路成癮猝死）
  await page.click('button[onclick="startGame()"]');
  await page.waitForTimeout(800);
  await page.click('button:has-text("帶著這套配裝出生")');
  await page.waitForTimeout(1000);
  for (let i = 0; i < 3; i++) {
    await page.waitForSelector(".choices .choice, .choices .btn", { timeout: 8000 }).catch(() => {});
    const btns = await page.$$(".choices .choice, .choices .btn");
    if (!btns.length) break;
    await btns[0].click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => {
    S.age = Math.max(S.age, 23);
    S.flags = S.flags || {}; S.flags.specialDeath = "boba"; die();
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(__dirname, "scenes", "shot_death.png") });

  // 收藏館死法圖鑑
  await page.evaluate(() => {
    const key = (x) => x.id || x.key || x.k;
    DEATHBOOK.slice(0, 34).forEach((d) => { SAVE.deaths[key(d)] = true; });
    ACHIEVEMENTS.slice(0, 80).forEach((a) => { SAVE.ach[key(a)] = true; });
    COLL_TAB = "death"; COLL_FILTER = "all"; screenCollection();
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(__dirname, "scenes", "shot_coll.png") });
  await page.close();

  // ---- 拼 1280x640 preview ----
  const fp = (n) => "file:///" + path.join(__dirname, "scenes", n).replace(/\\/g, "/");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1280px;height:640px;overflow:hidden;position:relative;
    background:radial-gradient(900px 600px at 30% 40%, #1d1f3a 0%, #0e0f1a 75%);
    font-family:"Microsoft JhengHei","PingFang TC",sans-serif;color:#eef0ff}
  .left{position:absolute;left:64px;top:0;height:100%;width:560px;
    display:flex;flex-direction:column;justify-content:center;z-index:5}
  h1{font-size:84px;font-weight:900;letter-spacing:2px;
    background:linear-gradient(90deg,#ffd95e,#ff9d5c);-webkit-background-clip:text;color:transparent}
  .tag{font-size:32px;color:#cdd3ff;font-weight:700;margin-top:18px;line-height:1.55}
  .feat{font-size:22px;color:#8d93b8;margin-top:22px;line-height:1.9}
  .url{margin-top:26px;font-size:26px;font-weight:800;color:#7fd7ff}
  .shots{position:absolute;right:-30px;top:0;height:100%;width:660px;z-index:1}
  .shot{position:absolute;width:280px;border-radius:18px;border:3px solid rgba(255,217,94,.4);
    box-shadow:0 18px 60px rgba(0,0,0,.65);overflow:hidden}
  .shot img{width:100%;display:block}
  .s1{left:0;top:-60px;transform:rotate(-5deg)}
  .s2{left:215px;top:30px;transform:rotate(3deg);z-index:3;width:300px;border-color:rgba(255,120,140,.5)}
  .s3{left:430px;top:-80px;transform:rotate(7deg)}
  .glow{position:absolute;right:140px;bottom:-180px;width:600px;height:400px;
    background:radial-gradient(closest-side,#ffd95e22,transparent);z-index:0}
  </style></head><body>
  <div class="left">
    <h1>地球 Online</h1>
    <div class="tag">AI 自主進化 66 輪的<br>開源台味人生模擬器</div>
    <div class="feat">🎴 抽卡投胎 · 😂 650+ 梗圖事件<br>💀 58 種死法圖鑑 · 🏆 212 成就</div>
    <div class="url">▶ earthlife.pages.dev — 點開就玩</div>
  </div>
  <div class="glow"></div>
  <div class="shots">
    <div class="shot s1"><img src="${fp("shot_start.png")}"></div>
    <div class="shot s2"><img src="${fp("shot_death.png")}"></div>
    <div class="shot s3"><img src="${fp("shot_coll.png")}"></div>
  </div>
  </body></html>`;
  const fs = require("fs");
  const htmlPath = path.join(__dirname, "scenes", "_preview.html");
  fs.writeFileSync(htmlPath, html);
  const pv = await ctx.newPage();
  await pv.setViewportSize({ width: 1280, height: 640 });
  await pv.goto("file:///" + htmlPath.replace(/\\/g, "/"), { waitUntil: "networkidle" });
  await pv.waitForTimeout(500);
  await pv.screenshot({ path: path.join(__dirname, "preview.png") });
  console.log("preview.png done");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
