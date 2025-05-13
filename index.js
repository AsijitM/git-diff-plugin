#!/usr/bin/env node
const simpleGit = require('simple-git');
const axios = require('axios');
const { program } = require('commander');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if it exists
try {
  dotenv.config();
} catch (err) {
  console.log('No .env file found, using environment variables only');
}

console.log("🚀 Starting the script...");

// CI detection
const isCI = process.env.CI === 'true' ||
             process.env.GITHUB_ACTIONS === 'true' ||
             process.env.GITLAB_CI === 'true' ||
             process.env.TRAVIS === 'true' ||
             process.env.CIRCLECI === 'true';

console.log(`🔄 Running in ${isCI ? 'CI environment' : 'local environment'}`);

// GitHub API setup
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.MY_GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER || process.env.GITHUB_REPOSITORY_OWNER || 'AsijitM';
const REPO_NAME = process.env.REPO_NAME || (process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : 'o11y-metadata');
const BRANCH = process.env.BRANCH || process.env.GITHUB_REF_NAME || 'main';
console.log(`🔑 GitHub Token : ${GITHUB_TOKEN ? '***' : 'Not provided'}`);
console.log(`📁 Repository: ${REPO_OWNER}/${REPO_NAME} (${BRANCH})`);

// Files to ignore in git diff
const IGNORED_FILES = [
  '.github/workflows/CD',
  '.gitignore',
  'extract_tags.js',
  'package-lock.json',
  'package.json',
  'sample_test.js'
];

console.log(`🔇 Ignoring files: ${IGNORED_FILES.join(', ')}`);

// Find the correct git repository path
function findGitRoot() {
    if (isCI) {
        // In CI, typically the runner already checks out the repository in the working directory
        const cwd = process.cwd();
        console.log(`🔍 Using CI working directory as git repository: ${cwd}`);
        return cwd;
    }

    // Try to find git in the current directory
    const cwd = process.cwd();
    console.log(`🔍 Checking for git repository in: ${cwd}`);

    // Try a few possible locations
    const possiblePaths = [
        cwd, // Current working directory
        path.resolve(cwd, '..'), // Parent directory
        path.resolve(cwd, '../..'), // Grandparent directory
    ];

    for (const dirPath of possiblePaths) {
        if (fs.existsSync(path.join(dirPath, '.git'))) {
            console.log(`✅ Found git repository at: ${dirPath}`);
            return dirPath;
        }
    }

    // Default to current directory if not found
    console.log(`⚠️ No git repository found, using current directory: ${cwd}`);
    return cwd;
}

const gitRoot = findGitRoot();
const git = simpleGit(gitRoot);

async function getGitDiff() {
    try {
        console.log('Attempting to get git diff...');

        if (isCI) {
            console.log('🔍 Running in CI environment, fetching git diff...');

            // In GitHub Actions, it usually does a shallow clone, so we might need different strategies
            if (process.env.GITHUB_ACTIONS === 'true') {
                // For pull requests
                if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
                    console.log('📋 Pull Request detected, getting PR diff...');
                    const baseSha = process.env.GITHUB_BASE_REF;
                    const headSha = process.env.GITHUB_HEAD_REF;
                    const diff = await git.diff([`origin/${baseSha}`, `origin/${headSha}`]).catch(
                        async (e) => {
                            console.log('⚠️ Failed to get direct PR diff, trying alternate method...');
                            // Try a different approach - get files changed in the PR
                            return await git.diff();
                        }
                    );
                    console.log('🔍 Git Diff obtained (PR - not shown here to reduce console output)');
                    return diff;
                }

                // For push events, try direct diff or last commit diff
                try {
                    console.log('📋 Push event detected, checking available commits...');
                    await git.fetch(['--unshallow']).catch(e => console.log('Repository might already be complete, continuing...'));
                    const diff = await git.diff(['HEAD~1', 'HEAD']);
                    console.log('🔍 Git Diff obtained (push event - not shown here to reduce console output)');
                    return diff;
                } catch (e) {
                    console.log('⚠️ Failed to get standard diff, trying to show last commit changes...');
                    const diff = await git.show(['HEAD']);
                    console.log('🔍 Git Diff obtained (last commit - not shown here to reduce console output)');
                    return diff;
                }
            }
        }

        // Standard approach for local environments or other CI systems
        // First check if we have at least one commit
        const log = await git.log({maxCount: 2}).catch(e => {
            console.log('⚠️ No commit history found:', e.message);
            return { all: [] };
        });

        if (!log.all.length) {
            console.error('❌ No commit history found. Is this a valid git repository with commits?');
            return null;
        } else if (log.all.length === 1) {
            // Only one commit, get the diff of that commit
            console.log('ℹ️ Only one commit found, showing changes in that commit');
            const hash = log.all[0].hash;
            const diff = await git.show([hash]);
            console.log('🔍 Git Diff obtained (first commit - not shown here to reduce console output)');
            return diff;
        } else {
            // More than one commit, get diff between the last two
            console.log('ℹ️ Multiple commits found, showing diff between the last two');
            const diff = await git.diff(['HEAD~1', 'HEAD']);
            console.log('🔍 Git Diff obtained (not shown here to reduce console output)');
            return diff;
        }
    } catch (error) {
        console.error('❌ Error fetching git diff:', error.message);
        console.log('💡 Try running this script from within a git repository with commit history.');
        return null;
    }
}

