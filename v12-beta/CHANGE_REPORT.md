# V14.6 ADMIN UI FIX3

## 目標
將道具與配方管理簡化為「儲存修改」與「發布正式版」。

## 修改
- 隱藏「建立草稿／儲存草稿／發布草稿／套用全部到草稿」等工程流程按鈕。
- 道具儲存自動建立或更新 Config 草稿。
- 配方儲存自動執行配方驗證與套用，再更新 Config 草稿。
- 發布自動依序執行套用、驗證、儲存、發布。
- 保留版本紀錄、回復、Excel、完整 JSON 與所有既有 RPC。

## 靜態驗證
- admin_professional_ui.js：JavaScript 語法 PASS。
- admin_crafting.js：JavaScript 語法 PASS。
- 原 admin.html 欄位 ID 數量維持 44。
