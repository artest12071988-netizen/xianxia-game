# V14.8 Phase 2 FIX2

## 修正內容
- 將後台既有 Supabase client 掛載至 `window.xianxiaAdminSupabase`。
- 保留 `window.sb` 相容橋接。
- AI 驗收模組優先讀取正式橋接 client。
- 加入最長 10 秒連線等待，避免模組早於後台初始化而誤判未連線。
- 更新快取版本字串。

## 未修改
- RPC 與 SQL
- AI、玩家、屍體資料
- 遊戲邏輯與數值
