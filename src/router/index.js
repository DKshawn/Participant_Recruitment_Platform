import { createRouter, createWebHistory } from 'vue-router'
import i18n from '@/i18n' // 路由守卫在 setup 之外执行，必须用全局实例（useI18n() 会在 setup 外抛错）
import { useUserStore } from '@/stores/user'

import MainLayout from '@/layout/MainLayout.vue'
import LoginView from '@/views/LoginView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import PlaceholderView from '@/views/PlaceholderView.vue'
import HallView from '@/views/student/HallView.vue'
import StudentWallet from '@/views/student/StudentWallet.vue'
import PublishView from '@/views/researcher/PublishView.vue'
import PoolView from '@/views/researcher/PoolView.vue'

/**
 * 各端「首页」映射：已登录用户访问登录页时据此纠正回自己的工作台
 */
const roleHome = {
  student: '/student/hall',
  researcher: '/researcher/publish',
}

/**
 * ============================================================================
 * 路由表（Step 11：路由安全重构）
 * ----------------------------------------------------------------------------
 * 结构说明：
 *  - /                    通用门户 = 学生登录页（唯一对外暴露的登录入口）
 *  - /admin-auth-secure   研究者登录入口（动态且隐蔽的路径，学生侧界面无任何指向）
 *  - /login               旧地址兜底：重定向到 /（保护老书签，不再渲染任何内容）
 *  - /student/*           学生端外壳（MainLayout），3 个子页面
 *  - /researcher/*        研究者端外壳（MainLayout），4 个子页面
 *  - /:pathMatch(.*)*     伪装 404 页（NotFoundView）：未知路径与越权拦截的统一落地
 *
 * 安全设计（详见下方全局守卫）：
 *  1. 白名单：未登录用户只能访问两个登录页与 404 页，其余路径一律回 /；
 *  2. 角色越权拦截：学生硬猜研究者 URL（如 /researcher/pool）时，
 *     不弹窗、不提示「无权访问」，直接重定向到一个不可预测的伪装 404 路径
 *     （/404-secure-<时间戳>，落入 catch-all），隐藏后台路由字典的存在；
 *  3. 404 页是 catch-all 本身，路由表中不存在任何显式的 '/404' 条目，
 *     避免 404 URL 本身成为可枚举的字典项。
 *
 * meta 约定：
 *  - meta.public    白名单路由（未登录可访问）
 *  - meta.role      受保护路由要求的角色：'student' | 'researcher'
 *  - meta.requiresAuth  语义标记：该路由需要登录（守卫以 role 为准做判定）
 *  - meta.i18nKey   浏览器标签页标题使用的 i18n key（随语言实时翻译）
 * ============================================================================
 */
