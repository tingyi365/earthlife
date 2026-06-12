/* 產 1920x1080 字卡：標題卡 / 結尾卡（不透明）＋ 5 張下橫幅字幕（透明 PNG） */
const { chromium } = require("playwright");
const path = require("path");

const FONT = `"Microsoft JhengHei","PingFang TC",sans-serif`;

function fullCard(title, sub, lines) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1920px;height:1080px;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(1200px 800px at 50% 35%, #1c1e36 0%, #0e0f1a 70%);
    font-family:${FONT};color:#eef0ff;}
  .wrap{text-align:center;max-width:1500px}
  .emoji{font-size:110px;margin-bottom:28px}
  h1{font-size:88px;font-weight:900;letter-spacing:4px;
     background:linear-gradient(90deg,#ffd95e,#ff9d5c);-webkit-background-clip:text;color:transparent;}
  .sub{font-size:46px;margin-top:30px;color:#cdd3ff;font-weight:700;line-height:1.5}
  .lines{margin-top:44px;font-size:34px;color:#8d93b8;line-height:1.9}
  .url{color:#7fd7ff;font-weight:800}
  </style></head><body><div class="wrap">
    <div class="emoji">${title.emoji}</div>
    <h1>${title.text}</h1>
    <div class="sub">${sub}</div>
    ${lines ? `<div class="lines">${lines}</div>` : ""}
  </div></body></html>`;
}

function caption(text) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0}
  body{width:1920px;height:1080px;background:transparent;font-family:${FONT};
    display:flex;align-items:flex-end;justify-content:center}
  .bar{margin-bottom:56px;padding:22px 64px;border-radius:60px;
    background:rgba(10,11,22,.82);border:2px solid rgba(255,217,94,.35);
    box-shadow:0 8px 40px rgba(0,0,0,.55);
    font-size:46px;font-weight:800;color:#ffe9a8;letter-spacing:2px;white-space:nowrap}
  </style></head><body><div class="bar">${text}</div></body></html>`;
}

const CARDS = {
  "card_title": { opaque: true, html: fullCard(
    { emoji: "🌍", text: "地球 Online" },
    "一個 AI 自己改了 <b style='color:#ffd95e'>66 版</b>的人生模擬器",
    "出生靠抽卡・人生靠選擇・登出靠造化") },
  "card_end": { opaque: true, html: fullCard(
    { emoji: "🎲", text: "免安裝・免註冊・點開就玩" },
    `<span class="url">earthlife.pages.dev</span>`,
    `GitHub 開源：github.com/tingyi365/earthlife<br>玩到笑出來，順手給顆 ⭐`) },
  "cap_s1": { html: caption("🎮 歡迎登入《地球 Online》— 史上最爛 MMORPG") },
  "cap_s2": { html: caption("🎴 開局全靠抽：天賦・出身・年代，不可重抽") },
  "cap_s3": { html: caption("😂 650+ 隨機事件，每個選擇都是一張梗圖") },
  "cap_s4": { html: caption("💀 58 種死法圖鑑：網咖猝死・珍珠嗆喉・天燈砸頂") },
  "cap_s5": { html: caption("🏆 212 成就＋8 隱藏結局，收藏控的輪迴地獄") },
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const [name, c] of Object.entries(CARDS)) {
    await page.setContent(c.html, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(__dirname, "scenes", name + ".png"),
      omitBackground: !c.opaque,
    });
    console.log("card", name);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
