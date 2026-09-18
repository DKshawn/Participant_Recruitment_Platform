<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue' // Loading 旋转图标（遮罩层使用）
import { useUserStore } from '@/stores/user'

/**
 * 登录页（Step 14 修订：多入口隔离 SSO 模式）
 *
 * 背景：为满足不同机构的准入控制，登录界面拆分为两个相互隔离的入口（el-tabs 双标签页）：
 *
 *  区域 A「东京理科大学专用入口 (TUS Members)」
 *   - 仅一个按钮：「使用理科大 Microsoft 账号登录」
 *   - 模拟 OAuth：随机生成测试邮箱（TUS 官方 / 校外各约 50%，随机命中成功/拒绝两种分支）
 *   - 强制校验后缀 tus.ac.jp / ed.tus.ac.jp：
 *       不符合 → 红色严厉报错「认证失败：您使用的不是东京理科大学的官方邮箱」，阻止登录、不写 Token
 *       符合   → 写入模拟会话（Token + UserInfo）→ 进入系统
 *
 *  区域 B「外部机构及通用入口 (External / General)」
 *   - 两个标准按钮：Microsoft / Google
 *   - 模拟 OAuth：随机生成普通 gmail / outlook 邮箱，不限制域名，直接引导进入系统
 *     （学生端 → /student/hall；研究者隐蔽入口 → /researcher/publish）
 *
 *  两区共用：
 *   - 全屏 Loading 遮罩（「正在跳转至 Microsoft / Google 认证中心…」），setTimeout 1.5s 模拟认证中心往返
 *   - i18n：全部文案走 login.* 字典（zh-CN / ja-JP / en-US），切换语言实时响应
 *
 *  路由双入口（沿用 Step 11 的 mode 设计）：
 *   - /                    → mode='student'    学生门户（成功后跳 /student/hall）
 *   - /admin-auth-secure   → mode='researcher' 隐蔽入口（成功后跳 /researcher/publish）
 *
 *  安全说明：生产环境的邮箱域名校验必须由后端完成
 *  （校验 OIDC id_token 的 email 声明，或经 Microsoft Graph / Google People API 二次确认）；
 *  此处前端校验为演示层实现，用于直观展示「拒绝分支」。
 */
const props = defineProps({
  /** 入口模式：student = 通用门户（/），researcher = 隐蔽入口（/admin-auth-secure） */
  mode: {
    type: String,
    default: 'student',
    validator: (v) => ['student', 'researcher'].includes(v),
  },
})

const router = useRouter()
const user = useUserStore()
const { t } = useI18n()

/* ============ 区域 A：TUS 官方域名白名单与强制校验 ============ */

/**
 * 东京理科大学（TUS）官方邮箱域名白名单。
 * 包含教育子域 ed.tus.ac.jp 与官方主域 tus.ac.jp。
 */
const TUS_DOMAINS = ['tus.ac.jp', 'ed.tus.ac.jp']

/**
 * 强制校验（区域 A 核心逻辑）：
 * 仅当邮箱以 TUS 官方域名结尾（完全匹配，或作为其子域匹配）时通过。
 * 示例：
 *   sakai1234@ed.tus.ac.jp  → true
 *   hongo1234@tus.ac.jp     → true
 *   visitor1234@gmail.com   → false（触发严厉报错，阻止登录）
 * @param {string} email 模拟 OAuth 回调回传的邮箱
 * @returns {boolean}
 */
function isTusOfficialEmail(email) {
  if (typeof email !== 'string') return false
  const at = email.lastIndexOf('@')
  if (at <= 0) return false
  const domain = email.slice(at + 1).toLowerCase()
  return TUS_DOMAINS.some(
    (d) => domain === d || domain.endsWith('.' + d),
  )
}

/* ============ 模拟 OAuth 回调：随机生成测试邮箱 ============ */

/** 生成 4 位随机数，用于构造可区分的演示邮箱 */
function rnd() {
  return Math.floor(Math.random() * 9000) + 1000
}

