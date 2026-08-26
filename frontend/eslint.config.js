import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'docs/**']
  },

  // 共通ルール
  js.configs.recommended,

  // Vueコンポーネント
  ...pluginVue.configs['flat/recommended'],

  // フロントエンド（ブラウザで動作するコード）
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser
      }
    },
    rules: {
      // 命名規則: 2語以上のコンポーネント名を必須にする
      'vue/multi-word-component-names': 'error',
      // 命名規則: テンプレート内の属性はkebab-caseにする
      'vue/attribute-hyphenation': ['error', 'always'],
      // コンポーネント設計ルール: propsは型と既定値を明示する
      'vue/require-default-prop': 'error',
      'vue/require-prop-types': 'error',
      // コンポーネント設計ルール: emitは宣言してから使う
      'vue/require-explicit-emits': 'error'
    }
  },

  // バックエンド（Node.js上で動作するコード）
  {
    files: ['amplify/**/*.js', 'tools/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    }
  },

  // テスト
  {
    files: ['**/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  }
];
