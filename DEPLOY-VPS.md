# Deploying mechbridgegroup.com on a VPS

> **First time?** Follow [GO-LIVE.md](GO-LIVE.md). It covers GoDaddy DNS, the OVH server, the website, the mail server (Postfix, Dovecot, DKIM) and Roundcube at mail.mechbridgegroup.com, step by step. This file is the shorter reference for updates and roles.

Production is one Node process. Astro serves the prerendered pages and the `/api` routes, and the data lives in a single SQLite file plus an `uploads/` folder for CVs. nginx sits in front for TLS.

The GitHub Pages copy (`npm run deploy:pages`) is a static demo: it has no server, and its data stays in each visitor's browser. Nothing on this page applies to it.

## What you need

- Ubuntu 22.04+ or Debian 12+ (any Linux with systemd works)
- **Node.js 22.13 or newer**. The site uses Node's built-in `node:sqlite`, so there are no native builds. Node 24 LTS is a good choice.
- nginx, certbot, sqlite3 (used by the backup script), git
- DNS: an A record for `mechbridgegroup.com` and `www` pointing at the server

## First install

```bash
# 1. System user and folders
sudo adduser --system --group --home /var/www/mechbridge mechbridge
sudo mkdir -p /var/lib/mechbridge && sudo chown mechbridge:mechbridge /var/lib/mechbridge

# 2. Code
sudo -u mechbridge git clone --recurse-submodules https://github.com/Mechbridge/website.git /var/www/mechbridge
cd /var/www/mechbridge
sudo -u mechbridge npm ci
sudo -u mechbridge npm run build

# 3. Settings
sudo cp .env.example /etc/mechbridge.env
sudo nano /etc/mechbridge.env          # check DATA_DIR, add SMTP details if you want email alerts
sudo chmod 640 /etc/mechbridge.env && sudo chown root:mechbridge /etc/mechbridge.env

# 4. First superadmin (prompts for a password, minimum 10 characters)
sudo -u mechbridge env DATA_DIR=/var/lib/mechbridge npm run admin:create -- --email you@mechbridgegroup.com --name "Your Name" --role superadmin

# 5. Service
sudo cp deploy/mechbridge.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now mechbridge
sudo systemctl status mechbridge

# 6. nginx + TLS
sudo cp deploy/nginx.conf /etc/nginx/sites-available/mechbridge
sudo ln -s /etc/nginx/sites-available/mechbridge /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d mechbridgegroup.com -d www.mechbridgegroup.com

# 7. Nightly backups
sudo crontab -u mechbridge -e     # add: 15 2 * * * DATA_DIR=/var/lib/mechbridge /var/www/mechbridge/deploy/backup.sh
```

Then open `https://mechbridgegroup.com/admin` and log in. Add the other staff accounts under **Staff accounts**.

## Updating

```bash
cd /var/www/mechbridge
sudo -u mechbridge git pull --recurse-submodules
sudo -u mechbridge npm ci
sudo -u mechbridge npm run build
sudo systemctl restart mechbridge
```

The database schema is created and upgraded automatically when the server starts.

## Roles

| Role | Can do |
|---|---|
| Superadmin | Everything, including staff accounts and deleting leads |
| HR | Jobs, internship intakes, and job/internship applications (with CVs) |
| Training | Training batches, certificates, and training enquiries |
| Sales | Proposal requests, general contact and support leads |

At least one active superadmin must always exist; the portal refuses to demote or deactivate the last one. A locked-out superadmin can be reset from the server with `npm run admin:create` (same email, new password).

## Where things are

| | |
|---|---|
| Database | `$DATA_DIR/mechbridge.db` (SQLite, WAL mode) |
| CVs | `$DATA_DIR/uploads/` (PDF/DOC/DOCX up to 5 MB, downloadable only by logged-in staff) |
| Logs | `journalctl -u mechbridge -f` |
| Backups | `/var/backups/mechbridge/` (30 days) |

## Security notes

- Passwords are hashed with scrypt. Sessions are random 256-bit tokens stored hashed, sent as `HttpOnly; SameSite=Lax; Secure` cookies, and they last 7 days.
- Writes to the API must come from the site's own origin. Login and lead submissions are rate-limited per IP.
- Certificate verification only reveals the holder name, programme, title, issue date and status.
- Keep `/etc/mechbridge.env` and the backups readable only by root and the `mechbridge` user.
