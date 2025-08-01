export function generateCodexPrompt(rulesPath, prInfo) {
  const prompt = `You are an AI code linter reviewing a Pull Request. Your task is to:

**Read the style guidelines** from the file: ${rulesPath}

**Analyze the PR changes**: 
   ${prInfo.prNumber ? `- PR #${prInfo.prNumber}` : ''}
   - Base branch: ${prInfo.baseRef}
   - Head branch: ${prInfo.headRef || 'current branch'}
   - Repository name: ${prInfo.repoName}
   - Repository owner: ${prInfo.repoOwner}

**Review process**:
   - Use git to examine the diff between ${prInfo.baseRef} and ${prInfo.headRef || 'HEAD'}
   - Focus on changed files and lines
   - Compare changes against the style guidelines
   - Consider the broader codebase context. When reading a file from the diff, review also the relevant references from the codebase to determine consistency.
   - Provide feedback continuously through the review process according to **Provide feedback**.

**Provide feedback**:
   - Use the GitHub MCP to post review comments on specific lines where issues are found
   - For each issue, specify:
     * The file and line number
     * Which style rule is violated
     * A clear explanation of the issue
     * Suggested fix if applicable
   - NEVER include emojies in your review comments
   - For small changes, batch all comments into a single API call.
   - For bigger changes, break it down into multiple API calls.
     * Large changes are defined as more than 10 files changed or more than 100 lines changed.
     * Reviews for large changes can be broken down by file or logical sections.
     * ALWAYS start by creating the pull request review without the "event" property when submitting the first batch of comments.
     * Then submit the next batches of review comments individually on the same pull request review.
     * Finally, submit the pull request review by updating the event to REQUEST_CHANGES.
   - Always use "event":"REQUEST_CHANGES" for your review comments if any issues are found.
   - Always use "event":"COMMENT" for your review comments if no issues are found.
    - If you find no issues, post a single comment saying the PR looks good from a style perspective.

**Be constructive**: Focus on helping improve code quality, not just finding problems.

1. Analyze the style guidelines, then assert if the PR is a small or a large change.
2. Analyze the PR changes and report any style violations.
`;

  return prompt;
}
