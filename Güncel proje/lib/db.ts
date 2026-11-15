import 'server-only';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// Veriler proje dizininde tutulur; paketleme aşamasında yazılabilir konum belirlenecek.
const dataDirectory = path.join(process.cwd(), 'data');
mkdirSync(dataDirectory, { recursive: true });
const db = new Database(path.join(dataDirectory, 'kentsel.sqlite'));
db.pragma('busy_timeout = 5000');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
const schema = `id INTEGER PRIMARY KEY AUTOINCREMENT,
  semt TEXT, ada TEXT, parsel TEXT, arsa_alani REAL, taks REAL, kaks REAL,
  bina_sayisi INTEGER, daire_sayisi INTEGER, dukkan_sayisi INTEGER,
  insaat_alani REAL, imar_tipi TEXT, riskli_yapi TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))`;
// Eski NOT NULL şemasını kayıtları ve kimlikleri koruyarak tek işlemde taşı.
db.transaction(() => {
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'projects'").get();
  if (!exists) {
    db.exec(`CREATE TABLE projects (${schema})`);
    return;
  }
  const columns = db.pragma('table_info(projects)') as { name: string; notnull: number }[];
  if (columns.some(column => column.notnull) || !columns.some(column => column.name === 'riskli_yapi')) {
    const target = ['id', 'semt', 'ada', 'parsel', 'arsa_alani', 'taks', 'kaks', 'bina_sayisi', 'daire_sayisi', 'dukkan_sayisi', 'insaat_alani', 'imar_tipi', 'riskli_yapi', 'created_at', 'updated_at'];
    const common = target.filter(name => columns.some(column => column.name === name)).join(', ');
    db.exec(`CREATE TABLE projects_migration (${schema}); INSERT INTO projects_migration (${common}) SELECT ${common} FROM projects; DROP TABLE projects; ALTER TABLE projects_migration RENAME TO projects;`);
  }
}).immediate();
export default db;
