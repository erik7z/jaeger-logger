module.exports = {
  env: {
    es2017: true,
    node: true,
  },
  ignorePatterns: ['lib/**/*'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:unicorn/recommended',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
    ecmaVersion: 2017,
  },
  plugins: ['eslint-plugin-jsdoc', '@typescript-eslint', 'prettier', 'unicorn'],
  overrides: [],
  rules: {
    'unicorn/prefer-module': 'off',
    'unicorn/filename-case': 'off',
    '@typescript-eslint/array-type': [
      'warn',
      {
        default: 'array-simple',
      },
    ],
    '@typescript-eslint/explicit-function-return-type': [
      'warn',
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true,
        allowConciseArrowFunctionExpressionsStartingWithVoid: false,
        allowedNames: [],
      },
    ],
    '@typescript-eslint/explicit-member-accessibility': [
      'warn',
      {
        accessibility: 'explicit',
        overrides: {
          accessors: 'explicit',
          constructors: 'off',
          methods: 'explicit',
          properties: 'explicit',
          parameterProperties: 'explicit',
        },
      },
    ],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-types': [
      'error',
      {
        types: {
          String: true,
          Boolean: true,
          Number: true,
          Symbol: true,
          '{}': true,
          Object: true,
          object: true,
          Function: false,
        },
        extendDefaults: true,
      },
    ],
  },
};
