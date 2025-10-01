import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import simpleGit from 'simple-git';
import { fileURLToPath } from 'url';
import { defaultStyleRules } from './default-style-rules.js';
import { generateCodexPrompt } from './generate-codex-prompt.js';
import { GithubHelper } from './github-helper.js';
import { Logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AILinter {
  constructor(options = {}) {
    Logger.setVerbose(options.verbose || false);

    this.options = {
      rules: options.rules || 'STYLE-GUIDELINES.md',
      prNumber: options.prNumber,
      baseRef: options.baseRef || 'main',
      headRef: options.headRef,
      repoOwner: options.repoOwner || GithubHelper.getGitHubOwner(process.cwd()),
      repoName: options.repoName || GithubHelper.getRepoName(process.cwd()),
      workingDir: process.cwd(),
      verbose: options.verbose || false,
      dryRun: options.dryRun || false,
      model: options.model || 'gpt-5-codex'
    };

    Logger.debug(`Working directory: ${this.options.workingDir}`);
    this.git = simpleGit(this.options.workingDir);

    this.#checkDependencies();

    this.githubHelper = new GithubHelper();
  }

  #checkDependencies() {
    if (!process.env.AI_LINTER_OPENAI_KEY) {
      Logger.error('Please set your OpenAI API key:');
      Logger.info('  export AI_LINTER_OPENAI_KEY="your-api-key-here"');
      process.exit(1);
    }

    if (!process.env.GITHUB_TOKEN && !process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
      Logger.error('Set either GITHUB_TOKEN (for GitHub App) or GITHUB_PERSONAL_ACCESS_TOKEN:');
      Logger.info('  export GITHUB_TOKEN="your-github-app-token"');
      Logger.info('  OR');
      Logger.info('  export GITHUB_PERSONAL_ACCESS_TOKEN="your-personal-access-token"');
      process.exit(1);
    }
  }

  async run() {
    try {
      Logger.info('🤖 - Powered by OpenAI Codex');

      const rulesPath = await this.#findRulesFile();
      const prInfo = await this.#getPRInfo();

      Logger.debug(`Working directory: ${this.options.workingDir}`);
      Logger.debug(`Rules file: ${rulesPath}`);
      Logger.debug(`PR info: ${JSON.stringify(prInfo)}`);

      await this.#authenticateCodex();
      await this.#runCodexReview(rulesPath, prInfo);

    } catch (error) {
      Logger.error(`Error: ${error.message}`);
      Logger.debug(error.stack);
      process.exit(1);
    }
  }

  async #findRulesFile() {
    const spinner = ora(`Looking for rules file: ${this.options.rules}`).start();

    const rulesPath = path.resolve(this.options.workingDir, this.options.rules);

    if (await fs.pathExists(rulesPath)) {
      spinner.succeed(`Found rules file: ${rulesPath}`);
      return rulesPath;
    }

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
    Logger.warning('Searched in:');
    commonPaths.forEach(p => Logger.debug(`  ${p}`));

    Logger.warning('Creating a default STYLE-GUIDELINES.md file...');
    await this.#createDefaultRulesFile();

    const defaultPath = path.join(this.options.workingDir, 'STYLE-GUIDELINES.md');
    return defaultPath;
  }

  async #createDefaultRulesFile() {
    const defaultRules = defaultStyleRules;

    const filePath = path.join(this.options.workingDir, 'STYLE-GUIDELINES.md');
    await fs.writeFile(filePath, defaultRules);
    Logger.success(`Created default rules file: ${filePath}`);
    Logger.warning('Please customize it for your project needs.');
  }

  async #getPRInfo() {
    if (!this.options.prNumber) {
      try {
        const currentBranch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
        Logger.debug(`Current branch: ${currentBranch}`);

        if (process.env.GITHUB_REF && process.env.GITHUB_REF.startsWith('refs/pull/')) {
          this.options.prNumber = process.env.GITHUB_REF.match(/refs\/pull\/(\d+)/)[1];
          this.options.baseRef = process.env.GITHUB_BASE_REF || 'main';
          this.options.headRef = process.env.GITHUB_HEAD_REF || currentBranch;
        }
      } catch (error) {
        Logger.debug(`Could not auto-detect PR info: ${error.message}`);
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

  async #authenticateCodex() {
    const openAiToken = process.env.AI_LINTER_OPENAI_KEY;
    const codexDir = path.join(require('os').homedir(), '.codex');
    const authPath = path.join(codexDir, 'auth.json');

    try {
      await fs.ensureDir(codexDir);
      await fs.writeJson(authPath, {
        OPENAI_API_KEY: openAiToken
      });
      Logger.success('Codex authentication configured');
    } catch (error) {
      Logger.error(`Failed to configure Codex authentication: ${error.message}`);
      throw error;
    }
  }

  async #runCodexReview(rulesPath, prInfo) {
    const spinner = ora('Running Codex AI review...').start();

    try {
      const prompt = generateCodexPrompt(rulesPath, prInfo);

      if (this.options.dryRun) {
        spinner.succeed('Dry run - would execute Codex with prompt:');
        Logger.info('─'.repeat(50));
        Logger.info(prompt);
        Logger.info('─'.repeat(50));
        return;
      }

      const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

      // Create a temporary config file for this run
      const tmpConfigPath = path.join('/tmp', `codex-config-${Date.now()}.toml`);
      const configContent = `experimental_use_rmcp_client = true

[mcp_servers.github]
url = "https://api.githubcopilot.com/mcp/"
bearer_token = "${githubToken}"
`;

      await fs.writeFile(tmpConfigPath, configContent);

      const codexArgs = [
        'exec',
        '--full-auto',
        '--skip-git-repo-check',
        '--model', this.options.model,
        '--config', `config_file="${tmpConfigPath}"`,
        '--',
        prompt
      ];

      Logger.debug(`Running: codex ${codexArgs.join(' ')}`);
      Logger.debug(`Config file: ${tmpConfigPath}`);

      spinner.stop();
      Logger.info('Starting Codex review...');

      return await new Promise((resolve, reject) => {
        const codexProcess = spawn('codex', codexArgs, {
          stdio: 'inherit',
          shell: false
        });

        let wasInterrupted = false;

        const cleanup = async () => {
          wasInterrupted = true;
          if (codexProcess && !codexProcess.killed)
            codexProcess.kill('SIGTERM');

          // Clean up temp config file
          try {
            await fs.remove(tmpConfigPath);
          } catch (err) {
            Logger.debug(`Failed to remove temp config: ${err.message}`);
          }
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        codexProcess.on('close', async (code, signal) => {
          process.removeListener('SIGINT', cleanup);
          process.removeListener('SIGTERM', cleanup);

          // Clean up temp config file
          try {
            await fs.remove(tmpConfigPath);
          } catch (err) {
            Logger.debug(`Failed to remove temp config: ${err.message}`);
          }

          if (wasInterrupted || signal === 'SIGTERM' || signal === 'SIGINT') {
            Logger.warning('Codex review interrupted by user');
            reject(new Error('Process was interrupted'));
          } else if (code === 0) {
            Logger.success('Codex review completed successfully');
            resolve();
          } else {
            Logger.error(`Codex review failed with exit code ${code}`);
            reject(new Error(`Codex exited with code ${code}`));
          }
        });

        codexProcess.on('error', async (error) => {
          process.removeListener('SIGINT', cleanup);
          process.removeListener('SIGTERM', cleanup);

          // Clean up temp config file
          try {
            await fs.remove(tmpConfigPath);
          } catch (err) {
            Logger.debug(`Failed to remove temp config: ${err.message}`);
          }

          Logger.error(`Failed to run Codex: ${error.message}`);
          reject(error);
        });
      });
    } catch (error) {
      Logger.error(`Error running Codex review: ${error.message}`);
      throw error;
    }
  }
}
