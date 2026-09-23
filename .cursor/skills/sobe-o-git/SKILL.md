---
name: sobe-o-git
description: >-
  Bumps the repo version, updates CHANGELOG and README from actual work, then
  commits and pushes to branch portal. Use when the user says sobe-o-git,
  sobe o git, versionamento, changelog, README, commit, push, branch portal,
  or: Ok faz o versionamento, altera o changelog e readme de acordo e faz o
  commit e push para o branch portal.
---

# sobe-o-git

Canonical trigger (verbatim):

Ok faz o versionamento, altera o changelog e readme de acordo e faz o commit e push para o branch portal

Run this workflow in the **current repo**. Do not skip version, changelog, README, commit, or push unless git is unavailable.

```
Task Progress:
- [ ] Inspect repo state
- [ ] Bump version (existing scheme)
- [ ] Update CHANGELOG + README from real work
- [ ] Land work on branch portal
- [ ] Commit (no secrets)
- [ ] Push origin portal
- [ ] Confirm status
```

## Git safety

- NEVER update git config
- NEVER `--force`, hard reset, or skip hooks (`--no-verify`)
- NEVER amend unless this skill’s own commit is HEAD, unpushed, and a hook modified files — prefer a NEW commit
- NEVER `git -i` interactive
- Windows PowerShell: no bash HEREDOC. Commit with `git commit -m "line1" -m "line2"`
- Never commit secrets, `.env`, credentials, or similar files

## 1. Inspect

In parallel:

```
git status
git diff
git log -8 --oneline
git branch -vv
git branch -a
```

Also read `package.json` (and nearby version files), latest git tags, CHANGELOG/CHANGELOG.md, README/README.md. Note language and style (PT-BR if the files are PT).

If there is nothing to version or commit, stop and say so.

## 2. Version

Follow **this repo’s existing scheme**. Do not invent a new one.

Typical sources (use what exists): `package.json` / lockfile if it stores version, git tags (`vX.Y.Z` vs `X.Y.Z`), CHANGELOG headings.

- Patch for fixes/docs; minor for user-facing features; major only if the repo already uses breaking majors
- Sync README if it lists the version
- Do not bump unrelated packages or lockfiles just to bump

## 3. CHANGELOG + README

Document **actual uncommitted / session work only**. Do not invent features.

- CHANGELOG: dated section for this release with user-facing items, matching existing format (Keep a Changelog, Unreleased → version, PT-BR vs EN)
- README: only what already belongs there (version, feature list, usage). Match tone and language
- Skip files that do not exist; do not create a changelog/README unless the repo already expects them

## 4. Branch `portal`

Default remote branch is **`portal`**. User asked for commit **and** push.

- If current branch is `portal`, stay on it
- If current branch is not `portal`, put the work on `portal` (checkout/switch + commit, or merge current work onto `portal`)
- If `portal` does not exist locally or on remotes (`git branch -a`), use the repo’s main integration branch (`main` / `master` / whatever tracks origin) **and say so**
- If `origin/portal` has commits you do not have, pull/rebase first. No force

## 5. Commit

Stage relevant source and docs from this work (version files, CHANGELOG, README, code). Exclude secrets and `.env`.

Commit message: 1–2 sentences **why**, matching `git log` style.

PowerShell:

```
git add <files>
git commit -m "Short why." -m "Optional second sentence."
```

After commit: `git status`. If a hook modified files and this skill’s commit is still HEAD and unpushed, prefer a **new** commit over amend.

## 6. Push

```
git push -u origin portal
```

If you fell back to another integration branch, push that branch instead and tell the user `portal` was missing.

Do not open a PR unless asked.

## Do not

- Invent changelog entries or README features
- Force-push, skip hooks, or rewrite published history
- Change git config
