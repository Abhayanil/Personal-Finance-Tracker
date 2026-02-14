/**
 * PocketTrack Backend
 * Optimized for Public Repo: Uses active sheet context and automated setup.
 */

const SETTINGS_SHEET = 'Settings';
const TRANS_SHEET = 'Transactions';
const REM_SHEET = 'Reminders';

/**
 * Serves the HTML frontend.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('PocketTrack')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * One-time setup function to create required sheets and headers.
 * Run this from the Apps Script editor once after deployment.
 */
function setupInitialSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Define required sheets and their headers
  const sheets = [
    { name: TRANS_SHEET, headers: [['ID', 'Date', 'Amount', 'Type', 'Tag', 'Note', 'Timestamp']] },
    { name: REM_SHEET, headers: [['ID', 'Name', 'Amount', 'Day', 'Frequency', 'Tag', 'Type']] },
    { name: SETTINGS_SHEET, headers: [['Key', 'Value'], ['Budget', '20000'], ['PIN', '1234']] }
  ];

  sheets.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
      sheet.getRange(1, 1, s.headers.length, s.headers[0].length).setValues(s.headers);
      sheet.getRange(1, 1, 1, s.headers[0].length).setFontWeight('bold').setBackground('#f1f5f9');
    }
  });
  
  return "Setup complete! Sheets and headers have been initialized.";
}

/**
 * Fetches summary data for the dashboard.
 */
function getSummaryData(search = "", month = null, year = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TRANS_SHEET);
  const settings = ss.getSheetByName(SETTINGS_SHEET);
  
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const now = new Date();
  const targetMonth = month !== null ? parseInt(month) : now.getMonth();
  const targetYear = year !== null ? parseInt(year) : now.getFullYear();
  
  // Calculate days left in the selected month
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const daysLeft = targetMonth === now.getMonth() ? Math.max(0, lastDay - now.getDate()) : 0;

  let summary = {
    balance: 0,
    income: 0,
    expense: 0,
    investment: 0,
    expenseTags: {},
    history: [],
    budget: getSetting('Budget', 20000),
    daysLeft: daysLeft
  };

  data.forEach(row => {
    const d = new Date(row[1]);
    if (d.getMonth() === targetMonth && d.getFullYear() === targetYear) {
      const amt = parseFloat(row[2]);
      const type = row[3];
      const tag = row[4];

      if (type === 'Credit') {
        summary.income += amt;
        summary.balance += amt;
      } else if (type === 'Debit') {
        summary.expense += amt;
        summary.balance -= amt;
        summary.expenseTags[tag] = (summary.expenseTags[tag] || 0) + amt;
      } else if (type === 'Investment') {
        summary.investment += amt;
        summary.balance -= amt;
      }

      summary.history.unshift({
        id: row[0],
        date: Utilities.formatDate(d, Session.getScriptTimeZone(), "dd MMM"),
        amount: amt,
        type: type,
        tag: tag,
        note: row[5]
      });
    }
  });

  return summary;
}

/**
 * Saves a new transaction.
 */
function addTransaction(tx) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TRANS_SHEET);
  const id = "TX" + Date.now();
  sheet.appendRow([id, tx.date, tx.amount, tx.type, tx.tag, tx.note, new Date()]);
  return true;
}

/**
 * Deletes a transaction by ID.
 */
function deleteTransaction(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TRANS_SHEET);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

/**
 * Fetches reminders.
 */
function getReminders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(REM_SHEET);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.map(r => ({
    id: r[0], name: r[1], amount: r[2], day: r[3], frequency: r[4], tag: r[5], type: r[6]
  }));
}

/**
 * Saves a new reminder.
 */
function addReminder(r) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(REM_SHEET);
  const id = "RM" + Date.now();
  sheet.appendRow([id, r.name, r.amount, r.day, r.frequency, r.tag, r.type]);
}

/**
 * Helper to get settings.
 */
function getSetting(key, defaultVal) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SETTINGS_SHEET);
  const data = sheet.getDataRange().getValues();
  const found = data.find(r => r[0] === key);
  return found ? found[1] : defaultVal;
}

/**
 * Updates budget setting.
 */
function setBudget(val) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SETTINGS_SHEET);
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === 'Budget') {
      sheet.getRange(i + 1, 2).setValue(val);
      return;
    }
  }
  sheet.appendRow(['Budget', val]);
}
