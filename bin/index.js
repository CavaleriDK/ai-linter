#!/usr/bin/env node

import { Command } from 'commander';
import { AILinter } from './src/ai-linter.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('ai-linter')
  .description('AI-powered code linter using OpenAI Codex CLI')
  .version(packageJson.version);

// Default command is review
program
  .description('Review code changes against style guidelines')
  .option('-r, --rules <file>', 'Path to style guidelines file', 'STYLE-GUIDELINES.md')
  .option('-p, --pr <number>', 'Pull Request number to review')
  .option('-b, --base <ref>', 'Base branch for comparison', 'main')
  .option('-h, --head <ref>', 'Head branch for comparison')
  .option('-m, --model <name>', 'OpenAI model to use', 'o4-mini')
  .option('-o, --repo-owner <owner>', 'GitHub repository owner')
  .option('-n, --repo-name <name>', 'GitHub repository name')
  .option('--dry-run', 'Show what would be done without executing')
  .option('-v, --verbose', 'Verbose logging')
  .action(async (options) => {
    const linter = new AILinter({
      rules: options.rules,
      prNumber: options.pr,
      baseRef: options.base,
      headRef: options.head,
      model: options.model,
      repoOwner: options.repoOwner,
      repoName: options.repoName,
      dryRun: options.dryRun,
      verbose: options.verbose
    });

    await linter.run();
  });

program.parse();
