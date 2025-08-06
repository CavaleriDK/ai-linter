# Style Guidelines

## General Code Style Rules
- We optimize for maintainability over cleverness
  - When in doubt, choose the boring solution

### Code Style
- Avoid deep nesting of conditional statements
- Always prefer return early pattern
- Use \`const\` over \`let\`, \`let\` over \`var\`
- Use template literals for string interpolation
- Handle async operations with async/await or Promises
  - Prefer async/await over Promises
- Use 2 spaces for indentation
- Use camelCase for variables and functions, PascalCase for classes
- Methods must appear in classes in the same order that they are used when reading the class file top to bottom
  - The first public method appears at the top, and its own private methods appear below it before the next public method
  - Unless a private method is used by multiple other methods, then it must appear only under the first public method using it
- Private methods must use a hash `#` prefix
- Always use the static class `Logger` instead of console.*

### Security & Best Practices
- Never commit sensitive information (API keys, passwords, tokens)
- Remove commented-out code unless there's a specific reason to keep it
- Only include necessary dependencies

### Performance
- Avoid code duplication - extract common functionality

### Comments & Documentation
- Do not write inline code comments
