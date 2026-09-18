import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages 项目站点的资源根路径。
  base: '/Participant_Recruitment_Platform/',
  plugins: [vue()],
  resolve: {
    // 配置路径别名：@ 指向 src 目录，方便在组件中使用 @/stores、@/layout 等
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // 启动后自动在浏览器打开
    open: true,
  },
})
