# anti sleep ™ Club｜訂位系統

台北 anti sleep ™ Club 的內部訂位系統。員工從 IG / LINE 收到客人訂位需求 → 後台輸入或貼上對話 → 自動推 LINE 群組通知所有員工。

## 功能

### 訂位 dashboard（`/admin`）
- **甘特圖視角**：14 桌 × N 時段矩陣，跨段訂位的格子會橫跨多時段填滿
- **座位圖視角**：實體平面圖，每張被訂的桌子下方有 mini timeline 顯示整晚使用情形（不同訂位用不同顏色）
- 兩個視角切換看同一份資料
- 點任一格／桌新增或編輯訂位
- 衝突檢查：撞單會擋下並跳警告

### 新增訂位的兩種方式
- **`+ 新增訂位`**：手動填表單
- **`📋 貼上訂位`**：把 IG / LINE 對話訊息貼進去，系統自動 parse 出日期/時間/桌號/姓名/電話/人數/備註

### 提醒
- 訂位開始時間到 + 客人未確認 → 頂部跳通知 banner，員工點「✓ 到了」/「× 沒來」處理

### 座位編輯（`/admin/floor`）
- 拖拉移動桌子位置（吸附格線）
- 拖右下角 handle 縮放
- 加新圓桌 / 方桌、改名稱、改人數
- 空間（外牆）大小可改（公尺），桌子超出邊界會自動拉回
- 改完按「儲存」→ 寫進 localStorage，dashboard 立刻同步

### 營業時段
- Dashboard 頂部「營業 [HH:00] ~ [HH:00]」可改開店/打烊時間
- 時段以 2 小時一輪（時段欄位、抽屜下拉、座位圖 timeline 全部跟著動態調整）

### LINE 群組通知（mockup 階段為預覽）
- 抽屜下方即時顯示送出後 LINE 群組會收到的訊息格式
- 真實接 LINE Messaging API 後會自動推到群組

### PWA
- 已加 `manifest.json` + theme-color + standalone display mode
- 手機 Safari / Chrome「加到主畫面」就會變 app icon，全螢幕 standalone 模式開啟

## 技術棧

- **Next.js 16**（App Router） + TypeScript
- **Tailwind CSS v4**
- **react-konva**（之後做更進階座位編輯器會用）
- **@supabase/supabase-js + ssr**（之後接資料庫）
- **react-hook-form + zod**（之後做表單驗證）

## 開發

```bash
npm install
npm run dev   # http://localhost:3000
```

主要路由：
- `/` 客人首頁（品牌頁，Reserve 按鈕導 IG DM）
- `/admin` 員工訂位 dashboard
- `/admin/floor` 座位平面圖編輯器
- `/book` 客人端訂位流程（V1 暫不啟用，V2 才可能上線）

## 目前狀態

- [x] 視覺、互動 mockup 全部完成
- [x] 資料持久化用 localStorage（座位 layout、營業時段）
- [ ] 接 Supabase（schema、RLS、auth）
- [ ] 員工登入
- [ ] LINE Messaging API 真推送
- [ ] Vercel 部署

## 部署

設計成部署在 Vercel：開好 GitHub repo 後在 Vercel 連接 → 自動 detect Next.js → build & deploy。
