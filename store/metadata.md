# App Store Connect 填寫資料 / Listing copy

複製貼上到 App Store Connect 對應欄位。字數上限已檢查。

## 基本資訊 App Information

| 欄位 | 值 |
|---|---|
| Bundle ID | `com.ryder1018.crownarchers` |
| SKU | `crownarchers001` |
| 主要語言 Primary language | 繁體中文 (Traditional Chinese) |
| 類別 Category | 遊戲 Games → 主要：休閒 Casual；次要：策略 Strategy |
| 內容版權 Content Rights | 不含第三方內容（字型 Lilita One 為 SIL OFL 授權，可商用） |
| 年齡分級 Age Rating | 問卷中「卡通或奇幻暴力」選「不常/輕微 Infrequent/Mild」，其餘全部「無 None」→ 結果應為 9+ |
| 價格 Price | 免費 Free |
| App 內購買 | 無 |
| 隱私權政策網址 | `https://crown-archers.beloved-sucai.workers.dev/privacy` |
| 支援網址 Support URL | `https://crown-archers.beloved-sucai.workers.dev/` |

### App 隱私 App Privacy（「資料類型」問卷）
選「**否，我們不會從此 App 收集資料**」→ 標籤會顯示「未收集資料 Data Not Collected」。

### 出口合規 Export Compliance
Info.plist 已設定 `ITSAppUsesNonExemptEncryption = NO`，上傳後不會再問。

---

## 繁體中文 (zh-Hant)

**名稱 Name（30 字內）**
王冠弓兵團

**副標題 Subtitle（30 字內）**
拉弓射箭，一路稱王！

**宣傳文字 Promotional Text（170 字內）**
選對閘門、萬箭齊發！帶領你的弓兵團一路壯大，擊潰敵軍，挑戰巨人首領，奪下王冠！

**描述 Description**
```
拉弓射箭，一路稱王！

左右拖曳帶領你的弓兵團前進。你的弓兵會自動放箭——你只要決定往哪裡走。

◆ 選對閘門，兵力暴增
+50、x2、÷2、-30……每道閘門都會改變你的兵力。選錯了也別慌：對著閘門射箭，數字會一路往上加！

◆ 萬箭齊發，擊潰敵軍
成群的敵兵會朝你衝來。對準他們放箭，在他們碰到你之前把他們射倒。

◆ 擊破寶箱，取得增益
連射、多重箭、援軍、金幣——射穿木桶就能拿到強力獎勵。

◆ 挑戰巨人首領
每一關的盡頭都有巨人首領守著城堡。在它的大棒子砸下來之前，用箭雨把它擊倒！

◆ 升級你的軍團
用金幣強化初始兵力、射速、攻擊力與收益，挑戰更難的關卡。

◆ 四大地形，無盡關卡
河上石橋、青翠草原、冰雪山道、黃沙大漠，關卡越往後越刺激。

・可離線遊玩
・沒有廣告、沒有內購、不收集任何個人資料
```

**關鍵字 Keywords（100 字元內，逗號分隔不加空白）**
弓箭,射箭,弓兵,軍隊,士兵,閘門,塔防,策略,休閒,城堡,首領,國王,領主,戰爭,數字,跑酷,大軍,攻城

**新功能 What's New（1.0.0）**
王冠弓兵團正式上線！

---

## English (en-US)

**Name**
Crown Archers

**Subtitle**
Draw bows. Claim the crown!

**Promotional Text**
Pick the right gates, rain arrows on the enemy, and topple giant bosses. Grow your archer army and claim the crown!

**Description**
```
Draw your bows and claim the crown!

Drag left and right to lead your army of archers. They shoot on their own — you choose the path.

◆ PICK THE RIGHT GATE
+50, x2, ÷2, -30… every gate changes the size of your army. Picked a bad one? Shoot it! Your arrows push its number up.

◆ RAIN ARROWS
Enemy hordes charge straight at you. Aim your volleys and cut them down before they reach your lines.

◆ SMASH BARRELS FOR POWER-UPS
Rapid fire, multi-shot, reinforcements and coins are waiting inside.

◆ TOPPLE GIANT BOSSES
A giant chief guards the castle at the end of every level. Bring him down before his club comes crashing down on your army.

◆ UPGRADE YOUR LEGION
Spend coins on starting army, fire rate, damage and income to take on tougher levels.

◆ FOUR LANDS, ENDLESS LEVELS
River bridges, green meadows, snowy passes and desert roads.

• Play offline
• No ads, no in-app purchases, no data collection
```

**Keywords**
archer,archery,bow,arrow,army,crowd,gates,soldiers,castle,boss,king,lord,strategy,casual,war,runner

**What's New (1.0.0)**
Crown Archers is here!

---

## 螢幕截圖 Screenshots

- `store/zh-TW/1.png` … `5.png`：繁中商店頁
- `store/en-US/1.png` … `5.png`：英文商店頁
- 尺寸 1320 × 2868（6.9 吋 iPhone），App Store Connect 會自動縮放給較小機型使用。
- 本 App 只支援 iPhone（未勾選 iPad），所以不需要 iPad 截圖。

重新產生：`npm run dev` 後執行
```
node scripts/store-shots.mjs http://localhost:5173/ zh-TW
node scripts/store-shots.mjs http://localhost:5173/ en-US
python scripts/compose-store.py zh-TW
python scripts/compose-store.py en-US
```
