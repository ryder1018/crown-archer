# 上架＋廣告＋儲值 Todo

建議分兩階段：**先上架 1.0（無廣告、無儲值）**，審核最單純；過審後再推 **1.1 加入廣告與儲值**。

---

## 階段一：上架 1.0

**需要**：Mac（最新版 Xcode）、iPhone、Apple ID（開啟雙重認證）、US$99/年

- [ ] 加入 Apple Developer Program（個人身分，審核約 1～2 天）
- [ ] Mac 上建置：`npm ci && npm run ios && npx cap open ios`
- [ ] Xcode → Signing 選你的 Team，接上 iPhone 實機試玩
- [ ] App Store Connect 建立 App（資料照 `store/metadata.md` 貼上）
- [ ] 上傳 8 張截圖（`store/zh-TW`、`store/en-US`）
- [ ] Xcode → Archive → 上傳 → 先用 **TestFlight** 自己測一輪
- [ ] 送審（約 1～3 天）

---

## 階段二：廣告（Google AdMob）

**需要**：Google 帳號、AdMob 帳號、收款用的台灣銀行帳戶

**你要做**
- [ ] 註冊 AdMob → 新增 iOS App → 建立廣告單元，把 ID 給我：
  - 獎勵廣告（看廣告換獎勵）
  - 插頁廣告（關卡之間）
- [ ] AdMob 填寫稅務資料、付款資料（滿 US$100 才付款，會寄 PIN 碼信到你家驗證地址）
- [ ] 在 AdMob 設定 GDPR／隱私權訊息（同意彈窗）

**我會做**
- [ ] 串接 `@capacitor-community/admob`
- [ ] 加入 ATT 追蹤授權彈窗、Info.plist 設定（SKAdNetwork 等）
- [ ] 放廣告的位置：
  - 勝利後「看廣告領雙倍金幣」
  - 失敗後「看廣告復活」
  - 第 10 關以後每 3 關一次插頁廣告（買了「移除廣告」就不顯示）
- [ ] 網站加上 `app-ads.txt`，並更新隱私權政策（改成「會收集廣告識別碼」）

---

## 階段三：儲值（App 內購買）

**需要**：簽署 App Store Connect 的「付費 App 協議」，並填銀行與稅務資料（W-8BEN）

**你要做**
- [ ] 簽付費 App 協議、填銀行與稅務資料
- [ ] 申請 **App Store 小型企業計畫**（抽成從 30% 降為 15%）
- [ ] 在 App Store Connect 建立商品（價格自訂），例如：
  - 消耗型：金幣包 小／中／大
  - 非消耗型：移除廣告、英雄禮包
- [ ] 建立 Sandbox 測試帳號，用來測試購買
- [ ] （建議）註冊 RevenueCat（每月營收 US$2,500 以下免費），可省掉自己驗證收據

**我會做**
- [ ] 串接 RevenueCat（或 `cordova-plugin-purchase`）
- [ ] 做商店畫面＋「恢復購買」按鈕（Apple 規定必須有）
- [ ] 平衡金幣包定價，不讓遊戲變成不付費就玩不下去

---

## 1.1 送審前

- [ ] App Store Connect「App 隱私權」問卷改為：收集「識別碼」「使用資料」，用於第三方廣告
- [ ] 年齡分級問卷重填（不要勾「兒童類別」）
- [ ] 商店描述拿掉「沒有廣告、沒有內購」那一行
- [ ] TestFlight 測試：廣告用測試 ID，購買用 Sandbox 帳號

> ⚠️ 千萬不要點自己 App 裡的真實廣告，AdMob 帳號會被停權。
