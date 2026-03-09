const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const bcrypt = require('bcryptjs');
const initDatabase = require('./schema');

let mainWindow;
let db;
let saveDb;

// ── IPC HANDLERS ──────────────────────────────────────
// Must be registered before createWindow is called

// CHECK: Does any manager account exist yet?
ipcMain.handle('auth:check-setup', async () => {
  const result = db.exec(
    `SELECT id FROM users WHERE role = 'manager' LIMIT 1`
  );
  return result.length > 0 && result[0].values.length > 0;
});

// LOGIN: Verify username and password
ipcMain.handle('auth:login', async (event, { username, password }) => {
  const result = db.exec(
    `SELECT id, username, password_hash, role, is_first_login, employee_id
     FROM users WHERE username = ?`,
    [username]
  );

  // No user found
  if (result.length === 0 || result[0].values.length === 0) {
    return { success: false, message: 'Invalid username or password' };
  }

  // Map result columns to an object
  const cols = result[0].columns;
  const row = result[0].values[0];
  const user = {};
  cols.forEach((col, i) => user[col] = row[i]);

  // Compare password with stored hash
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    return { success: false, message: 'Invalid username or password' };
  }

  // Update last_login timestamp
  db.run(
    `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`,
    [user.id]
  );
  saveDb();

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      isFirstLogin: user.is_first_login === 1,
      employeeId: user.employee_id,
    }
  };
});

// SETUP: Create first manager account (login screen only)
ipcMain.handle('auth:create-manager', async (event, { username, password }) => {
  const existing = db.exec(
    `SELECT COUNT(*) as count FROM users WHERE role = 'manager'`
  );

  const managerCount = existing[0].values[0][0];

  if (managerCount >= 1) {
    return {
      success: false,
      message: 'A manager account already exists. Sign in or ask your manager to add you from inside the app.'
    };
  }

  const password_hash = await bcrypt.hash(password, 12);

  try {
    db.run(
      `INSERT INTO users (username, password_hash, role, is_first_login)
       VALUES (?, ?, 'manager', 0)`,
      [username, password_hash]
    );
    saveDb();
    return { success: true };
  } catch (err) {
    return { success: false, message: 'Username already taken' };
  }
});

// ADD MANAGER: Called from inside the app by an existing manager (max 2)
ipcMain.handle('auth:add-manager', async (event, { username, password }) => {
  const existing = db.exec(
    `SELECT COUNT(*) as count FROM users WHERE role = 'manager'`
  );

  const managerCount = existing[0].values[0][0];

  if (managerCount >= 2) {
    return {
      success: false,
      message: 'Maximum of 2 manager accounts reached. Remove a manager before adding a new one.'
    };
  }

  const password_hash = await bcrypt.hash(password, 12);

  try {
    db.run(
      `INSERT INTO users (username, password_hash, role, is_first_login)
       VALUES (?, ?, 'manager', 1)`,
      [username, password_hash]
    );
    saveDb();
    return { success: true };
  } catch (err) {
    return { success: false, message: 'Username already taken' };
  }
});

// ── DASHBOARD HANDLERS ────────────────────────────────

ipcMain.handle('dashboard:today-schedule', () => {
  const today = new Date().toISOString().split('T')[0];
  const result = db.exec(`
    SELECT s.*, e.first_name, e.last_name,
      GROUP_CONCAT(t.title, '||') as tasks
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    LEFT JOIN tasks t ON t.assigned_to = e.id
      AND t.due_date = ? AND t.status != 'Done'
    WHERE s.date = ?
    GROUP BY s.id
    ORDER BY s.start_time
  `, [today, today]);

  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
});

ipcMain.handle('dashboard:tomorrow-schedule', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toISOString().split('T')[0];

  const result = db.exec(`
    SELECT s.*, e.first_name, e.last_name
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.date = ?
    ORDER BY s.start_time
  `, [date]);

  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
});

ipcMain.handle('dashboard:inventory-alerts', () => {
  const result = db.exec(`
    SELECT id, name, quantity, low_stock_alert
    FROM products
    WHERE quantity <= low_stock_alert
    ORDER BY quantity ASC
  `);

  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
});

ipcMain.handle('dashboard:manager-notes', () => {
  const result = db.exec(`
    SELECT id, type, title, body, pinned, meeting_at
    FROM manager_notes
    ORDER BY pinned DESC, created_at DESC
    LIMIT 10
  `);

  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
});

// ── APP SETUP ─────────────────────────────────────────
async function createWindow() {
  const result = await initDatabase();
  db = result.db;
  saveDb = result.saveDb;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    titleBarStyle: 'hiddenInset',
    title: 'Small Biz App',
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
