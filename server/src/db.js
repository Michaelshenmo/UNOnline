import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'uno.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT,
    email TEXT,
    role TEXT DEFAULT 'player',
    status TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS game_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    player_id INTEGER NOT NULL,
    rank INTEGER,
    finished_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES users(id)
  );
`);

// Migrations
try { db.exec('ALTER TABLE users ADD COLUMN status TEXT DEFAULT "normal"'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN title TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN title_enabled INTEGER DEFAULT 0'); } catch {}

// Insert default settings
const insertSetting = db.prepare('INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)');
insertSetting.run('max_players', '4');
insertSetting.run('turn_timeout', '30');
insertSetting.run('uno_penalty', '2');
insertSetting.run('allow_registration', 'true');
insertSetting.run('announcement', '');
insertSetting.run('announcement_version', '0');
insertSetting.run('email_verification', 'false');
insertSetting.run('smtp_host', '');
insertSetting.run('smtp_port', '465');
insertSetting.run('smtp_user', '');
insertSetting.run('smtp_password', '');
insertSetting.run('smtp_from', '');
insertSetting.run('no_mercy_threshold', '40');

export default db;
