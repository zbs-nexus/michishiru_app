import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// ローカル開発時にAPIを受け持つハーネスのポート
const LOCAL_API_PORT = 3001;

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3000,
    // ポートが使用中の場合は別ポートへ切り替えず、明示的に失敗させる
    // （APIハーネスのポートと衝突するのを防ぐ）
    strictPort: true,
    host: true,
    proxy: {
      // /api へのリクエストはローカルAPIハーネス（Lambdaハンドラ）へ転送する
      '/api': {
        target: `http://127.0.0.1:${LOCAL_API_PORT}`,
        changeOrigin: true
      }
    }
  }
});
