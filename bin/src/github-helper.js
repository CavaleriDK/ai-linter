import path from 'path';
import { execSync } from 'child_process';
import { Octokit } from 'octokit';
import { Logger } from './logger.js';

export class GithubHelper {
  #currentIdentity = null;

  constructor() {
    const githubToken = process.env.GITHUB_TOKEN;
    this.octokit = new Octokit({
      auth: githubToken
    });
  }

  async removeAllPendingReviewsFromTool(repoOwner, repoName, prNumber) {
    const pendingReviews = await this.#getPendingReviewsFromTool(repoOwner, repoName, prNumber);

    if (pendingReviews.length === 0) {
      Logger.debug('No pending reviews to clean up');
      return;
    }

    Logger.info(`Cleaning up ${pendingReviews.length} pending review(s)...`);

    const results = await Promise.allSettled(
      pendingReviews.map(review =>
        this.#deletePendingReview(repoOwner, repoName, prNumber, review.id)
      )
    );

    const successful = results.filter(result =>
      result.status === 'fulfilled' && result.value
    ).length;

    Logger.info(`Successfully cleaned up ${successful}/${pendingReviews.length} pending review(s)`);
  }

  async #getPendingReviewsFromTool(repoOwner, repoName, prNumber) {
    const [reviewsResponse, currentIdentity] = await Promise.all([
      this.octokit.rest.pulls.listReviews({
        owner: repoOwner,
        repo: repoName,
        pull_number: prNumber
      }),
      this.#getCurrentIdentity(repoOwner, repoName)
    ]);

    const pendingReviews = this.#filterReviewsByIdentity(reviewsResponse.data, currentIdentity);

