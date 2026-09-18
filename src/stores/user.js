import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { mockSubjects } from '@/mocks/subjects'
import i18n, { pickLocalized } from '@/i18n' // Step 16：姓名择优渲染（store 在 setup 外，用 i18n.global.locale）

/**
 * 用户 / 角色状态管理（Pinia Setup Store）
 *
 * 本平台的「核心机制」之一是角色分离：
 *  - student   学生端（被试）：浏览实验、报名、查看参与记录
 *  - researcher 研究者端（管理员）：发布实验、管理被试池、信誉分加减
 *
 * 纯前端演示阶段，这里仅维护「当前登录的是哪个角色、哪个人」，
 * 完整的被试数据（信誉分等）会在后续步骤由独立的 subjects store 承接。
 *
 * 【Step 11 新增】会话持久化：
 *  登录成功后把 { token, role, id } 写入 localStorage（key: actmind.session），
 *  应用启动时（store 首次初始化）自动从 localStorage 恢复会话。
 *  路由守卫（router/index.js）即依赖此机制读取「当前 token / userRole」。
 *  注意：演示环境的 token 是伪造的（mock-token-*），不代表任何真实鉴权。
 */

/** localStorage 会话存储键（与 i18n 的 actmind.locale 保持同一前缀规范） */
const SESSION_KEY = 'actmind.session'

