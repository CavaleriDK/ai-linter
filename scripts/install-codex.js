#!/usr/bin/env node

import { execSync } from 'child_process';

const CODEX_VERSION = '0.42.0';

function checkNpmInstalled() {
  try {
    execSync('npm --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function installCodex() {
  console.log(`Installing @openai/codex@${CODEX_VERSION} globally...`);

  if (!checkNpmInstalled()) {
    console.error('npm is not installed. Please install Node.js and npm first.');
    process.exit(1);
  }

  try {
    execSync(`npm install -g @openai/codex@${CODEX_VERSION}`, {
      stdio: 'inherit'
    });

    console.log('OpenAI Codex installed successfully!');

  } catch (error) {
    console.error('Installation failed:', error.message);
    process.exit(1);
  }
}

installCodex();