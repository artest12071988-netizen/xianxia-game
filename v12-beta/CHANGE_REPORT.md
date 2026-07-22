# V14.7 玩家管理與卡點救援

新增：玩家搜尋、玩家狀態檢視、移動、A-1 一鍵解除卡點、物品增減、靈石／元寶增減、密碼重設信、管理操作紀錄。

未修改：遊戲主架構、原存檔格式、永久死亡規則、原管理後台 RPC、拍賣／配方／AI 測試功能。

靜態檢查：JavaScript 語法 PASS；SQL 依既有 `game_saves`、`player_presence`、`account_wallets` 與 `is_game_admin()` 設計。正式 Supabase 執行仍需部署後驗收。