export const useUserStore = defineStore('user', () => {
  /** 当前角色：'student' | 'researcher' | null（null 表示未登录） */
  const role = ref(null)

  /** 当前登录的学生身份对象 */
  const student = ref(null)

  /** 当前登录的研究者身份对象 */
  const researcher = ref(null)

  /** Step 14：SSO 授权邮箱（如 student@ed.tus.ac.jp）；账号密码时代为 null */
  const ssoEmail = ref(null)

  /* ---------------------- 会话持久化（Step 11） ---------------------- */

  /**
   * 把当前会话写入 localStorage（登出时清除）。
   * 存储结构：{ token, role, id } —— 路由守卫据此判断登录态与角色。
   * 全部包在 try/catch 中：隐私模式下 localStorage 不可用也不影响功能。
   */
  function persistSession() {
    try {
      if (!role.value) {
        localStorage.removeItem(SESSION_KEY)
        return
      }
      const current =
        role.value === 'student' ? student.value : researcher.value
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          // 演示用伪造 token：真实项目此处应为后端签发的 JWT 等凭证
          token: `mock-token-${role.value}-${current?.id ?? 'anonymous'}`,
          role: role.value,
          id: current?.id ?? null,
          // Step 14：SSO 已验证的教育邮箱（账号密码时代不存在此字段）
          email: ssoEmail.value ?? null,
        }),
      )
    } catch {
      /* localStorage 不可用时静默降级（会话仅存在于内存） */
    }
  }

  /**
   * 从 localStorage 恢复会话（store 初始化时调用一次）。
   * 只认「角色 + id」能对上 Mock 名单的合法会话，脏数据直接丢弃。
   */
  function restoreSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return
      const s = JSON.parse(raw)
      if (s?.role === 'student' && s?.id) {
        loginAsStudent(s.id)
      } else if (s?.role === 'researcher' && s?.id) {
        loginAsResearcher(s.id)
      } else {
        // 会话结构非法：清理，避免脏数据反复触发恢复逻辑
        localStorage.removeItem(SESSION_KEY)
      }
    } catch {
      /* JSON 损坏或存储不可用：按未登录处理 */
    }
  }

  /* ------------------------------------------------------------
   * 模拟登录候选名单（Mock）
   * 说明：这里故意放了几名信誉分不同的学生，方便后续在「实验大厅」
   * 验证「定向分发/信誉分过滤」逻辑时，能直观看到不同分数的差异。
   * 真实分数将在 subjects store 中维护，此处仅用于登录选择。
   * ---------------------------------------------------------- */
  // 学生候选名单：直接由被试库 Mock 数据派生，保证「姓名/专业/信誉分」同源一致
  const studentOptions = mockSubjects.map((s) => ({
    id: s.id,
    name: s.name,
    // Step 13：专业/年级存 i18n 键值路径，由视图侧 $t() 动态翻译（数据层不写死任何语言文案）
    majorKey: s.majorKey,
    gradeKey: s.gradeKey,
    // 仅用于登录页展示的定性标签（语义 key，登录页按 login.tag* 翻译），绝不展示具体分数
    tag:
      s.reputation >= 90 ? 'tagHigh' : s.reputation >= 70 ? 'tagMid' : 'tagPending',
  }))

  // Step 16：研究者姓名同为 {zh,ja,en} 多语言对象（中文名：日语片假名 / 英语拼音）
  const researcherOptions = [
    { id: 'res_001', name: { zh: '顾言', ja: 'ゴ・エン', en: 'Gu Yan' }, title: '行为经济学实验室 · PI' },
    { id: 'res_002', name: { zh: '沈知', ja: 'シン・ジ', en: 'Shen Zhi' }, title: '认知心理学 · 研究助理' },
  ]

  /* ---------------------- 派生状态 ---------------------- */
  const isLoggedIn = computed(() => role.value !== null)
  const isStudent = computed(() => role.value === 'student')
  const isResearcher = computed(() => role.value === 'researcher')

  /** 当前展示的名字（导航栏头像处使用）
   *  Step 16：name 为 {zh,ja,en} 对象，按当前界面语言择优取显示文本 */
  const displayName = computed(() =>
    pickLocalized(
      role.value === 'student' ? student.value?.name : researcher.value?.name,
      i18n.global.locale.value,
    ),
  )


  /* 角色标签统一由组件侧经 i18n（role.student / role.researcher）翻译，
     此处不再硬编码中文，避免多语言环境下出现残留中文。 */

  /* ---------------------- 行为动作 ---------------------- */

  /** 以学生身份登录（可指定 id，默认取第一位）；成功后持久化会话 */
  function loginAsStudent(id = studentOptions[0].id) {
    const target =
      studentOptions.find((s) => s.id === id) || studentOptions[0]
    role.value = 'student'
    student.value = { ...target }
    researcher.value = null
    persistSession()
  }

  /** 以研究者身份登录（可指定 id，默认取第一位）；成功后持久化会话 */
  function loginAsResearcher(id = researcherOptions[0].id) {
    const target =
      researcherOptions.find((r) => r.id === id) || researcherOptions[0]
    role.value = 'researcher'
    researcher.value = { ...target }
    student.value = null
    persistSession()
  }

  /** 统一的「切换角色」入口，供导航栏下拉菜单调用 */
  function switchRole(target) {
    if (target === 'student') loginAsStudent()
    else if (target === 'researcher') loginAsResearcher()
  }

  /**
   * Step 14：OAuth 2.0 / OIDC 单点登录（模拟）
   *
   * 真实流程：授权码模式（Authorization Code + PKCE），由后端换取
   * id_token / access_token 并签发本站会话；前端只接收最终会话。
   * 演示流程：LoginView 在模拟 1.5s 跳转后调用本方法，
   *  1) 以学生/研究者 Mock 名单第一位作为已验证身份（保证与
   *     被试库 Mock 数据同源，定向分发逻辑可继续演示）；
   *  2) 记录 SSO 邮箱（ssoEmail），供导航栏展示已验证的学术身份。
   *
   * 注意：邮箱域名白名单校验在 LoginView（视图层）完成，
   * 校验不通过时本方法根本不会被调用，Token 也不会写入。
   *
   * @param {'student'|'researcher'} role   登录入口对应的角色
   * @param {string} email                  模拟 OAuth 回调回传的教育邮箱
   */
  function loginWithSso(role, email) {
    if (role === 'student') loginAsStudent()
    else loginAsResearcher()
    ssoEmail.value = email
    persistSession()
  }

  /** 退出登录，清空角色与身份，并清除 localStorage 会话 */
  function logout() {
    role.value = null
    student.value = null
    researcher.value = null
    ssoEmail.value = null
    persistSession()
  }

  // 【Step 11】store 首次初始化时尝试从 localStorage 恢复会话（刷新页面不掉线）
  restoreSession()

  // 【Step 14】若会话中携带了 SSO 邮箱，一并恢复（刷新后导航栏仍可展示已验证邮箱）
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      if (s?.token && s.email) ssoEmail.value = s.email
    }
  } catch {
    /* ignore */
  }

  return {
    // state
    role,
    student,
    researcher,
    ssoEmail,
    studentOptions,
    researcherOptions,
    // getters
    isLoggedIn,
    isStudent,
    isResearcher,
    displayName,
    // actions
    loginAsStudent,
    loginAsResearcher,
    loginWithSso,
    switchRole,
    logout,
  }
})
