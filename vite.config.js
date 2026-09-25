import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages 项目站点的资源根路径。
  base: loadEnv(mode, process.cwd()).VITE_APP_BASE || '/Participant_Recruitment_Platform/',
  plugins: [vue()],
  resolve: {
    // 配置路径别名：@ 指向 src 目录，方便在组件中使用 @/stores、@/layout 等
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false },
    },
    // 由用户或验证工具打开，避免后台启动时弹出浏览器。
    open: false,
  },
}))
