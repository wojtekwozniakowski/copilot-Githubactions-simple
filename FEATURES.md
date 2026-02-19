# GitHub Actions Features Showcased

This PoC demonstrates a wide range of **GitHub Actions capabilities** you can learn from and use in your own projects.

## Core Workflow Features

### 1. Workflow Triggers

- **On push**: Run CI on every commit to any branch
- **On pull_request**: Run checks before merge to main
- **On workflow_dispatch**: Manual trigger from GitHub UI
- **On schedule (cron)**: Run maintenance tasks weekly
- **On tag push**: Automatic release on version tags
- **Event inputs**: `release.yml` shows manual release with custom parameters

**Files:** `ci.yml`, `deploy-pages.yml`, `release.yml`, `maintenance.yml`, `codeql.yml`

### 2. Matrix Builds

Run the same job with multiple configurations:

```yaml
strategy:
  matrix:
    node-version: [20, 22]
```

**Benefit:** Verify app works on multiple Node.js versions without code duplication

**Files:** `ci.yml` → `quality` job

### 3. Job Dependencies & Concurrency

- **`needs:` clause**: Wait for jobs to complete before starting
- **`concurrency` groups**: Cancel older runs when new commits arrive (useful for PRs)

```yaml
concurrency:
  group: pages
  cancel-in-progress: true
```

**Benefit:** Avoid wasting compute on outdated workflow runs

**Files:** `ci.yml`, `deploy-pages.yml`

### 4. Conditional Execution

- **`if:` conditions**: Run steps/jobs only when conditions are met

Examples:
- Upload artifacts only from **Node 22** (not 20): `if: matrix.node-version == 22`
- Run dependency review **only on PRs**: `if: github.event_name == 'pull_request'`
- Run job **only after success**: `if: always()`

**Files:** `ci.yml`, `release.yml`

### 5. Composite Actions (Reusable Setup)

Instead of repeating Node setup in every workflow, use `.github/actions/setup-node-project`:

```yaml
- name: Setup project
  uses: ./.github/actions/setup-node-project
  with:
    node-version: 22
```

**Benefit:** DRY principle for workflows; single source of truth for setup logic

**Files:** `.github/actions/setup-node-project/action.yml`

## Advanced Features

### 6. Artifacts & Artifact Management

Store build outputs for later use or download:

```yaml
- name: Upload build artifact
  uses: actions/upload-artifact@v4
  with:
    name: web-dist
    path: dist
```

**Use cases:**
- Download build in different jobs (CI → Release)
- Download for manual testing/debugging
- Automatic cleanup after 90 days (configurable)

**Files:** `ci.yml` (uploads dist + coverage), `release.yml` (creates tarball from dist)

### 7. Environment Protection & Approvals

Use GitHub **Environments** with protection rules:

```yaml
deploy:
  environment:
    name: github-pages
    url: ${{ steps.deployment.outputs.page_url }}
```

**Features:**
- **Required reviewers**: Manual approval before deployment
- **Deployment branches**: Only deploy from specific branches
- **Secret masking**: Separate secrets per environment

**Setup:** Settings → Environments → github-pages → Add protection rules

**Files:** `deploy-pages.yml` (has environment defined; user configures approvers)

### 8. Secrets & Variable Interpolation

- **Secrets** (encrypted): `${{ secrets.GITHUB_TOKEN }}`
- **Built-in vars** (unencrypted): `${{ github.sha }}`, `${{ github.ref }}`
- **Env vars**: Pass data between steps

Example:

```yaml
env:
  COMMIT_SHA: ${{ github.sha }}
  RUN_NUMBER: ${{ github.run_number }}
  DEPLOY_ENV: production
```

**Files:** All workflows use this pattern

### 9. Caching Dependencies

Speeds up workflows by caching npm packages:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm  # ← Automatic caching
```

**Benefit:** 10-30s saved per run by skipping npm install

**Files:** `.github/actions/setup-node-project/action.yml`

## Security Features

### 10. Dependency Review

Automatically review new dependencies added in PRs (checks for known vulnerabilities):

```yaml
- name: Dependency review
  uses: actions/dependency-review-action@v4
```

**Benefit:** Catch risky packages before they're merged

**Files:** `ci.yml` → `dependency-review` job

### 11. npm Audit Security Scanning

Check packages for known vulnerabilities:

```bash
npm audit --audit-level=high
```

Fails the job if high+ vulnerabilities found.

**Files:** `ci.yml` → `security-audit` job, `maintenance.yml`

### 12. CodeQL Static Analysis

GitHub's security code analysis engine:

```yaml
- name: Initialize CodeQL
  uses: github/codeql-action/init@v3
  with:
    languages: javascript
```

Finds bugs, vulnerabilities, and code quality issues.

**Files:** `codeql.yml`

### 13. Step Summaries

Write formatted summaries to GitHub UI (visible in Actions tab + job logs):

```bash
{
  echo "## CI Summary"
  echo "- Quality: ${{ needs.quality.result }}"
  echo "- Security audit: ${{ needs.security-audit.result }}"
} >> "$GITHUB_STEP_SUMMARY"
```

**Benefit:** Executives/managers can see results at a glance without diving into logs

**Files:** `ci.yml`, `maintenance.yml`

## Deployment Features

### 14. GitHub Pages Deployment

Publish static site using native GitHub Pages workflow:

```yaml
- name: Deploy to GitHub Pages
  id: deployment
  uses: actions/deploy-pages@v4
