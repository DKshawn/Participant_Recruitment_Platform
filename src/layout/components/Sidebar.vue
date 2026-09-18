<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { menuConfig } from '@/config/menu'

/**
 * 左侧侧边栏
 *
 * 核心逻辑：菜单项随当前角色动态变化
 *  - 学生端   → 实验大厅 / 我的参与记录 / 个人中心
 *  - 研究者端 → 发布新实验 / 实验管理 / 被试池管理 / 评分与审核
 *
 * el-menu 开启 `router` 模式后，点击菜单项会以 index 作为路径跳转，
 * `default-active` 绑定当前路由路径，实现高亮联动。
 */
const props = defineProps({
  // 是否处于折叠状态
  collapsed: { type: Boolean, default: false },
})

const route = useRoute()
const user = useUserStore()

// 根据当前角色取出对应菜单
const activeMenu = computed(() => menuConfig[user.role] || [])

// 顶部小标签：提示当前处于哪个端，帮助测试时快速辨认
const roleBadge = computed(
  () => (user.role === 'student' ? 'STUDENT' : 'RESEARCHER'),
)
</script>

<template>
  <div class="sidebar">
    <!-- 角色端标识（折叠时自动隐藏文字） -->
    <div class="side-role" :class="{ collapsed: collapsed }">
      <span class="side-role-dot" />
      <span class="side-role-text">{{ roleBadge }}</span>
    </div>

    <!-- 动态菜单 -->
    <el-menu
      class="sidebar-menu"
      :default-active="route.path"
      :collapse="collapsed"
      :collapse-transition="false"
      unique-opened
      router
    >
      <el-menu-item
        v-for="item in activeMenu"
        :key="item.index"
        :index="item.index"
      >
        <el-icon>
          <component :is="item.icon" />
        </el-icon>
        <template #title>{{ $t(item.i18nKey) }}</template>
      </el-menu-item>
    </el-menu>

    <!-- 底部版本信息 -->
    <div class="side-footer" v-show="!collapsed">
      ActMind Pool v0.1
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 顶部角色标识 */
.side-role {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 18px 12px;
  font-size: 12px;
  letter-spacing: 1.5px;
  color: #9ca3af;
  font-weight: 600;
  white-space: nowrap;
}
.side-role.collapsed {
  justify-content: center;
  padding: 16px 0 12px;
}
.side-role-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5, #7c6ff0);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
}

/* 菜单主体 */
.sidebar-menu {
  flex: 1;
  border-right: none;
  padding: 0 10px;
  overflow-y: auto;
}
.sidebar-menu:deep(.el-menu-item) {
  border-radius: 10px;
  margin-bottom: 6px;
  height: 46px;
  line-height: 46px;
}
.sidebar-menu:deep(.el-menu-item:hover) {
  background: #f1f2f8;
}
.sidebar-menu:deep(.el-menu-item.is-active) {
  background: linear-gradient(90deg, #eef2ff, #f5f3ff);
  color: #4f46e5;
  font-weight: 600;
}
.sidebar-menu:deep(.el-menu-item.is-active .el-icon) {
  color: #4f46e5;
}

/* 底部 */
.side-footer {
  padding: 12px 18px;
  font-size: 11px;
  color: #c0c4cc;
  border-top: 1px solid #f0f1f5;
  white-space: nowrap;
}
</style>
