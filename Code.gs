/**
 * PocketTrack Backend
 * Personal Finance Tracker for Google Sheets
 * Optimized for mobile use and public deployment
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
  
  const sheets = [
    { 
      name: TRANS_SHEET, 
      headers: [['ID', 'Date', 'Amount', 'Note', 'Tag', 'Type']]  // Changed order
    },
    { 
      name: REM_SHEET, 
      headers: [['ID', 'Name', 'Amount', 'Day', 'Frequency', 'Tag', 'Type']] 
    },
    { 
      name: SETTINGS_SHEET, 
      headers: [['Key', 'Value'], ['Budget', '20000'], ['PIN', '1234']] 
    }
  ];

  sheets.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
      sheet.getRange(1, 1, s.headers.length, s.headers[0].length).setValues(s.headers);
      sheet.getRange(1, 1, 1, s.headers[0].length).setFontWeight('bold').setBackground('#f1f5f9');
      sheet.setFrozenRows(1);
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
  
  if (!sheet) {
    throw new Error("Transactions sheet not found. Please run setupInitialSheets() first.");
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const now = new Date();
  const targetMonth = month !== null ? parseInt(month) : now.getMonth();
  const targetYear = year !== null ? parseInt(year) : now.getFullYear();
  
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const daysLeft = targetMonth === now.getMonth() && targetYear === now.getFullYear() 
    ? Math.max(0, lastDay - now.getDate()) 
    : 0;

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

  // YOUR SHEET STRUCTURE: ID, Date, Amount, Note, Tag, Type
  data.forEach(row => {
    const d = new Date(row[1]);  // Date at index 1
    if (d.getMonth() === targetMonth && d.getFullYear() === targetYear) {
      const amt = parseFloat(row[2]);  // Amount at index 2
      const note = row[3];              // Note at index 3
      const tag = row[4];               // Tag at index 4
      const type = row[5];              // Type at index 5

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
        note: note
      });
    }
  });

  return summary;
}

/**
 * Saves a new transaction with validation.
 */
function addTransaction(tx) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TRANS_SHEET);
  
  if (!sheet) throw new Error("Transactions sheet not found.");
  
  if (!tx.amount || parseFloat(tx.amount) <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  
  if (!tx.type || !['Credit', 'Debit', 'Investment'].includes(tx.type)) {
    throw new Error("Invalid transaction type");
  }
  
  if (!tx.date) throw new Error("Date is required");
  if (!tx.tag) throw new Error("Category/Tag is required");
  
  const id = "TX" + Date.now();
  
  // YOUR SHEET STRUCTURE: ID, Date, Amount, Note, Tag, Type
  sheet.appendRow([
    id,                    // ID
    tx.date,              // Date
    parseFloat(tx.amount), // Amount
    tx.note || '',        // Note
    tx.tag,               // Tag
    tx.type               // Type
  ]);
  
  return { success: true, id: id };
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
      return { success: true };
    }
  }
  
  throw new Error("Transaction not found");
}

/**
 * Fetches reminders.
 */
function getReminders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(REM_SHEET);
  
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  data.shift();
  
  return data.map(r => ({
    id: r[0], 
    name: r[1], 
    amount: r[2], 
    day: r[3], 
    frequency: r[4], 
    tag: r[5], 
    type: r[6]
  }));
}

/**
 * Saves a new reminder with validation.
 */
function addReminder(r) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(REM_SHEET);
  
  if (!sheet) throw new Error("Reminders sheet not found.");
  
  if (!r.name || r.name.trim() === '') {
    throw new Error("Reminder name is required");
  }
  
  if (!r.amount || parseFloat(r.amount) <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  
  const day = parseInt(r.day);
  if (!day || day < 1 || day > 31) {
    throw new Error("Day must be between 1 and 31");
  }
  
  if (!r.frequency) throw new Error("Frequency is required");
  
  if (!r.type || !['Debit', 'Investment'].includes(r.type)) {
    throw new Error("Invalid reminder type");
  }
  
  const id = "RM" + Date.now();
  
  sheet.appendRow([
    id, 
    r.name.trim(), 
    parseFloat(r.amount), 
    day, 
    r.frequency, 
    r.tag || 'Bills', 
    r.type
  ]);
  
  return { success: true, id: id };
}

/**
 * Deletes a reminder by ID.
 */
function deleteReminder(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(REM_SHEET);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  throw new Error("Reminder not found");
}

/**
 * Pays a reminder by creating a transaction from it.
 */
function payReminder(reminderData) {
  try {
    const reminder = JSON.parse(decodeURIComponent(reminderData));
    
    const transaction = {
      amount: reminder.amount,
      date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      type: reminder.type,
      tag: reminder.tag,
      note: `Paid: ${reminder.name} (Reminder)`
    };
    
    addTransaction(transaction);
    
    return { success: true, message: "Payment recorded successfully" };
  } catch (e) {
    throw new Error("Failed to process payment: " + e.message);
  }
}

/**
 * Helper to get settings.
 */
function getSetting(key, defaultVal) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SETTINGS_SHEET);
  
  if (!sheet) return defaultVal;
  
  const data = sheet.getDataRange().getValues();
  const found = data.find(r => r[0] === key);
  return found ? found[1] : defaultVal;
}

/**
 * Updates a setting value.
 */
function setSetting(key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SETTINGS_SHEET);
  
  if (!sheet) throw new Error("Settings sheet not found.");
  
  const data = sheet.getDataRange().getValues();
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return { success: true };
    }
  }
  
  sheet.appendRow([key, value]);
  return { success: true };
}

/**
 * Updates budget setting.
 */
function setBudget(val) {
  const budget = parseFloat(val);
  
  if (isNaN(budget) || budget <= 0) {
    throw new Error("Budget must be a positive number");
  }
  
  return setSetting('Budget', budget);
}

/**
 * Updates PIN setting.
 */
function setPIN(newPin) {
  if (!/^\d{4}$/.test(newPin)) {
    throw new Error("PIN must be exactly 4 digits");
  }
  
  return setSetting('PIN', newPin);
}

/**
 * Verifies PIN for login.
 */
function verifyPIN(pin) {
  const storedPin = getSetting('PIN', '1234');
  return pin === String(storedPin);
}

/**
 * Gets current PIN (for frontend initialization).
 */
function getCurrentPIN() {
  return getSetting('PIN', '1234');
}
