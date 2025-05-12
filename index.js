const simpleGit = require('simple-git');
const axios = require('axios');
const { program } = require('commander');

// GitHub API setup
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;  // GitHub Token for authentication
const REPO_OWNER = 'AsijitM';
const REPO_NAME = 'git-diff-plugin';
const BRANCH = 'main'; // or any other branch

const git = simpleGit();

// Fetch Git diff between the latest commit and the previous commit
async function getGitDiff() {
    try {
        const diff = await git.diff(['HEAD^', 'HEAD']);
        console.log('Git Diff:\n', diff);
    } catch (error) {
        console.error('Error fetching git diff:', error);
    }
}

// Fetch commit details from GitHub API
async function fetchCommitDetails() {
    try {
        const response = await axios.get(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${BRANCH}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
        });
        console.log('Commit Details:', response.data);
    } catch (error) {
        console.error('Error fetching commit details:', error);
    }
}

// CLI interface using commander
program
    .option('-d, --diff', 'Fetch Git Diff')
    .option('-c, --commit', 'Fetch Commit Details')
    .parse(process.argv);

if (program.diff) {
    getGitDiff();
}

if (program.commit) {
    fetchCommitDetails();
}
