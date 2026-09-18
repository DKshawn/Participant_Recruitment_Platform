<script setup>
import { computed } from 'vue'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import ja from 'element-plus/es/locale/lang/ja'
import { useI18n } from 'vue-i18n'

/**
 * 根组件
 * - 用 ElConfigProvider 让 Element Plus 内置组件的文案
 *  （如 ElMessageBox 的“确定/取消”、分页、日期选择等）也随 i18n 语言切换
 * - 其余路由视图由 <router-view> 渲染
 */
const { locale } = useI18n()

// i18n locale -> Element Plus locale 映射
const elementLocale = computed(() => {
  if (locale.value === 'ja-JP') return ja
  if (locale.value === 'en-US') return en
  return zhCn
})
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <router-view />
  </el-config-provider>
</template>
