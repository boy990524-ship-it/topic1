# FocusStats

簡單的前端專注力與學習統計 Web App。使用者可使用番茄鐘進行專注時間管理，所有紀錄會儲存在瀏覽器 localStorage，並以 Chart.js 顯示「本日」、「本月」、「年度」統計。

檔案結構

- index.html
- style.css
- app.js
- README.md

功能

- 番茄鐘：可自訂工作與休息時間，包含「開始 / 暫停」與「重置」按鍵。
- 提示音：時間結束時會播放提示音（Web Audio API）。
- AI 查詢小助手：可輸入 OpenAI API Key（或使用後端代理）並發送問題以取得回覆。
- 統計圖表：使用 Chart.js 顯示今日（逐小時）、本月（逐日）、年度（逐月）專注時數。資料存在 localStorage。

如何本地啟動

1. 將專案檔案放在任一靜態伺服器目錄，或直接打開 `index.html`。

部署到 GitHub（含 GitHub Pages）

1. 在 GitHub 建立新 repository（例如 `focusstats`）。
2. 在本機（或 Codespace）初始化 git 並推送：

```bash
git init
git add .
git commit -m "Initial commit: FocusStats"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

3. 到 GitHub 網站：Repository → Settings → Pages，將來源設為 `main` 分支的根目錄（/），儲存後稍候即可取得 Pages URL。

注意事項（AI API）

- 若要從瀏覽器直接呼叫 OpenAI，需在 `API Key` 欄位貼上您的金鑰。瀏覽器直呼可能遇到 CORS 或安全風險；建議在實際專案中透過後端代理轉發請求以保護金鑰。

若需我幫你：

- 把專案初始化成 Git repo 並幫你產生 commit（我可以執行指令）。
- 加入後端代理範例（Node/Express）來安全使用 OpenAI API。

後端代理

此專案包含一個簡單的 Node/Express 代理，位於 `server.js`。用法：

1. 安裝依賴：

```bash
cd /path/to/project
npm install
```

2. 在專案根目錄建立 `.env`，加入：

```
OPENAI_API_KEY=sk-...
PORT=3000
```

3. 啟動代理：

```bash
npm start
```

4. 前端（`app.js`）可以改為呼叫 `POST /api/ai`（例如 `http://localhost:3000/api/ai`）並傳入 `{ "prompt": "你的問題" }`。

安全性提示：請勿把真實 API Key 推到公開倉庫；使用 `.env` 並加入 `.gitignore`。

可選的安全設定

- `CLIENT_SECRET`: 如果你在 `.env` 設定 `CLIENT_SECRET=your-secret`，後端會要求所有來自前端的代理請求在 HTTP 標頭 `x-client-secret` 帶入相同的值，否則回傳 401。前端已在 AI Modal 中新增 `Proxy Secret` 欄位，可填入該值。
- `ALLOWED_ORIGINS`: 可用逗號分隔的來源清單（例如 `http://localhost:5500,http://example.com`），若設定則後端僅允許這些來源的跨域請求；否則預設允許所有來源。

前端行為

- 當你按下 AI 送出時，前端會先向 `/health` 偵測後端代理是否可用。若可用，前端會呼叫 `POST /api/ai`，並在 `Proxy Secret` 有填值時帶入 `x-client-secret` 標頭。
- 若未偵測到代理，且你有在 `API Key` 欄位貼上 OpenAI Key，前端會直接呼叫 OpenAI（請注意安全風險）。
# topic1