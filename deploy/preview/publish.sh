#!/bin/sh
# Forced command for the CI preview key (see README). It accepts `publish <slug>` with a tar of the built site on
# stdin, or `delete <slug>`, and only ever touches $SITE_DIR/<slug>. Installed by setup.sh and configured by
# SITE_DIR in the key's authorized_keys entry, so CI cannot change what its own key may run.
set -eu
export PATH=/usr/local/bin:/usr/bin:/bin

: "${SITE_DIR:?set SITE_DIR, the directory Caddy serves, in the forced command}"
max_bytes=$((200 * 1024 * 1024))

set -f
# shellcheck disable=SC2086
set -- ${SSH_ORIGINAL_COMMAND:-}
set +f
action=${1:-}
slug=$(printf '%s' "${2:-}" | grep -xE '[a-z0-9][a-z0-9-]{0,62}') && [ $# -eq 2 ] || {
  echo "expected 'publish <slug>' or 'delete <slug>', got: ${SSH_ORIGINAL_COMMAND:-<none>}" >&2
  exit 2
}

case $action in
  publish)
    incoming=$(mktemp -d "$SITE_DIR/.incoming.XXXXXX")
    outgoing="$SITE_DIR/.outgoing.$$"
    trap 'rm -rf "$incoming" "$outgoing"' EXIT
    head -c "$max_bytes" | tar -x -C "$incoming" --no-same-owner
    find "$incoming" -type l -delete
    chmod -R a+rX "$incoming"
    if [ -d "$SITE_DIR/$slug" ]; then mv "$SITE_DIR/$slug" "$outgoing"; fi
    mv "$incoming" "$SITE_DIR/$slug"
    echo "published $slug"
    ;;
  delete)
    rm -rf "${SITE_DIR:?}/$slug"
    echo "deleted $slug"
    ;;
  *)
    echo "unknown action: $action" >&2
    exit 2
    ;;
esac
