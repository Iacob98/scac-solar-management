/**
 * Файл: .eslintrc.js
 * Назначение: Конфигурация ESLint для контроля качества кода и архитектуры
 * Правила: ограничение длины файлов (300 строк), функций (80 строк)
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

module.exports = {
  extends: [
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    // ----- Контроль архитектуры -----
    'max-lines': ['error', { 
      max: 300, 
      skipBlankLines: true, 
      skipComments: true 
    }],
    'max-lines-per-function': ['error', { 
      max: 80, 
      skipBlankLines: true, 
      skipComments: true 
    }],
    
    // ----- Качество кода -----
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    
    // ----- React специфичные -----
    'react/react-in-jsx-scope': 'off', // не нужно в современном React
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // ----- Импорты и структура -----
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error'
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  env: {
    browser: true,
    node: true,
    es6: true
  }
};