    Logger.debug(`Found ${pendingReviews.length} pending review(s) by ${currentIdentity.login}`);
    return pendingReviews;
  }

  async #getCurrentIdentity(owner, repo) {
    if (this.#currentIdentity)
      return this.#currentIdentity;

    const identity = await this.#tryGetUserIdentity() ||
      await this.#tryGetAppIdentity() ||
      await this.#tryGetBotIdentity(owner, repo);

    if (!identity)
      throw new Error('Unable to determine authentication identity');

    this.#currentIdentity = identity;
    return this.#currentIdentity;
  }

  async #tryGetUserIdentity() {
    try {
      const { data: user } = await this.octokit.rest.users.getAuthenticated();
      return { type: 'user', ...user };
    } catch {
      return null;
    }
  }

  async #tryGetAppIdentity() {
    try {
      const { data: app } = await this.octokit.rest.apps.getAuthenticated();
      return { type: 'app', id: app.id, login: app.slug, name: app.name };
    } catch {
      return null;
    }
  }

  async #tryGetBotIdentity(owner, repo) {
    try {
      console.log(`tryGetBotIdentity: Getting installation ID for owner=${owner}, repo=${repo}`);
      const installationId = await this.#getInstallationId(owner, repo);
      console.log(`tryGetBotIdentity: Installation ID: ${installationId}`);
      if (!installationId) return null;

      const { data: installation } = await this.octokit.rest.apps.getInstallation({
        installation_id: installationId
      });
      console.log(`tryGetBotIdentity: Installation data:`, JSON.stringify(installation, null, 2));

      const app = installation.app;
      
      const botLogin = `${app.slug}[bot]`;
      console.log(`tryGetBotIdentity: Bot login: ${botLogin}`);
      
      try {
        const { data: botUser } = await this.octokit.rest.users.getByUsername({
          username: botLogin
        });
        console.log(`tryGetBotIdentity: Found bot user:`, JSON.stringify(botUser, null, 2));
        
        return {
          type: 'bot',
          id: botUser.id,
          login: botUser.login,
          name: botUser.name || app.name
        };
      } catch (userError) {
        console.log(`tryGetBotIdentity: Could not fetch bot user, using fallback. Error:`, userError.message);
        return {
          type: 'bot',
          id: app.id,
          login: botLogin,
          name: app.name
        };
      }

    } catch (error) {
      console.log(`tryGetBotIdentity: Error getting bot identity:`, error.message);
      Logger.error('Error getting bot identity:', error.message);
      return null;
    }
  }

  async #getInstallationId(owner, repo) {
    try {
      console.log(`getInstallationId: Starting with owner=${owner}, repo=${repo}`);
      
      if (owner && repo) {
        console.log(`getInstallationId: Trying method 1 - getRepoInstallation`);
        try {
          const { data: installation } = await this.octokit.rest.apps.getRepoInstallation({
            owner: owner,
            repo: repo
          });
          console.log(`getInstallationId: Method 1 successful, installation ID: ${installation.id}`);
          return installation.id;
        } catch (repoError) {
          console.log(`getInstallationId: Method 1 failed:`, repoError.message);
        }
      }

      console.log(`getInstallationId: Trying method 2 - listReposAccessibleToInstallation`);
      const { data } = await this.octokit.rest.apps.listReposAccessibleToInstallation({ per_page: 1 });
      console.log(`getInstallationId: Method 2 response:`, JSON.stringify(data, null, 2));
      if (data.repositories && data.repositories.length > 0) {
        console.log(`getInstallationId: Method 2 successful, installation ID: ${data.installation_id}`);
        return data.installation_id;
      }

      console.log(`getInstallationId: Trying method 3 - parse from auth header`);
      const authHeader = this.octokit.request.defaults.headers.authorization;
      console.log(`getInstallationId: Auth header: ${authHeader}`);
      if (authHeader && authHeader.includes('installation')) {
        const match = authHeader.match(/installation\/(\d+)/);
        if (match) {
          const id = parseInt(match[1]);
          console.log(`getInstallationId: Method 3 successful, installation ID: ${id}`);
          return id;
        }
      }

      console.log(`getInstallationId: All methods failed, returning null`);
    } catch (error) {
      console.log(`getInstallationId: Unexpected error:`, error.message);
      Logger.error('Error getting installation ID:', error.message);
      return null;
    }
    return null;
  }

  #filterReviewsByIdentity(reviews, currentIdentity) {
    const pendingReviews = reviews.filter(review => review.state === 'PENDING');

    if (currentIdentity.type === 'app') {
      return pendingReviews.filter(review =>
        review.user.id === currentIdentity.id ||
        review.user.login === currentIdentity.login ||
        review.user.type === 'Bot'
      );
    }

    if (currentIdentity.type === 'bot') {
      return pendingReviews.filter(review =>
        review.user.login === currentIdentity.login ||
        (review.user.type === 'Bot' && review.user.login.includes(currentIdentity.name))
      );
    }

    return pendingReviews.filter(review => review.user.id === currentIdentity.id);
  }

  async #deletePendingReview(repoOwner, repoName, prNumber, reviewId) {
    try {
      await this.octokit.rest.pulls.deletePendingReview({
        owner: repoOwner,
        repo: repoName,
        pull_number: prNumber,
        review_id: reviewId
      });

      Logger.debug(`Deleted pending review ${reviewId}`);
      return true;
    } catch (err) {
      Logger.error(`Failed to delete review ${reviewId}: ${err.message}`);
      return false;
    }
  }

  async canUseRequestChanges(repoOwner, repoName, prNumber) {
    if (!repoOwner || !repoName || !prNumber)
      return false;

    try {
      const [pr, currentIdentity] = await Promise.all([
        this.octokit.rest.pulls.get({
          owner: repoOwner,
          repo: repoName,
          pull_number: prNumber
        }),
        this.#getCurrentIdentity(repoOwner, repoName)
      ]);

      const prAuthor = pr.data.user;

      if (currentIdentity.type === 'app')
        return this.#canAppRequestChanges(repoOwner, repoName, prAuthor);

      return prAuthor.id !== currentIdentity.id;
    } catch (err) {
      Logger.error(`Error checking PR permissions: ${err.message}`);
      return false;
    }
  }

  async #canAppRequestChanges(repoOwner, repoName, prAuthor) {
    try {
      const installation = await this.octokit.rest.apps.getRepoInstallation({
        owner: repoOwner,
        repo: repoName
      });

      const installingAccount = installation.data.account;

      if (installingAccount.type === 'Organization')
        return true;

      if (installingAccount.type === 'User')
        return prAuthor.id !== installingAccount.id;

      return false;
    } catch (installationError) {
      Logger.warning(`Could not determine app installation context: ${installationError.message}`);
      return false;
    }
  }

  static getGitHubOwner(repoPath) {
    const remoteUrl = this.#getRemoteOriginUrl(repoPath);
    if (!remoteUrl)
      throw new Error(`No remote origin URL found for repository at ${repoPath}`);

    const owner = this.#parseOwnerFromUrl(remoteUrl);
    if (!owner)
      throw new Error(`Cannot parse GitHub owner from URL: ${remoteUrl}`);

    return owner;
  }

  static #parseOwnerFromUrl(url) {
    let match;

    if (url.startsWith('git@github.com:')) {
      match = url.match(/git@github\.com:([^\/]+)\//);
      if (match)
        return match[1];
    }

    if (url.includes('github.com/')) {
      match = url.match(/github\.com\/([^\/]+)\//);
      if (match)
        return match[1];
    }

    return null;
  }

  static #getRemoteOriginUrl(repoPath) {
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

  static getRepoName(repoPath) {
    const remoteUrl = this.#getRemoteOriginUrl(repoPath);
    if (!remoteUrl)
      throw new Error(`No remote origin URL found for repository at ${repoPath}`);

    const repoName = this.#parseRepoNameFromUrl(remoteUrl);
    if (!repoName)
      throw new Error(`Cannot parse GitHub repository name from URL: ${remoteUrl}`);

    return repoName;
  }

  static #parseRepoNameFromUrl(url) {
    let match;

    if (url.startsWith('git@github.com:')) {
      match = url.match(/git@github\.com:[^\/]+\/(.+?)(?:\.git)?$/);
      if (match)
        return match[1];
    }

    if (url.includes('github.com/')) {
      match = url.match(/github\.com\/[^\/]+\/(.+?)(?:\.git)?$/);
      if (match)
        return match[1];
    }

    return null;
  }
}
