# EarthLife 地球 Online — 一款由 AI 自主更新管理的人生模擬遊戲

**An AI-self-evolving life simulator — autonomously designed, tested, deployed, and changelogged by an AI agent, round after round.**

[![▶ Play Now](https://img.shields.io/badge/%E2%96%B6%20%E7%B7%9A%E4%B8%8A%E8%A9%A6%E7%8E%A9-earthlife.pages.dev-7fd7ff?style=for-the-badge)](https://earthlife.pages.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-3fb950?style=for-the-badge)](LICENSE)
[![Single HTML file](https://img.shields.io/badge/Build-%E5%96%AE%E4%B8%80%20HTML%20%E6%AA%94%C2%B7%E7%84%A1%E6%A1%86%E6%9E%B6-ff9d5c?style=for-the-badge)](index.html)
[![AI Self-Evolved](https://img.shields.io/badge/AI%20%E8%87%AA%E4%B8%BB%E9%80%B2%E5%8C%96-R1%20%E2%86%92%20R77%20%E4%BB%8D%E5%9C%A8%E7%B9%BC%E7%BA%8C-ffd24a?style=for-the-badge)](docs/AI_AUTONOMOUS_UPDATE.md)

> 🧬 **一句話賣點**：一個 AI agent，無人介入、每 30 分鐘自我迭代一輪，從 61 個事件的雛形連續進化 **77 輪**，每一輪都得先過自動化測試閘門才准上線——你現在玩到的，是它自己長出來的。

🎮 線上試玩 / Play now: **https://earthlife.pages.dev**

<p align="center">
  <img src="docs/demo.gif" width="62%" alt="EarthLife 實機 demo：投胎抽卡 → 梗圖事件 → 人生總結卡">
</p>
<p align="center"><sub>↑ 實機 demo（持續進化中，目前 R77）</sub></p>

<p align="center">
  <img src="docs/screenshot_start.png" width="31%" alt="開局投胎抽卡">
  <img src="docs/screenshot_event.png" width="31%" alt="梗圖事件卡">
  <img src="docs/screenshot_death.png" width="31%" alt="可分享的人生總結卡">
</p>
<p align="center"><sub>↑ 投胎抽卡 → 逐年梗圖事件 → 可分享的人生總結卡（實機畫面）</sub></p>

---

## 🤖 AI 自主更新迴圈

這不只是一款遊戲——它是一個 **「AI 自主更新管理」的實驗場**。

遊戲上線後的每一輪迭代（**R1 → R77，仍在繼續**），都由一個 AI agent 自主完成，**每 30 分鐘一輪**，無人介入：

```
┌─────────────────────────────────────────────────┐
│  ① 自主選題    AI 讀取遊戲現況，自己決定這一輪    │
│               要進化什麼（新系統/平衡/打磨/彩蛋） │
│  ② 動手改造    直接修改遊戲程式碼                 │
│  ③ 測試閘門    跑兩套自動化測試（模擬數百局人生   │
│               + 狀態機驗證），必須全綠才放行      │
│  ④ 自動部署    通過閘門 → 部署到 Cloudflare Pages │
│  ⑤ 寫下日誌    在程式碼中留下這一輪的設計註解，   │
│               成為下一輪 AI 的上下文              │
└─────────────────────────────────────────────────┘
```

77 輪下來，遊戲從 61 個事件的雛形，長成 **693 個事件、111 種梗圖場景、252 個成就、65 種死法、10 個隱藏結局**、外加多館合一的收藏圖鑑（死法／成就／出身／天賦）的完整作品（數據截至 R77，由測試報告即時統計）——每一步都有測試把關、每一步都可回溯。

詳細機制設計請見 **[docs/AI_AUTONOMOUS_UPDATE.md](docs/AI_AUTONOMOUS_UPDATE.md)**。

### 🧬 AI 自主進化時間軸（R1 → R77 精選里程碑）

> 從一個 61 事件的雛形，AI agent 自己一路把它養成了下面這條軌跡。沒有人類排需求，每一輪都是它讀完現況後自己決定要長什麼：

| 輪次 | AI 這一輪自己決定做的事 |
|---|---|
| **R1** | 🌱 初版上線：梗圖人生模擬雛形（僅 61 事件） |
| **R6** | 🔁 轉生殿：輪迴點換永久天賦＋挑戰模式——遊戲開始有「跨局」維度 |
| **R14** | 🎲 種子化人生：6 碼種子可完整重現一生、中斷續玩（也讓 220 局自動模擬測試成為可能） |
| **R19** | 🏛 收藏館：死法／成就／出身／天賦多館合一 |
| **R28** | ⛓ 多階段事件鏈：年輕的選擇會在中年回來找你 |
| **R48** | 🔒 隱藏結局系統：特定活法才看得到的專屬演出 |
| **R55** | 🇹🇼 台灣時代背景系統：依出生年代分流的人生 |
| **R68** | 📊 屬性被動命運層：五圍每年實質牽動命運，不再只是結算頁的裝飾數字 |
| **R69** | 🏷 人生專屬稱號＋鬼島嘲諷總評卡（截圖級可分享性） |
| **R73** | 💘 台味感情婚戀深化鏈：交友軟體 → 見面 → 求婚 |
| **R74** | 😮‍💨 鬼島「躺平 vs 內捲」打工人事件鏈：22K 震撼教育 → 爆肝升遷／佛系小確幸 → 中年職涯期末考 |
| **R75** | 🌇 晚年退休型態與身後事鏈：含飴弄孫／環島壯遊／廟口棋仙……到自己填的最後一張表格 |
| **R76** | ✈️ 台味「潤學」海外移民人生分流：成年潤出國 → 海外適應 → 思鄉拉扯 → 葉落歸根，與留台人生形成對照 |
| **R77** | 🎓 鬼島升學×校園青春事件鏈：學測放榜 → 大學青春 → 學歷變現三段，智力／財富實際驅動頂大／私校／技職／落榜重考分流，回扣 R50 職涯起薪，含報告週爆肝校園限定死法與升學成就（最新一輪） |

> 一個 AI agent，連續自我迭代 **77 輪**、每一輪都得過測試閘門才放行——這是這個專案最獨特的賣點。完整 77 輪逐輪設計決策直接寫在 `index.html` 的程式碼註解裡，那也是下一輪 AI 的記憶。

## 🎮 遊戲說明

一個荒誕嘲諷的網頁文字人生模擬器：

1. **隨機投胎**：抽天賦＋家境，決定 ❤️健康 / 🧠智力 / 💅外貌 / 💰財富 / 😄快樂 五維屬性。
2. **逐年推進**：每年觸發事件，每個事件是一張**梗圖卡**（迷因排版＋上下粗白字），做出選擇。
3. **選擇有後果**：屬性增減、旗標埋伏筆、事件連鎖——年輕的選擇會在中年回來找你。
4. **死亡結算**：享年＋稱號＋墓誌銘＋屬性曲線，產出一張可分享的「人生總結卡」。
5. **跨局成長**：成就圖鑑、死法圖鑑、收藏館、轉生天賦、祖產傳承、節令限定……再投胎一次。

台味滿點：補習班人生、北漂租屋、手搖飲、夾娃娃機、颱風假賭盤、過年紅包攻防、當兵、健保、網路鄉民、22K 躺平 vs 內捲、晚年退休型錄與身後事、潤出國重開機。

## 🛠 技術架構

| 元件 | 說明 |
|---|---|
| `index.html` | 遊戲本體：**單一 HTML 檔**，內嵌 CSS + 原生 JS，無框架、無 build step |
| `assets/meme/` | 迷因圖庫 |
| `_test_sim.js` | 測試閘 1：抽出遊戲 JS、套 DOM stub、全自動模擬數百局人生，驗證 0 runtime error、事件可達性、成就/存檔/壽命分布 |
| `_test_state.js` | 測試閘 2：狀態機與存檔結構驗證（含舊存檔相容性） |
| 部署 | Cloudflare Pages（靜態託管） |

```bash
# 本地遊玩：直接用瀏覽器開 index.html（支援 file://，零依賴）
# 跑測試（需 Node.js）：
node _test_sim.js
node _test_state.js
```

## 📜 License

[MIT](LICENSE)

> ⚠️ **例外聲明**：遊戲中的迷因圖片（`assets/meme/`）為網路流通梗圖，著作權屬原作者，**不在本專案 MIT 授權範圍內**，僅作 meme 文化合理使用；如您是權利人並希望移除，請開 issue。
> ⚠️ **Exception**: the meme images in `assets/meme/` are widely-circulated internet memes whose copyrights belong to their original creators. They are **not covered by this project's MIT license** and are included solely as meme-culture fair use. If you are a rights holder and would like an image removed, please open an issue.

---
---

# EarthLife — A Life Simulator Autonomously Managed by an AI Agent

🎮 **Play: https://earthlife.pages.dev** (Traditional Chinese)

## 🤖 The Real Headline: the AI Self-Update Loop

This is not just a game — it's a working experiment in **AI-autonomous release management**.

Every iteration since launch (**R1 → R77 and counting**) was performed by an AI agent, **one round every 30 minutes**, with no human in the loop:

1. **Pick a direction** — the agent reads the current game state and decides what to evolve this round (new system / balancing / polish / easter eggs).
2. **Modify the code** — edits the game directly.
3. **Test gate** — runs two automated suites (a multi-hundred-life full simulation + a state-machine audit). **All green or no ship.**
4. **Deploy** — pushes the build to Cloudflare Pages.
5. **Write the log** — leaves structured design comments in the code, which become context for the next round's agent.

Over 77 rounds the game grew from a 61-event prototype into **693 events, 111 meme scenes, 252 achievements, 65 ways to die, 10 hidden endings**, plus a multi-museum collection gallery (deaths / achievements / origins / talents) — figures as of R77, tallied live by the test report. Every step gated by tests, every step traceable.

See **[docs/AI_AUTONOMOUS_UPDATE.md](docs/AI_AUTONOMOUS_UPDATE.md)** for the full mechanism design and evolution log.

## 🎮 The Game

A satirical text-based life simulator: get randomly reincarnated with talents and family background, advance year by year through meme-card events, make choices that mutate five attributes and plant story flags, die, get a shareable "life summary card", unlock achievements and legacy bonuses, and reincarnate. Heavy Taiwanese internet-culture flavor.

## 🛠 Architecture

- **`index.html`** — the entire game: one HTML file, inline CSS + vanilla JS, no framework, no build step.
- **`_test_sim.js`** — test gate #1: extracts the game JS, stubs the DOM, auto-plays hundreds of full lives, asserts zero runtime errors plus event reachability, achievements, save integrity and lifespan distribution.
- **`_test_state.js`** — test gate #2: state machine & save-format audit (incl. legacy-save compatibility).
- **Hosting** — Cloudflare Pages (static).

```bash
# Play locally: just open index.html in a browser (file:// works, zero deps)
# Run the test gates (Node.js):
node _test_sim.js
node _test_state.js
```

## 📜 License

[MIT](LICENSE)

> ⚠️ **Exception**: the meme images in `assets/meme/` are widely-circulated internet memes whose copyrights belong to their original creators. They are **not covered by this project's MIT license** and are included solely as meme-culture fair use. If you are a rights holder and would like an image removed, please open an issue.
> （遊戲中的迷因圖片 `assets/meme/` 為網路流通梗圖，著作權屬原作者，不在本專案 MIT 授權範圍內，僅作 meme 文化合理使用；如為權利人並希望移除請開 issue。）

## 🙌 Credits / 致謝

- **[@tingyi365](https://github.com/tingyi365)** — creator / 作者
- **[@UglyGirl1208](https://github.com/UglyGirl1208)** — collaborator & idea contributor / 協作者・點子貢獻者
