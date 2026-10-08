# Branch previews on the tailnet

Every push to a branch other than `main` builds the site with `PREVIEW_BASE=/<branch-slug>/` and publishes it to
`https://edjex-preview.<tailnet>.ts.net/<branch-slug>/`. The root lists the branches that have a preview. Nothing is
reachable from outside the tailnet.

CI joins the tailnet as an ephemeral `tag:ci` node and SSHes to the NAS with a key that can only run
[`publish.sh`](publish.sh), piping it a tar of `dist/`. A small Compose project on the NAS, a Tailscale sidecar
named `edjex-preview` plus Caddy, serves the result. Deleting a branch removes its preview once
`.github/workflows/preview.yml` is on `main`, because GitHub only runs `delete` workflows from the default branch.

## One-time setup

**Tailscale**, in the admin console. The policy already has what this needs from the `tailnet-apps` setup:
`tag:ci` and `tag:apps` owned by `autogroup:admin`, and `tag:ci` allowed to reach the NAS on port 22.

- An OAuth client with the Auth Keys write scope for `tag:ci`. Make a new one rather than sharing `tailnet-apps`'s,
  since this repo is public and its client should be revocable on its own.
- A one-off auth key for the sidecar: not reusable, not ephemeral, pre-approved, tagged `tag:apps`.

**Then**, from a machine on the tailnet with `gh` logged in:

```sh
TS_AUTHKEY=tskey-auth-… TS_OAUTH_CLIENT_ID=… TS_OAUTH_SECRET=tskey-client-… deploy/preview/setup.sh
```

It copies the stack to `/volume1/Ed/edjex-preview` on the NAS and starts it, installs `publish.sh` as
`~/bin/edjex-preview-publish`, authorises a new CI key to run only that, and fills in the repo's `preview`
environment (`DEPLOY_SSH_KEY`, `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`) and variables (`DEPLOY_HOST`, `DEPLOY_USER`,
`DEPLOY_KNOWN_HOST`). CI skips the preview until `DEPLOY_HOST` is set.
