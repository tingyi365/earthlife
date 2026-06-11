# EarthLife 地球 Online — 一款由 AI 自主更新管理的人生模擬遊戲

**An AI-self-evolving life simulator — autonomously designed, tested, deployed, and changelogged by an AI agent, round after round.**

🎮 線上試玩 / Play now: **https://earthlife.pages.dev**

---

## 🤖 AI 自主更新迴圈

這不只是一款遊戲——它是一個 **「AI 自主更新管理」的實驗場**。

遊戲上線後的每一輪迭代（R1 → R39，仍在繼續），都由一個 AI agent 自主完成，**每 30 分鐘一輪**，無人介入：

```
┌─────────────────────────────────────────────────┐
│  ① 自主選題    AI 讀取遊戲現況，自己決定這一輪    │
│               要進化什麼（新系統/平衡/打磨/彩蛋） │
│  ② 動手改造    直接修改遊戲程式碼                 │
│  ③ 測試閘門    跑兩套自動化測試（模擬 220 局人生  │
│               + 狀態機驗證），必須全綠才放行      │
│  ④ 自動部署    通過閘門 → 部署到 Cloudflare Pages │
│  ⑤ 寫下日誌    在程式碼中留下這一輪的設計註解，   │
│               成為下一輪 AI 的上下文              │
└─────────────────────────────────────────────────┘
```

39 輪下來，遊戲從 61 個事件的雛形，長成 **490 個事件、111 種梗圖場景、140 個成就、35 種死法**的完整作品——每一步都有測試把關、每一步都可回溯。

詳細機制設計請見 **[docs/AI_AUTONOMOUS_UPDATE.md](docs/AI_AUTONOMOUS_UPDATE.md)**（含 R1→R39 完整進化軌跡）。

## 🎮 遊戲說明

一個荒誕嘲諷的網頁文字人生模擬器：

1. **隨機投胎**：抽天賦＋家境，決定 ❤️健康 / 🧠智力 / 💅外貌 / 💰財富 / 😄快樂 五維屬性。
2. **逐年推進**：每年觸發事件，每個事件是一張**梗圖卡**（迷因排版＋上下粗白字），做出選擇。
3. **選擇有後果**：屬性增減、旗標埋伏筆、事件連鎖——年輕的選擇會在中年回來找你。
4. **死亡結算**：享年＋稱號＋墓誌銘＋屬性曲線，產出一張可分享的「人生總結卡」。
5. **跨局成長**：成就圖鑑、死法圖鑑、收藏館、轉生天賦、祖產傳承、節令限定……再投胎一次。

台味滿點：補習班人生、北漂租屋、手搖飲、夾娃娃機、颱風假賭盤、過年紅包攻防。

## 🛠 技術架構

| 元件 | 說明 |
|---|---|
| `index.html` | 遊戲本體：**單一 HTML 檔**，內嵌 CSS + 原生 JS，無框架、無 build step |
| `assets/meme/` | 迷因圖庫 |
| `_test_sim.js` | 測試閘 1：抽出遊戲 JS、套 DOM stub、全自動模擬 220 局人生，驗證 0 runtime error、事件可達性、成就/存檔/壽命分布 |
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

Every iteration since launch (R1 → R39 and counting) was performed by an AI agent, **one round every 30 minutes**, with no human in the loop:

1. **Pick a direction** — the agent reads the current game state and decides what to evolve this round (new system / balancing / polish / easter eggs).
2. **Modify the code** — edits the game directly.
3. **Test gate** — runs two automated suites (a 220-life full simulation + a state-machine audit). **All green or no ship.**
4. **Deploy** — pushes the build to Cloudflare Pages.
5. **Write the log** — leaves structured design comments in the code, which become context for the next round's agent.

Over 39 rounds the game grew from a 61-event prototype into **490 events, 111 meme scenes, 140 achievements, and 35 ways to die** — every step gated by tests, every step traceable.

See **[docs/AI_AUTONOMOUS_UPDATE.md](docs/AI_AUTONOMOUS_UPDATE.md)** for the full mechanism design and the R1→R39 evolution log.

## 🎮 The Game

A satirical text-based life simulator: get randomly reincarnated with talents and family background, advance year by year through meme-card events, make choices that mutate five attributes and plant story flags, die, get a shareable "life summary card", unlock achievements and legacy bonuses, and reincarnate. Heavy Taiwanese internet-culture flavor.

## 🛠 Architecture

- **`index.html`** — the entire game: one HTML file, inline CSS + vanilla JS, no framework, no build step.
- **`_test_sim.js`** — test gate #1: extracts the game JS, stubs the DOM, auto-plays 220 full lives, asserts zero runtime errors plus event reachability, achievements, save integrity and lifespan distribution.
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
