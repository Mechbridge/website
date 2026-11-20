// Mailbox management for the staff portal.
// Production: runs the root helper /usr/local/sbin/mb-mailbox through one sudo rule (see deploy/).
// Local development (no mail server): MAILBOX_MODE=mock keeps mailboxes in DATA_DIR/mailboxes-mock.json.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { dataDir } from './core.mjs';
import type { MailAlias, Mailbox, MailboxList } from '../lib/api/types';
import { MAIL_DOMAIN, CORE_MAILBOXES, mailAddress, mailAddressError, mailPasswordError } from '../lib/roles';

const HELPER = '/usr/local/sbin/mb-mailbox';
const mode = (): MailboxList['mode'] =>
  (process.env.MAILBOX_MODE as MailboxList['mode']) || (existsSync(HELPER) ? 'server' : process.platform === 'win32' || process.env.NODE_ENV !== 'production' ? 'mock' : 'off');

export class MailError extends Error { constructor(public status: number, msg: string) { super(msg); } }

function helper(args: string[], input = ''): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn('sudo', ['-n', HELPER, ...args], { stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000 });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => reject(new MailError(503, `The mailbox tool couldn't start (${e.message}).`)));
    p.on('close', (code) => {
      if (code === 0) return resolve(out);
      const msg = err.split('\n').find((l) => l.startsWith('ERROR: '))?.slice(7)
        || (/password is required|not allowed|sudoers/i.test(err) ? 'The website is not allowed to manage mailboxes yet. Install the sudo rule from deploy/sudoers-mechbridge.' : err.trim() || `Mailbox tool failed (${code}).`);
      reject(new MailError(/doesn't exist/.test(msg) ? 404 : /already/.test(msg) ? 409 : 400, msg));
    });
    p.stdin.end(input ? `${input}\n` : '');
  });
}

/* ---------- mock store for local development ---------- */
const mockFile = () => path.join(dataDir(), 'mailboxes-mock.json');
interface MockState { mailboxes: { address: string; created: string }[]; aliases: MailAlias[] }
function mockLoad(): MockState {
  try { return JSON.parse(readFileSync(mockFile(), 'utf8')); } catch {
    const now = new Date().toISOString();
    return {
      mailboxes: CORE_MAILBOXES.map((l) => ({ address: `${l}@${MAIL_DOMAIN}`, created: now })),
      aliases: ['postmaster', 'abuse', 'no-reply', 'info'].map((l) => ({ from: `${l}@${MAIL_DOMAIN}`, to: `connect@${MAIL_DOMAIN}` })),
    };
  }
}
const mockSave = (s: MockState) => writeFileSync(mockFile(), JSON.stringify(s, null, 2));

/* ---------- validation shared by both modes ---------- */
export function normaliseAddress(input: string) {
  const address = mailAddress(input);
  const e = mailAddressError(address);
  if (e) throw new MailError(400, e);
  return address;
}
export function checkPassword(pw: unknown) {
  const p = String(pw ?? '');
  const e = mailPasswordError(p);
  if (e) throw new MailError(400, e);
  return p;
}

/* ---------- operations ---------- */
export async function listMailboxes(): Promise<MailboxList> {
  const m = mode();
  const base = { mode: m, domain: MAIL_DOMAIN, webmail: `https://mail.${MAIL_DOMAIN}` };
  if (m === 'off') return { ...base, available: false, mailboxes: [], aliases: [] };
  if (m === 'mock') {
    const s = mockLoad();
    return { ...base, available: true, mailboxes: s.mailboxes.map((x) => ({ ...x, size_bytes: 0, core: isCore(x.address) })), aliases: s.aliases };
  }
  const out = await helper(['list']);
  const [boxes, aliases = ''] = out.split('--aliases');
  const mailboxes: Mailbox[] = boxes.split('\n').filter(Boolean).map((line) => {
    const [address, size, created] = line.split('\t');
    return { address, size_bytes: Number(size) || 0, created: created || '', core: isCore(address) };
  }).sort((a, b) => a.address.localeCompare(b.address));
  return { ...base, available: true, mailboxes, aliases: aliases.split('\n').filter(Boolean).map((l) => { const [from, to] = l.split('\t'); return { from, to }; }) };
}

const isCore = (address: string) => CORE_MAILBOXES.some((l) => address === `${l}@${MAIL_DOMAIN}`);

export async function createMailbox(input: string, password: unknown) {
  const address = normaliseAddress(input), pw = checkPassword(password);
  const m = mode();
  if (m === 'off') throw new MailError(503, 'Mail management is not set up on this server yet.');
  if (m === 'mock') {
    const s = mockLoad();
    if (s.mailboxes.some((x) => x.address === address)) throw new MailError(409, `${address} already exists.`);
    if (s.aliases.some((x) => x.from === address)) throw new MailError(409, `${address} is already an alias.`);
    s.mailboxes.push({ address, created: new Date().toISOString() }); mockSave(s); return address;
  }
  await helper(['add', address], pw);
  return address;
}

export async function setMailboxPassword(input: string, password: unknown) {
  const address = normaliseAddress(input), pw = checkPassword(password);
  const m = mode();
  if (m === 'off') throw new MailError(503, 'Mail management is not set up on this server yet.');
  if (m === 'mock') {
    if (!mockLoad().mailboxes.some((x) => x.address === address)) throw new MailError(404, `${address} doesn't exist.`);
    return address;
  }
  await helper(['passwd', address], pw);
  return address;
}

export async function deleteMailbox(input: string) {
  const address = normaliseAddress(input);
  const m = mode();
  if (m === 'off') throw new MailError(503, 'Mail management is not set up on this server yet.');
  if (m === 'mock') {
    const s = mockLoad();
    if (!s.mailboxes.some((x) => x.address === address)) throw new MailError(404, `${address} doesn't exist.`);
    s.mailboxes = s.mailboxes.filter((x) => x.address !== address); mockSave(s); return address;
  }
  await helper(['delete', address]);
  return address;
}
