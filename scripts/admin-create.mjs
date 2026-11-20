#!/usr/bin/env node
// Create (or reset) a staff account on the VPS database.
//   npm run admin:create -- --email you@mechbridgegroup.com --name "Your Name" --role superadmin
// Prompts for the password. Uses DATA_DIR (default ./data), same as the server.
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, exit } from 'node:process';
import { openDb, hashPassword, MIN_PASSWORD } from '../src/server/core.mjs';

const args = Object.fromEntries(argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? '']] : acc), []));
const email = String(args.email || '').trim().toLowerCase();
const name = String(args.name || email.split('@')[0] || '').trim();
const role = String(args.role || 'superadmin');
const ROLES = ['superadmin', 'hr', 'training', 'sales', 'documentation'];

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !ROLES.includes(role)) {
  console.error('Usage: npm run admin:create -- --email you@mechbridgegroup.com --name "Your Name" --role superadmin|hr|training|sales|documentation');
  exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });
const pw = args.password || (await rl.question(`Password for ${email} (min ${MIN_PASSWORD} characters): `));
rl.close();
if (pw.length < MIN_PASSWORD) { console.error(`Password must be at least ${MIN_PASSWORD} characters.`); exit(1); }

const db = openDb();
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) {
  db.prepare('UPDATE users SET name = ?, role = ?, pw_hash = ?, active = 1 WHERE id = ?').run(name, role, hashPassword(pw), existing.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
  console.log(`Updated ${email} (${role}). Existing sessions were signed out.`);
} else {
  db.prepare('INSERT INTO users (email, name, role, pw_hash) VALUES (?, ?, ?, ?)').run(email, name, role, hashPassword(pw));
  console.log(`Created ${email} (${role}).`);
}
