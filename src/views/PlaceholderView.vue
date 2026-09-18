<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@/stores/user'

/**
 * 通用占位页
 *
 * 步骤 1 只搭建外壳与路由，具体业务页面将在后续步骤逐个实现。
 * 这里读取当前路由的 meta.title 与角色信息，展示一个友好的「待开发」提示，
 * 保证任意菜单点击后都有对应页面可渲染，框架整体可跑通。
 */
const route = useRoute()
const user = useUserStore()
const { t } = useI18n()

/** 页面标题：优先路由 meta.i18nKey（可翻译），否则回退 meta.title / common.page */
const pageTitle = computed(() =>
  route.meta?.i18nKey
    ? t(route.meta.i18nKey)
    : route.meta?.title || t('common.page'),
)

/** 当前端标签（role.student / role.researcher） */
const sideLabel = computed(() =>
  t(user.role === 'student' ? 'role.student' : 'role.researcher'),
)
</script>

<template>
  <el-card shadow="never" class="placeholder-card">
    <el-empty description="" :image-size="90">
      <template #description>
        <p class="ph-title">{{ pageTitle }}</p>
        <p class="ph-sub">
          {{ t('placeholder.at', { side: sideLabel }) }} · {{ t('placeholder.todo') }}
        </p>
        <p class="ph-hint">{{ t('placeholder.ready') }} ✅</p>
      </template>
      <template #default>
        <el-tag type="info" effect="plain" size="large" round>
          {{ t('placeholder.step') }}
        </el-tag>
      </template>
    </el-empty>
  </el-card>
</template>

<style scoped>
.placeholder-card {
  min-height: calc(100vh - var(--app-header-height) - 40px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  border: none;
}
.ph-title {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 6px;
}
.ph-sub {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 6px;
}
.ph-hint {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}
</style>
