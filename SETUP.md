# 前端-GAS後端整合教學

## 概述
將前端表單資料透過 `fetch()` 發送至 Google Apps Script，並自動寫入 Google 試算表。

---

## 步驟 1: 建立 Google 試算表

1. 進入 [Google Sheets](https://sheets.google.com)
2. 建立新試算表，命名為「詞彙資料庫」（或任意名稱）
3. 設定表頭（第一列）：
   - A1: `時間`
   - B1: `單字`
   - C1: `中文意思`
   - D1: `例句`

4. **複製試算表 ID**：
   - 試算表網址：`https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
   - 記下 `{SHEET_ID}` 部分

---

## 步驟 2: 建立 Google Apps Script

1. 進入 [Google Apps Script](https://script.google.com)
2. 建立新專案
3. 清空預設代碼，貼入以下 `Code.gs`：

```javascript
// Google Apps Script - Code.gs
const SHEET_ID = 'YOUR_SHEET_ID'; // 替換為您的試算表 ID

function doPost(e) {
  try {
    // 解析前端發送的 JSON 資料
    const data = JSON.parse(e.postData.contents);
    
    // 取得試算表和工作表
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
    
    // 在最後一列後新增資料
    sheet.appendRow([
      new Date().toLocaleString('zh-TW'),  // 時間
      data.word || '',                      // 單字
      data.meaning || '',                   // 中文意思
      data.example || ''                    // 例句
    ]);
    
    // 回傳成功訊息
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, message: '資料已保存' })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    // 回傳錯誤訊息
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. **部署 GAS**：
   - 點選「部署」> 「新部署」
   - 類型選「Web 應用程式」
   - 執行身份：選擇自己的帳戶
   - 有權存取者：選「所有人」（重要！）
   - 點「部署」
   - 複製「部署 ID」（或 Web 應用程式 URL）

   部署 URL 格式：
   ```
   https://script.google.com/macros/d/{DEPLOYMENT_ID}/userweb
   ```

---

## 步驟 3: 更新前端 HTML

在 `index.html` 中建立簡單表單：

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>單字紀錄</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; }
    input, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
    button { padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background-color: #0056b3; }
    .message { margin-top: 20px; padding: 10px; border-radius: 4px; display: none; }
    .success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
  </style>
</head>
<body>
  <h1>新增單字</h1>
  <form id="wordForm">
    <div class="form-group">
      <label for="word">單字</label>
      <input type="text" id="word" name="word" placeholder="例：apple" required>
    </div>
    
    <div class="form-group">
      <label for="meaning">中文意思</label>
      <input type="text" id="meaning" name="meaning" placeholder="例：蘋果" required>
    </div>
    
    <div class="form-group">
      <label for="example">例句</label>
      <textarea id="example" name="example" rows="3" placeholder="例：An apple a day keeps the doctor away."></textarea>
    </div>
    
    <button type="button" id="submitBtn">提交資料</button>
  </form>
  
  <div id="message" class="message"></div>

  <script>
    const GAS_URL = 'https://script.google.com/macros/d/YOUR_DEPLOYMENT_ID/userweb';
    
    document.getElementById('submitBtn').addEventListener('click', async function() {
      const word = document.getElementById('word').value.trim();
      const meaning = document.getElementById('meaning').value.trim();
      const example = document.getElementById('example').value.trim();
      
      if (!word || !meaning) {
        showMessage('請填入單字和中文意思', 'error');
        return;
      }
      
      try {
        const response = await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word, meaning, example })
        });
        
        const result = await response.json();
        
        if (result.success) {
          showMessage('✓ 資料已成功保存到試算表', 'success');
          document.getElementById('wordForm').reset();
        } else {
          showMessage('✗ 保存失敗：' + result.error, 'error');
        }
      } catch(error) {
        showMessage('✗ 網路錯誤：' + error.message, 'error');
      }
    });
    
    function showMessage(text, type) {
      const messageDiv = document.getElementById('message');
      messageDiv.textContent = text;
      messageDiv.className = 'message ' + type;
      messageDiv.style.display = 'block';
      setTimeout(() => messageDiv.style.display = 'none', 5000);
    }
  </script>
</body>
</html>
```

---

## 步驟 4: 設定配置

### 前端配置
1. 編輯 `index.html` 中的第 64 行
2. 將 `YOUR_DEPLOYMENT_ID` 替換為您的 GAS 部署 ID

### 後端配置  
1. 編輯 `Code.gs` 中的第 2 行
2. 將 `YOUR_SHEET_ID` 替換為您的試算表 ID

---

## 步驟 5: 測試

1. 開啟前端頁面
2. 填入表單資料：
   - 單字：「Hello」
   - 中文意思：「你好」
   - 例句：「Hello, world!」
3. 點擊「提交資料」
4. 檢查 Google 試算表是否新增一列資料

---

## 常見問題

### Q: 如何重新部署 GAS？
A: 修改 `Code.gs` 後，點「部署」> 「管理部署」> 編輯該版本 > 保存。無需重新建立部署。

### Q: 權限錯誤？
A: 確保部署時選擇「有權存取者：所有人」。

### Q: CORS 錯誤？
A: GAS 預設允許跨域請求，不需額外設定。

### Q: 如何檢查是否成功？
A: 
- 前端看到「資料已成功保存」訊息
- Google 試算表新增一列資料

---

## 核心技術原理

| 元件 | 功能 |
|------|------|
| **HTML 表單** | 收集使用者輸入 |
| **JavaScript fetch()** | 將 JSON 資料 POST 到 GAS |
| **GAS doPost()** | 接收 JSON、解析資料 |
| **appendRow()** | 在試算表最後一列新增資料 |

---

## 關鍵代碼說明

### 前端：發送資料
```javascript
await fetch(GAS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ word, meaning, example })
});
```

### 後端：接收與存儲
```javascript
const data = JSON.parse(e.postData.contents);  // 解析 JSON
sheet.appendRow([...]);  // 新增一列
```

---

## 注意事項

✅ **適用於**：小型個人專案、學習目的、私人試算表  
❌ **不適用於**：高流量應用、需要授權的公開表單

---

**完成！現在您有一個簡單、無依賴的前端-GAS 整合系統。** 🎉
