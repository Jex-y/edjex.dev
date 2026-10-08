#!/bin/sh
# One-time setup, run from a machine on the personal tailnet with `gh` logged in (see README). It installs the
# preview stack and the forced-command publisher on the NAS, then gives this repo's `preview` environment a fresh
# CI key that can only run that publisher.
set -eu

: "${TS_AUTHKEY:?a one-off Tailscale auth key tagged tag:apps, for the edjex-preview sidecar}"
: "${TS_OAUTH_CLIENT_ID:?the id of an OAuth client with the Auth Keys write scope for tag:ci}"
: "${TS_OAUTH_SECRET:?the secret of that OAuth client}"
host=${DEPLOY_HOST:-nas.tail12605.ts.net}
user=${DEPLOY_USER:-ed}
preview_dir=${PREVIEW_DIR:-/volume1/Ed/edjex-preview}
repo=${REPO:-Jex-y/edjex.dev}
here=$(cd "$(dirname "$0")" && pwd)

remote() { ssh "$user@$host" "PATH=/usr/local/bin:\$PATH; $1"; }

remote "mkdir -p '$preview_dir/sites' ~/bin"
for file in compose.yaml serve.json Caddyfile; do
  remote "cat > '$preview_dir/$file'" < "$here/$file"
done
printf 'TS_AUTHKEY=%s\n' "$TS_AUTHKEY" | remote "umask 077 && cat > '$preview_dir/.env'"
remote "cat > ~/bin/edjex-preview-publish && chmod 755 ~/bin/edjex-preview-publish" < "$here/publish.sh"
remote "cd '$preview_dir' && docker compose up -d --wait"

keys=$(mktemp -d)
trap 'rm -rf "$keys"' EXIT
ssh-keygen -q -t ed25519 -N '' -C edjex-preview-ci -f "$keys/ci"
remote_home=$(remote 'printf %s "$HOME"')
printf 'command="SITE_DIR=%s/sites %s/bin/edjex-preview-publish",restrict %s\n' \
  "$preview_dir" "$remote_home" "$(cat "$keys/ci.pub")" |
  remote "sed -i '/ edjex-preview-ci\$/d' ~/.ssh/authorized_keys && cat >> ~/.ssh/authorized_keys"

gh api -X PUT "repos/$repo/environments/preview" > /dev/null
gh secret set DEPLOY_SSH_KEY --repo "$repo" --env preview < "$keys/ci"
gh secret set TS_OAUTH_CLIENT_ID --repo "$repo" --env preview --body "$TS_OAUTH_CLIENT_ID"
gh secret set TS_OAUTH_SECRET --repo "$repo" --env preview --body "$TS_OAUTH_SECRET"
gh variable set DEPLOY_HOST --repo "$repo" --body "$host"
gh variable set DEPLOY_USER --repo "$repo" --body "$user"
gh variable set DEPLOY_KNOWN_HOST --repo "$repo" --body "$(ssh-keyscan -t ed25519 "$host" 2> /dev/null)"

echo "previews will appear under https://edjex-preview.${host#*.}/"
