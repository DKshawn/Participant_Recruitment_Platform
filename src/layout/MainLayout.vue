<script setup>
import { ref } from 'vue'
import Navbar from './components/Navbar.vue'
import Sidebar from './components/Sidebar.vue'

/**
 * 主布局外壳（Admin Shell）
 *
 * 结构：
 *  ┌────────────────────────────────────────────┐
 *  │  Navbar（顶部导航栏：Logo / 角色切换）        │
 *  ├──────────┬─────────────────────────────────┤
 *  │          │                                 │
 *  │ Sidebar  │   <router-view>                 │
 *  │（左侧菜单）│   当前路由对应的页面内容            │
 *  │          │                                 │
 *  └──────────┴─────────────────────────────────┘
 *
 * 侧边栏支持折叠，折叠状态保存在本组件本地（isCollapse），
 * 通过 prop 下发给 Navbar（触发按钮）与 Sidebar（渲染菜单）。
 */
const isCollapse = ref(false)

function toggleCollapse() {
  isCollapse.value = !isCollapse.value
}
</script>

<template>
  <el-container class="app-layout">
    <!-- 顶部导航栏 -->
    <el-header class="app-header" height="60px">
      <Navbar
        :is-collapse="isCollapse"
        @toggle-collapse="toggleCollapse"
      />
    </el-header>

    <!-- 下方主体：侧边栏 + 内容区 -->
    <el-container class="app-body">
      <el-aside
        class="app-aside"
        :width="isCollapse ? '64px' : '220px'"
      >
        <Sidebar :collapsed="isCollapse" />
      </el-aside>

      <!-- 主内容区：渲染具体页面 -->
      <el-main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  overflow: hidden;
}

.app-header {
  padding: 0;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
  z-index: 10;
}

.app-body {
  height: calc(100vh - var(--app-header-height));
}

.app-aside {
  background: #ffffff;
  border-right: 1px solid #eef0f5;
  transition: width 0.28s ease;
  overflow: hidden;
}

.app-main {
  padding: 20px;
  background: var(--app-content-bg);
  overflow-y: auto;
}

/* 页面切换的淡入 + 轻微上移动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.22s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
