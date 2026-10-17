# 王冠弓兵團 Crown Archers

直式單手手遊：左右拖曳帶領弓兵團前進，自動射箭；選閘門改變兵力（射擊閘門可讓數字變大）、擊破木桶拿增益、擊退敵軍，最後打倒巨人首領。

- 技術：TypeScript + Three.js（所有模型都是程式產生的低多邊形）+ Vite，用 Capacitor 7 包成 iOS App（Swift Package Manager，不需要 CocoaPods）
- 音效與音樂全部用 WebAudio 即時合成，沒有音檔
- 完全離線、無廣告、無內購、不收集資料
- 支援繁體中文與英文（依裝置語言自動切換）

## 開發

需要 Node 22（`nvm use 22`）。

```bash
npm ci
npm run dev          # http://localhost:5173 ，加上 ?debug 可在 console 使用 window.game
npm test             # 遊戲邏輯、存檔、收藏庫、平衡（自動駕駛 bot 跑 55 關）
npm run build        # 產出 dist/
```

測試捷徑（只有網址帶 `?debug` 才有效，會覆蓋瀏覽器裡的進度）：
`?debug&level=33&up=18&coins=5000` → 跳到第 33 關、四項升級設為 Lv.18、金幣 5000。

開發用腳本（需先 `npm run dev`）：

| 指令 | 用途 |
|---|---|
| `node scripts/shots.mjs http://localhost:5173/ shots 5` | 第 5 關一路自動玩並截圖到 `shots/` |
| `node scripts/input-test.mjs` | 驗證拖曳、暫停、繼續 |
| `node scripts/icon.mjs` | 重新算圖 App 圖示到 `resources/icon.png` |
| `python scripts/subset-font.py` | 新增中文字後重新產生字型子集 `public/fonts/ca-round.woff2`（需要 fonttools、brotli） |
| `node scripts/store-shots.mjs … zh-TW` + `python scripts/compose-store.py zh-TW` | 產生 App Store 截圖（見 `store/metadata.md`） |

### 程式結構

```
src/sim/       純遊戲邏輯（不依賴 three.js，可單元測試）
  world.ts       軍隊、箭、閘門、敵軍、木桶、首領的模擬
  levelgen.ts    依關卡編號產生固定關卡（含失敗後自動降低難度）
  bot.ts         自動駕駛（測試與截圖用）
src/meta/      升級公式、金幣獎勵、存檔（@capacitor/preferences）
src/render/    three.js 畫面：模型、場景、粒子、追蹤 3D 位置的文字
src/main.ts    遊戲流程、UI、輸入、音效、震動
ios/           Capacitor iOS 專案
docs/          隱私權政策與客服頁（部署到 Cloudflare，見 wrangler.site.jsonc）
store/         App Store 截圖與上架文案
```

## 上架 App Store 步驟（需要在 Mac 上做）

### 1. 註冊 Apple Developer Program
到 <https://developer.apple.com/programs/enroll/> 用你的 Apple ID 註冊（個人 US$99／年）。審核通常 1–2 天。

### 2. 隱私權政策與客服網頁（已完成）
已部署到 Cloudflare（你的帳號，靜態網頁）：
- 客服：https://crown-archers.beloved-sucai.workers.dev/
- 隱私權政策：https://crown-archers.beloved-sucai.workers.dev/privacy

內容在 `docs/`，修改後重新部署：
```bash
npx wrangler deploy -c wrangler.site.jsonc
```

### 3. 在 Mac 上建置
```bash
# 安裝 Xcode（App Store 免費下載）與 Node 22
git clone <你的 repo> && cd crown-archers
npm ci
npm run ios          # = npm run build && npx cap sync ios
npx cap open ios     # 用 Xcode 開啟
```
在 Xcode：
1. 左側點 **App** 專案 → TARGETS **App** → **Signing & Capabilities**
2. Team 選你的開發者帳號（勾選 Automatically manage signing）
3. Bundle Identifier 保持 `com.ryder1018.crownarchers`（若被占用就改一個，並同步改 `capacitor.config.ts` 的 `appId`）
4. 上方裝置選你的 iPhone（用線接上，iPhone 要開「開發者模式」）→ ▶ 執行，實機試玩
   - 第一次會花幾分鐘下載 Swift 套件

### 4. 建立 App Store Connect 項目
<https://appstoreconnect.apple.com> → 我的 App → ＋ → 新增 App：
- 平台 iOS、名稱「王冠弓兵團」、主要語言繁體中文、Bundle ID 選上面那個、SKU `crownarchers001`
- 其他欄位照 `store/metadata.md` 填（描述、關鍵字、分類、年齡分級、App 隱私選「不收集資料」）
- 截圖上傳 `store/zh-TW/*.png`（英文頁面用 `store/en-US/*.png`）

### 5. 上傳並送審
在 Xcode：
1. 裝置選 **Any iOS Device (arm64)**
2. 選單 **Product → Archive**
3. 完成後 Organizer 視窗 → **Distribute App** → **App Store Connect** → Upload
4. 約 10–30 分鐘後，App Store Connect 的「建置版本」會出現這個版本；選它 → **提交審查**

之後要更新：改 `package.json` 的 `version` 與 Xcode 的 Version／Build（Build 每次上傳都要 +1），重做步驟 3 與 5。
