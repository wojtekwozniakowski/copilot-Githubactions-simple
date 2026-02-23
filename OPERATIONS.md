# Operations Guide

Deployment procedures, release management, rollback, and workflow internals.

---

## Table of Contents

1. [How the Pipelines Fit Together](#how-the-pipelines-fit-together)
2. [What Happens on Push to main](#what-happens-on-push-to-main)
3. [What Happens on a Pull Request](#what-happens-on-a-pull-request)
4. [Deploying a New Version](#deploying-a-new-version)
5. [Creating a Release](#creating-a-release)
6. [Rolling Back](#rolling-back)
7. [Running Workflows Manually](#running-workflows-manually)
8. [Build Metadata](#build-metadata)
9. [Container Images (GHCR)](#container-images-ghcr)
10. [Secrets and Permissions](#secrets-and-permissions)
11. [Scheduled Workflows](#scheduled-workflows)
12. [Troubleshooting](#troubleshooting)

---

## How the Pipelines Fit Together

```
Developer
  │
  ├─ push to feature branch / open PR
  │       └─► ci.yml          → lint + test + build (Node 20 & 22)
  │                            → dependency review (PRs only)
  │                            → security audit
  │
  ├─ merge PR → push to main
  │       ├─► ci.yml          → same checks as above
  │       └─► deploy-pages.yml → build → deploy to GitHub Pages
  │
  ├─ push tag  v*.*.*
  │       └─► release.yml     → build → GitHub Release (tarball + checksum)
  │                            → Docker image → GHCR
  │
  └─ every Monday 08:00 UTC
          ├─► maintenance.yml  → npm outdated + npm audit report
          └─► codeql.yml       → static security analysis
```

---

## What Happens on Push to main

Two workflows run in parallel when a commit lands on `main`.

### 1. CI (`ci.yml`)

1. **Concurrency guard** — any in-progress CI run for this branch is cancelled immediately so only the latest commit is checked.
2. **Quality job** runs a matrix across Node 20 and Node 22 in parallel:
   - Checkout code
   - Run composite action → set up Node, `npm install`
   - `npm run lint`
   - `npm run format:check`
   - `npm run test` (with coverage)
   - `npm run build:metadata` (injects `COMMIT_SHA`, `RUN_NUMBER`, `DEPLOY_ENV=ci`)
   - `npm run build`
   - Upload `dist/` and `coverage/` artifacts (Node 22 run only)
3. **Security audit job** — waits for `quality`, then runs `npm audit --audit-level=high`. Fails the pipeline if high-severity vulnerabilities exist.
4. **Summarize job** — writes a formatted summary to the GitHub Actions step summary page.

### 2. Pages Deployment (`deploy-pages.yml`)

Runs independently from CI, so a Pages deploy does not wait for CI to pass. If you want Pages to wait for CI, add `needs: [quality]` referencing the CI workflow — but that requires a different workflow structure (reusable workflows).

Steps:

1. **Concurrency guard** — only one Pages deployment runs at a time; the previous one is cancelled.
2. Checkout code
3. `actions/configure-pages` — reads the repo's Pages config and sets `base_path`
4. Composite action → Node 22, `npm install`
5. `npm run build:metadata` (injects `COMMIT_SHA`, `RUN_NUMBER`, `DEPLOY_ENV=production`)
6. `npm run build` — Vite uses the repo name as the base path automatically when running in GitHub Actions
7. `actions/upload-pages-artifact` — packages `dist/`
8. `actions/deploy-pages` — pushes to the `github-pages` environment

After this job completes the live site is updated. The URL is:
`https://<org-or-user>.github.io/<repo-name>/`

---

## What Happens on a Pull Request

`ci.yml` runs with all the same quality checks plus two additional jobs:

- **Dependency review** (`actions/dependency-review-action`) — scans the diff for newly introduced packages with known vulnerabilities. Blocks merge if any are found.
- The **security audit** job still runs as usual.

The deploy workflow does **not** run on PRs — only on push to `main`.

---

## Deploying a New Version

### Option A — Regular update (recommended for most changes)

1. Commit and push your changes to a feature branch.
2. Open a pull request. CI runs automatically.
3. Merge the PR into `main`.
4. `deploy-pages.yml` triggers automatically and updates the live site within ~1-2 minutes.

No manual steps needed. The deployed build will contain the exact commit SHA and run number visible in the app's UI.

### Option B — Manual deploy (force a redeploy without a code change)

1. Go to **Actions → deploy-pages.yml → Run workflow**.
2. Select branch `main`.
3. Click **Run workflow**.

This rebuilds and redeploys from the current state of `main`.

---

## Creating a Release

Releases are for versioned snapshots. Each release produces:

- A GitHub Release page with auto-generated notes
- A downloadable tarball (`webapp-v<tag>.tar.gz`) with SHA256 checksum
- A Docker image pushed to GHCR

### Via Git Tag (recommended)

```bash
git tag v1.2.0
git push origin v1.2.0
```

`release.yml` triggers automatically. The job:

1. Resolves the tag name
2. Runs `build:metadata` with `DEPLOY_ENV=release`
3. Builds the app
4. Creates `webapp-v1.2.0.tar.gz` and `webapp-v1.2.0.tar.gz.sha256`
5. Creates the GitHub Release with auto-generated changelog notes
6. Builds the Docker image and pushes it to GHCR with the tag and `:latest`

The release appears under **Releases** in the GitHub sidebar.

### Via Manual Dispatch

1. Go to **Actions → release.yml → Run workflow**.
2. Enter the tag name (e.g. `v1.2.0`).
3. Check **Publish container image** if you want GHCR publishing.
4. Click **Run workflow**.

Use this if you need to re-run a release without re-pushing the tag, or if you want to publish the container separately.

---

## Rolling Back

### Roll back the live Pages site

GitHub Pages always serves the last successful deployment. To go back to a previous version:

**Option 1 — Revert the commit**

```bash
git revert <bad-commit-sha>
git push origin main
```

This creates a new commit that undoes the change. `deploy-pages.yml` triggers and redeploys the reverted state. This is the safest option because it keeps history intact.

**Option 2 — Re-run a previous workflow**

1. Go to **Actions → deploy-pages.yml**.
2. Find the last known-good run.
3. Click it → **Re-run all jobs**.

This redeploys the exact `dist/` artifact from that run. Only works if the run's artifacts have not expired (default: 90 days).

### Roll back a container image

Images are tagged by version and `:latest`. To pin to a previous version:

```bash
docker pull ghcr.io/<owner>/github-actions-webapp-poc:v1.1.0
```

`:latest` always points to the most recently published tag. If you need to move `:latest` back, re-run `release.yml` manually with the older tag.

### Roll back a GitHub Release

GitHub Releases cannot be un-published automatically by a workflow. To remove or supersede one:

1. Go to **Releases** in the GitHub UI.
2. Edit or delete the release as needed.
3. If the tag itself needs to change:
   ```bash
   git tag -d v1.2.0
   git push origin :refs/tags/v1.2.0
   ```
   Then re-tag and push the correct commit.

---

## Running Workflows Manually

All workflows support `workflow_dispatch` (manual trigger).

| Workflow           | Where to find it                 | Inputs                                        |
| ------------------ | -------------------------------- | --------------------------------------------- |
| `ci.yml`           | Actions → CI Pipeline            | none                                          |
| `deploy-pages.yml` | Actions → Deploy to GitHub Pages | none                                          |
| `release.yml`      | Actions → Release                | `tag` (string), `publish_container` (boolean) |
| `maintenance.yml`  | Actions → Maintenance            | none                                          |
| `codeql.yml`       | Actions → CodeQL                 | none                                          |

To run: **Actions → select workflow → Run workflow → fill inputs → Run workflow**.

---

## Build Metadata

Every build injects four values into the app at build time via `scripts/generate-build-metadata.mjs`:

| Variable      | Source                                     | Example value                                |
| ------------- | ------------------------------------------ | -------------------------------------------- |
| `commitSha`   | `COMMIT_SHA` env var → `GITHUB_SHA`        | `a3f8c21`                                    |
| `runNumber`   | `RUN_NUMBER` env var → `GITHUB_RUN_NUMBER` | `42`                                         |
| `buildTime`   | Current ISO timestamp at build time        | `2025-06-01T10:30:00.000Z`                   |
| `environment` | `DEPLOY_ENV` env var                       | `production`, `ci`, `release`, `development` |

The script reads `src/build-info.template.js`, replaces the placeholders, and writes `src/generated-build-info.js`. This file is then bundled by Vite and displayed in the app's UI, so every live build is traceable back to the exact commit and run.

**Local development** gets `local-dev` / `local` / `development` as defaults.

`src/generated-build-info.js` is committed to the repo as a fallback for local dev but should never be committed with CI-generated values — the workflows always regenerate it fresh.

---

## Container Images (GHCR)

Images are built from the `Dockerfile` at the repo root:

```dockerfile
FROM nginx:1.27-alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
```

The image serves the static `dist/` folder via nginx on port 80.

**Registry:** `ghcr.io/<owner>/github-actions-webapp-poc`

**Tags applied on each release:**

- `:<version>` — e.g. `v1.2.0`
- `:latest`

**Pull and run locally:**

```bash
docker pull ghcr.io/<owner>/github-actions-webapp-poc:latest
docker run -p 8080:80 ghcr.io/<owner>/github-actions-webapp-poc:latest
```

Open `http://localhost:8080`.

**Authentication:** uses `secrets.GITHUB_TOKEN` automatically — no additional secrets needed as long as the repo's Actions permission allows writing to packages.

---

## Secrets and Permissions

No custom secrets are required. The workflows use only built-in GitHub tokens and variables.

| Token / Variable       | Used by                            | Purpose                                     |
| ---------------------- | ---------------------------------- | ------------------------------------------- |
| `secrets.GITHUB_TOKEN` | `release.yml`, `deploy-pages.yml`  | Create releases, push to GHCR, deploy pages |
| `GITHUB_SHA`           | All workflows via `build:metadata` | Inject commit SHA into the build            |
| `GITHUB_RUN_NUMBER`    | All workflows via `build:metadata` | Inject run number into the build            |
| `GITHUB_REPOSITORY`    | `release.yml`                      | Derive GHCR image name                      |

**Required repository settings:**

1. **Settings → Actions → General → Workflow permissions**: set to **Read and write**.
2. **Settings → Pages → Source**: set to **GitHub Actions**.
3. (Optional) **Settings → Environments**: add a `github-pages` environment with protection rules (e.g. required reviewer before deploy).

---

## Scheduled Workflows

### Maintenance (`maintenance.yml`) — every Monday 08:00 UTC

Runs two checks and writes results to the job summary:

- `npm outdated` — lists packages with newer versions available. Does not fail the workflow.
- `npm audit --audit-level=moderate` — reports vulnerabilities. Also does not fail, so it never blocks the main branch.

To act on the findings: update packages locally, test, and push a PR.

### CodeQL (`codeql.yml`) — every Monday 03:30 UTC + push/PR to main

Runs GitHub's static analysis for JavaScript. Results appear in **Security → Code scanning** and are visible only to repo admins and maintainers. Findings are not tied to PR checks by default unless branch protection rules are configured.

---

## Troubleshooting

### Pages deployment is stuck / shows old content

- Check **Actions → deploy-pages.yml** for a failed or cancelled run.
- If a previous run is still in progress, new deploys queue behind it due to the concurrency lock. Wait for it to finish or cancel it manually.
- Hard-refresh the browser (`Ctrl+Shift+R`) — GitHub Pages has CDN caching.

### Release workflow fails on tag push

- Check that the tag matches `v*.*.*` exactly (e.g. `v1.0.0`, not `1.0.0` or `v1.0`).
- Check **Actions → release.yml** for the error. Common causes:
  - Actions write permission not enabled (see [Secrets and Permissions](#secrets-and-permissions)).
  - The tag already has an existing release — delete the release in the UI before re-running.

### Container image fails to push to GHCR

- Confirm **Settings → Actions → General → Workflow permissions** is **Read and write**.
- If the repository is under an organization, check that the org does not have a policy blocking package writes from Actions.

### CI fails on `format:check`

Run locally:

```bash
npm run format
git add -A
git commit -m "fix: apply prettier formatting"
```

### CI fails on `npm audit`

Run locally:

```bash
npm audit
npm audit fix        # safe fixes
npm audit fix --force  # includes breaking upgrades — review carefully
```

Commit the updated `package-lock.json` after fixing.

### Build metadata shows `local-dev`

`build:metadata` was not run before `build`. In CI this happens automatically. Locally:

```bash
npm run build:metadata
npm run build
```
