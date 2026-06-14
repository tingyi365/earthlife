# GitHub Social Preview 設定指引

當有人把 repo 連結貼到 Twitter/X、Facebook、Discord、Slack、LINE 等地方時，
會顯示一張**社群預覽大圖（social preview）**。設好這張圖能大幅提升點擊率，
對「衝星」與導流到試玩頁很有幫助。

本 repo 已備好現成素材：**[`docs/social_preview.png`](social_preview.png)**——**正好 1280×640、檔案 < 1MB，可直接上傳免壓縮**，是現在的首選。
（另有一張高解析的 [`promo/preview.png`](../promo/preview.png) 為遊戲截圖合成版，2560×1280 約 1.8MB，需先壓縮才能上傳，詳見文末。）

---

## 📌 為什麼要手動上傳？（給專案主）

> **GitHub social preview 圖無法透過 REST API 或 git commit 設定，只能在網頁後台手動上傳。**
> 所以這張圖不會「自動生效」，需要專案主（@tingyi365）到 Settings 手動上傳一次。

## 🪜 設定步驟（約 30 秒）

1. 打開 repo 的 **Settings**（齒輪頁籤，需要 repo 管理權限）。
2. 在 **General**（預設第一頁）往下捲到 **Social preview** 區塊。
3. 點 **Edit** → **Upload an image**。
4. 選擇本 repo 的 `docs/social_preview.png`（先把檔案下載到本機再上傳；此圖已是 1280×640、< 1MB，無需壓縮）。
5. 存檔。完成後可用 https://www.opengraph.xyz/ 或直接把 repo 連結貼到聊天室驗證縮圖。

---

## 📐 關於圖檔規格（重要）

GitHub social preview 的官方建議：

| 項目 | 官方建議 | `docs/social_preview.png`（首選） | `promo/preview.png`（截圖合成版） |
|---|---|---|---|
| **比例** | 2:1 | ✅ **1280 × 640（正好 2:1）** | ✅ 2560 × 1280（正好 2:1） |
| **建議尺寸** | 1280 × 640 | ✅ **完全吻合** | 2 倍尺寸，GitHub 會自動縮放 |
| **檔案大小上限** | **1 MB** | ✅ **約 0.5 MB，遠低於上限** | ⚠️ 約 1.8 MB，超過上限需壓縮 |

> ✅ **首選 `docs/social_preview.png` 可直接上傳，以下壓縮步驟只適用想改用 `promo/preview.png` 的情況。**

### ⚠️ 改用 `promo/preview.png` 才需要先壓縮

因為 `promo/preview.png` 約 1.8 MB、超過 GitHub 的 1 MB 上限，**直接上傳會失敗**。
請先擇一處理後再上傳（擇一即可）：

- **線上壓縮（最簡單）**：丟到 https://tinypng.com/ 壓一下，通常可壓到 1 MB 以下，畫質幾乎無損。
- **縮成建議尺寸**：把圖縮到 1280 × 640（剛好是官方建議尺寸，檔案自然變小）。
  - 例：`ffmpeg -i promo/preview.png -vf scale=1280:640 promo/preview_social.png`
  - 或任何看圖軟體 / 線上工具縮放即可。

> 壓縮 / 縮圖後的檔案**只是給後台上傳用**，不一定要 commit 進 repo；
> 若想留存，建議另存為 `promo/preview_social.png` 以免覆蓋原始高解析圖。

---

完成上傳後，這個 repo 之後被分享到任何社群平台，都會自動帶上這張預覽大圖。🌍🎮
