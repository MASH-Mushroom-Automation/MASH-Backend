module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',      // New feature
        'fix',       // Bug fix
        'docs',      // Documentation changes
        'style',     // Code style changes (formatting, semicolons, etc.)
        'refactor',  // Code refactoring
        'perf',      // Performance improvements
        'test',      // Adding or updating tests
        'build',     // Build system or external dependencies
        'ci',        // CI/CD changes
        'chore',     // Other changes that don't modify src or test files
        'revert',    // Revert a previous commit
      ],
    ],
    'subject-case': [0], // Disable subject case checking
    'body-max-line-length': [2, 'always', 100],
  },
};
