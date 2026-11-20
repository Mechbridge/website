# Going live: mechbridgegroup.com and mail.mechbridgegroup.com

One OVH VPS (Ubuntu 26.04, IP **178.32.38.29**) runs everything:

| Part | What | Where |
|---|---|---|
| Website | Node server (Astro) on 127.0.0.1:4321, behind nginx | https://mechbridgegroup.com |
| Staff portal | Same server | https://mechbridgegroup.com/admin |
| Mail (send/receive) | Postfix (SMTP) + Dovecot (IMAP) + OpenDKIM | mail.mechbridgegroup.com, ports 25 / 465 / 587 / 993 |
| Webmail | Roundcube on nginx + PHP-FPM | https://mail.mechbridgegroup.com |
| TLS | One Let's Encrypt certificate for all three names | auto-renews |

Mailboxes created here: **connect@, support@, careers@, intern@** mechbridgegroup.com, plus aliases (postmaster@, abuse@, no-reply@).

> **Domain check.** Everything on the site (links, emails, sitemap, share cards) uses **mechbridgegroup.com**. If the domain you bought on GoDaddy is really `mechbridge.com`, stop and tell the developer before continuing, because the site and these steps would both need changing.

Time needed: about 2 hours of work, plus up to a few hours of waiting for DNS to spread.

Commands go into **PuTTY** one block at a time. Lines starting with `#` are comments. Use **WinSCP** if you'd rather edit a file in a window than in `nano`.

---

## Step 1. DNS at GoDaddy (do this first; it needs time to spread)

GoDaddy → **My Products** → mechbridgegroup.com → **DNS** → **Manage DNS**.

1. Delete any existing **A** record for `@` that points to a GoDaddy "parked" IP, and turn off **Forwarding** if it's on.
2. Add or edit these records (TTL 600 seconds, or "1/2 hour"):

