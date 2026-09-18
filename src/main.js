import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'
import i18n from './i18n'
import './styles/index.css'

/**
 * 应用入口
 * - 创建 Vue 实例
 * - 挂载 Pinia（全局状态管理，用于保存角色、信誉分等）
 * - 挂载 vue-router（路由，负责角色端页面切换）
 * - 挂载 vue-i18n（多语言：简中 / 英文 / 日文，动态切换）
 * - 全量引入 Element Plus
 */
const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(ElementPlus)

app.mount('#app')