```

**Features:**
- Zero configuration (GitHub handles it)
- Environment-based approval gates
- Automatic workflow cancellation for superseded runs

**Files:** `deploy-pages.yml`

### 15. Container Registry Publishing

Build and push Docker images to GHCR:

```yaml
- name: Build and push image
  uses: docker/build-push-action@v6
  with:
    push: true
    tags: ghcr.io/${{ github.repository_owner }}/github-actions-webapp-poc:${{ tag }}
```

**Benefit:** Distribute app as containers; integrate with Kubernetes, cloud platforms

**Files:** `release.yml` → `publish-container` job

### 16. GitHub Releases

Auto-generate releases with notes and artifacts:

```yaml
- name: Create GitHub release
  uses: softprops/action-gh-release@v2
  with:
    generate_release_notes: true
    files: |
      webapp-${{ tag }}.tar.gz
      checksums.txt
```

**Features:**
- Auto-generated changelog from commits
- Attach binaries/archives
- Set as draft or pre-release
- Trigger webhooks

**Files:** `release.yml` → `release-assets` job

## Data Flow & Outputs

### 17. Job Outputs

Share data between jobs:

```yaml
jobs:
  release-assets:
    outputs:
      release_tag: ${{ steps.tag.outputs.release_tag }}

  publish-container:
    needs: release-assets
    run: echo ${{ needs.release-assets.outputs.release_tag }}
```

**Benefit:** Dynamic values computed in one job used in downstream jobs

**Files:** `release.yml`

### 18. Step Outputs

Capture step output and use it later:

```yaml
- name: Resolve release tag
  id: tag
  run: echo "release_tag=v1.0.0" >> "$GITHUB_OUTPUT"

- name: Use tag
  run: echo ${{ steps.tag.outputs.release_tag }}
```

**Files:** `release.yml`

## Scheduled & Maintenance Features

### 19. Scheduled Workflows (Cron)

Run tasks on a schedule (useful for health checks, dependency updates, nightly builds):

```yaml
schedule:
  - cron: '0 8 * * 1'  # Every Monday 8 AM UTC
```

**Files:** `maintenance.yml`, `codeql.yml`

### 20. Manual Workflow Input

Accept user input when manually triggering workflows:

```yaml
workflow_dispatch:
  inputs:
    tag:
      description: 'Release tag (v1.0.0)'
      required: true
    publish_container:
      description: 'Publish container'
      type: boolean
      default: true
```

**Benefit:** Operators control build parameters without editing yaml

**Files:** `release.yml`

## Code Quality & Testing

### 21. Linting & Format Checks

Enforce code style across your team:

```bash
npm run lint     # ESLint
npm run format:check  # Prettier
```

**Benefit:** Consistent code, fewer nitpicky PR reviews

**Files:** `ci.yml`, `package.json`

### 22. Test Coverage & Reporting

Run tests with coverage metrics:

```bash
npm run test  # vitest with coverage
```

**Benefit:** Identify untested code; prevent regressions

**Files:** `ci.yml`, `tests/health.test.js`

## Practical Patterns You Can Copy

### Pattern 1: Build Metadata Injection

Embed deployment info (commit, timestamp, environment) into static site:

```javascript
export const buildInfo = {
  commitSha: process.env.COMMIT_SHA,
  runNumber: process.env.RUN_NUMBER,
  buildTime: process.env.BUILD_TIME,
  environment: process.env.DEPLOY_ENV
};
```

Used in workflows to provide runtime visibility into what version is deployed.

**Files:** `scripts/generate-build-metadata.mjs`, `src/main.js`

### Pattern 2: Conditional Artifact Upload

Only upload artifacts from one matrix configuration (avoids duplicates):

```yaml
- name: Upload artifact
  if: matrix.node-version == 22
  uses: actions/upload-artifact@v4
  with:
    name: web-dist
    path: dist
```

### Pattern 3: Approval Gates for Production

Use environments to require manual approval before production deploys:

```yaml
deploy:
  needs: build
  environment: production  # Requires approval in Settings → Environments
  runs-on: ubuntu-latest
```

### Pattern 4: Tag-Based Release Workflow

Trigger releases automatically on version tags:

```yaml
on:
  push:
    tags:
      - 'v*.*.*'
```

Avoids manual release creation; keeps version in git history.

## Learning Resources

1. **Official Docs**: https://docs.github.com/actions
2. **Workflow Syntax**: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
3. **Actions Marketplace**: https://github.com/marketplace?type=actions
4. **Community Examples**: https://github.com/actions/

## Summary

This PoC showcases **20+ GitHub Actions patterns** covering:

✅ **Triggers** (push, PR, schedule, tags, manual)  
✅ **Parallelization** (matrix, conditional execution)  
✅ **Reusability** (composite actions, secrets, variables)  
✅ **Artifacts** (build outputs, test coverage, releases)  
✅ **Security** (dependency review, npm audit, CodeQL)  
✅ **Testing** (vitest, coverage reporting)  
✅ **Deployment** (GitHub Pages, containers, approvals)  
✅ **Monitoring** (step summaries, scheduled checks)

Use this as a foundation to build your own CI/CD pipelines!
