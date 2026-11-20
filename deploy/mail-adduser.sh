#!/usr/bin/env bash
# Add a mailbox (or reset its password) on the Postfix + Dovecot setup in GO-LIVE.md.
#   sudo bash deploy/mail-adduser.sh connect@mechbridgegroup.com
# Prompts for the password. Mailboxes live in /var/mail/vhosts/<domain>/<user>/Maildir.
set -euo pipefail
ADDR="${1:-}"
if [[ ! "$ADDR" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
  echo "Usage: sudo bash $0 user@mechbridgegroup.com" >&2; exit 1
fi
[[ $EUID -eq 0 ]] || { echo "Run with sudo." >&2; exit 1; }

USERS=/etc/dovecot/users
VMBOX=/etc/postfix/vmailbox
DOMAIN="${ADDR#*@}"; LOCAL="${ADDR%@*}"

read -rsp "Password for $ADDR (min 12 characters): " P1; echo
read -rsp "Repeat it: " P2; echo
[[ "$P1" == "$P2" ]] || { echo "Passwords don't match." >&2; exit 1; }
(( ${#P1} >= 12 )) || { echo "Use at least 12 characters." >&2; exit 1; }

HASH="$(doveadm pw -s SHA512-CRYPT -p "$P1")"
touch "$USERS" "$VMBOX"
# Replace an existing entry or append a new one.
grep -v "^${ADDR}:" "$USERS" > "$USERS.tmp" || true
echo "${ADDR}:${HASH}" >> "$USERS.tmp"
mv "$USERS.tmp" "$USERS"
chown root:dovecot "$USERS"; chmod 640 "$USERS"

grep -q "^${ADDR} " "$VMBOX" || echo "${ADDR} ${DOMAIN}/${LOCAL}/Maildir/" >> "$VMBOX"

mkdir -p "/var/mail/vhosts/${DOMAIN}/${LOCAL}"
chown -R vmail:vmail "/var/mail/vhosts/${DOMAIN}"

systemctl reload postfix dovecot
echo "Mailbox ready: $ADDR  (log in at https://mail.${DOMAIN})"
