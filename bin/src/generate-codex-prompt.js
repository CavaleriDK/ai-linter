export function generateCodexPrompt(rulesPath, prInfo) {
  const prompt = `You are an AI code linter reviewing a Pull Request. 

Now, perform the following tasks in order:
  1. Create a new pending PR review with the Github MCP tool "create_pending_pull_request_review" or use your existing pending review if it exists.
  2. Analyze the style guidelines, then assert if the PR is a small or a large change.
  3. Analyze the PR changes and add each style violation using the Github MCP tool "add_comment_to_pending_review". Add each violation when you find it, do not wait until the end.
  4. Submit the PR review using the Github MCP tool "submit_pending_pull_request_review" by setting the event to "REQUEST_CHANGES" if any issues are found, or "COMMENT" if no issues are found. If you cannot use the "REQUEST_CHANGES" event, use the "COMMENT" event instead.

Your tasks includes the following rules:

**Read the style guidelines** from the file: ${rulesPath}

**Analyze the PR changes**: 
  - PR #${prInfo.prNumber}
  - Base branch: ${prInfo.baseRef}
  - Head branch: ${prInfo.headRef || 'current branch'}
  - Repository name: ${prInfo.repoName}
  - Repository owner: ${prInfo.repoOwner}

**Review process**:
  - Use git to examine the diff between ${prInfo.baseRef} and ${prInfo.headRef || 'HEAD'}
  - Focus on changed files and lines
  - Consider the broader codebase context. 
    - When reading a file from the diff, review also the full file and the relevant references from the codebase to determine how the change affects the related files.
  - Compare changes against the style guidelines
    - If a change causes a violation outside the diff lines, report it as well on the changed lines but with a reference to the impacted line number(s) and file(s). 
      - For example, if a change in one file changes the behavior of a function and the function name is no longer descriptive, report it in the changed lines but mention where the function is defined and what the new name should be.

**Provide feedback**:
  - Use the GitHub MCP to post review comments on specific lines where issues are found
  - For each issue, specify:
    - The file and line number
    - Which style rule is violated
    - A clear explanation of the issue
    - Suggested fix if applicable
  - NEVER include emojies in your review comments
  - If you find no issues, update the body of the PR review saying the PR looks good from a style perspective.
  - For each issue found, post an individual comment to the existing PR review including:
    - The file and line number
    - Which style rule is violated
    - A clear explanation of the issue
    - Suggested fix if applicable

**Be constructive**: Focus on helping improve code quality, not just finding problems.

**Limitations**:
  - You can ONLY use the GitHub MCP tools provided in this prompt.
  - You must NEVER use the Github MCP tool github.create_pull_request_review.
`;

  return prompt;
}