/**
 * 区域 A 邮箱池：TUS 官方邮箱与校外邮箱混合（各约 50%），
 * 随机命中即可分别演示「认证成功」与「认证失败（拒绝）」两条分支。
 */
const TUS_POOL = [
  { user: 'sakai', domain: 'ed.tus.ac.jp' }, // TUS 教育邮箱 → 通过
  { user: 'hongo', domain: 'tus.ac.jp' },    // TUS 官方邮箱 → 通过
  { user: 'visitor', domain: 'gmail.com' },  // 校外邮箱   → 拒绝
  { user: 'guest', domain: 'outlook.com' },  // 校外邮箱   → 拒绝
]

/** 区域 B 邮箱池：普通公共邮箱（gmail / outlook），无域名限制 */
const EXTERNAL_POOL = [
  { user: 'jdoe', domain: 'gmail.com' },
  { user: 'partner', domain: 'outlook.com' },
  { user: 'alice', domain: 'gmail.com' },
]

/** 从池中随机取一个并拼接为演示邮箱，如 `sakai4821@ed.tus.ac.jp` */
function randomEmail(pool) {
  const p = pool[Math.floor(Math.random() * pool.length)]
  return `${p.user}${rnd()}@${p.domain}`
}

/* ============ 模拟 OAuth 登录交互 ============ */

/** 当前激活的入口标签（A: 'tus' / B: 'external'），默认展示 TUS 专用入口 */
const activeTab = ref('tus')
/** 全屏 Loading 遮罩状态 */
const ssoLoading = ref(false)
/** 遮罩文案对应的 provider（microsoft / google） */
const ssoProvider = ref('microsoft')

/** 登录成功后的落地页：由路由入口（mode）决定，与入口区域无关 */
function destination() {
  return props.mode === 'student' ? '/student/hall' : '/researcher/publish'
}

/**
 * 区域 A：东京理科大学专用入口的登录流程
 *  ① 全屏遮罩「正在跳转至 Microsoft 认证中心…」
 *  ② setTimeout 1.5s 模拟认证中心往返，随机生成一个测试邮箱
 *  ③ 强制 TUS 官方域名后缀校验
 *     - 通过 → user.loginWithSso() 写模拟会话 → 成功提示 → 跳转落地页
 *     - 拒绝 → 红色严厉报错「认证失败：您使用的不是东京理科大学的官方邮箱」，
 *              不写入 Token、不跳转（用户可再次点击重试，邮箱随机重抽）
 */
function handleTusLogin() {
  if (ssoLoading.value) return
  ssoProvider.value = 'microsoft'
  ssoLoading.value = true

  setTimeout(() => {
    const email = randomEmail(TUS_POOL) // 模拟 OAuth 回调回传的邮箱

    // —— 强制 TUS 官方域名校验（拒绝分支） ——
    if (!isTusOfficialEmail(email)) {
      ssoLoading.value = false
      ElMessage.error(t('login.failedTus'))
      return // 阻止登录：不写 Token、不跳转
    }

    // —— 校验通过：写入模拟会话（Token + UserInfo）并跳转 ——
    user.loginWithSso(props.mode, email)
    ssoLoading.value = false
    ElMessage.success(t('login.enteredByProvider', { provider: 'Microsoft' }))
    router.push(destination())
  }, 1500)
}

/**
 * 区域 B：外部机构及通用入口的登录流程（不限制域名，必然通过）
 *  ① 全屏遮罩「正在跳转至 Microsoft / Google 认证中心…」
 *  ② setTimeout 1.5s 后随机生成一个普通 gmail / outlook 邮箱
 *  ③ 写入模拟会话 → 直接进入系统内部（/student/hall 或 /researcher/publish）
 * @param {'microsoft'|'google'} provider 授权提供方
 */
function handleExternalLogin(provider) {
  if (ssoLoading.value) return
  ssoProvider.value = provider
  ssoLoading.value = true

  setTimeout(() => {
    const email = randomEmail(EXTERNAL_POOL) // 普通 gmail / outlook 邮箱

    user.loginWithSso(props.mode, email)
    ssoLoading.value = false
    ElMessage.success(
      t('login.enteredByProvider', {
        provider: provider === 'microsoft' ? 'Microsoft' : 'Google',
      }),
    )
    router.push(destination())
  }, 1500)
}
</script>

