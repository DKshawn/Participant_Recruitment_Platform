<script setup>
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Compass, HomeFilled } from '@element-plus/icons-vue'

/**
 * 404 页面（Step 11：路由安全重构的核心组件之一）
 *
 * 设计要点：
 *  1. 该页是路由表中的 catch-all（/:pathMatch(.*)*），同时承担
 *     「未知路径」与「角色越权拦截」两种场景的落地页。
 *  2. 文案刻意模糊（「不存在 / 已移动 / 需要特定权限」），
 *     绝不出现「无权访问 / 403 / forbidden」等字样，
 *     防止学生端通过报错信息枚举出研究者端路由字典。
 *  3. 全部文案走 i18n（notFound.* 三语字典），切换语言实时生效。
 *  4. 「返回首页」按钮 push('/')：
 *     - 未登录用户 → 落到通用学生门户
 *     - 已登录用户 → 守卫自动纠正到其角色首页
 */
const router = useRouter()
const { t } = useI18n()

/** 返回门户（守卫会按登录态/角色做最终纠正，无需在此判断） */
function backHome() {
  router.push('/')
}
</script>

<template>
  <div class="notfound-page">
    <div class="notfound-card">
      <!-- 大号 404 码（渐变文字，与品牌色一致） -->
      <div class="nf-code">{{ $t('notFound.code') }}</div>

      <!-- 图标：Compass（@element-plus/icons-vue 无 Global 图标，用罗盘意象） -->
      <div class="nf-icon">
        <el-icon><Compass /></el-icon>
      </div>

      <h1 class="nf-title">{{ $t('notFound.title') }}</h1>
      <p class="nf-desc">{{ $t('notFound.desc') }}</p>

      <el-button type="primary" round class="nf-btn" @click="backHome">
        <el-icon class="el-icon--left"><HomeFilled /></el-icon>
        {{ $t('notFound.backHome') }}
      </el-button>

      <!-- 底部版本标识：与登录页品牌区呼应，同时暗示「这是一个正式系统」 -->
      <div class="nf-foot">{{ $t('app.version') }}</div>
    </div>
  </div>
</template>

<style scoped>
.notfound-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #eef2ff 0%, #f8f9ff 45%, #f0fdfa 100%);
  padding: 24px;
}

.notfound-card {
  width: 100%;
  max-width: 440px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  box-shadow: 0 18px 48px rgba(17, 24, 39, 0.08);
  padding: 56px 48px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
}

.nf-code {
  font-size: 76px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 4px;
  background: linear-gradient(135deg, #4f46e5, #7c6ff0);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  user-select: none;
}

.nf-icon {
  margin-top: 6px;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  font-size: 26px;
  color: #4f46e5;
  background: #eef2ff;
}

.nf-title {
  font-size: 19px;
  font-weight: 700;
  color: #111827;
  margin: 14px 0 0;
}

.nf-desc {
  font-size: 13.5px;
  line-height: 1.7;
  color: #9ca3af;
  margin: 0;
}

.nf-btn {
  margin-top: 22px;
}

.nf-foot {
  margin-top: 34px;
  font-size: 12px;
  color: #c4c9d4;
  letter-spacing: 0.5px;
}
</style>
