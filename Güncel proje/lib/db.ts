import 'server-only';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// Veriler proje dizininde tutulur; paketleme aşamasında yazılabilir konum belirlenecek.
const dataDirectory = path.join(process.cwd(), 'data');
mkdirSync(dataDirectory, { recursive: true });
const db = new Database(path.join(dataDirectory, 'kentsel.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
export default db;
