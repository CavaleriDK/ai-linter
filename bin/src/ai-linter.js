import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import simpleGit from 'simple-git';
import { fileURLToPath } from 'url';
import { defaultStyleRules } from './default-style-rules.js';
import { generateCodexPrompt } from './generate-codex-prompt.js';
import { getGitHubOwner, getGitHubRepoName } from './git-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @TODO: Make sure to find the right repository owner!
// PR review comments now fail sometimes :(
export class AILinter {
  constructor(options = {}) {
    this.options = {
      rules: options.rules || 'STYLE-GUIDELINES.md',
      prNumber: options.prNumber,
      baseRef: options.baseRef || 'main',
      headRef: options.headRef,
      repoOwner: options.repoOwner || getGitHubOwner(process.cwd()),
      repoName: options.repoName || getGitHubRepoName(process.cwd()),
      workingDir: process.cwd(),
      verbose: options.verbose || false,
      dryRun: options.dryRun || false,
      model: options.model || 'o4-mini'
    };
    this.log(`Working directory: ${this.options.workingDir}`, 'debug');
    this.git = simpleGit(this.options.workingDir);
  }

  log(message, type = 'info') {
    if (!this.options.verbose && type === 'debug') return;

    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      debug: chalk.gray
    };

    console.log(colors[type](`[AI-Linter] ${message}`));
  }

  checkDependencies() {
    const spinner = ora('Checking dependencies...').start();

    if (!process.env.OPENAI_API_KEY) {
      spinner.fail('OpenAI API key not found');
      this.log('Please set your OpenAI API key:', 'error');
      this.log('  export OPENAI_API_KEY="your-api-key-here"', 'info');
      process.exit(1);
    }

    if (!process.env.GITHUB_TOKEN && !process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
      spinner.fail('GitHub token not found');
      this.log('Set either GITHUB_TOKEN (for GitHub App) or GITHUB_PERSONAL_ACCESS_TOKEN:', 'error');
      this.log('  export GITHUB_TOKEN="your-github-app-token"', 'info');
      this.log('  OR', 'info');
      this.log('  export GITHUB_PERSONAL_ACCESS_TOKEN="your-personal-access-token"', 'info');
      process.exit(1);
    }

    spinner.succeed('Codex Dependencies verified');
  }

  async findRulesFile() {
    const spinner = ora(`Looking for rules file: ${this.options.rules}`).start();

    const rulesPath = path.resolve(this.options.workingDir, this.options.rules);

    if (await fs.pathExists(rulesPath)) {
      spinner.succeed(`Found rules file: ${rulesPath}`);
      return rulesPath;
    }

    // Try common locations
    const commonPaths = [
      path.join(this.options.workingDir, 'docs', this.options.rules),
      path.join(this.options.workingDir, '.github', this.options.rules),
      path.join(this.options.workingDir, 'STYLE-GUIDELINES.md'),
      path.join(this.options.workingDir, 'docs/STYLE-GUIDELINES.md'),
      path.join(this.options.workingDir, '.github/STYLE-GUIDELINES.md')
    ];

    for (const testPath of commonPaths) {
      if (await fs.pathExists(testPath)) {
        spinner.succeed(`Found rules file: ${testPath}`);
        return testPath;
      }
    }

    spinner.fail(`Rules file not found: ${this.options.rules}`);
    this.log('Searched in:', 'warning');
    commonPaths.forEach(p => this.log(`  ${p}`, 'debug'));

    this.log('Creating a default STYLE-GUIDELINES.md file...', 'warning');
    await this.createDefaultRulesFile();

    const defaultPath = path.join(this.options.workingDir, 'STYLE-GUIDELINES.md');
    return defaultPath;
  }

  async createDefaultRulesFile() {
    const defaultRules = defaultStyleRules;

    const filePath = path.join(this.options.workingDir, 'STYLE-GUIDELINES.md');
    await fs.writeFile(filePath, defaultRules);
    this.log(`Created default rules file: ${filePath}`, 'success');
    this.log('Please customize it for your project needs.', 'warning');
  }

  async getPRInfo() {
    if (!this.options.prNumber) {
      try {
        const currentBranch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
        this.log(`Current branch: ${currentBranch}`, 'debug');

        if (process.env.GITHUB_REF && process.env.GITHUB_REF.startsWith('refs/pull/')) {
          this.options.prNumber = process.env.GITHUB_REF.match(/refs\/pull\/(\d+)/)[1];
          this.options.baseRef = process.env.GITHUB_BASE_REF || 'main';
          this.options.headRef = process.env.GITHUB_HEAD_REF || currentBranch;
        }
      } catch (error) {
        this.log(`Could not auto-detect PR info: ${error.message}`, 'debug');
        process.exit(1);
      }
    }

    return {
      prNumber: this.options.prNumber,
      baseRef: this.options.baseRef,
      headRef: this.options.headRef,
      repoOwner: this.options.repoOwner,
      repoName: this.options.repoName
    };
  }

  async runCodexReview(rulesPath, prInfo) {
    const spinner = ora('Running Codex AI review...').start();

    try {
      const prompt = generateCodexPrompt(rulesPath, prInfo);

      if (this.options.dryRun) {
        spinner.succeed('Dry run - would execute Codex with prompt:');
        this.log('─'.repeat(50), 'info');
        this.log(prompt, 'info');
        this.log('─'.repeat(50), 'info');
        return;
      }

      const codexBin = path.resolve(
        path.dirname(path.dirname(__dirname)),
        'node_modules',
        '@openai',
        'codex',
        'bin',
        'codex.js'
      );

      const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      const codexArgs = [
        'exec',
        '--full-auto',
        '--skip-git-repo-check',
        '--model', this.options.model,
        '--config', 'mcp_servers.github.command="npx"',
        '--config', 'mcp_servers.github.args=["-y", "@modelcontextprotocol/server-github"]',
        '--config', `mcp_servers.github.env={GITHUB_PERSONAL_ACCESS_TOKEN="${githubToken}"}`,
        '--',
        prompt
      ];

      this.log(`Running: codex ${codexArgs.join(' ')}`, 'debug');

      // Stop the spinner before spawning the process to avoid output conflicts
      spinner.stop();
      this.log('Starting Codex review...', 'info');

      return await new Promise((resolve, reject) => {
        const codexProcess = spawn(process.execPath, [codexBin, ...codexArgs], {
          stdio: 'inherit',
          shell: false
        });

        let wasInterrupted = false;

        const cleanup = () => {
          wasInterrupted = true;
          if (codexProcess && !codexProcess.killed)
            codexProcess.kill('SIGTERM');
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        codexProcess.on('close', (code, signal) => {
          // Remove signal handlers after process ends
          process.removeListener('SIGINT', cleanup);
          process.removeListener('SIGTERM', cleanup);

          if (wasInterrupted || signal === 'SIGTERM' || signal === 'SIGINT') {
            this.log('Codex review interrupted by user', 'warning');
            reject(new Error('Process was interrupted'));
          } else if (code === 0) {
            this.log('Codex review completed successfully', 'success');
            resolve();
          } else {
            this.log(`Codex review failed with exit code ${code}`, 'error');
            reject(new Error(`Codex exited with code ${code}`));
          }
        });

        codexProcess.on('error', (error) => {
          // Remove signal handlers on error
          process.removeListener('SIGINT', cleanup);
          process.removeListener('SIGTERM', cleanup);

          this.log(`Failed to run Codex: ${error.message}`, 'error');
          reject(error);
        });
      });
    } catch (error) {
      this.log(`Error running Codex review: ${error.message}`, 'error');
      throw error;
    }
  }

  async run() {
    try {
      this.log('🤖 - Powered by OpenAI Codex', 'info');

      await this.checkDependencies();

      const rulesPath = await this.findRulesFile();
      const prInfo = await this.getPRInfo();

      this.log(`Working directory: ${this.options.workingDir}`, 'debug');
      this.log(`Rules file: ${rulesPath}`, 'debug');
      this.log(`PR info: ${JSON.stringify(prInfo)}`, 'debug');

      await this.runCodexReview(rulesPath, prInfo);

    } catch (error) {
      this.log(`Error: ${error.message}`, 'error');
      this.log(error.stack, 'debug');
      process.exit(1);
    }
  }
}
