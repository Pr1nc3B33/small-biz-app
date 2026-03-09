const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database', 'smallbiz.db'));
db.pragma('journal_mode = WAL');
db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL UNIQUE,
        color       TEXT DEFAULT '#64748B',
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);
const defaultPositions = [
    'Manager',
    'Shift Leader',
    'Team Leader',
    'Cashier',
    'Customer Service'
];

const insertPosition = db.prepare(`
    INSERT OR IGNORE INTO positions (title) VALUES (?)
`);

defaultPositions.forEach(title => insertPosition.run(title));


db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    sku             TEXT UNIQUE,
    category        TEXT,
    quantity        INTEGER DEFAULT 0,
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

db.exec(`
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

db.exec(`
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

db.exec(`
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
        FOREIGN KEY (assigned_to) REFERENCES employees(id)
    )
`);

db.exec(`
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
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (performed_by) REFERENCES employees(id)
    )
`);

console.log('✅ Database and all 6 tables created successfully!');

module.exports = db;
