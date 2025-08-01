# Style Guidelines

## General Code Style Rules

### Code Style
- Avoid deep nesting of conditional statements
- Always prefer return early pattern
- Use \`const\` over \`let\`, \`let\` over \`var\`
- Use template literals for string interpolation
- Handle async operations with async/await or Promises
  * Prefer async/await over Promises
- Use 2 spaces for indentation
- Use camelCase for variables and functions, PascalCase for classes

### Security & Best Practices
- Never commit sensitive information (API keys, passwords, tokens)
- Remove commented-out code unless there's a specific reason to keep it
- Only include necessary dependencies

### Performance
- Avoid code duplication - extract common functionality

### Comments & Documentation
- Do not write inline code comments