const routes = [
  /* ---------- 旧登录地址兜底：一律重定向到通用门户 ---------- */
  {
    path: '/login',
    redirect: '/',
  },

  /* ---------- 通用门户：学生登录页（未登录用户的唯一首页） ---------- */
  {
    path: '/',
    name: 'StudentPortal',
    component: LoginView,
    props: { mode: 'student' },
    meta: {
      public: true,
      requiresAuth: false,
      title: '学生门户',
      i18nKey: 'login.studentCard',
    },
  },

  /* ---------- 研究者登录入口：隐蔽路径（学生侧界面无任何链接指向这里） ---------- */
  {
    path: '/admin-auth-secure',
    name: 'ResearcherAuth',
    component: LoginView,
    props: { mode: 'researcher' },
    meta: {
      public: true,
      requiresAuth: false,
      title: '研究者入口',
      i18nKey: 'login.researcherCard',
    },
  },

  /* ---------- 学生端（MainLayout 外壳 + 3 个子页面） ---------- */
  {
    path: '/student',
    component: MainLayout,
    redirect: '/student/hall',
    meta: { requiresAuth: true, role: 'student' },
    children: [
      {
        path: 'hall',
        name: 'StudentHall',
        component: HallView,
        meta: {
          requiresAuth: true,
          role: 'student',
          title: '实验大厅',
          i18nKey: 'menu.hall',
        },
      },
      {
        // Step 12：积分钱包（学生端 PayPay 积分兑换中心）
        path: 'wallet',
        name: 'StudentWallet',
        component: StudentWallet,
        meta: {
          requiresAuth: true,
          role: 'student',
          title: '积分钱包',
          i18nKey: 'menu.wallet',
        },
      },
      {
        path: 'records',
        name: 'StudentRecords',
        component: PlaceholderView,
        meta: {
          requiresAuth: true,
          role: 'student',
          title: '我的参与记录',
          i18nKey: 'menu.records',
        },
      },
      {
        path: 'profile',
        name: 'StudentProfile',
        component: PlaceholderView,
        meta: {
          requiresAuth: true,
          role: 'student',
          title: '个人中心',
          i18nKey: 'menu.profile',
        },
      },
    ],
  },

  /* ---------- 研究者端（MainLayout 外壳 + 4 个子页面） ---------- */
  {
    path: '/researcher',
    component: MainLayout,
    redirect: '/researcher/publish',
    meta: { requiresAuth: true, role: 'researcher' },
    children: [
      {
        path: 'publish',
        name: 'ResearcherPublish',
        component: PublishView,
        meta: {
          requiresAuth: true,
          role: 'researcher',
          title: '发布新实验',
          i18nKey: 'publish.title',
        },
      },
      {
        path: 'manage',
        name: 'ResearcherManage',
        component: PlaceholderView,
        meta: {
          requiresAuth: true,
          role: 'researcher',
          title: '实验管理',
          i18nKey: 'menu.manage',
        },
      },
      {
        path: 'pool',
        name: 'ResearcherPool',
        component: PoolView,
        meta: {
          requiresAuth: true,
          role: 'researcher',
          title: '被试池管理',
          i18nKey: 'pool.title',
        },
      },
      {
        path: 'review',
        name: 'ResearcherReview',
        component: PlaceholderView,
        meta: {
          requiresAuth: true,
          role: 'researcher',
          title: '评分与审核',
          i18nKey: 'menu.review',
        },
      },
    ],
  },

  /* ---------- 伪装 404：catch-all 直接渲染 NotFoundView ----------
     说明：不设置显式 '/404' 路由，越权拦截时重定向到
     '/404-secure-<时间戳>' 这类不可预测路径，由本规则兜住。 */
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFoundView,
    meta: {
      public: true,
      requiresAuth: false,
      title: '404',
      i18nKey: 'notFound.title',
    },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * ============================================================================
 * 全局前置守卫（Step 11：登录白名单 + 角色越权伪装 404）
 * ----------------------------------------------------------------------------
 * 判定顺序（命中即返回，短路后续规则）：
 *
 *  ① 未登录：
 *     - 目标在白名单（meta.public === true，即两个登录页 / 404 页）→ 放行；
 *     - 否则 → 一律重定向回 /（通用门户）。
 *       注意：这里绝不提示「请先登录」，也不区分目标是学生页还是研究者页，
 *       学生硬猜 /researcher/pool 只会看到「回到门户」，无任何越权线索。
 *
 *  ② 已登录却访问登录页（404 页除外）：
 *     - 直接纠正到自己角色的首页（roleHome），避免在门户上重复登录。
 *
 *  ③ 【核心拦截】角色越权：
 *     - 目标路由声明了 meta.role 且与当前 user.role 不一致
 *       （典型：学生硬猜 /researcher/pool，或研究者访问 /student/hall）；
 *     - 处理：不弹窗、不提示「无权访问」，直接重定向到伪装 404 路径
 *       '/404-secure-<时间戳>'（落入 catch-all → NotFoundView）。
 *       使用带时间戳的随机化路径，使 404 的 URL 不可预测、不可分享复用，
 *       进一步隐藏路由字典。
 *
 *  ④ 其余情况放行。
 *
 * 会话来源：useUserStore() —— 该 Pinia store 在初始化时已从
 * localStorage（actmind.session：{ token, role, id }）水合，
 * 满足「从 localStorage 或状态管理库读取 token 与 userRole」的要求。
 * ============================================================================
 */
router.beforeEach((to) => {
  // —— 0) 更新浏览器标签页标题（随当前语言实时翻译）——
  const t = i18n.global.t
  const appTitle = t('app.name')
  const pageTitle = to.meta?.i18nKey ? t(to.meta.i18nKey) : to.meta?.title
  document.title = pageTitle ? `${pageTitle} · ${appTitle}` : appTitle

  const user = useUserStore()
  const isPublic = to.meta?.public === true

  // ① 未登录：白名单放行，其余一律回通用门户（不区分目标角色，零提示）
  if (!user.isLoggedIn) {
    return isPublic ? true : { path: '/' }
  }

  // ② 已登录访问登录页：纠正到自己角色的首页（404 页除外，允许停留）
  if (isPublic && to.name !== 'NotFound') {
    return { path: roleHome[user.role] }
  }

  // ③ 角色越权：伪装 404（无弹窗、无「无权访问」提示，隐藏路由字典）
  const requiredRole = to.meta?.role
  if (requiredRole && requiredRole !== user.role) {
    return { path: `/404-secure-${Date.now()}` }
  }

  // ④ 放行
  return true
})

export default router
