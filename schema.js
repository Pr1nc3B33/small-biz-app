const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'database', 'smallbiz.db');

async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Load existing database file if it exists, otherwise create new
  let db;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Save database to disk
  function saveDb() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }

  // ── POSITIONS ───────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS positions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL UNIQUE,
      color       TEXT DEFAULT '#64748B',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default positions
  const defaultPositions = [
    'Manager', 'Shift Leader', 'Team Leader',
    'Cashier', 'Customer Service'
  ];
  defaultPositions.forEach(title => {
    db.run(`INSERT OR IGNORE INTO positions (title) VALUES (?)`, [title]);
  });

  // ── PRODUCTS ────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      sku             TEXT UNIQUE,
      category        TEXT,
      quantity        INTEGER DEFAULT 0,
      unit            TEXT DEFAULT 'units',
      low_stock_alert INTEGER DEFAULT 5,
      unit_cost       REAL,
      sale_price      REAL,
      supplier        TEXT,
      location        TEXT,
      notes           TEXT,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── EMPLOYEES ───────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name      TEXT NOT NULL,
      last_name       TEXT NOT NULL,
      position_id     INTEGER,
      email           TEXT UNIQUE,
      phone           TEXT,
      hire_date       DATE,
      salary          REAL,
      status          TEXT DEFAULT 'Active',
      notes           TEXT,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (position_id) REFERENCES positions(id)
    )
  `);

  // ── USERS ───────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id     INTEGER UNIQUE,
      username        TEXT NOT NULL UNIQUE,
      password_hash   TEXT NOT NULL,
      role            TEXT NOT NULL DEFAULT 'employee',
      is_first_login  INTEGER DEFAULT 1,
      last_login      DATETIME,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  // ── SHIFTS ──────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS shifts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id     INTEGER NOT NULL,
      date            DATE NOT NULL,
      start_time      TIME NOT NULL,
      end_time        TIME NOT NULL,
      actual_start    TIME,
      actual_end      TIME,
      position        TEXT,
      status          TEXT DEFAULT 'Scheduled',
      notes           TEXT,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  // ── TASKS ───────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      title               TEXT NOT NULL,
      description         TEXT,
      assigned_to         INTEGER,
      due_date            DATE,
      status              TEXT DEFAULT 'Pending',
      priority            TEXT DEFAULT 'Medium',
      related_product_id  INTEGER,
      created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at        DATETIME,
      FOREIGN KEY (related_product_id) REFERENCES products(id),
      FOREIGN KEY (assigned_to)        REFERENCES employees(id)
    )
  `);

  // ── INVENTORY LOG ───────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_log (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id           INTEGER NOT NULL,
      performed_by         INTEGER,
      performed_by_system  TEXT,
      change_type          TEXT NOT NULL,
      quantity_change      INTEGER NOT NULL,
      quantity_after       INTEGER NOT NULL,
      reason               TEXT,
      created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id)   REFERENCES products(id),
      FOREIGN KEY (performed_by) REFERENCES employees(id)
    )
  `);

  // ── TICKETS ─────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      created_by      INTEGER NOT NULL,
      ticket_type     TEXT NOT NULL,
      title           TEXT NOT NULL,
      description     TEXT,
      status          TEXT DEFAULT 'Pending',
      priority        TEXT DEFAULT 'Normal',
      reviewed_by     INTEGER,
      manager_notes   TEXT,
      resolved_at     DATETIME,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by)  REFERENCES employees(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    )
  `);

  // ── NOTIFICATIONS ───────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      ticket_id   INTEGER,
      message     TEXT NOT NULL,
      is_read     INTEGER DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id)   REFERENCES users(id),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    )
  `);

  // ── MANAGER NOTES ───────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS manager_notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_by  INTEGER NOT NULL,
      type        TEXT DEFAULT 'Note',
      title       TEXT NOT NULL,
      body        TEXT,
      pinned      INTEGER DEFAULT 0,
      meeting_at  DATETIME,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Save to disk after all tables created
  saveDb();
  console.log('✅ Database and all 10 tables created successfully!');

  return { db, saveDb };
}

module.exports = initDatabase;