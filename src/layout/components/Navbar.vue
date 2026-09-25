<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  Fold,
  Expand,
  Compass, // 注：@element-plus/icons-vue 无 Global 图标，用圆形 Compass 作“地球/语言”意象
  User,
  OfficeBuilding,
  SwitchButton,
  Check,
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { apiEnabled } from '@/services/api'
import { setLocale, SUPPORTED_LOCALES, pickLocalized } from '@/i18n'

/**
 * 顶部导航栏
 *  - 左侧：折叠按钮 + 系统 Logo
 *  - 右侧：【语言切换器】（地球图标 + 下拉，简中/英文/日文 实时切换）
 *          当前用户头像 + 「角色切换」下拉菜单
 *
 * i18n：所有界面文案均通过 t()/ $t() 获取，切换语言即时生效、无需刷新。
 */
const props = defineProps({
  isCollapse: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle-collapse'])

const router = useRouter()
const user = useUserStore()
const { t, locale } = useI18n()

/* ---------------- 用户展示信息（数据，非 UI 文案） ---------------- */
/* Step 16：name 为 {zh,ja,en} 对象，头像取当前界面语言姓名首字 */
const avatarText = computed(() => {
  const name =
    user.role === 'student' ? user.student?.name : user.researcher?.name
  return (pickLocalized(name, locale.value) || 'U').slice(0, 1)
})
const avatarBg = computed(
  () => (user.role === 'student' ? '#4f46e5' : '#0d9488'),
)
const roleTagType = computed(() =>
  user.role === 'student' ? 'primary' : 'success',
)
const roleLabel = computed(() =>
  user.role === 'student' ? t('role.student') : t('role.researcher'),
)

/**
 * 当前身份副标题（Step 13 学术语境本地化）：
 *  - 学生端：majorKey / gradeKey 为 i18n 键值路径，在此动态翻译
 *    → 「心理学 · 大二」/「心理学 · 学部2年」/「Psychology · 2nd-Year (Sophomore)」
 *  - 研究者端：title 为原文字符串（职称），直接展示
 */
const subtitle = computed(() => {
  if (user.role === 'student') {
    const st = user.student
    if (!st?.majorKey) return ''
    return `${t(st.majorKey)} · ${t(st.gradeKey)}`
  }
  return user.researcher?.title || ''
})

/* ---------------- 语言切换器 ---------------- */
// 语言选项（label 用各自母语书写，符合惯例）
const languageOptions = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English' },
  { code: 'ja-JP', label: '日本語' },
]
// 触发器上显示的短标签
const currentLangLabel = computed(() => {
  if (locale.value === 'en-US') return 'EN'
  if (locale.value === 'ja-JP') return '日本語'
  return '中文'
})
function changeLang(code) {
  setLocale(code)
}

/* ---------------- 角色切换 ---------------- */
async function handleCommand(command) {
  if (command === 'logout') {
    try { await user.logout() } catch (error) { ElMessage.error(error.message); return }
    ElMessage.success(t('nav.logoutDone'))
    // Step 11：退出后回到通用门户 /（旧 /login 已重定向至 /）
    router.push('/')
    return
  }
  if (apiEnabled) return
  if (command === user.role) return
  user.switchRole(command)
  const home = command === 'student' ? '/student/hall' : '/researcher/manage'
  const label =
    command === 'student' ? t('role.student') : t('role.researcher')
  ElMessage.success(t('nav.switched', { label }))
  router.push(home)
}
</script>

<template>
  <div class="navbar">
    <!-- ============ 左侧：折叠按钮 + Logo ============ -->
    <div class="navbar-left">
      <el-icon class="collapse-btn" @click="emit('toggle-collapse')">
        <Expand v-if="isCollapse" />
        <Fold v-else />
      </el-icon>

      <div class="brand">
        <div class="brand-logo">知</div>
        <div class="brand-text">
          <span class="brand-title">{{ $t('app.name') }}</span>
          <span class="brand-sub">{{ $t('app.brand') }}</span>
        </div>
      </div>
    </div>

    <!-- ============ 右侧：语言切换器 + 用户信息 ============ -->
    <div class="navbar-right">
      <!-- 语言切换器（地球图标 + 下拉） -->
      <el-dropdown
        trigger="click"
        class="lang-dropdown"
        @command="changeLang"
      >
        <div class="lang-trigger">
          <el-icon><Compass /></el-icon>
          <span class="lang-label">{{ currentLangLabel }}</span>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <div class="lang-menu-cap">{{ $t('nav.langLabel') }}</div>
            <el-dropdown-item
              v-for="opt in languageOptions"
              :key="opt.code"
              :command="opt.code"
            >
              <el-icon v-if="locale === opt.code"><Check /></el-icon>
              <span class="lang-opt">{{ opt.label }}</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 分隔线 -->
      <div class="nav-divider" />

      <!-- 用户头像 + 角色切换下拉 -->
      <el-dropdown
        trigger="click"
        class="user-dropdown"
        @command="handleCommand"
      >
        <div class="user-trigger">
          <el-avatar :size="34" :style="{ background: avatarBg }">
            {{ avatarText }}
          </el-avatar>
          <div class="user-meta">
            <span class="user-name">{{ user.displayName }}</span>
            <span class="user-sub">{{ subtitle }}</span>
          </div>
          <el-tag
            class="role-tag"
            :type="roleTagType"
            size="small"
            effect="light"
            round
          >
            {{ roleLabel }}
          </el-tag>
        </div>

        <template #dropdown>
          <el-dropdown-menu>
            <div class="dropdown-user-card">
              <el-avatar :size="38" :style="{ background: avatarBg }">
                {{ avatarText }}
              </el-avatar>
              <div>
                <div class="dc-name">{{ user.displayName }}</div>
                <div class="dc-sub">{{ subtitle }}</div>
                <!-- Step 14：SSO 已验证的教育邮箱（OAuth 时代的核心身份标识） -->
                <div v-if="user.ssoEmail" class="dc-email">{{ user.ssoEmail }}</div>
              </div>
            </div>

            <el-dropdown-item v-if="!apiEnabled" disabled class="dropdown-section">
              {{ $t('nav.switchIdentity') }}
            </el-dropdown-item>
            <el-dropdown-item v-if="!apiEnabled" command="student" :icon="User">
              {{ $t('nav.studentEnd') }}
            </el-dropdown-item>
            <el-dropdown-item v-if="!apiEnabled" command="researcher" :icon="OfficeBuilding">
              {{ $t('nav.researcherEnd') }}
            </el-dropdown-item>

            <el-dropdown-item divided command="logout" :icon="SwitchButton">
              {{ $t('nav.logout') }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style scoped>
.navbar {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.collapse-btn {
  font-size: 20px;
  color: #4b5563;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: all 0.2s;
}
.collapse-btn:hover {
  background: #eef0f5;
  color: #4f46e5;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-logo {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, #4f46e5, #7c6ff0);
  box-shadow: 0 4px 10px rgba(79, 70, 229, 0.28);
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}
.brand-title {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  letter-spacing: 0.5px;
}
.brand-sub {
  font-size: 11px;
  color: #9ca3af;
  letter-spacing: 1px;
}

/* 右侧 */
.navbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.nav-divider {
  width: 1px;
  height: 24px;
  background: #e5e7eb;
  margin: 0 4px;
}

/* 语言切换器 */
.lang-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 7px 12px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  color: #4b5563;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}
.lang-trigger:hover {
  background: #f1f2f8;
  border-color: #c7d2fe;
  color: #4f46e5;
}
.lang-menu-cap {
  padding: 10px 16px 6px;
  font-size: 12px;
  color: #9ca3af;
  background: #faf9fc;
}
.lang-opt {
  display: inline-block;
  min-width: 70px;
}

/* 用户区 */
.user-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 12px;
  transition: background 0.2s;
}
.user-trigger:hover {
  background: #f1f2f8;
}
.user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.user-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}
.user-sub {
  font-size: 11px;
  color: #9ca3af;
}
.role-tag {
  margin-left: 4px;
}

/* 下拉内的用户卡片 */
.dropdown-user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
}
.dc-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.dc-sub {
  font-size: 12px;
  color: #9ca3af;
}
/* Step 14：SSO 邮箱（小一号、等宽数字，学术邮箱较长时自动截断） */
.dc-email {
  font-size: 11px;
  color: #4f46e5;
  margin-top: 2px;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dropdown-section {
  font-size: 12px;
  color: #9ca3af;
  cursor: default;
  background: #faf9fc;
}
</style>
