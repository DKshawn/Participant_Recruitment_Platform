<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import i18n, { localeBase } from '@/i18n'

/**
 * MultiLangTagSelect —— 局部多语言标签选择器（Step 9）
 *
 * 解决的痛点：
 *  全局界面语言为中文时，研究者仍可为实验分别打上「中文 / 英文 / 日文」三套标签。
 *
 * 核心设计：
 *  1. 数据结构：v-model 绑定 { zh: [], en: [], ja: [] }（每种语言一个标签数组）
 *  2. 局部语言状态 activeLang：
 *     - 初始化时跟随系统当前界面语言（localeBase('zh-CN') → 'zh'）；
 *     - 之后【完全独立】——切换 activeLang 只改本组件状态，
 *       绝不触碰 i18n.global.locale（全局界面语言保持不变）。
 *  3. 选项翻译：本版本 vue-i18n 的 t() 不支持按次指定语言，
 *     改用 i18n.global.getLocaleMessage(locale) 只读获取目标语言的字典树
 *     （纯读取操作，对全局语言状态零副作用），
 *     由 computed 根据 activeLang 实时提取备选项。
 *  4. 预定义标签存「稳定 key」（如 behavioralEconomics），自由输入存原文；
 *     切换语言时，各语言的已选内容互不干扰，只影响 tags[activeLang]。
 */
const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ zh: [], en: [], ja: [] }),
  },
})
const emit = defineEmits(['update:modelValue'])

/* 只从全局 i18n「读取」当前语言用于初始化，之后不再依赖全局状态 */
const { t, locale } = useI18n()

/* 三种可填写语言（标签用各语言母语简称，本身无需翻译） */
const LANGS = [
  { code: 'zh', label: '中' },
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日' },
]
/* 语言基础码 → i18n 字典 locale 键 */
const LOCALE_MAP = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP' }

/* 预定义标签的稳定 key（顺序固定；文案按 activeLang 从字典提取） */
const TAG_KEYS = [
  'behavioralEconomics',
  'cognitivePsychology',
  'decisionScience',
  'neuroscience',
  'gameTheory',
  'socialPreferences',
  'cooperation',
  'longitudinal',
]

/* ---------------------- 局部语言状态（核心） ---------------------- */
/* 默认 = 系统当前界面语言；此后与全局 i18n 彻底解耦 */
const activeLang = ref(localeBase(locale.value))

/* ---------------------- 按 activeLang 实时提取备选项 ---------------------- */
/* getLocaleMessage(locale)：只读获取「目标语言」的字典树，
   即使全局界面是中文，activeLang='ja' 时也能正确取出日文选项 */
const activeDict = computed(
  () => i18n.global.getLocaleMessage(LOCALE_MAP[activeLang.value]) || {},
)

const presetOptions = computed(() => {
  const dict = activeDict.value.publish?.tagOptions || {}
  return TAG_KEYS.map((k) => ({ key: k, label: dict[k] || k }))
})

/* 占位文案也跟随 activeLang（界面 chrome 用全局 t 亦可，这里跟随局部语言更一致） */
const placeholder = computed(() => activeDict.value.publish?.tagsPh || '')

/* ---------------------- 双向绑定：只读写 tags[activeLang] ---------------------- */
const selected = computed({
  get: () => props.modelValue?.[activeLang.value] || [],
  set: (val) => {
    emit('update:modelValue', {
      ...props.modelValue,
      [activeLang.value]: val || [],
    })
  },
})

/* ---------------------- 各语言填写情况（指示点 + 提示） ---------------------- */
const isFilled = (code) => (props.modelValue?.[code] || []).length > 0
const filledCount = computed(
  () => ['zh', 'en', 'ja'].filter(isFilled).length,
)
</script>

<template>
  <div class="mlt">
    <!-- 头部：填写进度提示 + 局部语言切换器（只影响 activeLang，不改全局语言） -->
    <div class="mlt-head">
      <span class="mlt-hint" :class="{ 'is-done': filledCount >= 3 }">
        {{ t('common.langProgress', { n: filledCount }) }}
      </span>
      <el-radio-group v-model="activeLang" size="small">
        <el-radio-button
          v-for="l in LANGS"
          :key="l.code"
          :value="l.code"
        >
          {{ l.label }}
          <!-- 该语言已有标签的指示小圆点 -->
          <i v-if="isFilled(l.code)" class="filled-dot" />
        </el-radio-button>
      </el-radio-group>
    </div>

    <!-- 标签选择框：
         - multiple + filterable + allow-create：可多选、可搜索、可手动输入创建新标签
         - reserve-keyword：连续创建多个自创标签时保留搜索关键字
         - 选项 label 按 activeLang 翻译；已选 chip 显示 tags[activeLang] 的内容 -->
    <el-select
      v-model="selected"
      multiple
      filterable
      allow-create
      default-first-option
      reserve-keyword
      clearable
      :placeholder="placeholder"
      class="mlt-select"
    >
      <el-option
        v-for="opt in presetOptions"
        :key="opt.key"
        :label="opt.label"
        :value="opt.key"
      />
    </el-select>
  </div>
</template>

<style scoped>
.mlt {
  width: 100%;
}

/* 头部：提示与切换器左右分布，窄屏自动换行不挤压 */
.mlt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.mlt-hint {
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
}
.mlt-hint.is-done {
  color: var(--el-color-success);
}

/* 已填语言的指示点 */
.filled-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin-left: 5px;
  border-radius: 50%;
  background: var(--el-color-success);
}

.mlt-select {
  width: 100%;
}
</style>