import path from 'path';
import { execSync } from 'child_process';

export const getGitHubOwner = (repoPath) => {
  const remoteUrl = getRemoteOriginUrl(repoPath);
  if (!remoteUrl)
    throw new Error(`No remote origin URL found for repository at ${repoPath}`);


  const owner = parseOwnerFromUrl(remoteUrl);
  if (!owner)
    throw new Error(`Cannot parse GitHub owner from URL: ${remoteUrl}`);


  return owner;
};

export const getGitHubRepoName = (repoPath) => {
  const remoteUrl = getRemoteOriginUrl(repoPath);
  if (!remoteUrl)
    throw new Error(`No remote origin URL found for repository at ${repoPath}`);


  const repoName = parseRepoNameFromUrl(remoteUrl);
  if (!repoName)
    throw new Error(`Cannot parse GitHub repository name from URL: ${remoteUrl}`);


  return repoName;
};

function getRemoteOriginUrl(repoPath) {
  try {
    const cwd = path.resolve(repoPath);
    const remoteUrl = execSync('git config --get remote.origin.url', {
      cwd,
      encoding: 'utf8'
    }).trim();

    return remoteUrl || null;
  } catch {
    return null;
  }
}

function parseOwnerFromUrl(url) {
  let match;

  if (url.startsWith('git@github.com:')) {
    match = url.match(/git@github\.com:([^\/]+)\//);
    if (match) return match[1];
  }

  if (url.includes('github.com/')) {
    match = url.match(/github\.com\/([^\/]+)\//);
    if (match) return match[1];
  }

  return null;
}

function parseRepoNameFromUrl(url) {
  let match;

  if (url.startsWith('git@github.com:')) {
    match = url.match(/git@github\.com:[^\/]+\/(.+?)(?:\.git)?$/);
    if (match) return match[1];
  }

  if (url.includes('github.com/')) {
    match = url.match(/github\.com\/[^\/]+\/(.+?)(?:\.git)?$/);
    if (match) return match[1];
  }

  return null;
}
