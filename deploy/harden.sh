#!/usr/bin/env bash
# Server bootstrap + hardening for the ДомойСкорей host (Ubuntu/Debian).
# Run as root on 5.42.108.44:  sudo bash harden.sh
#
# Installs Docker, configures a deny-by-default firewall (only 22/80/443),
# fail2ban for SSH, and unattended security upgrades.
#
# IMPORTANT: make sure you can log in over SSH with a key BEFORE running this,
# and review SSH_PORT below. This does not itself disable password login —
# see the commented hardening block at the end.
set -euo pipefail

SSH_PORT="${SSH_PORT:-22}"

echo "==> Updating base system"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades

echo "==> Installing Docker Engine + compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "==> Firewall (ufw): deny incoming, allow 22/80/443 only"
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}"/tcp        # SSH
ufw limit "${SSH_PORT}"/tcp        # rate-limit brute force on SSH
ufw allow 80/tcp                   # HTTP (Caddy -> ACME + redirect to 443)
ufw allow 443/tcp                  # HTTPS
ufw --force enable
ufw status verbose

# NOTE ON DOCKER + UFW: Docker writes its own iptables rules and bypasses ufw for
# *published* ports. This stack only publishes 80/443 (via the caddy service);
# db/minio/api are never published, so they remain unreachable from outside
# regardless. Do not add `ports:` mappings for those services.

echo "==> fail2ban: SSH jail"
cat > /etc/fail2ban/jail.d/sshd.local <<EOF
[sshd]
enabled  = true
port     = ${SSH_PORT}
maxretry = 4
findtime = 10m
bantime  = 1h
backend  = systemd
EOF

# Optional: ban IPs hammering the API auth endpoint, parsed from Caddy's JSON log.
# The Caddy access log lives in the caddy_logs volume; expose it to the host if
# you want this jail (see README). Filter provided in deploy/fail2ban/.
cat > /etc/fail2ban/filter.d/caddy-auth.conf <<'EOF'
[Definition]
failregex = ^.*"client_ip":"<HOST>".*"uri":"/api/auth.*"status":(401|403|429).*$
ignoreregex =
EOF

systemctl enable --now fail2ban
systemctl restart fail2ban
fail2ban-client status sshd || true

echo "==> Unattended security upgrades"
dpkg-reconfigure -f noninteractive unattended-upgrades || true
systemctl enable --now unattended-upgrades || true

cat <<'NEXT'

==> Base hardening done.

Recommended manual SSH hardening (only after confirming key-based login works):
  # /etc/ssh/sshd_config
  PermitRootLogin prohibit-password
  PasswordAuthentication no
  then: systemctl restart ssh

Next:
  1) Put the app on the host (git clone / scp) and cd into deploy/
  2) cp .env.example .env  &&  edit it  (openssl rand -hex 32 for secrets)
  3) Point DNS:  A  <DOMAIN>      -> 5.42.108.44
                 A  cdn.<DOMAIN>  -> 5.42.108.44
  4) docker compose --env-file .env up -d --build
  5) ./validate.sh
NEXT
