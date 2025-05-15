# CI/CD Quick Start Guide

This guide shows how to use the Git Diff Analyzer in your CI/CD pipelines.

## GitHub Actions Integration

### Basic Setup

1. Add the package to your project:
```bash
npm install --save-dev ci-cd-git-diff-analyzer
```

2. Create a workflow file at `.github/workflows/ci.yml`:
```yaml
name: CI with Git Diff Analysis

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Important for git history

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'

      - name: Install dependencies
        run: |
          npm ci
          npm install ci-cd-git-diff-analyzer

      - name: Run Git Diff Analyzer
        id: git-diff
        run: npx git-diff-analyzer --diff
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Alternative options:
      # Using full path: node node_modules/ci-cd-git-diff-analyzer/index.js --diff
      # Using shorter alias: npx gda --diff

      # Use the output in subsequent steps
      - name: Conditional testing
        run: |
          if grep -q "src/" git-diff-output.txt; then
            npm test
          else
            echo "No source code changes, skipping tests"
          fi
```

### Making the Most of Git Diff Analyzer

The analyzer provides several benefits:

1. **Faster CI Builds**: Only run tests and builds for components that changed
2. **Targeted Deployments**: Deploy only services that were modified
3. **Change Visibility**: See what files changed in the workflow logs
4. **PR Analysis**: Better understand the scope of pull requests

## Common Patterns

### Selective Testing

Test only what changed:

```yaml
- name: Run Git Diff Analyzer
  id: git-diff
  run: node node_modules/ci-cd-git-diff-analyzer/index.js --diff

- name: Frontend Tests
  if: success()
  run: |
    if grep -q "src/frontend" git-diff-output.txt; then
      npm run test:frontend
    else
      echo "No frontend changes, skipping frontend tests"
    fi

- name: Backend Tests
  if: success()
  run: |
    if grep -q "src/backend" git-diff-output.txt; then
      npm run test:backend
    else
      echo "No backend changes, skipping backend tests"
    fi
```

### Monorepo Support

For monorepos with multiple services:

```yaml
- name: Run Git Diff Analyzer
  id: git-diff
  run: node node_modules/ci-cd-git-diff-analyzer/index.js --diff

- name: Determine changed services
  id: services
  run: |
    if grep -q "services/auth/" git-diff-output.txt; then
      echo "auth_changed=true" >> $GITHUB_OUTPUT
    else
      echo "auth_changed=false" >> $GITHUB_OUTPUT
    fi

    if grep -q "services/api/" git-diff-output.txt; then
      echo "api_changed=true" >> $GITHUB_OUTPUT
    else
      echo "api_changed=false" >> $GITHUB_OUTPUT
    fi

- name: Build Auth Service
  if: steps.services.outputs.auth_changed == 'true'
  run: |
    cd services/auth
    npm ci
    npm run build

- name: Build API Service
  if: steps.services.outputs.api_changed == 'true'
  run: |
    cd services/api
    npm ci
    npm run build
```

## Best Practices

1. **Always use `fetch-depth: 0`** in the checkout step to ensure git history is available
2. **Use output variables** for complex workflows with multiple jobs
3. **Check for specific file patterns** rather than directories for more accuracy
4. **Consider fallbacks** for new repositories or when git history isn't available

## Troubleshooting

If you encounter issues:

1. Make sure you have git history available (use `fetch-depth: 0`)
2. Check that your GitHub token has appropriate permissions
3. Use `if: always()` for critical steps to ensure they run even if earlier steps fail
4. Add debug output to see what the analyzer detected

For more examples, see the workflow files in the `.github/workflows/` directory.
