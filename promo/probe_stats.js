/* 探針：抓遊戲統計數字（死法/成就/事件/出身/天賦/劇本），給文案用 */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const target = process.argv[2] || "https://earthlife.pages.dev";
  await page.goto(target, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  const stats = await page.evaluate(() => {
    const out = {};
    try { out.coll = collStats(); } catch (e) { out.coll = "ERR " + e.message; }
    try { out.achievements = ACHIEVEMENTS.length; } catch (e) {}
    try { out.events = (typeof EVENTS !== "undefined" && EVENTS ? EVENTS.length : (buildEvents().length)); } catch (e) { out.events = "ERR " + e.message; }
    try { out.origins = ORIGINS.length; } catch (e) {}
    try { out.talents = TALENTS.length; } catch (e) {}
    try { out.specialDeaths = Object.keys(SPECIAL_DEATHS).length; } catch (e) {}
    try { out.scripts = R56_SCRIPTS.length; } catch (e) {}
    try { out.rebirthTalents = REBIRTH_TALENTS.length; } catch (e) {}
    try { out.legacyPerks = LEGACY_PERKS.length; } catch (e) {}
    try { out.deathTotal = collStats ? undefined : undefined; } catch (e) {}
    try {
      // 死法圖鑑總數：從收藏館統計或 DEATH 定義推
      if (typeof COLL_DEATHS !== "undefined") out.deathDefs = COLL_DEATHS.length;
    } catch (e) {}
    try { out.title = document.title; } catch (e) {}
    return out;
  });
  console.log(JSON.stringify(stats, null, 2));
  await browser.close();
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });
