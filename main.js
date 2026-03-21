const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const bcrypt = require('bcryptjs');
const initDatabase = require('./schema');

let mainWindow;
let db;
let saveDb;

// ── AUTH HANDLERS ─────────────────────────────────────

ipcMain.handle('auth:check-setup', async () => {
  const result = db.exec(
    `SELECT id FROM users WHERE role = 'manager' LIMIT 1`
  );
  return result.length > 0 && result[0].values.length > 0;
});

ipcMain.handle('auth:login', async (event, { username, password }) => {
  const result = db.exec(
    `SELECT id, username, password_hash, role, is_first_login, employee_id
     FROM users WHERE username = ?`,
    [username]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return { success: false, message: 'Invalid username or password' };
  }

  const cols = result[0].columns;
  const row = result[0].values[0];
  const user = {};
  cols.forEach((col, i) => user[col] = row[i]);

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    return { success: false, message: 'Invalid username or password' };
  }

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

// ── EMPLOYEE HANDLERS ─────────────────────────────────

ipcMain.handle('employees:get-positions', () => {
  const result = db.exec(`
    SELECT p.id, p.title, p.color,
      COUNT(e.id) as employee_count
    FROM positions p
    LEFT JOIN employees e ON e.position_id = p.id
      AND e.status = 'Active'
    GROUP BY p.id
    ORDER BY p.title
  `);

  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
});

ipcMain.handle('employees:get-by-position', (event, positionId) => {
  const result = db.exec(`
    SELECT e.id, e.first_name, e.last_name, e.email,
      e.phone, e.status, e.hire_date, p.title as position_title,
      p.color as position_color,
      COUNT(DISTINCT t.id) as tasks_completed
    FROM employees e
    LEFT JOIN positions p ON e.position_id = p.id
    LEFT JOIN tasks t ON t.assigned_to = e.id
      AND t.status = 'Done'
    WHERE e.position_id = ? AND e.status = 'Active'
    GROUP BY e.id
    ORDER BY e.first_name
  `, [positionId]);

  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
});

ipcMain.handle('employees:get-all', () => {
  const result = db.exec(`
    SELECT e.id, e.first_name, e.last_name, e.email,
      e.phone, e.status, e.hire_date, p.title as position_title,
      p.color as position_color
    FROM employees e
    LEFT JOIN positions p ON e.position_id = p.id
    WHERE e.status = 'Active'
    ORDER BY e.first_name
  `);

  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
});

ipcMain.handle('employees:add', async (event, data) => {
  try {
    db.run(`
      INSERT INTO employees
        (first_name, last_name, email, phone, position_id, hire_date, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Active')
    `, [
      data.first_name,
      data.last_name,
      data.email || null,
      data.phone || null,
      data.position_id,
      data.hire_date || new Date().toISOString().split('T')[0]
    ]);
    saveDb();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('employees:deactivate', (event, employeeId) => {
  try {
    db.run(
      `UPDATE employees SET status = 'Inactive' WHERE id = ?`,
      [employeeId]
    );
    saveDb();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// ── INVENTORY HANDLERS ────────────────────────────────

ipcMain.handle('inventory:get-all', () => {
  const result = db.exec(`
    SELECT id, name, sku, category, quantity, unit,
      low_stock_alert, unit_cost, sale_price, supplier, notes
    FROM products
    ORDER BY name
  `);

  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
});

ipcMain.handle('inventory:add-product', (event, data) => {
  try {
    db.run(`
      INSERT INTO products
        (name, sku, quantity, unit, low_stock_alert, unit_cost, sale_price, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.name,
      data.sku || null,
      data.quantity || 0,
      data.unit || 'units',
      data.low_stock_alert || 10,
      data.unit_cost || null,
      data.sale_price || null,
      data.notes || null,
    ]);
    saveDb();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('inventory:adjust-stock', (event, { productId, adjustment, reason }) => {
  try {
    const current = db.exec(
      `SELECT quantity FROM products WHERE id = ?`,
      [productId]
    );

    if (!current.length) return { success: false, message: 'Product not found' };

    const currentQty = current[0].values[0][0];
    const newQty = currentQty + adjustment;

    if (newQty < 0) {
      return { success: false, message: 'Stock cannot go below zero' };
    }

    db.run(
      `UPDATE products SET quantity = ? WHERE id = ?`,
      [newQty, productId]
    );

    db.run(`
      INSERT INTO inventory_log
        (product_id, change_type, quantity_change, quantity_after,
         reason, performed_by_system)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      productId,
      adjustment > 0 ? 'restock' : 'removal',
      adjustment,
      newQty,
      reason || 'Manual adjustment',
      'manual'
    ]);

    saveDb();
    return { success: true, newQuantity: newQty };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('inventory:delete-product', (event, productId) => {
  try {
    db.run(`DELETE FROM products WHERE id = ?`, [productId]);
    saveDb();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// ── SCHEDULE HANDLERS ─────────────────────────────────

ipcMain.handle('schedule:get-week', async (event, { startDate }) => {
  try {
    const result = db.exec(`
      SELECT
        s.id,
        s.date,
        s.start_time,
        s.end_time,
        s.position,
        s.status,
        s.notes,
        e.first_name,
        e.last_name
      FROM shifts s
      JOIN employees e ON s.employee_id = e.id
      WHERE s.date >= ? AND s.date < date(?, '+7 days')
      ORDER BY s.date, s.start_time
    `, [startDate, startDate]);

    if (!result.length) return { success: true, shifts: [] };

    const cols = result[0].columns;
    const shifts = result[0].values.map(row => {
      const obj = {};
      cols.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });

    return { success: true, shifts };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('schedule:add-shift', async (event, shiftData) => {
  try {
    db.run(`
      INSERT INTO shifts (employee_id, date, start_time, end_time, position, status, notes)
      VALUES (?, ?, ?, ?, ?, 'Scheduled', ?)
    `, [
      shiftData.employee_id,
      shiftData.date,
      shiftData.start_time,
      shiftData.end_time,
      shiftData.position,
      shiftData.notes || ''
    ]);

    saveDb();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('schedule:delete-shift', async (event, { id }) => {
  try {
    db.run(`DELETE FROM shifts WHERE id = ?`, [id]);
    saveDb();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
// ── TASKS HANDLERS ───────────────────────────────────

ipcMain.handle('tasks:get-all', () => {
  const result = db.exec(`
    SELECT t.id, t.title, t.description, t.due_date,
      t.status, t.priority, t.created_at,
      e.first_name, e.last_name
    FROM tasks t
    LEFT JOIN employees e ON t.assigned_to = e.id
    ORDER BY t.created_at DESC
  `);

  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
});

ipcMain.handle('tasks:add', (event, data) => {
  try {
    db.run(`
      INSERT INTO tasks (title, description, assigned_to, due_date, status, priority)
      VALUES (?, ?, ?, ?, 'Pending', ?)
    `, [
      data.title,
      data.description || null,
      data.assigned_to || null,
      data.due_date || null,
      data.priority || 'Medium'
    ]);
    saveDb();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('tasks:update-status', (event, { id, status }) => {
  try {
    const completedAt = status === 'Done' ? "CURRENT_TIMESTAMP" : "NULL";
    db.run(
      `UPDATE tasks SET status = ?, completed_at = ${completedAt}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id]
    );
    saveDb();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('tasks:delete', (event, id) => {
  try {
    db.run(`DELETE FROM tasks WHERE id = ?`, [id]);
    saveDb();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
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

ipcMain.handle('tickets:get-all', (event) => {
  try {
    const result = db.exec(`
      SELECT t.id, t.title, t.description, t.category,
        t.status, t.priority, t.created_at, t.updated_at,
        e1.first_name || ' ' || e1.last_name AS created_by_name,
        e2.first_name || ' ' || e2.last_name AS assigned_to_name
      FROM tickets t
      LEFT JOIN employees e1 ON t.created_by = e1.id
      LEFT JOIN employees e2 ON t.assigned_to = e2.id
      ORDER BY t.created_at DESC
    `);

    if (!result.length) return { success: true, tickets: [] };
    const cols = result[0].columns;
    const tickets = result[0].values.map(row => {
      const obj = {};
      cols.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
    return { success: true, tickets };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('tickets:create', (event, data) => {
  try {
    db.run(`
      INSERT INTO tickets (title, description, category, priority, created_by)
      VALUES (?, ?, ?, ?, ?)
    `, [
      data.title,
      data.description || null,
      data.category,
      data.priority || 'Medium',
      data.created_by
    ]);
    saveDb();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('tickets:get-by-id', (event, id) => {
  try {
    const result = db.exec(`
      SELECT t.id, t.title, t.description, t.category,
        t.status, t.priority, t.created_at, t.updated_at,
        e1.first_name || ' ' || e1.last_name AS created_by_name,
        e2.first_name || ' ' || e2.last_name AS assigned_to_name,
        t.assigned_to
      FROM tickets t
      LEFT JOIN employees e1 ON t.created_by = e1.id
      LEFT JOIN employees e2 ON t.assigned_to = e2.id
      WHERE t.id = ?
    `, [id]);

    if (!result.length || !result[0].values.length) {
      return { success: false, message: 'Ticket not found' };
    }

    const cols = result[0].columns;
    const ticket = {};
    cols.forEach((col, i) => ticket[col] = result[0].values[0][i]); 
    const notesResult = db.exec(`
      SELECT n.id, n.note, n.created_at,
        e.first_name || ' ' || e.last_name AS author_name
      FROM ticket_notes n
      LEFT JOIN employees e ON n.author_id = e.id
      WHERE n.ticket_id = ?
      ORDER BY n.created_at ASC
    `, [id]);

    const notes = !notesResult.length ? [] : notesResult[0].values.map(row => {
      const obj = {};
      notesResult[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });

    return { success: true, ticket, notes };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

  ipcMain.handle('tickets:update-status', (event, { id, status }) => {
    try {
      db.run(
        `UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, id]
      );
      saveDb();
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }); 
  ipcMain.handle('tickets:assign', (event, { id, employeeId }) => {
    try {
      db.run(
        `UPDATE tickets SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [employeeId, id]
      );
      saveDb();
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
  ipcMain.handle('tickets:add-note', (event, { ticketId, authorId, note }) => {
    try {
      db.run(`
        INSERT INTO ticket_notes (ticket_id, author_id, note)
        VALUES (?, ?, ?)
      `, [ticketId, authorId, note]);
      saveDb();
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });



app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
