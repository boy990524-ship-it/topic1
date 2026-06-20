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
- AI 查詢小助手：前端無需持有 OpenAI 金鑰，後端代理會使用部署環境變數中的 `OPENAI_API_KEY`。
- 統計圖表：使用 Chart.js 顯示今日（逐小時）、本月（逐日）、年度（逐月）專注時數。資料存在 localStorage。

如何本地啟動

1. 將專案檔案放在任一靜態伺服器目錄，或直接打開 `index.html`。

部署到 GitHub（靜態頁面）

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

> 注意：GitHub Pages 只能部署靜態網站，無法執行 `server.js`。如果你要讓 AI 正常運作，就不能只用 Pages。請改用 Render、Cloud Run 等支援 Node.js 的平台。

部署成公開 API

本專案已經包含可部署的後端代理與 GitHub Actions workflow：

- `.github/workflows/render-deploy.yml`
- `.github/workflows/cloudrun-deploy.yml`

你可以選擇其中一種方式部署：

### Render

1. 到 Render 建立新服務，選 `Web Service`。
2. 連接你的 GitHub repository，選 `main` 分支。
3. Build command: `npm install`
4. Start command: `npm start`
5. 在 Render 服務設定中新增環境變數：

```bash
OPENAI_API_KEY=你的真實 OpenAI 金鑰
PORT=3000
```

6. 如果你要額外保護 API，還可以設定：

```bash
CLIENT_SECRET=你的自訂秘密
ALLOWED_ORIGINS=https://your-domain.com
```

7. 部署完成後，Render 會給你一個公開網址，其他人就可以透過該網址使用你的 App 和 AI。

### Google Cloud Run

1. 在 Google Cloud 建立專案並啟用 Cloud Run。
2. 建立 GitHub Actions secret：

- `GCP_PROJECT_ID`
- `GCP_SA_KEY`（服務帳戶金鑰 JSON）
- `GCP_REGION`
- `OPENAI_API_KEY`
- `CLIENT_SECRET`（可選）

3. 將程式碼推到 GitHub，GitHub Actions 會使用 `.github/workflows/cloudrun-deploy.yml` 自動部署。

4. 部署完成後，Cloud Run 會給你一個公開網址，其他人即可使用。

注意：要讓 AI 的 OpenAI 功能完整運作，務必在部署平台上設定 `OPENAI_API_KEY`。

注意事項（AI API）

- 前端不應該直接持有或暴露 OpenAI 金鑰。
- 若未設定 `OPENAI_API_KEY`，後端仍會使用本地模擬 AI 回覆，可讓 UI 立刻運作。
- 若你有有效金鑰，可在部署平台或 local shell 中設定 `OPENAI_API_KEY`，後端則會直接呼叫 OpenAI。
- 可以建立 `.env.example` 作為範本，但不要將真實金鑰加入版本控制。

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

2. 在專案根目錄建立 `.env` 或是直接使用環境變數。範例：

```
OPENAI_API_KEY=sk-...
PORT=3000
```

如果你不想在本機寫入敏感金鑰，可以直接在部署平台上設定 `OPENAI_API_KEY`，本地開發也可以改用：

```bash
export OPENAI_API_KEY=sk-...
export PORT=3000
npm start
```

3. 啟動代理：

```bash
npm start
```

4. 前端（`app.js`）會直接呼叫 `/sse?prompt=...` 取得 AI 回覆。

安全性提示：請勿把真實 API Key 推到公開倉庫；使用 `.env`、平台環境變數或 `.env.example` 作為範例，並加入 `.gitignore`。

可選的安全設定

- `CLIENT_SECRET`: 如果你在 `.env` 或部署平台環境變數中設定 `CLIENT_SECRET=your-secret`，後端會要求所有來自前端的代理請求在 HTTP 標頭 `x-client-secret` 帶入相同的值，否則回傳 401。
- `ALLOWED_ORIGINS`: 可用逗號分隔的來源清單（例如 `http://localhost:5500,http://example.com`），若設定則後端僅允許這些來源的跨域請求；否則預設允許所有來源。

本專案也有 `.env.example` 範本檔，可用來說明環境變數格式，但不要把真實金鑰存進版本控制。 

前端行為

- 當你按下 AI 送出時，前端會直接建立 `EventSource`，向後端代理的 `/sse?prompt=...` 取得串流回覆。
- 後端代理 `server.js` 會直接從 `process.env.OPENAI_API_KEY` 讀取金鑰，因此前端不需要自行貼入 OpenAI Key。
- 如果你想額外保護代理，可以在部署平台設定 `CLIENT_SECRET`，後端會驗證前端傳入的秘密值。

部署到雲端（快速指南）

以下示範兩種常見方式：Render（最簡單）與 Google Cloud Run（更靈活、可擴充）。兩者都支援 Docker 映像。

1) Render（快速、免費層可用）
- 在 Render 建立新服務選擇 "Web Service" → 連接你的 GitHub repository → 選 `main` 分支。
- Build 命令: `docker build -t focusstats .`（Render 會自動使用 Dockerfile）
- Start 命令: `docker run -e OPENAI_API_KEY=$OPENAI_API_KEY -p 3000:3000 focusstats`（在 Render 設定環境變數 `OPENAI_API_KEY` 與 `CLIENT_SECRET`）

2) Google Cloud Run（支援自動擴充與更細緻設定）
- 建議先在本機建立映像（或直接用 Cloud Build）：

```bash
# 透過 Cloud Build (必要時先 gcloud auth login 並設定 project)
gcloud builds submit --tag gcr.io/PROJECT-ID/focusstats
gcloud run deploy focusstats --image gcr.io/PROJECT-ID/focusstats --platform managed --region us-central1 --allow-unauthenticated --set-env-vars OPENAI_API_KEY=YOUR_KEY,CLIENT_SECRET=YOUR_SECRET
```

- 或用 Docker + Cloud Run（先上傳到 Container Registry 再部署）：

```bash
docker build -t gcr.io/PROJECT-ID/focusstats .
docker push gcr.io/PROJECT-ID/focusstats
gcloud run deploy focusstats --image gcr.io/PROJECT-ID/focusstats --platform managed --region us-central1 --allow-unauthenticated --set-env-vars OPENAI_API_KEY=YOUR_KEY,CLIENT_SECRET=YOUR_SECRET
```

注意：若你使用 SSE 或 WebSocket，Cloud Run 與 Render 均支援，但要注意連線時間與最大請求大小限制。請在所選平台文件中檢查 keep-alive 與 timeout 設定。

自動部署（GitHub Actions）
- 你也可以建立 GitHub Actions，於 push 時自動 build 並 deploy 到 Cloud Run 或 Render。我可以幫你產生範例 workflow 檔案。
# topic1