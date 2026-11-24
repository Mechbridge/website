// Plain-JS core shared by the Astro server (src/server/*.ts) and the CLI (scripts/admin-create.mjs).
// SQLite through Node's built-in node:sqlite (Node >= 22.13), so the VPS needs no native build.
import { DatabaseSync } from 'node:sqlite';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superadmin','hr','training','sales')),
  pw_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS postings (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('job','internship','training')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (kind, slug)
);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('consultancy','contact','training','internship','job','support')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  ref_id INTEGER,
  ref_title TEXT NOT NULL DEFAULT '',
  cv_name TEXT NOT NULL DEFAULT '',
  cv_path TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','closed')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS leads_type ON leads(type, status);
CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  holder_name TEXT NOT NULL,
  programme TEXT NOT NULL CHECK (programme IN ('training','internship')),
  title TEXT NOT NULL,
  batch TEXT NOT NULL DEFAULT '',
  issue_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','revoked')),
  revoked_reason TEXT NOT NULL DEFAULT '',
  issued_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function dataDir() {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  mkdirSync(path.join(dir, 'uploads'), { recursive: true });
  return dir;
}

// Versioned migrations, applied in order on boot (PRAGMA user_version tracks the last one run).
const MIGRATIONS = [
  // v2: richer lead pipeline (qualified, distributed, converted), assignment, distribution,
  //     a per-lead history table, and last-login tracking for staff.
  `
  CREATE TABLE leads_v2 (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('consultancy','contact','training','internship','job','support')),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    ref_id INTEGER,
    ref_title TEXT NOT NULL DEFAULT '',
    cv_name TEXT NOT NULL DEFAULT '',
    cv_path TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','distributed','converted','closed')),
    notes TEXT NOT NULL DEFAULT '',
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    distributed_to TEXT NOT NULL DEFAULT '',
    distributed_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  INSERT INTO leads_v2 (id, type, name, email, phone, country, subject, message, ref_id, ref_title, cv_name, cv_path, status, notes, created_at, updated_at)
    SELECT id, type, name, email, phone, country, subject, message, ref_id, ref_title, cv_name, cv_path, status, notes, created_at, created_at FROM leads;
  DROP TABLE leads;
  ALTER TABLE leads_v2 RENAME TO leads;
  CREATE INDEX IF NOT EXISTS leads_type ON leads(type, status);
  CREATE INDEX IF NOT EXISTS leads_created ON leads(created_at);
  CREATE TABLE IF NOT EXISTS lead_events (
    id INTEGER PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    at TEXT NOT NULL DEFAULT (datetime('now')),
    by TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS lead_events_lead ON lead_events(lead_id);
  ALTER TABLE users ADD COLUMN last_login_at TEXT NOT NULL DEFAULT '';
  `,
  // v3: documentation role and per-person extra permissions (perms, comma-separated);
  //     postings get 'archived' (hidden) while 'closed' now stays listed as no longer available,
  //     so existing closed postings become archived to keep them hidden;
  //     optional certificate details.
  `
  CREATE TABLE users_v3 (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('superadmin','hr','training','sales','documentation')),
    pw_hash TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT NOT NULL DEFAULT '',
    perms TEXT NOT NULL DEFAULT ''
  );
  INSERT INTO users_v3 (id, email, name, role, pw_hash, active, created_at, last_login_at)
    SELECT id, email, name, role, pw_hash, active, created_at, last_login_at FROM users;
  DROP TABLE users;
  ALTER TABLE users_v3 RENAME TO users;

  CREATE TABLE postings_v3 (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('job','internship','training')),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    mode TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed','archived')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (kind, slug)
  );
  INSERT INTO postings_v3 (id, kind, title, slug, location, mode, start_date, summary, body, status, created_at, updated_at)
    SELECT id, kind, title, slug, location, mode, start_date, summary, body, CASE status WHEN 'closed' THEN 'archived' ELSE status END, created_at, updated_at FROM postings;
  DROP TABLE postings;
  ALTER TABLE postings_v3 RENAME TO postings;

  ALTER TABLE certificates ADD COLUMN period_from TEXT NOT NULL DEFAULT '';
  ALTER TABLE certificates ADD COLUMN period_to TEXT NOT NULL DEFAULT '';
  ALTER TABLE certificates ADD COLUMN hours TEXT NOT NULL DEFAULT '';
  ALTER TABLE certificates ADD COLUMN mode TEXT NOT NULL DEFAULT '';
  ALTER TABLE certificates ADD COLUMN grade TEXT NOT NULL DEFAULT '';
  ALTER TABLE certificates ADD COLUMN modules TEXT NOT NULL DEFAULT '';
  ALTER TABLE certificates ADD COLUMN remarks TEXT NOT NULL DEFAULT '';
  ALTER TABLE certificates ADD COLUMN signatory_name TEXT NOT NULL DEFAULT '';
  ALTER TABLE certificates ADD COLUMN signatory_title TEXT NOT NULL DEFAULT '';
  `,
  // v4: internship applications attach a degree certificate or college ID.
  `
  ALTER TABLE leads ADD COLUMN id_doc_name TEXT NOT NULL DEFAULT '';
  ALTER TABLE leads ADD COLUMN id_doc_path TEXT NOT NULL DEFAULT '';
  `,
  // v5: topic-specific details from the enquiry form (company, college, experience...), as JSON.
  `
  ALTER TABLE leads ADD COLUMN details TEXT NOT NULL DEFAULT '{}';
  `,
];

function migrate(db) {
  const current = Number(db.prepare('PRAGMA user_version').get().user_version) || 1;
  for (let v = current + 1; v <= MIGRATIONS.length + 1; v++) {
    db.exec('PRAGMA foreign_keys = OFF; BEGIN;');
    try {
      db.exec(MIGRATIONS[v - 2]);
      db.exec(`PRAGMA user_version = ${v}; COMMIT;`);
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }
  }
}

export function openDb() {
  const db = new DatabaseSync(path.join(dataDir(), 'mechbridge.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// scrypt$N$salt$hash
export function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(pw, stored) {
  const [alg, n, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const got = scryptSync(pw, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: 8, p: 1 });
  return timingSafeEqual(expected, got);
}

export const MIN_PASSWORD = 10;
