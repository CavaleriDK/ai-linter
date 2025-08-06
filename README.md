# AI Linter


AI-powered code linter using OpenAI Codex CLI with GitHub MCP integration for intelligent Pull Request reviews.

## Features

- 🤖 **AI-Powered Reviews**: Uses OpenAI Codex CLI as an intelligent agent
- 📋 **Configurable Rules**: Customizable style guidelines (defaults to `STYLE-GUIDELINES.md`)
- 🔗 **GitHub Integration**: Native GitHub MCP support for posting PR comments
- 🌍 **Global CLI**: Install once, use anywhere
- 🚀 **Context-Aware**: Full repository access for better analysis
- ⚡ **Non-blocking**: Iterative review process without token context limits

## Installation

### Prerequisites

- Node.js 22+
- Go 1.24+ (for building GitHub MCP Server)

### Install

```bash
npm install -g ai-linter-cli
```

The GitHub MCP Server v0.10.0 will be automatically built during installation.

## Usage

### Command Line

```bash
# Review a specific PR
ai-linter --repo-owner myorg --repo-name myrepo --pr 123

# Review with custom style guidelines
ai-linter --repo-owner myorg --repo-name myrepo --pr 123 --rules ./docs/STYLE-GUIDE.md

# Review with a specific model (default: o4-mini)
ai-linter --repo-owner myorg --repo-name myrepo --pr 123 --model o1-preview

# Dry run (show what would be reviewed)
ai-linter --repo-owner myorg --repo-name myrepo --pr 123 --dry-run

# Verbose output
ai-linter --repo-owner myorg --repo-name myrepo --pr 123 --verbose
```

### GitHub Actions (Recommended)

AI Linter works best as a GitHub App that automatically reviews PRs. See the [GitHub App Setup](#github-app-setup) section below.

## GitHub App Setup

### Step 1: Create the GitHub App

1. Go to your GitHub settings to create a new app:
   - Personal account: https://github.com/settings/apps/new
   - Organization: https://github.com/organizations/YOUR_ORG/settings/apps/new

2. Configure the app with these settings:
   - **Name**: AI Linter
   - **Description**: AI-powered code review and style guideline enforcement
   - **Homepage URL**: Your repository URL
   - **Webhook**: Uncheck "Active" (we use GitHub Actions)
   - **Permissions**:
     - Contents: Read
     - Pull requests: Write
   - **Subscribe to events**: Pull request

3. Click "Create GitHub App"

### Step 2: Generate Private Key

1. After creation, scroll to "Private keys"
2. Click "Generate a private key"
3. Save the downloaded `.pem` file securely

### Step 3: Install the App

1. Click "Install App" in the sidebar
2. Choose repositories to install on
3. Click "Install"

### Step 4: Configure Repository Secrets

Add these secrets to your repository (Settings → Secrets → Actions):
- `AI_LINTER_APP_ID`: Your GitHub App's ID or Client ID (found on app settings page)
- `AI_LINTER_PRIVATE_KEY`: Contents of the `.pem` file
- `OPENAI_API_KEY`: Your OpenAI API key

### Step 5: Add GitHub Actions Workflow

Create `.github/workflows/ai-linter.yml`:

```yaml
name: AI Linter

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

concurrency:
  group: pull_request-${{ github.head_ref }}
  cancel-in-progress: true # Avoid running multiple workflows simultaneously to prevent deleting other reviews

jobs:
  ai-lint:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.24'

      - name: Install AI Linter
        run: npm install -g ai-linter-cli

      - name: Generate GitHub App Token
        id: generate_token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ secrets.AI_LINTER_APP_ID }}
          private-key: ${{ secrets.AI_LINTER_PRIVATE_KEY }}

      - name: Run AI Linter
        env:
          GITHUB_TOKEN: ${{ steps.generate_token.outputs.token }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          ai-linter \
            --repo-owner ${{ github.repository_owner }} \
            --repo-name ${{ github.event.repository.name }} \
            --pr ${{ github.event.pull_request.number }} \
            --base=${{ github.base_ref }} \
            --head=${{ github.head_ref }} 
```

## Style Guidelines

AI Linter looks for a `STYLE-GUIDELINES.md` file in your repository. If not found, it will create a default one.

Common locations checked:
- `./STYLE-GUIDELINES.md`
- `./docs/STYLE-GUIDELINES.md`
- `./.github/STYLE-GUIDELINES.md`

## Configuration

### Environment Variables

- `OPENAI_API_KEY`: Required - Your OpenAI API key
- `GITHUB_TOKEN`: GitHub App installation token (provided by GitHub Actions)
- `GITHUB_PERSONAL_ACCESS_TOKEN`: Alternative to GitHub App token for local development

### Command Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--rules <file>` | `-r` | Path to style guidelines file | `STYLE-GUIDELINES.md` |
| `--pr <number>` | `-p` | Pull Request number to review | - |
| `--base <ref>` | `-b` | Base branch for comparison | `main` |
| `--head <ref>` | `-h` | Head branch for comparison | Current branch |
| `--model <name>` | `-m` | OpenAI model to use | `o4-mini` |
| `--repo-owner <owner>` | `-o` | GitHub repository owner | Auto-detected |
| `--repo-name <name>` | `-n` | GitHub repository name | Auto-detected |
| `--dry-run` | - | Show what would be done without executing | `false` |
| `--verbose` | `-v` | Verbose logging | `false` |

## License

MIT