<template>
  <div class="login-page">
    <!-- ============ 左侧品牌区（沿用前版） ============ -->
    <div class="login-brand">
      <div class="brand-row">
        <div class="brand-logo">知</div>
        <div>
          <div class="brand-title">{{ $t('app.name') }}</div>
          <div class="brand-sub">{{ $t('app.brand') }}</div>
        </div>
      </div>

      <p class="brand-slogan">
        {{ $t('app.taglinePrefix') }}<br />
        <b>{{ $t('app.taglineStrong') }}</b>
      </p>

      <ul class="brand-points">
        <li>🎯 {{ $t('app.point1') }}</li>
        <li>🛡️ {{ $t('app.point2') }}</li>
        <li>📣 {{ $t('app.point3') }}</li>
      </ul>
    </div>

    <!-- ============ 右侧登录区（Step 14 修订：双入口隔离） ============ -->
    <div class="login-panel">
      <!-- 面板标题/描述随路由入口模式切换（学生门户 / 研究者入口） -->
      <template v-if="mode === 'student'">
        <h2 class="panel-title">{{ $t('login.studentCard') }}</h2>
        <p class="panel-desc">{{ $t('login.studentCardDesc') }}</p>
      </template>
      <template v-else>
        <h2 class="panel-title">{{ $t('login.researcherCard') }}</h2>
        <p class="panel-desc">{{ $t('login.researcherCardDesc') }}</p>
      </template>

      <p class="sso-hint">{{ $t('login.ssoHint') }}</p>

      <!-- ============ 双入口标签页（区域 A / 区域 B 物理隔离） ============ -->
      <el-tabs v-model="activeTab" class="login-tabs">
        <!-- ---------- 区域 A：东京理科大学专用入口 (TUS Members) ---------- -->
        <el-tab-pane :label="$t('login.tabTus')" name="tus">
          <div class="tab-pane-body">
            <!-- 本区唯一按钮：理科大 Microsoft 账号（黑底 + 标准四色 Logo） -->
            <button class="sso-btn sso-btn-ms" @click="handleTusLogin">
              <!-- Microsoft 官方四色 Logo（inline SVG，不依赖外部资源） -->
              <svg class="sso-logo" viewBox="0 0 21 21" width="22" height="22" aria-hidden="true">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              <span>{{ $t('login.btnTusMicrosoft') }}</span>
            </button>

            <!-- TUS 官方域名限制提示（i18n） -->
            <p class="domain-hint">{{ $t('login.tusHint') }}</p>
          </div>
        </el-tab-pane>

        <!-- ---------- 区域 B：外部机构及通用入口 (External / General) ---------- -->
        <el-tab-pane :label="$t('login.tabExternal')" name="external">
          <div class="tab-pane-body">
            <!-- 按钮 1：Microsoft（黑底 + 标准四色 Logo） -->
            <button class="sso-btn sso-btn-ms" @click="handleExternalLogin('microsoft')">
              <svg class="sso-logo" viewBox="0 0 21 21" width="22" height="22" aria-hidden="true">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              <span>{{ $t('login.btnMicrosoft') }}</span>
            </button>

            <!-- 按钮 2：Google（白底 + 标准 G 标） -->
            <button class="sso-btn sso-btn-g" @click="handleExternalLogin('google')">
              <!-- Google 官方「G」标（inline SVG，四色标准配色） -->
              <svg class="sso-logo" viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{{ $t('login.btnGoogle') }}</span>
            </button>

            <!-- 外部通用入口提示（i18n：供非 TUS 的合作研究者或被试使用） -->
            <p class="domain-hint">{{ $t('login.extHint') }}</p>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- ============ 全屏 Loading 遮罩（模拟跳转认证中心） ============ -->
    <div v-if="ssoLoading" class="sso-overlay" role="status">
      <div class="overlay-inner">
        <el-icon class="overlay-spin is-loading"><Loading /></el-icon>
        <p class="overlay-text">
          {{
            ssoProvider === 'microsoft'
              ? $t('login.loadingMicrosoft')
              : $t('login.loadingGoogle')
          }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: linear-gradient(160deg, #eef2ff 0%, #f8f9ff 45%, #f0fdfa 100%);
}

/* ---------- 左侧品牌区 ---------- */
.login-brand {
  padding: 80px 64px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.brand-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}
.brand-logo {
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #4f46e5, #7c6ff0);
  box-shadow: 0 10px 24px rgba(79, 70, 229, 0.32);
}
.brand-title {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
}
.brand-sub {
  font-size: 13px;
  color: #9ca3af;
  letter-spacing: 1px;
}
.brand-slogan {
  font-size: 20px;
  line-height: 1.6;
  color: #374151;
  margin: 0 0 32px;
}
.brand-slogan b {
  color: #4f46e5;
}
.brand-points {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.brand-points li {
  font-size: 15px;
  color: #4b5563;
  background: rgba(255, 255, 255, 0.7);
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid rgba(229, 231, 235, 0.8);
}

/* ---------- 右侧登录区 ---------- */
.login-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 60px 72px;
  gap: 14px;
}
.panel-title {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}
.panel-desc {
  font-size: 14px;
  color: #9ca3af;
  margin: 0 0 8px;
}
.sso-hint {
  font-size: 13.5px;
  color: #4b5563;
  margin: 0;
}

/* ---------- 双入口标签页（el-tabs） ---------- */
.login-tabs {
  margin-top: 6px;
}
/* 标签页文字略加大加粗，突出「双入口隔离」语义 */
.login-tabs :deep(.el-tabs__item) {
  font-size: 14.5px;
  font-weight: 600;
}
/* 每个入口区域内部：按钮纵向排列 + 底部提示语 */
.tab-pane-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 8px;
}

