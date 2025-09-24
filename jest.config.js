module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/.claude-collective/tests/**/*.test.js'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/frontend/.next/',
    '<rootDir>/infrastructure/.terragrunt-cache/',
    '<rootDir>/node_modules/'
  ],
  watchPathIgnorePatterns: [
    '<rootDir>/frontend/.next/',
    '<rootDir>/infrastructure/.terragrunt-cache/'
  ],
  transformIgnorePatterns: [
    '<rootDir>/infrastructure/.terragrunt-cache/',
    '<rootDir>/frontend/.next/'
  ]
};