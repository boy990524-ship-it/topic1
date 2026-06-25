// Google Apps Script - Code.gs
// 在 Google Apps Script 編輯器中使用此代碼

// ⚠️ 重要：替換為您的 Google 試算表 ID
const SHEET_ID = 'YOUR_SHEET_ID';

/**
 * 接收來自前端的 POST 請求
 * 前端使用 fetch() 發送 JSON，此函式接收並寫入試算表
 */
function doPost(e) {
  try {
    // 解析前端發送的 JSON 資料
    const data = JSON.parse(e.postData.contents);

    // 驗證必要資料
    if (!data.word || !data.meaning) {
      throw new Error('缺少必要欄位：word 或 meaning');
    }

    // 取得 Google 試算表
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheets()[0]; // 取得第一個工作表

    // 在最後一列後新增一列資料
    sheet.appendRow([
      new Date().toLocaleString('zh-TW'),  // 時間戳記（台灣時區）
      data.word,                            // 單字
      data.meaning,                         // 中文意思
      data.example || ''                    // 例句（可選）
    ]);

    // 回傳成功訊息
    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        message: '資料已成功保存到試算表'
      })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch(error) {
    // 回傳錯誤訊息
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: error.toString()
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 測試函式（可選）
 * 在 Google Apps Script 編輯器中直接執行以測試
 */
function testDoPost() {
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        word: 'beautiful',
        meaning: '美麗的',
        example: 'The sunset is beautiful.'
      })
    }
  };

  const response = doPost(testEvent);
  Logger.log(response.getContent());
}
