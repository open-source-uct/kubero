// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // el mock de octokit es JS plano fuera del tsconfig; el .spec.ignore.ts es un
    // spec desactivado a propósito (jest no lo ejecuta)
    ignores: [
      'eslint.config.mjs',
      'src/__mocks__/**',
      'src/**/*.spec.ignore.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 5,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // muchos métodos son async por contrato (controllers de Nest, strategies
      // de passport, implementaciones de Repo); un await olvidado ya lo detecta
      // no-floating-promises
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_', // el comentario original ya lo pedía, pero solo cubría argumentos
          ignoreRestSiblings: true, // para destructuring que excluye un campo, ej. { password, ...result }
        },
      ], // Ignore unused variables starting with "_"
    },
  },
  {
    // `expect(service.metodo).toHaveBeenCalled()` es el patrón normal de jest;
    // en los specs los métodos son mocks y no dependen de `this`
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