/* ---------- SSO 大按钮（原生 button，避免 el-button 对第三方品牌色的限制） ---------- */
.sso-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  min-height: 52px;
  border-radius: 12px;
  font-size: 15.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
  border: 1px solid transparent;
}
.sso-btn:hover {
  transform: translateY(-1px);
}
.sso-btn:active {
  transform: translateY(0);
}
.sso-logo {
  flex: none;
  display: block;
}

/* Microsoft —— 黑底白字（符合 MS 深色 SSO 按钮惯例） */
.sso-btn-ms {
  background: #111827;
  color: #fff;
  box-shadow: 0 8px 20px rgba(17, 24, 39, 0.22);
}
.sso-btn-ms:hover {
  background: #1f2937;
  box-shadow: 0 12px 26px rgba(17, 24, 39, 0.3);
}

/* Google —— 白底深灰字 + 细边框（Google 官方 SSO 按钮惯例） */
.sso-btn-g {
  background: #fff;
  color: #3c4043;
  border-color: #dadce0;
  box-shadow: 0 4px 14px rgba(60, 64, 67, 0.08);
}
.sso-btn-g:hover {
  box-shadow: 0 8px 20px rgba(60, 64, 67, 0.14);
}

/* 入口限制/用途提示小字（两区共用样式） */
.domain-hint {
  font-size: 12px;
  line-height: 1.6;
  color: #9ca3af;
  margin: 4px 0 0;
}

/* ---------- 全屏 Loading 遮罩 ---------- */
.sso-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(248, 249, 252, 0.92);
  backdrop-filter: blur(3px);
}
.overlay-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 36px 52px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 18px 48px rgba(17, 24, 39, 0.1);
}
.overlay-spin {
  font-size: 40px;
  color: #4f46e5;
}
.overlay-text {
  margin: 0;
  font-size: 15px;
  color: #374151;
  font-weight: 500;
}

/* 小屏适配 */
@media (max-width: 960px) {
  .login-page {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
  .login-brand {
    padding: 48px 32px;
  }
  .login-panel {
    padding: 32px;
  }
}
</style>
