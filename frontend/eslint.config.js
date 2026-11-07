import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // 未使用变量：允许下划线前缀表示「故意不用」
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      // React Compiler 建议类规则（react-hooks v7 新增）：现有写法行为正确，只是不利于编译器优化 → 提示不阻断
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/use-memo': 'warn',
      // 仅影响开发热更新
      'react-refresh/only-export-components': 'warn',
      // 旧模块（串口烧录 / Blockly 桥接 / 旧后台）大量第三方无类型对象，逐步收敛
      '@typescript-eslint/no-explicit-any': 'warn',
      'preserve-caught-error': 'warn',
    },
  },
])
