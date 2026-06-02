#!/usr/bin/env bash
set -euo pipefail

alias_name="${HOSTINGER_OPENCLAW_ALIAS:-navigate-openclaw}"
host_name="${HOSTINGER_OPENCLAW_HOST:-89.117.36.92}"
host_user="${HOSTINGER_OPENCLAW_USER:-codex}"
host_port="${HOSTINGER_OPENCLAW_PORT:-22}"
key_file="${HOME}/.ssh/cloud_hostinger_openclaw_ed25519"
config_file="${HOME}/.ssh/config"

mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"

if [[ -n "${HOSTINGER_OPENCLAW_SSH_KEY_B64:-}" ]]; then
  printf '%s' "${HOSTINGER_OPENCLAW_SSH_KEY_B64}" | tr -d '\r\n ' | base64 -d > "${key_file}"
elif [[ -n "${HOSTINGER_OPENCLAW_SSH_KEY:-}" ]]; then
  printf '%s\n' "${HOSTINGER_OPENCLAW_SSH_KEY}" | sed 's/\r$//' > "${key_file}"
else
  echo "Hostinger SSH secret not set; skipping SSH bootstrap."
  exit 0
fi

chmod 600 "${key_file}"
touch "${HOME}/.ssh/known_hosts"
ssh-keyscan -T 10 -p "${host_port}" "${host_name}" >> "${HOME}/.ssh/known_hosts" 2>/dev/null || true
chmod 600 "${HOME}/.ssh/known_hosts"

if [[ -f "${config_file}" ]]; then
  awk -v target="${alias_name}" '
    /^Host[[:space:]]+/ {
      skip = 0
      for (i = 2; i <= NF; i++) {
        if ($i == target) {
          skip = 1
        }
      }
    }
    !skip { print }
  ' "${config_file}" > "${config_file}.tmp"
else
  : > "${config_file}.tmp"
fi

cat >> "${config_file}.tmp" <<EOF

Host ${alias_name}
    HostName ${host_name}
    User ${host_user}
    Port ${host_port}
    IdentityFile ${key_file}
    IdentitiesOnly yes
    StrictHostKeyChecking accept-new
EOF

mv "${config_file}.tmp" "${config_file}"
chmod 600 "${config_file}"

if [[ "${HOSTINGER_OPENCLAW_TEST:-0}" == "1" ]]; then
  ssh -o BatchMode=yes -o ConnectTimeout=10 "${alias_name}" "whoami && hostname"
fi

echo "Hostinger SSH alias '${alias_name}' configured."
