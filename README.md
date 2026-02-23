# GitHub Actions Web App PoC

A proof-of-concept demonstrating a complete GitHub Actions CI/CD pipeline for a static web app — covering automated testing, security scanning, deployments, releases, and container publishing.

> For deployment workflows, rollback procedures, and operational details see [OPERATIONS.md](OPERATIONS.md).

---

## Prerequisites

- Node.js 20 or 22
- npm 10+
- GitHub repository with Actions enabled
- GitHub Pages enabled (source: **GitHub Actions**) — for Pages deployment
- Repository Actions permission set to **read/write** — for releases and GHCR

---

## Quick Start

```bash
git clone <your-repo-url>
cd <repo>
npm install
npm run dev        # start local dev server
```

Open `http://localhost:5173` in your browser.

---

## Available Scripts

| Script                   | What it does                                                     |
| ------------------------ | ---------------------------------------------------------------- |
| `npm run dev`            | Start Vite dev server with hot reload                            |
| `npm run build`          | Production build → `dist/`                                       |
| `npm run preview`        | Serve the production build locally                               |
| `npm run build:metadata` | Inject build metadata (commit SHA, run number, env) into the app |
| `npm run lint`           | Run ESLint across all source files                               |
| `npm run format`         | Auto-format all files with Prettier                              |
| `npm run format:check`   | Check formatting without making changes (used in CI)             |
| `npm run test`           | Run tests with Vitest and generate coverage report               |

To do a full local production build:

```bash
npm run build:metadata
npm run build
npm run preview
```

---

## Project Structure

```
├── .github/
│   ├── actions/
│   │   └── setup-node-project/   # Reusable composite action (Node setup + npm install)
│   └── workflows/
│       ├── ci.yml                # Lint, test, build — runs on every push and PR
│       ├── deploy-pages.yml      # Deploy to GitHub Pages — runs on push to main
│       ├── release.yml           # Create GitHub Release + push Docker image to GHCR
│       ├── maintenance.yml       # Weekly dependency health check
│       └── codeql.yml            # Weekly CodeQL security analysis
├── src/
│   ├── index.html                # App entry point
│   ├── main.js                   # Binds build metadata and health status to UI
│   ├── health.js                 # Browser API health check
│   ├── styles.css                # Styles
│   ├── build-info.template.js    # Template with placeholders for CI to fill in
│   └── generated-build-info.js   # Generated at build time — do not edit manually
├── scripts/
│   └── generate-build-metadata.mjs  # Reads env vars, writes generated-build-info.js
├── tests/
│   └── health.test.js            # Unit tests (Vitest)
├── docs/
│   └── diagrams.md               # Architecture and sequence diagrams (Mermaid)
├── Dockerfile                    # nginx container serving dist/
├── OPERATIONS.md                 # Deployment, release, rollback procedures
└── FEATURES.md                   # Annotated breakdown of every GitHub Actions feature used
```

---

## Workflows at a Glance

| Workflow           | Trigger                       | What it does                                                            | Output                        |
| ------------------ | ----------------------------- | ----------------------------------------------------------------------- | ----------------------------- |
| `ci.yml`           | Push, PR, manual              | Lint, format check, test (Node 20 + 22), build, security audit          | Artifacts: `dist`, `coverage` |
| `deploy-pages.yml` | Push to `main`, manual        | Build and deploy to GitHub Pages                                        | Live site update              |
| `release.yml`      | Tag `v*.*.*`, manual          | Build, create GitHub Release with tarball + checksum, push Docker image | GitHub Release, GHCR image    |
| `maintenance.yml`  | Weekly (Mon 8 AM UTC), manual | `npm outdated` + `npm audit` health check                               | Step summary report           |
| `codeql.yml`       | Push/PR to `main`, weekly     | Static security analysis                                                | Security tab findings         |

---

## Key Files

| File                                            | Purpose                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `.github/actions/setup-node-project/action.yml` | Composite action — all workflows use this to set up Node and install deps   |
| `scripts/generate-build-metadata.mjs`           | Injects `COMMIT_SHA`, `RUN_NUMBER`, `DEPLOY_ENV` into the app at build time |
| `src/health.js`                                 | Runtime check that `fetch` and `navigator` are available                    |
| `src/generated-build-info.js`                   | Auto-generated — shows which commit and pipeline produced this build        |

---

## Further Reading

- [OPERATIONS.md](OPERATIONS.md) — how to deploy, create releases, roll back, manage environments
- [FEATURES.md](FEATURES.md) — annotated breakdown of every GitHub Actions feature demonstrated
- [docs/diagrams.md](docs/diagrams.md) — architecture and sequence diagrams
