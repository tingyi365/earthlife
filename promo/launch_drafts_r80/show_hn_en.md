# Show HN（英文）— R80 開發者向草稿

> 建議發布管道：Hacker News → https://news.ycombinator.com/submit（type = Show HN）
> 最佳發文時段（台灣時區）：平日 21:00–23:00（≈ 美東 08:00–10:00 / 美西 05:00–07:00），命中 HN 早晨流量高峰；避開週末
> 與既有素材區隔：copy.md 的 Show HN（R66）以「遊戲是什麼」開場；本版面向會給 star 的工程讀者，**以工程迴圈與可審計性開場、遊戲內容為佐證**，並更新到 R79 數字。

---

**Title（66 字元，< 80）：**

Show HN: An AI agent self-evolved this life-sim game for 79 rounds

---

**Body：**

Play (Traditional Chinese): https://earthlife.pages.dev
Repo (MIT): https://github.com/tingyi365/earthlife

I built a small text life-simulator, then stopped writing features and handed the loop to an AI agent. Every iteration it does the same thing without a human in the loop:

1. Reads the current code plus the design notes previous rounds left in the source — the file itself is the agent's long-term memory.
2. Picks one thing to evolve this round: a new mechanic, a balance pass, polish, or easter eggs.
3. Edits the game directly.
4. Test gate (non-negotiable): one suite extracts the game JS, stubs the DOM, and auto-plays 220 complete lives asserting zero runtime errors plus invariants — event reachability, save integrity, lifespan distribution; a second suite audits the state machine and legacy-save compatibility. Red gate, no ship.
5. Deploys to Cloudflare Pages and writes its changelog for the next round.

79 rounds in, it has grown from a ~60-event prototype into 696 events, 57 death types, 254 achievements, 23 birth origins, and a deterministic seed-replay system (any life replays from a short seed code) — all in a single ~1.5MB HTML file. No framework, no build step, no dependencies; open it from file:// and it runs.

Every round is one commit, so the entire 79-round evolution is auditable in the history.

Two things I didn't expect:
- The agent polices its own determinism. Its comments repeatedly re-assert a "zero RNG consumption in UI code" rule so that seed replays stay byte-identical across versions.
- It treats the test gate as a hard constraint, not a suggestion — it has refused to ship rounds where the 220-life simulation surfaced a regression, and spent the round fixing instead.

The game itself is zh-TW only and leans into dark Taiwanese humor, so for non-Chinese speakers the interesting part is probably the repo and the loop, not the gameplay. Happy to go deep on the test-gate design, the determinism discipline, or the things that broke along the way.

---

**注意事項（HN）：**
- **嚴禁灌票 / 互推（vote ring）**：不要請朋友按讚或留言推，HN 反濫用偵測會直接降權甚至 ban，務必走自然流量。
- Show HN 必須是可實際使用的東西 — 連結要能直接玩 / 看 repo（本案符合）。
- 標題不要加行銷詞、不要全大寫、不要加 emoji；HN 讀者反感行銷腔。
- 發文後親自留言回覆技術提問即可，**不要請人來帶風向**。
- 老實揭露語言限制（zh-TW only）反而加分，HN 重視誠實。
- 一個連結只 Show HN 一次；R66 版若已發過，本版屬「重大更新」可重投，但需在留言說明距上次的進展（R66→R79）。
