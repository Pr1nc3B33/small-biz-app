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

// SETUP: Create the first manager account
ipcMain.handle('auth:create-manager', async (event, { username, password }) => {
  // Check if manager already exists
  const existing = db.exec(
    `SELECT id FROM users WHERE role = 'manager' LIMIT 1`
  );
  if (existing.length > 0 && existing[0].values.length > 0) {
    return { success: false, message: 'A manager account already exists' };
  }

  // Hash the password — never store plain text
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

// ── APP SETUP ─────────────────────────────────────────
async function createWindow() {
  // Initialize database first
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