async function fetchCommitDetails() {
    try {
        if (!GITHUB_TOKEN) {
            console.error('❌ GitHub token not provided. Set the GITHUB_TOKEN environment variable.');
            return null;
        }

        const response = await axios.get(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${BRANCH}`,
            { headers: { Authorization: `Bearer ${GITHUB_TOKEN}` } }
        );
        console.log('📝 Commit Details:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Error fetching commit details:', error.message);
        return null;
    }
}

// CLI interface using commander
program
    .version('1.0.0')
    .option('-d, --diff', 'Fetch Git Diff')
    .option('-c, --commit', 'Fetch Commit Details')
    .option('-v, --verbose', 'Show verbose output including full diff')
    .parse();

const options = program.opts();
console.log('CLI Options:', options);

async function run() {
    try {
        if (options.diff) {
            console.log("➡️ Running: getGitDiff");
            let diffResult = await getGitDiff();

            // Filter out ignored files from the diff
            if (diffResult) {
                // Process the diff to filter out ignored files
                const diffLines = diffResult.split('\n');
                let filteredLines = [];
                let skipSection = false;
                let currentFilePath = null;

                for (let i = 0; i < diffLines.length; i++) {
                    const line = diffLines[i];

                    // Check if this line starts a new file diff
                    if (line.startsWith('diff --git')) {
                        // Extract the filename without "a/" or "b/" prefix
                        const filePathMatch = line.match(/diff --git a\/(.*) b\/(.*)/);
                        if (filePathMatch && filePathMatch.length >= 3) {
                            currentFilePath = filePathMatch[2]; // Use the b/ path as current

                            // Check if this file should be ignored
                            skipSection = IGNORED_FILES.some(ignoredFile => {
                                return currentFilePath === ignoredFile ||
                                       currentFilePath.endsWith(`/${ignoredFile}`) ||
                                       currentFilePath.startsWith(`${ignoredFile}/`);
                            });

                            if (!skipSection) {
                                filteredLines.push(line);
                            } else {
                                console.log(`🔇 Ignoring changes in: ${currentFilePath}`);
                            }
                        } else {
                            // If we can't parse the file path for some reason, include it to be safe
                            filteredLines.push(line);
                            skipSection = false;
                        }
                    } else if (!skipSection) {
                        filteredLines.push(line);
                    }
                }

                // Join the filtered lines back into a string
                diffResult = filteredLines.join('\n');
                console.log('🔍 Filtered diff to exclude ignored files');

                // Show the filtered diff if verbose mode is enabled
                if (options.verbose) {
                    console.log('📋 Filtered Git Diff:\n', diffResult);
                }
            }

            // In CI environments, write the diff to a file for easier consumption by other steps
            if (isCI && diffResult) {
                const outputPath = process.env.GITHUB_WORKSPACE ?
                    path.join(process.env.GITHUB_WORKSPACE, 'git-diff-output.txt') :
                    path.join(process.cwd(), 'git-diff-output.txt');

                fs.writeFileSync(outputPath, diffResult);
                console.log(`✅ Diff output written to ${outputPath}`);

                // Set GitHub output if running in GitHub Actions
                if (process.env.GITHUB_OUTPUT) {
                    fs.appendFileSync(
                        process.env.GITHUB_OUTPUT,
                        `diff_found=${diffResult.length > 0}\n`
                    );
                    fs.appendFileSync(
                        process.env.GITHUB_OUTPUT,
                        `diff_output_path=${outputPath}\n`
                    );
                    console.log('✅ Set GitHub Actions outputs: diff_found, diff_output_path');
                }
            }
        } else if (options.commit) {
            console.log("➡️ Running: fetchCommitDetails");
            const commitResult = await fetchCommitDetails();

            // In CI environments, write the commit details to a file
            if (isCI && commitResult) {
                const outputPath = process.env.GITHUB_WORKSPACE ?
                    path.join(process.env.GITHUB_WORKSPACE, 'commit-details.json') :
                    path.join(process.cwd(), 'commit-details.json');

                fs.writeFileSync(outputPath, JSON.stringify(commitResult, null, 2));
                console.log(`✅ Commit details written to ${outputPath}`);

                // Set GitHub output if running in GitHub Actions
                if (process.env.GITHUB_OUTPUT) {
                    fs.appendFileSync(
                        process.env.GITHUB_OUTPUT,
                        `commit_sha=${commitResult.sha}\n`
                    );
                    fs.appendFileSync(
                        process.env.GITHUB_OUTPUT,
                        `commit_details_path=${outputPath}\n`
                    );
                    console.log('✅ Set GitHub Actions outputs: commit_sha, commit_details_path');
                }
            }
        } else {
            console.log("⚠️ No options provided. Use -d for diff or -c for commit details");
            program.help();
        }
    } catch (error) {
        console.error('❌ Error during execution:', error.message);
        if (isCI) {
            // In CI environments, we might want to explicitly fail the step
            process.exit(1);
        }
    }

    console.log("✅ Script execution completed.");
}

// If this file is being required as a module, export the functions
// otherwise run the CLI
if (require.main === module) {
    run();
} else {
    module.exports = {
        getGitDiff,
        fetchCommitDetails
    };
}
