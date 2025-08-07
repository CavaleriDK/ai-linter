#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Logger } from '../bin/src/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GITHUB_MCP_VERSION = 'v0.10.0';
const REPO_URL = 'https://github.com/github/github-mcp-server.git';
const BUILD_DIR = join(__dirname, '..', '.github-mcp-build');
const OUTPUT_DIR = join(__dirname, '..', 'bin', 'github-mcp');
const BINARY_NAME = process.platform === 'win32' ? 'github-mcp-server.exe' : 'github-mcp-server';

function checkGoInstalled() {
  try {
    execSync('go version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function buildGithubMCP() {
  Logger.info('Building GitHub MCP Server...');

  if (!checkGoInstalled()) {
    Logger.error('Go is not installed. Please install Go first: https://golang.org/dl/');
    process.exit(1);
  }

  if (existsSync(BUILD_DIR)) {
    Logger.info('Cleaning previous build...');
    rmSync(BUILD_DIR, { recursive: true, force: true });
  }

  if (!existsSync(OUTPUT_DIR))
    mkdirSync(OUTPUT_DIR, { recursive: true });

  try {
    Logger.info(`Cloning GitHub MCP Server ${GITHUB_MCP_VERSION}...`);
    execSync(`git clone --depth 1 --branch ${GITHUB_MCP_VERSION} ${REPO_URL} "${BUILD_DIR}"`, {
      stdio: 'inherit'
    });

    Logger.info('Building binary...');
    const buildPath = join(BUILD_DIR, 'cmd', 'github-mcp-server');
    const outputPath = join(OUTPUT_DIR, BINARY_NAME);

    execSync(`go build -o "${outputPath}"`, {
      cwd: buildPath,
      stdio: 'inherit'
    });

    if (process.platform !== 'win32')
      execSync(`chmod +x "${outputPath}"`, { stdio: 'inherit' });

    Logger.info('Cleaning up...');
    rmSync(BUILD_DIR, { recursive: true, force: true });

    Logger.info('GitHub MCP Server built successfully!');
    Logger.info(`Binary location: ${outputPath}`);

  } catch (error) {
    Logger.error('Build failed:', error.message);

    if (existsSync(BUILD_DIR))
      rmSync(BUILD_DIR, { recursive: true, force: true });

    process.exit(1);
  }
}

buildGithubMCP();
