const simpleGit = require('simple-git');
const axios = require('axios');
const { program } = require('commander');
const dotenv = require('dotenv');
dotenv.config();
console.log("🚀 Starting the script...");

// GitHub API setup
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'AsijitM';
const REPO_NAME = 'o11y-metadata';
const BRANCH = 'main';
console.log(`🔑 GitHub Token : ${GITHUB_TOKEN}`);

const git = simpleGit();

async function getGitDiff() {
    try {
        console.log('Attempting to get git diff...');
        const diff = await git.diff(['HEAD~1', 'HEAD']);
        console.log('🔍 Git Diff:\n', diff);
        return diff;
    } catch (error) {
        console.error('❌ Error fetching git diff:', error.message);
        return null;
    }
}

async function fetchCommitDetails() {
    try {
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
    .parse();

const options = program.opts();
console.log('CLI Options:', options);

async function run() {
    if (options.diff) {
        console.log("➡️ Running: getGitDiff");
        await getGitDiff();
    } else if (options.commit) {
        console.log("➡️ Running: fetchCommitDetails");
        await fetchCommitDetails();
    } else {
        console.log("⚠️ No options provided. Use -d for diff or -c for commit details");
        program.help();
    }

    console.log("✅ Script execution completed.");
}

run();
