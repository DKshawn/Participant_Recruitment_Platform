<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { localeBase } from '@/i18n'

/**
 * MultiLangInput —— 多语言输入组件（问题 3 核心）
 *
 * 设计目标：
 *  - 支持「实验标题 / 描述」等由研究者自由填写、无法预先翻译的动态内容
 *  - 数据结构：{ zh: '', en: '', ja: '' }（v-model 双向绑定整个对象）
 *  - 界面上【不同时平铺三个输入框】，而是在字段头部放置一个迷你语言切换器
 *    （el-radio-button：中 / EN / 日），点击某语言后才展示对应输入框
 *  - 默认展示「当前系统界面语言」；切换界面语言时自动跟随跳转
 *  - 已填写的语言标签上显示小圆点，并展示「已填 n/3 种语言」进度
 *
 * Props：
 *  - modelValue  {zh,en,ja} 多语言内容对象
 *  - type        'text' | 'textarea'
 *  - rows        textarea 行数
 *  - maxlength / showWordLimit  字数限制（按当前激活语言分别限制）
 *  - placeholder 占位文案（父级传入已翻译的字符串）
 */
const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ zh: '', en: '', ja: '' }),
  },
  type: { type: String, default: 'text' }, // 'text' | 'textarea'
  rows: { type: Number, default: 4 },
  maxlength: { type: [Number, String], default: undefined },
  showWordLimit: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const { t, locale } = useI18n()

/* 三种可填写语言：标签使用各语言的「母语简称」，本身无需翻译字典 */
const LANGS = [
  { code: 'zh', label: '中' },
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日' },
]

/* 当前激活语言：默认跟随界面语言（'zh-CN' → 'zh'） */
const active = ref(localeBase(locale.value))

/* 界面语言切换时，字段自动跳转到对应语言标签 */
watch(locale, (v) => {
  active.value = localeBase(v)
})

/* 当前激活语言的文本：双向绑定 modelValue 对象 */
const text = computed({
  get: () => props.modelValue?.[active.value] || '',
  set: (val) => {
    emit('update:modelValue', { ...props.modelValue, [active.value]: val })
  },
})

/* 已填写（去除首尾空白后非空）的语言数量，用于进度提示 */
const filledCount = computed(
  () =>
    ['zh', 'en', 'ja'].filter((k) =>
      String(props.modelValue?.[k] || '').trim(),
    ).length,
)
const isFilled = (code) => Boolean(String(props.modelValue?.[code] || '').trim())
</script>

<template>
  <div class="ml-input">
    <!-- 头部：迷你语言切换器 + 填写进度 -->
    <div class="ml-head">
      <el-radio-group v-model="active" size="small">
        <el-radio-button
          v-for="l in LANGS"
          :key="l.code"
          :value="l.code"
        >
          {{ l.label }}
          <!-- 已填写语言的指示小圆点 -->
          <i v-if="isFilled(l.code)" class="filled-dot" />
        </el-radio-button>
      </el-radio-group>
      <span class="ml-progress" :class="{ 'is-done': filledCount >= 3 }">
        {{ t('common.langProgress', { n: filledCount }) }}
      </span>
    </div>

    <!-- 输入区：仅渲染当前激活语言的输入框 -->
    <el-input
      v-if="type === 'textarea'"
      v-model="text"
      type="textarea"
      :rows="rows"
      :maxlength="maxlength"
      :show-word-limit="showWordLimit"
      :placeholder="placeholder"
      clearable
    />
    <el-input
      v-else
      v-model="text"
      :maxlength="maxlength"
      :show-word-limit="showWordLimit"
      :placeholder="placeholder"
      clearable
    />
  </div>
</template>

<style scoped>
.ml-input {
  width: 100%;
}

/* 头部：切换器与进度左右分布，窄屏自动换行不挤压 */
.ml-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

/* 已填写语言的指示点 */
.filled-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin-left: 5px;
  border-radius: 50%;
  background: var(--el-color-success);
}

.ml-progress {
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
}
.ml-progress.is-done {
  color: var(--el-color-success);
}
</style>