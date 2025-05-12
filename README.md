# Git Diff Analyzer for CI/CD

A Node.js tool to analyze git diffs and commit details for CI/CD workflows. Specifically designed to work in GitHub Actions and other CI/CD environments.

## Installation

### As a local package

```bash
npm install
```

### As a global package

```bash
npm install -g .
```

### As a dependency in another project

```bash
npm install --save ci-cd-git-diff-analyzer
# OR
npm install --save git+https://github.com/AsijitM/ci-cd-git-diff-analyzer.git
```

## Usage

### Environment Variables

Create a `.env` file in your project root (see `.env.example`):

```
GITHUB_TOKEN=your_github_token_here
REPO_OWNER=YourGithubUsername
REPO_NAME=YourRepoName
BRANCH=main
```

### Command Line Interface

```bash
# Show git diff between last two commits
node index.js --diff
# OR if installed globally
git-diff-analyzer --diff

# Fetch commit details from GitHub
node index.js --commit
# OR if installed globally
git-diff-analyzer --commit
```

### Usage in CI/CD (GitHub Actions)

Add the following to your workflow YAML file:

```yaml
jobs:
  analyze_changes:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Important: fetch all history for accurate diffs

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'

      - name: Install dependencies
        run: npm install ci-cd-git-diff-analyzer

      - name: Analyze Git Diff
        id: git-diff
        run: node node_modules/ci-cd-git-diff-analyzer/index.js --diff
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Example of using the diff output in subsequent steps
      - name: Check Diff Results
        if: success()
        run: |
          echo "Diff found: ${{ steps.git-diff.outputs.diff_found }}"
          echo "Diff output saved to: ${{ steps.git-diff.outputs.diff_output_path }}"
          
          # Example: only run certain steps if changes to specific files
          if grep -q "src/api" git-diff-output.txt; then
            echo "API changes detected"
            # Run API-specific CI steps
          fi
```

The tool automatically:
1. Detects it's running in CI environment
2. Handles GitHub's shallow clone correctly
3. Works with both PR and Push events
4. Exports outputs that can be used in subsequent workflow steps
5. Creates output files with detailed diff information

## Advanced CI/CD Usage Examples

### Conditional Building and Testing

This example shows how to use the analyzer to run specific build and test steps only when relevant files have changed:

```yaml
name: CI/CD with Selective Testing

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  analyze_and_test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
          
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
        run: node node_modules/ci-cd-git-diff-analyzer/index.js --diff
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          
      # Conditional frontend testing
      - name: Frontend Tests
        if: success()
        run: |
          if grep -q "src/frontend\|src/components\|src/pages" git-diff-output.txt; then
            echo "Frontend changes detected, running frontend tests"
            npm run test:frontend
          else
            echo "No frontend changes detected, skipping frontend tests"
          fi
          
      # Conditional backend testing
      - name: Backend Tests
        if: success()
        run: |
          if grep -q "src/backend\|src/api\|src/models" git-diff-output.txt; then
            echo "Backend changes detected, running backend tests"
            npm run test:backend
          else
            echo "No backend changes detected, skipping backend tests"
          fi
```

### Commit Analysis and Deployment

This example shows how to use commit details to make deployment decisions:

```yaml
name: CI/CD with Commit Analysis

on:
  push:
    branches: [ main ]

jobs:
  analyze_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
          
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'
          
      - name: Install dependencies
        run: npm install ci-cd-git-diff-analyzer
          
      - name: Analyze Commit Details
        id: commit-details
        run: node node_modules/ci-cd-git-diff-analyzer/index.js --commit
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          
      # Deploy based on commit message
      - name: Conditional Deployment
        if: success()
        run: |
          COMMIT_MSG=$(cat commit-details.json | jq -r '.commit.message')
          
          if [[ "$COMMIT_MSG" == *"[deploy]"* ]]; then
            echo "Deployment trigger found in commit message!"
            # Deployment commands here
          elif [[ "$COMMIT_MSG" == *"[minor]"* ]]; then
            echo "Minor change detected, skipping deployment"
          else
            echo "Standard commit, running normal CI process"
          fi
```

For more examples, see the `complete-ci-workflow-example.yml` file in this repository.

### Usage in Another Project

```javascript
const { getGitDiff, fetchCommitDetails } = require('ci-cd-git-diff-analyzer');

async function run() {
  // Get git diff between last two commits
  const diff = await getGitDiff();
  
  if (diff && diff.includes('package.json')) {
    console.log('Dependencies may have changed!');
    // Run npm install
  }

  // Fetch commit details from GitHub
  const commitDetails = await fetchCommitDetails();
  
  if (commitDetails && commitDetails.commit.message.includes('[important]')) {
    console.log('Important commit detected!');
    // Take special actions
  }
}

run();
```

## Features

- Fetches git diff between the last two commits
- Handles edge cases like repositories with only one commit
- Automatically finds the git repository in the project
- Fetches commit details from GitHub API
- Configurable via environment variables
- Special handling for CI environments (GitHub Actions, GitLab CI, etc.)
- Output files for easy consumption by other CI/CD steps
- GitHub Actions output variables for workflow integration

## Troubleshooting

### Error: "fatal: ambiguous argument 'HEAD~1'"

This error occurs when:
- The repository has no commits
- The script is not running in a git repository
- You're using it as a package in another project

The script will now attempt to find the git repository automatically and handle these cases gracefully.

### Error: "Request failed with status code 401" when fetching commit details

This error occurs when the GitHub token is invalid or missing. Make sure to set the `GITHUB_TOKEN` environment variable in your `.env` file or in your CI/CD environment.

### GitHub Actions: "The `set-output` command is deprecated"

If you see this warning in GitHub Actions, it's because GitHub has updated how outputs are set. The tool has been updated to use the new method via `GITHUB_OUTPUT` environment file.
