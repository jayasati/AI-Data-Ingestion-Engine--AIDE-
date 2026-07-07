# GitHub Actions (Phase 5)

Workflow templates. GitHub only executes workflows from `.github/workflows/`, so copy
`ci.yml` there when the repository is pushed to GitHub:

```bash
mkdir -p .github/workflows
cp infra/github-actions/ci.yml .github/workflows/ci.yml
```
