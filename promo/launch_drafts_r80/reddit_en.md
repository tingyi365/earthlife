# Reddit（英文）— R80 開發者／獨遊玩家向草稿

## 建議發布管道：**r/incremental_games**（優先），備選 r/WebGames

**為何選 r/incremental_games 而非 r/WebGames：**
- 本作核心是「轉生 / 天賦傳承 / 收集死法成就 / 重玩累積」的循環式進程，正中 incremental/idle 社群的口味；他們對「機制深度＋長線重玩」討論度遠高於 r/WebGames 的「一次性試玩」流量。
- 會給 GitHub star 的受眾在 r/incremental_games 重疊度高（該 sub 對開源、可審計、自製引擎的作品接受度好）。
- r/WebGames 流量大但留存淺、留言互動少；若想要 star 與深度回饋，r/incremental_games 轉化更好。
- **注意**：r/incremental_games 對「文字含量高 / 非英文」較敏感，所以下面把語言限制（zh-TW）誠實前置，並把英文受眾導向 repo 與機制討論。

> 最佳發文時段（台灣時區）：平日 20:00–23:00（≈ 美東 07:00–10:00），命中歐美晨間 Reddit 高峰
> 與既有素材區隔：copy.md 的 Reddit（R66）投 r/WebGames、以遊戲玩法為主；本版改投 r/incremental_games、**以重玩循環＋開源自製引擎為主軸**，更新到 R79。

---

**Title：**

EarthLife — a text life-sim with a self-evolving codebase: an AI agent has autonomously iterated it for 79 rounds [open source, MIT]

---

**Body：**

Play: https://earthlife.pages.dev
Source (MIT): https://github.com/tingyi365/earthlife

Heads-up before anything: the game UI is Traditional Chinese only. If you don't read Chinese, the gameplay won't land — but the build process and the repo might be the interesting part, so I'm sharing it here for that crowd too.

**The game (for the incremental/replay angle):** You get randomly reincarnated — talent, family, birthplace, and even the era you're born into all roll at the start and change which events you can hit. You advance year by year, make choices that shift stats and plant payoffs, die in creative ways, and the meta-progression is collecting deaths (57 of them), achievements (254), and unlocking rebirth talents / inherited legacy perks that carry across runs. There's a daily challenge on a shared seed and a seed-battle mode to race a friend through an identical life. ~696 events deep right now.

**The part I actually want to share:** after the first prototype, I stopped writing features. An AI agent runs each iteration on its own — it reads the current code plus the design notes earlier rounds left in the source (the file is its memory), picks one thing to build, edits it, then has to pass a test gate that auto-plays **220 complete lives headlessly** asserting zero runtime errors + invariants before it's allowed to deploy. If the gate is red it spends the round fixing instead of shipping. Then it writes its own changelog for the next round. 79 rounds of that, every round a single commit, the whole thing in one ~1.5MB HTML file with no framework and no build step.

Happy to answer questions about either the game design or the automation loop.

---

**首樓補充留言（發文後由樓主自己貼在留言區第一則）：**

A few technical bits that didn't fit the post, for anyone curious about the loop rather than the game:

- **Determinism is enforced by the agent itself.** Seed-replay only works if no RNG is consumed during rendering, and the agent keeps re-asserting a "zero RNG in UI code" rule in its own comments so replays stay byte-identical across versions. Watching it defend that invariant across rounds was the most "agent-like" thing about it.
- **The test gate is two suites:** one stubs the DOM and simulates 220 full lifespans checking reachability / save integrity / lifespan distribution; the other audits the state machine and backward-compat with old save strings. Both must be green or the round doesn't ship.
- **It's genuinely a single file** — vanilla JS, opens from `file://`, no dependencies. The full R1→R79 history is in the commit log if you want to watch a ~60-event prototype grow into ~700 events.

Not trying to farm anything here — genuinely happy to get torn apart on the design if anyone digs in.

---

**注意事項（Reddit）：**
- **發文前先讀目標 sub 的 rules 與置頂**：r/incremental_games 與 r/WebGames 都對純自我宣傳（self-promotion）有限制，多數要求走 self-post（文字貼文，非純連結）、且不能洗版式宣傳。本草稿已寫成 self-post 格式。
- 多數 sub 限制「自宣傳佔個人貼文比例」（常見 1:9 或 1:10）；若帳號是新號或全是自宣傳會被自動移除，發前先在該 sub 有真實互動紀錄。
- **誠實前置語言限制（zh-TW only）**是 Reddit 加分項，避免英文玩家點進去傻眼後 downvote。
- 不要 cross-post 洗整排 sub；一次選一個最契合的（建議 r/incremental_games）發、觀察反應再說。
- 回覆留言要真人、技術導向；Reddit 對「機器人感 / 公關腔」非常反感。
- 若 r/incremental_games 規則要求新作走特定 megathread（如每週分享串），就改貼那裡，別硬開新帖。
