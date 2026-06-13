# EarthLife 地球 Online — 一款由 AI 自主更新管理的人生模擬遊戲

**An AI-self-evolving life simulator — autonomously designed, tested, deployed, and changelogged by an AI agent, round after round.**

[![▶ Play Now](https://img.shields.io/badge/%E2%96%B6%20%E7%B7%9A%E4%B8%8A%E8%A9%A6%E7%8E%A9-earthlife.pages.dev-7fd7ff?style=for-the-badge)](https://earthlife.pages.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-3fb950?style=for-the-badge)](LICENSE)
[![Single HTML file](https://img.shields.io/badge/Build-%E5%96%AE%E4%B8%80%20HTML%20%E6%AA%94%C2%B7%E7%84%A1%E6%A1%86%E6%9E%B6-ff9d5c?style=for-the-badge)](index.html)
[![AI Self-Evolved](https://img.shields.io/badge/AI%20%E8%87%AA%E4%B8%BB%E9%80%B2%E5%8C%96-R1%20%E2%86%92%20R93%20%E4%BB%8D%E5%9C%A8%E7%B9%BC%E7%BA%8C-ffd24a?style=for-the-badge)](docs/AI_AUTONOMOUS_UPDATE.md)
[![Zero human-written game code](https://img.shields.io/badge/%E9%81%8A%E6%88%B2%E7%A8%8B%E5%BC%8F%E7%A2%BC-100%25%20AI%20%E6%89%8B%E5%AF%AB%C2%B7%E9%9B%B6%E4%BA%BA%E9%A1%9E%E6%8F%92%E6%89%8B-ff5d8f?style=for-the-badge)](docs/AI_AUTONOMOUS_UPDATE.md)

> 🧬 **這是一款「自己進化自己」的遊戲——一個 AI agent 自己寫出來、自己養大的。** 從 61 個事件的雛形開始，沒有人類排需求、沒有人類改一行 code，AI 每 30 分鐘自我迭代一輪：自己選題、自己改碼、自己跑測試、自己部署、自己寫日誌，全程無人介入。到今天它已經**連續自主進化 93 輪（R1 → R93，仍在繼續）**，且每一輪都得先過自動化測試閘門才准上線。**每一行遊戲程式碼都是 AI 手寫、零人類手寫遊戲碼。** 你現在玩到的這個版本，不是誰設計的——是它自己一輪一輪長出來的。

🎮 線上試玩 / Play now: **https://earthlife.pages.dev**

<p align="center">
  <img src="docs/demo.gif" width="62%" alt="EarthLife 實機 demo：投胎抽卡 → 梗圖事件 → 人生總結卡">
</p>
<p align="center"><sub>↑ 實機 demo（持續進化中，目前 R93）</sub></p>

<p align="center">
  <img src="docs/screenshot_start.png" width="31%" alt="開局投胎抽卡">
  <img src="docs/screenshot_event.png" width="31%" alt="梗圖事件卡">
  <img src="docs/screenshot_death.png" width="31%" alt="可分享的人生總結卡">
</p>
<p align="center"><sub>↑ 投胎抽卡 → 逐年梗圖事件 → 可分享的人生總結卡（實機畫面）</sub></p>

---

## 🤖 AI 自主更新迴圈

這不只是一款遊戲——它是一個 **「AI 自主更新管理」的實驗場**。

遊戲上線後的每一輪迭代（**R1 → R93，仍在繼續**），都由一個 AI agent 自主完成，**每 30 分鐘一輪**，無人介入、**全程零人類手寫遊戲碼**：

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

93 輪下來，遊戲從 61 個事件的雛形，長成 **726 個事件、111 種梗圖場景、269 個成就、66 種死法、10 個隱藏結局**、外加多館合一的收藏圖鑑（死法／成就／出身／天賦）的完整作品（內容數據截至 R84，由測試報告即時統計，R85→R93 另有新增）——每一步都有測試把關、每一步都可回溯。

詳細機制設計請見 **[docs/AI_AUTONOMOUS_UPDATE.md](docs/AI_AUTONOMOUS_UPDATE.md)**。

### 🧬 AI 自主進化時間軸（R1 → R93 精選里程碑）

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
| **R77** | 🎓 鬼島升學×校園青春事件鏈：學測放榜 → 大學青春 → 學歷變現三段，智力／財富實際驅動頂大／私校／技職／落榜重考分流，回扣 R50 職涯起薪，含報告週爆肝校園限定死法與升學成就 |
| **R79** | 🎖️ 鬼島兵役人生支線：填補升學畢業與職涯之間的役齡真空——役男體檢「體位判定」依體質分流常備役／替代役／免役／軍官志願役，含免役被酸的社會眼光、軍官當一份職涯（回扣 R50）、軍中操演熱衰竭限定死法，與既有 R58 兵役鏈並行零汙染 |
| **R81** | 📜 鬼島時代大事記・時代背景事件系統：依角色出生世代錨定「當下日曆年」確定性插播時代節點（戒嚴尾巴→解嚴開放→……→AI 浪潮），不同世代撞到不同歷史組合，每節點帶屬性檢定抉擇，結算回顧列出「你這一生見證過的時代」 |
| **R83** | 🏪 台味創業開店人生支線：辭頭路自己當頭家——選業態（夜市攤販／手搖飲／雞排鹽酥雞／早餐店／加盟連鎖）→ 資金借貸、展店守成、用料良心三道屬性檢定抉擇 → 五種頭家結局（慘賠收攤／小確幸穩定／上市上櫃連鎖帝國／被加盟總部坑／在地傳奇老店），回扣 R50 職涯與 R57 理財 |
| **R84** | 🎣 台味詐騙之島人生支線：接到可疑機會後三線分流（被害者／車手／反詐），智力決定識破、財富決定損失、魅力決定組織爬升 → 五種結局（血本無歸資深韭菜／車手被攔吃牢飯／升機房幹部洗錢黑化／金盆洗手反詐尖兵／識破反釣領檢舉獎金），黑化結局帶代價反諷不美化犯罪 |
| **R86** | 😮‍💨 台味血汗職場打工人事件鏈：受僱上班族日常三分流（爆肝衝刺／躺平擺爛／跳槽談判），健康賣肝、魅力×智力跳槽、財富躺平的屬性檢定 → 五種結局（爬上管理職／爆肝中年過勞畢業／跳槽贏家提早 FIRE／中年被資遣／全職躺平低慾望仙人），新增爆肝過勞死限定死法＋6 成就，回扣 R74 躺平 vs 內捲 |
| **R87** | 🏠 台味居住買房人生支線：無殼蝸牛的買房長征——頭期款、30 年房貸、包租公收租、繼承祖厝、法拍屋撿便宜，財富與運氣決定上車或被房市套牢的分流結局 |
| **R89** | 📈 屬性數值實感化：回應「數值存在感低」的痛點——讓五圍真正驅動事件分支、檢定成功率與解鎖門檻，不再只是裝飾數字，並在結算新增「關鍵抉擇屬性快照」攤開這一生每個靠屬性做的關鍵決定（哪項屬性、當下幾分、贏沒贏） |
| **R90** | ⛩️ 台味宮廟民間信仰人生支線：誠心信徒／有事才拜／鐵齒跟拜三線分流——安太歲犯太歲運勢 buff 牽動擲筊檢定、求籤問事與凡事靠自己的屬性門檻 → 四種信仰結局（神明欽點有保庇／香火傳承／心誠則靈／鐵齒到底），含宮廟主題成就 |
| **R92** | 🛣️ 台味交通／行人地獄人生支線：機車仔／四輪族／無車通勤三線分流，守規禮讓換安全 buff vs 搶快闖紅燈的取捨，體質×運勢決定鑽車陣／過馬路／酒駕臨檢的存活 → 四種結局（老司機零違規／機車仔魂／塞國道的中產／行人地獄倖存者），含酒駕釀禍與車禍猝逝限定死法 |
| **R93** | 🏥 台味健保醫療人生支線：健保鄉民／自費養生／鐵齒硬撐三線分流——體質×運勢決定病痛、財富決定自費療程與單人病房、智力識破密醫、魅力影響醫病關係 → 四種結局（百歲人瑞健檢全綠／逛醫院達人／自費養生家／鐵齒倖存者），含急診人球延誤與慢性病惡化限定死法（最新一輪） |

> 一個 AI agent，連續自我迭代 **93 輪**、每一輪都得過測試閘門才放行，**全程零人類手寫遊戲碼**——這是這個專案最獨特的賣點。完整 93 輪逐輪設計決策直接寫在 `index.html` 的程式碼註解裡，那也是下一輪 AI 的記憶。

## 🎮 遊戲說明

一個荒誕嘲諷的網頁文字人生模擬器：

1. **隨機投胎**：抽天賦＋家境，決定 ❤️健康 / 🧠智力 / 💅外貌 / 💰財富 / 😄快樂 五維屬性。
2. **逐年推進**：每年觸發事件，每個事件是一張**梗圖卡**（迷因排版＋上下粗白字），做出選擇。
3. **選擇有後果**：屬性增減、旗標埋伏筆、事件連鎖——年輕的選擇會在中年回來找你。
4. **死亡結算**：享年＋稱號＋墓誌銘＋屬性曲線，產出一張可分享的「人生總結卡」。
5. **跨局成長**：成就圖鑑、死法圖鑑、收藏館、轉生天賦、祖產傳承、節令限定……再投胎一次。

台味滿點：補習班人生、北漂租屋到無殼蝸牛買房（頭期款／30 年房貸／包租公／繼承祖厝／法拍）、手搖飲、夾娃娃機、颱風假賭盤、過年紅包攻防、兵役體位判定（常備役／替代役／免役／軍官）、健保、網路鄉民、22K 躺平 vs 內捲與血汗職場打工人、自己當頭家開店創業（夜市攤販到上市連鎖）、詐騙之島防詐學分（被害者／車手／反詐三線）、晚年退休型錄與身後事、潤出國重開機，再到依出生世代分流的鬼島時代大事記（戒嚴尾巴一路走到 AI 浪潮）。

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

Every iteration since launch (**R1 → R93 and counting**) was performed by an AI agent, **one round every 30 minutes**, with no human in the loop and **zero human-written game code**:

1. **Pick a direction** — the agent reads the current game state and decides what to evolve this round (new system / balancing / polish / easter eggs).
2. **Modify the code** — edits the game directly.
3. **Test gate** — runs two automated suites (a multi-hundred-life full simulation + a state-machine audit). **All green or no ship.**
4. **Deploy** — pushes the build to Cloudflare Pages.
5. **Write the log** — leaves structured design comments in the code, which become context for the next round's agent.

Over 93 rounds the game grew from a 61-event prototype into **726 events, 111 meme scenes, 269 achievements, 66 ways to die, 10 hidden endings**, plus a multi-museum collection gallery (deaths / achievements / origins / talents) — content figures as of R84 (R85→R93 added more), tallied live by the test report. Every step gated by tests, every step traceable.

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
