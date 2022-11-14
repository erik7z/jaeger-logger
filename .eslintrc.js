module.exports = {
  env: {
    es2017: true,
    node: true,
  },
  ignorePatterns: ['lib/**/*'],
  extends: [
    'plugin:prettier/recommended',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:unicorn/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
    ecmaVersion: 2017,
  },
  plugins: ['eslint-plugin-jsdoc', '@typescript-eslint', 'prettier', 'unicorn'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'constructor-super': 'off', // ts(2335) & ts(2377)
        'getter-return': 'off', // ts(2378)
        'no-const-assign': 'off', // ts(2588)
        'no-dupe-args': 'off', // ts(2300)
        'no-dupe-class-members': 'off', // ts(2393) & ts(2300)
        'no-dupe-keys': 'off', // ts(1117)
        'no-func-assign': 'off', // ts(2539)
        'no-import-assign': 'off', // ts(2539) & ts(2540)
        'no-new-symbol': 'off', // ts(2588)
        'no-obj-calls': 'off', // ts(2349)
        'no-redeclare': 'off', // ts(2451)
        'no-setter-return': 'off', // ts(2408)
        'no-this-before-super': 'off', // ts(2376)
        'no-undef': 'off', // ts(2304)
        'no-unreachable': 'off', // ts(7027)
        'no-unsafe-negation': 'off', // ts(2365) & ts(2360) & ts(2358)
        'no-var': 'error', // ts transpiles let/const to var, so no need for vars any more
        'prefer-const': 'error', // ts provides better types with const
        'prefer-rest-params': 'error', // ts provides better types with rest args over arguments
        'prefer-spread': 'error', // ts transpiles spread to apply, so no need for manual apply
        'valid-typeof': 'off', // ts(2367)
      },
    },
  ],
  rules: {
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/consistent-function-scoping': 'off',
    'unicorn/no-object-as-default-parameter': 'off',
    'unicorn/prefer-module': 'off',
    'unicorn/filename-case': 'off',
    'unicorn/no-null': 'off',
    'unicorn/no-nested-ternary': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'prettier/prettier': 'warn',
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
  },
};
