# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

`finch_release` is the **release distribution repository** for the Finch desktop app. It is separate from the source code repository at `../finch`.

| Repository | Purpose |
|------------|---------|
| `../finch` | Source development, builds, daily commits |
| `finch_release` (this repo) | Release artifacts metadata, update configs, release notes |

All data in this repository is **synced from `../finch`** — no source development happens here.

## Common Operations

### Sync release metadata from `../finch`

Before publishing a new version, copy the updated files:

```bash
cp ../finch/release/latest-mac.yml .
cp ../finch/release/builder-effective-config.yaml .
cp ../finch/CHANGELOG.md .
```

Then commit and push:

```bash
git add -A
git commit -m "chore: sync vX.Y.Z release metadata"
git push origin master
```

### Create a GitHub Release with DMG

DMG files (200MB+) are **not committed to git**. They are uploaded as GitHub Release assets:

```bash
cd ../finch
gh release create vX.Y.Z \
  --repo puterjam/finch \
  --title "Finch X.Y.Z" \
  --notes-file CHANGELOG.md \
  release/Finch-X.Y.Z-arm64.dmg \
  release/Finch-X.Y.Z-arm64.dmg.blockmap
```

Extract only the current version section from CHANGELOG for the release notes:

```bash
awk '/^## \[X.Y.Z\]/{start=1} start{print} /^---$/{if(start) exit}' CHANGELOG.md > /tmp/release-notes.md
```

### Verify remote branches

This repository shares the same GitHub remote (`puterjam/finch`) as the source repo, but uses a different branch:

- `master` — this release repo's branch
- `main` — the source code repo's branch (`../finch`)

```bash
# List remote branches
git ls-remote --heads origin
```

## File Reference

| File | Source | Purpose |
|------|--------|---------|
| `latest-mac.yml` | `../finch/release/latest-mac.yml` | Electron auto-updater config. The `url` field must point to the GitHub Release asset download URL |
| `CHANGELOG.md` | `../finch/CHANGELOG.md` | Version changelog, used for release notes |
| `builder-effective-config.yaml` | `../finch/release/builder-effective-config.yaml` | Effective electron-builder configuration for the release |
| `RELEASING.md` | — (local docs) | Detailed release workflow rules |

## Auto-Update Mechanism

The Finch app checks `latest-mac.yml` from GitHub Releases on startup. If a newer version is detected, it prompts the user to download the DMG asset referenced in the `url` field. Therefore, after uploading a new DMG, ensure `latest-mac.yml` is synced with the correct asset URL and hash.