| Type | Name | Value | Notes |
|---|---|---|---|
| A | `@` | `178.32.38.29` | the website |
| A | `www` | `178.32.38.29` | redirects to the main domain |
| A | `mail` | `178.32.38.29` | mail server and webmail |
| MX | `@` | `mail.mechbridgegroup.com` | priority **10**. Delete any other MX records (for example GoDaddy's own) |
| TXT | `@` | `v=spf1 mx a ip4:178.32.38.29 ~all` | SPF: only this server sends mail for the domain |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:postmaster@mechbridgegroup.com; fo=1` | start with `p=none`, tighten to `p=quarantine` after 2 weeks of clean reports |
| CAA | `@` | `0 issue "letsencrypt.org"` | optional, limits who can issue certificates |

The **DKIM** TXT record is added in Step 6, after the key is generated on the server.

Check from your PC (Command Prompt) after 10 to 30 minutes:
```bash
nslookup mechbridgegroup.com
```
```bash
nslookup -type=mx mechbridgegroup.com
```
Both should show `178.32.38.29` / `mail.mechbridgegroup.com`.

## Step 2. OVH settings

1. **Reverse DNS (PTR).** OVH Control Panel → **Bare Metal Cloud** → **IP** (or your VPS → **IP**) → `178.32.38.29` → **⋯ → Modify the reverse path** → `mail.mechbridgegroup.com`. Gmail and Outlook reject mail from servers without a matching PTR. (OVH only accepts it once the A record from Step 1 resolves.)
2. **Firewall.** If you enabled OVH's **Network Firewall** for this IP, allow TCP 22, 25, 80, 443, 465, 587, 993. Otherwise leave it off. The server firewall in Step 3 does the job.

## Step 3. Connect and prepare the server

**PuTTY**: Host `178.32.38.29`, port 22, connection type SSH. Log in as **ubuntu** (OVH's default user for Ubuntu images) with the password or key from OVH's install email.

```bash
# System up to date, hostname set to the mail name (needed for mail)
sudo apt update && sudo apt full-upgrade -y
sudo hostnamectl set-hostname mail.mechbridgegroup.com
echo "178.32.38.29 mail.mechbridgegroup.com mail" | sudo tee -a /etc/hosts
sudo timedatectl set-timezone Asia/Dubai
```

```bash
# Firewall: SSH, web, mail
sudo apt install -y ufw fail2ban unattended-upgrades
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw allow 25,465,587,993/tcp
sudo ufw --force enable
sudo ufw status
```

```bash
# Check that OVH lets this server send mail on port 25 (should print "succeeded" or "open")
nc -vz -w 5 gmail-smtp-in.l.google.com 25
```
If that times out, open a ticket with OVH asking them to unblock outbound port 25 for the VPS. Receiving and the website work without it, but sending to other domains won't.

## Step 4. Install the software

```bash
# Node.js 24 LTS (the site needs Node 22.13 or newer)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

```bash
# Web server, certificates, tools
sudo apt install -y nginx certbot python3-certbot-nginx sqlite3 git
```

## Step 5. One certificate for all three names

```bash
sudo certbot certonly --nginx -d mechbridgegroup.com -d www.mechbridgegroup.com -d mail.mechbridgegroup.com --agree-tos -m connect@mechbridgegroup.com --no-eff-email
```
If certbot says a name doesn't resolve, wait for DNS (Step 1) and run it again. Renewal is automatic. Check it with:
```bash
sudo certbot renew --dry-run
```

## Step 6. Mail server (Postfix, Dovecot, OpenDKIM)

### 6.1 Install
```bash
sudo DEBIAN_FRONTEND=noninteractive apt install -y postfix dovecot-core dovecot-imapd dovecot-lmtpd opendkim opendkim-tools
dovecot --version
```
These steps are written for **Dovecot 2.4** (Ubuntu 26.04). If the version starts with 2.3, tell the developer before continuing, because the config format differs.

### 6.2 Mail storage user
```bash
sudo groupadd -g 5000 vmail
sudo useradd -g vmail -u 5000 -d /var/mail/vhosts -m -s /usr/sbin/nologin vmail
```

### 6.3 Postfix
```bash
sudo postconf -e "myhostname = mail.mechbridgegroup.com"
sudo postconf -e "mydomain = mechbridgegroup.com"
sudo postconf -e "myorigin = \$mydomain"
sudo postconf -e "mydestination = localhost"
sudo postconf -e "mynetworks = 127.0.0.0/8 [::1]/128"
sudo postconf -e "inet_interfaces = all"
sudo postconf -e "inet_protocols = ipv4"
sudo postconf -e "message_size_limit = 26214400"
sudo postconf -e "virtual_mailbox_domains = mechbridgegroup.com"
sudo postconf -e "virtual_mailbox_maps = texthash:/etc/postfix/vmailbox"
sudo postconf -e "virtual_alias_maps = texthash:/etc/postfix/virtual"
sudo postconf -e "virtual_transport = lmtp:unix:private/dovecot-lmtp"
sudo postconf -e "smtpd_tls_cert_file = /etc/letsencrypt/live/mechbridgegroup.com/fullchain.pem"
sudo postconf -e "smtpd_tls_key_file = /etc/letsencrypt/live/mechbridgegroup.com/privkey.pem"
sudo postconf -e "smtpd_tls_security_level = may"
sudo postconf -e "smtp_tls_security_level = may"
sudo postconf -e "smtpd_tls_mandatory_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1"
sudo postconf -e "smtpd_sasl_type = dovecot"
sudo postconf -e "smtpd_sasl_path = private/auth"
sudo postconf -e "smtpd_helo_required = yes"
sudo postconf -e "smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination"
sudo postconf -e "smtpd_milters = inet:127.0.0.1:8891"
sudo postconf -e "non_smtpd_milters = \$smtpd_milters"
sudo postconf -e "milter_default_action = accept"
```

Turn on the submission ports (587 and 465) for mail apps and Roundcube:
```bash
sudo postconf -M submission/inet="submission inet n - y - - smtpd"
sudo postconf -P "submission/inet/syslog_name=postfix/submission" "submission/inet/smtpd_tls_security_level=encrypt" "submission/inet/smtpd_sasl_auth_enable=yes" "submission/inet/smtpd_client_restrictions=permit_sasl_authenticated,reject" "submission/inet/smtpd_recipient_restrictions=permit_sasl_authenticated,reject"
sudo postconf -M submissions/inet="submissions inet n - y - - smtpd"
sudo postconf -P "submissions/inet/syslog_name=postfix/submissions" "submissions/inet/smtpd_tls_wrappermode=yes" "submissions/inet/smtpd_sasl_auth_enable=yes" "submissions/inet/smtpd_client_restrictions=permit_sasl_authenticated,reject" "submissions/inet/smtpd_recipient_restrictions=permit_sasl_authenticated,reject"
```

Aliases (mail to these goes to the listed mailbox). Change the targets if you like:
```bash
sudo tee /etc/postfix/virtual > /dev/null <<'EOF'
postmaster@mechbridgegroup.com  connect@mechbridgegroup.com
abuse@mechbridgegroup.com       connect@mechbridgegroup.com
no-reply@mechbridgegroup.com    connect@mechbridgegroup.com
info@mechbridgegroup.com        connect@mechbridgegroup.com
EOF
sudo touch /etc/postfix/vmailbox
```

### 6.4 Dovecot
```bash
sudo cp /etc/dovecot/dovecot.conf /etc/dovecot/dovecot.conf.orig
sudo tee /etc/dovecot/dovecot.conf > /dev/null <<'EOF'
dovecot_config_version = 2.4.0
dovecot_storage_version = 2.4.0

protocols = imap lmtp
listen = *

mail_driver = maildir
mail_home = /var/mail/vhosts/%{user | domain}/%{user | username}
mail_path = ~/Maildir
mail_uid = vmail
mail_gid = vmail
first_valid_uid = 5000
last_valid_uid = 5000

auth_mechanisms = plain login
auth_username_format = %{user | lower}

passdb passwd-file {
  passwd_file_path = /etc/dovecot/users
}
userdb static {
  fields {
    uid = vmail
    gid = vmail
    home = /var/mail/vhosts/%{user | domain}/%{user | username}
  }
}

ssl = required
ssl_server_cert_file = /etc/letsencrypt/live/mechbridgegroup.com/fullchain.pem
ssl_server_key_file = /etc/letsencrypt/live/mechbridgegroup.com/privkey.pem
ssl_min_protocol = TLSv1.2

namespace inbox {
  inbox = yes
  separator = /
  mailbox Drafts {
    special_use = \Drafts
    auto = subscribe
  }
  mailbox Sent {
    special_use = \Sent
    auto = subscribe
  }
  mailbox Junk {
    special_use = \Junk
    auto = subscribe
  }
  mailbox Trash {
    special_use = \Trash
    auto = subscribe
  }
}

service imap-login {
  inet_listener imap {
    port = 0
  }
  inet_listener imaps {
    port = 993
  }
}

service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}

service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}

log_path = syslog
EOF
sudo touch /etc/dovecot/users && sudo chown root:dovecot /etc/dovecot/users && sudo chmod 640 /etc/dovecot/users
sudo doveconf -n > /dev/null && echo "Dovecot config OK"
```
If `doveconf` prints an error, copy it to the developer before going on.

The certificate files belong to root, so allow Dovecot and Postfix to read them after renewals:
```bash
echo 'post_hook = systemctl reload postfix dovecot nginx' | sudo tee -a /etc/letsencrypt/cli.ini
```

### 6.5 DKIM signing
```bash
sudo mkdir -p /etc/opendkim/keys/mechbridgegroup.com
sudo opendkim-genkey -b 2048 -d mechbridgegroup.com -s mail -D /etc/opendkim/keys/mechbridgegroup.com
sudo chown -R opendkim:opendkim /etc/opendkim
sudo tee /etc/opendkim.conf > /dev/null <<'EOF'
Syslog            yes
UMask             007
Mode              sv
Canonicalization  relaxed/simple
Domain            mechbridgegroup.com
Selector          mail
KeyFile           /etc/opendkim/keys/mechbridgegroup.com/mail.private
Socket            inet:8891@127.0.0.1
PidFile           /run/opendkim/opendkim.pid
OversignHeaders   From
InternalHosts     127.0.0.1, ::1, localhost
EOF
sudo systemctl restart opendkim postfix dovecot
sudo cat /etc/opendkim/keys/mechbridgegroup.com/mail.txt
```
The last command prints the DKIM record. In GoDaddy add a **TXT** record:
- **Name:** `mail._domainkey`
- **Value:** everything between the quotes joined into one line, starting `v=DKIM1; h=sha256; k=rsa; p=MIIB...` (no quotes, no spaces between the parts).

## Step 7. The website

```bash
# App user, data folder, code
sudo adduser --system --group --home /var/www/mechbridge mechbridge
sudo mkdir -p /var/lib/mechbridge && sudo chown mechbridge:mechbridge /var/lib/mechbridge
sudo -u mechbridge git clone --recurse-submodules https://github.com/Mechbridge/website.git /var/www/mechbridge
cd /var/www/mechbridge
sudo -u mechbridge npm ci
sudo -u mechbridge npm run build
```

Settings. The website sends lead alerts through the local Postfix, so no outside email service is needed:
```bash
sudo tee /etc/mechbridge.env > /dev/null <<'EOF'
HOST=127.0.0.1
PORT=4321
DATA_DIR=/var/lib/mechbridge
PUBLIC_SITE_URL=https://mechbridgegroup.com
SMTP_HOST=127.0.0.1
SMTP_PORT=25
SMTP_SECURE=false
SMTP_FROM=Mechbridge website <no-reply@mechbridgegroup.com>
LEAD_NOTIFY_TO=connect@mechbridgegroup.com
SUPPORT_NOTIFY_TO=support@mechbridgegroup.com
CAREERS_NOTIFY_TO=careers@mechbridgegroup.com
INTERN_NOTIFY_TO=intern@mechbridgegroup.com
EOF
sudo chown root:mechbridge /etc/mechbridge.env && sudo chmod 640 /etc/mechbridge.env
```

Your first staff login (it asks for a password, 10+ characters):
```bash
sudo -u mechbridge env DATA_DIR=/var/lib/mechbridge npm run admin:create -- --email connect@mechbridgegroup.com --name "Your Name" --role superadmin
```

Start it as a service:
```bash
sudo cp deploy/mechbridge.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now mechbridge
sudo systemctl status mechbridge --no-pager
curl -sI http://127.0.0.1:4321 | head -1
```
The last line should say `HTTP/1.1 200 OK`.

### 7.1 Create the mailboxes

The helper script comes with the website code you just cloned:
```bash
cd /var/www/mechbridge
sudo bash deploy/mail-adduser.sh connect@mechbridgegroup.com
sudo bash deploy/mail-adduser.sh support@mechbridgegroup.com
sudo bash deploy/mail-adduser.sh careers@mechbridgegroup.com
sudo bash deploy/mail-adduser.sh intern@mechbridgegroup.com
```
Each one asks for a password (12+ characters). Store them in a password manager. Run the same command later to reset a password or to add another address (for example `yourname@mechbridgegroup.com`).

## Step 8. Roundcube webmail

```bash
sudo apt install -y --no-install-recommends roundcube roundcube-sqlite3 php-fpm php-sqlite3 php-intl php-mbstring php-xml php-zip php-gd
```
When asked "Configure database for roundcube with dbconfig-common?" choose **Yes**, then **sqlite3**.

If the install pulled in Apache, switch it off (nginx serves everything):
```bash
sudo systemctl disable --now apache2 2>/dev/null; true
```

Point Roundcube at this mail server:
```bash
sudo tee -a /etc/roundcube/config.inc.php > /dev/null <<'EOF'

// Mechbridge settings
$config['imap_host'] = 'ssl://mail.mechbridgegroup.com:993';
$config['smtp_host'] = 'tls://mail.mechbridgegroup.com:587';
$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['product_name'] = 'Mechbridge Mail';
$config['username_domain'] = 'mechbridgegroup.com';
$config['login_autocomplete'] = 2;
$config['enable_spellcheck'] = false;
$config['plugins'] = ['archive', 'zipdownload', 'markasjunk'];
EOF
```

## Step 9. nginx: website and webmail

```bash
cd /var/www/mechbridge
PHP_SOCK=$(ls /run/php/php*-fpm.sock | head -1); echo "$PHP_SOCK"
sudo cp deploy/nginx.conf /etc/nginx/sites-available/mechbridge
sudo sed "s#PHP_SOCK#${PHP_SOCK}#" deploy/nginx-mail.conf | sudo tee /etc/nginx/sites-available/mail > /dev/null
sudo ln -sf /etc/nginx/sites-available/mechbridge /etc/nginx/sites-enabled/mechbridge
sudo ln -sf /etc/nginx/sites-available/mail /etc/nginx/sites-enabled/mail
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Open **https://mechbridgegroup.com** and **https://mail.mechbridgegroup.com**. Log in to webmail with the full address (for example `connect@mechbridgegroup.com`) and its password.

## Step 10. Check everything

| Check | How | Expected |
|---|---|---|
| Website | https://mechbridgegroup.com | home page, padlock in the browser |
| www redirect | https://www.mechbridgegroup.com | lands on https://mechbridgegroup.com |
| Staff portal | https://mechbridgegroup.com/admin | your superadmin login works |
| Form → email | submit the contact form on the site | lead appears in the portal, and an alert reaches connect@ in Roundcube |
| Receiving | from Gmail, send to connect@mechbridgegroup.com | arrives in Roundcube |
| Sending and reputation | in Roundcube, send a mail to the address shown on https://www.mail-tester.com | score 9/10 or higher (SPF, DKIM and DMARC all pass) |
| Robots and sitemaps | https://mechbridgegroup.com/robots.txt and /sitemap-index.xml | both load |
| Share card | paste the site URL into https://www.opengraph.xyz or LinkedIn Post Inspector | the photo card with the logo and title |

Mail apps (Outlook, phone): IMAP `mail.mechbridgegroup.com` port **993** SSL; SMTP `mail.mechbridgegroup.com` port **587** STARTTLS (or 465 SSL); username is the full email address.

## Step 11. Tell search engines

1. **Google Search Console** (https://search.google.com/search-console) → Add property → **Domain** → `mechbridgegroup.com`. Google shows a TXT record. Add it in GoDaddy DNS, wait 10 minutes and click Verify.
2. **Sitemaps** → submit `sitemap-index.xml` and `sitemap-images.xml`.
3. **Bing Webmaster Tools** (https://www.bing.com/webmasters) → **Import from Google Search Console** (one click once Google is verified).
4. Optional: create a **Google Business Profile** for the Dubai office once the street address is final.

After two weeks of clean DMARC reports (they arrive at postmaster@ → connect@), change the `_dmarc` TXT value to `v=DMARC1; p=quarantine; rua=mailto:postmaster@mechbridgegroup.com; fo=1`.

## Step 12. Keep it safe

```bash
# Nightly backups of the website data and the mailboxes (02:15)
sudo mkdir -p /var/backups/mechbridge
( sudo crontab -l 2>/dev/null; echo '15 2 * * * DATA_DIR=/var/lib/mechbridge /var/www/mechbridge/deploy/backup.sh && tar -czf /var/backups/mechbridge/mail-$(date +\%F).tar.gz -C /var/mail vhosts && find /var/backups/mechbridge -name "mail-*" -mtime +14 -delete' ) | sudo crontab -
```
Copy `/var/backups/mechbridge/` off the server now and then with WinSCP (or enable OVH's automated backup / snapshot option for the VPS).

```bash
# Block repeated login attempts on SSH, mail and webmail
sudo tee /etc/fail2ban/jail.local > /dev/null <<'EOF'
[sshd]
enabled = true
[postfix]
enabled = true
mode = aggressive
[dovecot]
enabled = true
[roundcube-auth]
enabled = true
logpath = /var/lib/roundcube/logs/errors.log
EOF
sudo systemctl restart fail2ban
```

Recommended: set up an SSH key in PuTTYgen, add it to `~/.ssh/authorized_keys`, confirm you can log in with it, then set `PasswordAuthentication no` in `/etc/ssh/sshd_config` and `sudo systemctl restart ssh`.

## Updating the website later

```bash
cd /var/www/mechbridge
sudo -u mechbridge git pull --recurse-submodules
sudo -u mechbridge npm ci
sudo -u mechbridge npm run build
sudo systemctl restart mechbridge
```
The database upgrades itself on restart.

## Where to look when something's wrong

| Problem | Command |
|---|---|
| Website down | `sudo systemctl status mechbridge` and `sudo journalctl -u mechbridge -n 100` |
| nginx error | `sudo nginx -t` and `sudo tail -n 50 /var/log/nginx/error.log` |
| Mail not arriving or sending | `sudo tail -n 100 /var/log/mail.log` |
| Mail queue | `sudo postqueue -p` (flush with `sudo postqueue -f`) |
| Webmail login fails | `sudo tail -n 50 /var/lib/roundcube/logs/errors.log` and `sudo journalctl -u dovecot -n 50` |
| Certificate | `sudo certbot certificates` |
