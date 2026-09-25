import { createI18n } from 'vue-i18n'
import backend from './backend'
import schedule from './schedule'
import zh from './locales/zh'
import en from './locales/en'
import ja from './locales/ja'

/**
 * 国际化（i18n）初始化
 *
 * - 支持三种语言：简体中文 zh-CN / English en-US / 日本語 ja-JP
 * - legacy: false  → 使用 Vue 3 Composition API 模式
 * - globalInjection: true → 模板中可直接使用 $t / $te 等全局方法
 * - 语言偏好持久化到 localStorage，刷新后仍保持
 * - 切换语言为响应式，整个应用实时生效，无需刷新
 */
const STORAGE_KEY = 'actmind.locale'
const SUPPORTED = ['zh-CN', 'en-US', 'ja-JP']

/**
 * 语言前缀映射表：
 * 浏览器语言标签形如 'zh-CN' / 'ja-JP' / 'en-US' / 'en-GB' / 'zh-HK'…
 * 按「基础语言前缀」匹配到本系统支持的语言，避免精确匹配失败。
 */
const PREFIX_MAP = [
  { prefix: 'zh', locale: 'zh-CN' },
  { prefix: 'ja', locale: 'ja-JP' },
  { prefix: 'en', locale: 'en-US' },
]

/**
 * 将任意语言标签（如 'zh-TW'、'ja'、'en-GB'）映射到支持的语言；
 * 无法映射时返回 null。
 * @param {string} lang 语言标签
 * @returns {'zh-CN'|'ja-JP'|'en-US'|null}
 */
function mapBrowserLang(lang) {
  if (!lang) return null
  const base = String(lang).split(/[-_]/)[0].toLowerCase()
  const hit = PREFIX_MAP.find((m) => m.prefix === base)
  return hit ? hit.locale : null
}

/**
 * 初始语言解析（问题 1 核心）：
 *  1. 优先读取 localStorage 中保存的用户偏好；
 *  2. 其次遍历 navigator.languages（完整偏好数组）与 navigator.language，
 *     按语言前缀（zh→zh-CN / ja→ja-JP / en→en-US）映射；
 *  3. 均不匹配时，默认回退到 'en-US'（学术环境通用性最强）。
 */
function resolveInitialLocale() {
  // 1) 用户手动选择过的语言（Navbar 切换时由 setLocale 持久化）
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && SUPPORTED.includes(saved)) return saved
  } catch {
    /* localStorage 不可用（如隐私模式）时忽略 */
  }
  // 2) 浏览器语言：languages 数组优先（按用户偏好顺序），再兜底 language
  try {
    const candidates = [...(navigator.languages || []), navigator.language]
    for (const lang of candidates) {
      const mapped = mapBrowserLang(lang)
      if (mapped) return mapped
    }
  } catch {
    /* navigator 不可用时忽略 */
  }
  // 3) 回退语言
  return 'en-US'
}

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: resolveInitialLocale(),
  fallbackLocale: 'en-US',
  // 生产环境关闭未翻译 key 的告警噪音（演示用）
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    'zh-CN': { ...zh, backend: backend['zh-CN'], schedule: schedule['zh-CN'] },
    'en-US': { ...en, backend: backend['en-US'], schedule: schedule['en-US'] },
    'ja-JP': { ...ja, backend: backend['ja-JP'], schedule: schedule['ja-JP'] },
  },
})

/**
 * 切换语言（响应式 + 持久化 + 更新 <html lang>）
 * @param {string} loc 'zh-CN' | 'en-US' | 'ja-JP'
 */
function setLocale(loc) {
  if (!SUPPORTED.includes(loc)) return
  i18n.global.locale.value = loc
  try {
    localStorage.setItem(STORAGE_KEY, loc)
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = loc
  }
}

export const SUPPORTED_LOCALES = SUPPORTED

/**
 * 取语言标签的基础前缀（'zh-CN' → 'zh'），用于多语言内容对象的键匹配
 */
export function localeBase(loc) {
  return (loc || '').split(/[-_]/)[0].toLowerCase() || 'en'
}

/**
 * 从多语言内容对象中「择优」取当前语言文本：
 *  - 支持旧数据结构（直接字符串，原样返回），保证 Mock 数据兼容
 *  - 取数顺序：当前界面语言 → zh → en → ja，返回第一个非空内容
 * @param {string|{zh:string, en:string, ja:string}} loc 内容（字符串或对象）
 * @param {string} locale 当前界面语言（'zh-CN' 等）
 */
export function pickLocalized(loc, locale) {
  if (loc == null) return ''
  if (typeof loc === 'string') return loc // 兼容旧数据 / Mock 纯字符串
  const ordered = ['zh', 'en', 'ja'].filter(
    (v, i, a) => a.indexOf(v) === i,
  )
  // 将当前界面语言排到最前（去重）
  const base = localeBase(locale)
  ordered.unshift(base)
  for (const k of ordered) {
    if (loc[k] && String(loc[k]).trim()) return loc[k]
  }
  return ''
}

export { setLocale }
export default i18n
