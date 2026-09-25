<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  EditPen,
  Location,
  Aim,
  Promotion,
  RefreshLeft,
  InfoFilled,
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useSubjectStore } from '@/stores/subject'
import { useExperimentStore } from '@/stores/experiment'
import { pickLocalized, localeBase } from '@/i18n'
import MultiLangInput from '@/components/MultiLangInput.vue'
import MultiLangTagSelect from '@/components/MultiLangTagSelect.vue'

/**
 * 研究者端 · 发布新实验
 *
 * 功能：
 *  - 基础表单：标题 / 描述 / 地点（线上链接 或 线下实验室）/ 时长 / 招募人数 / 报酬
 *  - 【核心】数据质量要求控制：用「滑动条 + 预设档位」设置该实验的
 *    「最低信誉分要求」，并实时预览当前被试池中有多少人被试达标
 *  - 必填项校验（el-form rules + 条件校验）
 */
const router = useRouter()
const user = useUserStore()
const subjectStore = useSubjectStore()
const experimentStore = useExperimentStore()
const { t, locale } = useI18n() // i18n：script 内使用 t()，模板内使用 $t()

const formRef = ref(null)
const submitting = ref(false)
onMounted(async () => {
  try { await subjectStore.load('researcher') } catch (error) { ElMessage.error(error.message) }
})

/* Step 16：发布者（研究者）姓名同为 {zh,ja,en} 对象，按当前界面语言择优展示 */
const publisherName = computed(
  () => pickLocalized(user.researcher?.name, locale.value) || t('common.researcher'),
)

/* ---------------------- 表单数据 ---------------------- */
const form = reactive({
  // 【问题 3】标题/描述改为多语言对象：研究者可为 zh/en/ja 分别填写，
  // 由 MultiLangInput 组件以「迷你语言切换器」形式录入，不同时平铺三个输入框
  title: { zh: '', en: '', ja: '' }, // 实验标题（多语言）
  description: { zh: '', en: '', ja: '' }, // 实验描述（多语言）
  // 【Step 9】标签升级为多语言结构：每种语言一个标签数组，
  // 由 MultiLangTagSelect 的「局部语言切换器」分语言录入（不影响全局界面语言）
  tags: { zh: [], en: [], ja: [] },
  // 【Step 10】地点拆分为三个独立字段：类型 + 线上链接 + 线下地址
  // （不再共用一个 locationDetail，避免切换类型时校验状态/文案串扰）
  locationType: 'online', // 地点类型：'online' 线上 | 'offline' 线下
  onlineUrl: '', // 线上实验链接（仅 locationType === 'online' 时必填）
  offlineAddress: '', // 线下实验地点（仅 locationType === 'offline' 时必填）
  // 【Step 15】需携带物品：多语言对象（选填）；学生端按界面语言择优展示，留空显示「无需携带」
  requiredItems: { zh: '', en: '', ja: '' },
  duration: 45, // 实验时长（分钟）
  participants: 20, // 计划招募人数
  reward: 2000, // 实验报酬（积分，Step 12 起 1 积分 = 1 日元）
  minReputation: 0, // 【核心】最低信誉分要求（0~100）
})

/* ---------------------- 多语言标签（Step 9） ---------------------- */
/* 标签下拉已抽离为独立组件 MultiLangTagSelect：
   - 预定义标签 key 列表、按局部语言提取译文、自由输入创建均在组件内部（单一数据源）；
   - 选项 value 存稳定 key，自由输入存原文；
   - 组件的局部语言切换器只改 activeLang，不触碰全局 i18n。

   发布时择优取「最佳语言」标签列表作为展示主数据
   （顺序：当前界面语言 → zh → en → ja，取第一个非空数组）；
   完整三语原文保留在 tagsLocales，供学生端按自身界面语言展示 */
function pickBestTags() {
  const order = ['zh', 'en', 'ja'].filter((v, i, a) => a.indexOf(v) === i)
  order.unshift(localeBase(locale.value))
  for (const k of order) {
    const arr = (form.tags[k] || []).filter(Boolean)
    if (arr.length) return arr
  }
  return []
}

/* ---------------------- 数据质量要求（核心模块） ---------------------- */
// 预设档位：点击即快速设定门槛（key 对应 publish.preset* 字典项，模板内翻译）
const qualityPresets = [
  { key: 'presetUnlimited', value: 0 },
  { key: 'presetBasic', value: 60 },
  { key: 'presetQualified', value: 70 },
  { key: 'presetGood', value: 85 },
  { key: 'presetPremium', value: 90 },
  { key: 'presetTop', value: 98 },
]

// 滑条刻度（marks）——computed 保证切换语言后实时重新翻译
const sliderMarks = computed(() => ({
  0: t('publish.presetUnlimited'),
  60: t('publish.presetBasic'),
  85: t('publish.presetGood'),
  90: t('publish.presetPremium'),
  98: t('publish.presetTop'),
  100: t('publish.markFull'),
}))

// 当前门槛对应的「质量等级」语义 key（徽标 + 文案均由字典翻译，体现严谨性）
const QUALITY_TAG_TYPE = {
  open: 'info',
  basic: 'info',
  qualified: 'primary',
  premium: 'warning',
  top: 'danger',
}
const qualityLevel = computed(() => {
  const v = form.minReputation
  let key = 'top'
  if (v <= 0) key = 'open'
  else if (v < 70) key = 'basic'
  else if (v < 85) key = 'qualified'
  else if (v < 95) key = 'premium'
  return {
    key,
    type: QUALITY_TAG_TYPE[key],
    label: t(`publish.qualityLabel.${key}`),
    text: t(`publish.qualityText.${key}`, { n: v }),
  }
})

// 实时预览：当前被试池中有多少人被试满足该门槛
const totalSubjects = computed(() => subjectStore.list.length)
const eligibleCount = computed(
  () => subjectStore.list.filter((s) => s.reputation >= form.minReputation).length,
)
const eligibleRatio = computed(() =>
  totalSubjects.value
    ? Math.round((eligibleCount.value / totalSubjects.value) * 100)
    : 0,
)

/* ---------------------- 地点校验（Step 10：动态校验修复） ---------------------- */
/**
 * 切换地点类型时的联动处理（核心修复）：
 *  - rules 是 computed，依赖 form.locationType，切换后规则自动重算；
 *  - 但 el-form 不会因类型切换而自动重新校验，上一个状态下挂在
 *    onlineUrl / offlineAddress 上的旧错误（如「请输入线上实验链接」）会残留；
 *    因此切换时主动 clearValidate 清除两个字段的历史报错，
 *    避免出现「选了线下却提示线上必填」的串扰。
 */
function handleLocationTypeChange() {
  formRef.value?.clearValidate(['onlineUrl', 'offlineAddress'])
}

/**
 * 线上链接的轻量格式校验（允许带或不带协议头）；
 * 「是否必填」由 rules 中的条件规则负责，此处只校验「格式」。
 */
function validateOnlineUrl(rule, value, callback) {
  const v = (value || '').trim()
  if (v && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/[\w\-./?%&=]*)?$/i.test(v)
  ) {
    return callback(new Error(t('publish.validation.linkInvalid')))
  }
  callback()
}

/**
 * 【问题 3】多语言字段的通用校验器：
 *  - 至少一种语言非空（对象无法用 el-form 的 required/max 直接校验）
 *  - 已填写的各语言均须落在 [min, max] 区间内
 */
function makeMlValidator(min, max, emptyKey, rangeKey) {
  return (rule, value, callback) => {
    const parts = ['zh', 'en', 'ja']
      .map((k) => String(value?.[k] || '').trim())
      .filter(Boolean)
    if (!parts.length) return callback(new Error(t(emptyKey)))
    if (parts.some((p) => p.length < min || p.length > max)) {
      return callback(new Error(t(rangeKey)))
    }
    callback()
  }
}

// 校验规则：使用 computed，切换语言后错误提示同步更新
const rules = computed(() => ({
  title: [
    {
      required: true,
      validator: makeMlValidator(
        1,
        50,
        'publish.validation.titleMlRequired',
        'publish.validation.titleMax',
      ),
      trigger: 'blur',
    },
  ],
  description: [
    {
      required: true,
      validator: makeMlValidator(
        10,
        300,
        'publish.validation.descMlRequired',
        'publish.validation.descLen',
      ),
      trigger: 'blur',
    },
  ],
  locationType: [
    { required: true, message: t('publish.validation.locationTypeRequired'), trigger: 'change' },
  ],
  /* 【Step 10 动态校验】规则随 locationType 响应式切换（rules 为 computed）：
     - online  → onlineUrl 必填 + 格式校验；offlineAddress 无规则
     - offline → offlineAddress 必填；onlineUrl 无规则
     每个字段只挂自己的错误提示；切换类型时由
     handleLocationTypeChange() 清除另一字段的残留报错 */
  onlineUrl:
    form.locationType === 'online'
      ? [
          {
            required: true,
            message: t('publish.validation.onlineUrlRequired'),
            trigger: 'blur',
          },
          { validator: validateOnlineUrl, trigger: 'blur' },
        ]
      : [],
  offlineAddress:
    form.locationType === 'offline'
      ? [
          {
            required: true,
            message: t('publish.validation.offlineAddressRequired'),
            trigger: 'blur',
          },
        ]
      : [],
  duration: [
    { required: true, message: t('publish.validation.durationRequired'), trigger: 'blur' },
    {
      type: 'number',
      min: 5,
      max: 600,
      message: t('publish.validation.durationRange'),
      trigger: 'blur',
    },
  ],
  participants: [
    { required: true, message: t('publish.validation.participantsRequired'), trigger: 'blur' },
    {
      type: 'number',
      min: 1,
      max: 500,
      message: t('publish.validation.participantsRange'),
      trigger: 'blur',
    },
  ],
  reward: [
    { required: true, message: t('publish.validation.rewardRequired'), trigger: 'blur' },
    { type: 'number', min: 0, message: t('publish.validation.rewardNegative'), trigger: 'blur' },
  ],
}))

/* ---------------------- 动作 ---------------------- */
/** 生成实验编号：NEW-年-随机3位 */
function genCode() {
  const year = new Date().getFullYear()
  const rand = Math.floor(100 + Math.random() * 900)
  return `NEW-${year}-${rand}`
}

/** 发布实验 */
async function handlePublish() {
  if (submitting.value) return
  submitting.value = true
  try {
    await formRef.value.validate()
  } catch {
    submitting.value = false
    ElMessage.error(t('publish.checkFields'))
    return
  }

  // 【问题 3】从多语言对象中择优取「最佳语言」作为展示主文本：
  // 当前界面语言 → 中文 → 英文 → 日文，取第一个非空值（兼容旧字符串数据）
  const bestTitle = pickLocalized(form.title, locale.value).trim()
  const bestDesc = pickLocalized(form.description, locale.value).trim()

  // 二次确认：把核心「质量门槛」在确认框里再提示一次，体现严谨
  const levelText =
    form.minReputation > 0
      ? t('publish.levelLimited', { n: form.minReputation, m: eligibleCount.value })
      : t('publish.levelUnlimited')
  try {
    await ElMessageBox.confirm(
      t('publish.publishConfirm', { name: bestTitle, level: levelText }),
      t('publish.publishConfirmTitle'),
      {
        type: 'warning',
        confirmButtonText: t('publish.publishBtn'),
        cancelButtonText: t('publish.reThink'),
      },
    )
  } catch {
    submitting.value = false
    return // 用户取消
  }

  // 组装实验对象（Step 15：与「实验大厅」JSONB 结构对齐，匹配真实后端列）
  // title / description / required_items 均为 {zh,en,ja} 多语言对象；
  // reward_points / duration_minutes 为数值字段；location_type + location_detail 拆分存储
  const exp = {
    title: { ...form.title },
    description: { ...form.description },
    code: genCode(),
    reward_points: form.reward,
    duration_minutes: form.duration,
    min_reputation_required: form.minReputation,
    location_type: form.locationType,
    // 发布时取当前类型对应的字段，统一落到 location_detail 供下游展示
    location_detail:
      form.locationType === 'online'
        ? (/^https?:\/\//i.test(form.onlineUrl.trim()) ? form.onlineUrl.trim() : `https://${form.onlineUrl.trim()}`)
        : form.offlineAddress.trim(),
    required_items: { ...form.requiredItems },
    slots: { total: form.participants, filled: 0 },
    // 【Step 9】多语言标签：择优主数据 + 完整三语原文
    tags: pickBestTags(),
    tagsLocales: {
      zh: [...(form.tags.zh || [])],
      en: [...(form.tags.en || [])],
      ja: [...(form.tags.ja || [])],
    },
    publishedBy: publisherName.value,
  }

  submitting.value = true
  try {
    await experimentStore.add(exp)
    ElMessage.success(t('publish.publishSuccess', { name: bestTitle }))
    await router.push('/researcher/manage')
  } catch (error) { ElMessage.error(error.message) }
  finally { submitting.value = false }
}

/** 重置表单 */
function handleReset() {
  formRef.value?.resetFields()
  // resetFields 会恢复为初始值，这里确保 tags / 数值回到默认
  form.tags = { zh: [], en: [], ja: [] }
  form.requiredItems = { zh: '', en: '', ja: '' }
  form.minReputation = 0
  ElMessage.info(t('publish.resetDone'))
}
</script>

<template>
  <div class="publish">
    <!-- 页头 -->
    <div class="page-head">
      <div>
        <h1>{{ $t('publish.title') }}</h1>
        <p>{{ $t('publish.desc') }}</p>
      </div>
      <el-tag type="primary" effect="dark" round size="large">
        {{ $t('publish.publisher') }}：{{ publisherName }}
      </el-tag>
    </div>

    <!-- 主表单卡片 -->
    <el-card shadow="never" class="form-card">
      <el-form
        ref="formRef"
        :disabled="submitting"
        :model="form"
        :rules="rules"
        label-position="top"
        class="publish-form"
      >
        <!-- ============ 分组：基本信息 ============ -->
        <section class="form-section">
          <div class="section-title">
            <el-icon><EditPen /></el-icon>
            <span>{{ $t('publish.basicInfo') }}</span>
          </div>

          <!-- 【问题 3】多语言输入：字段内嵌迷你语言切换器（中/EN/日），
               默认跟随当前界面语言，已填语言以小圆点标记 -->
          <el-form-item :label="$t('publish.expTitle')" prop="title">
            <MultiLangInput
              v-model="form.title"
              :maxlength="50"
              show-word-limit
              :placeholder="$t('publish.expTitlePh')"
            />
          </el-form-item>

          <el-form-item :label="$t('publish.expDesc')" prop="description">
            <MultiLangInput
              v-model="form.description"
              type="textarea"
              :rows="4"
              :maxlength="300"
              show-word-limit
              :placeholder="$t('publish.expDescPh')"
            />
          </el-form-item>

          <!-- 【Step 9】局部多语言标签选择器（组件内含 el-select，勿再外包一层）：
               - 右上角迷你切换器（中/EN/日）只改组件内 activeLang，不改全局语言；
               - 预定义选项按 activeLang 实时翻译；自由输入存原文；
               - v-model 绑定 { zh: [], en: [], ja: [] }，操作只影响当前激活语言数组 -->
          <el-form-item :label="$t('publish.tags')" prop="tags">
            <MultiLangTagSelect v-model="form.tags" />
          </el-form-item>
        </section>

        <!-- ============ 分组：实验安排 ============ -->
        <section class="form-section">
          <div class="section-title">
            <el-icon><Location /></el-icon>
            <span>{{ $t('publish.arrangement') }}</span>
          </div>

          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item :label="$t('publish.locationType')" prop="locationType">
                <!-- @change：切换类型时清除两个字段的历史报错，
                     防止「选线下却显示线上必填提示」的残留串扰 -->
                <el-radio-group
                  v-model="form.locationType"
                  @change="handleLocationTypeChange"
                >
                  <el-radio-button value="online">{{ $t('publish.online') }}</el-radio-button>
                  <el-radio-button value="offline">{{ $t('publish.offline') }}</el-radio-button>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :span="16">
              <!-- 【Step 10 条件渲染】线上/线下为两个独立字段、独立 prop：
                   同一时刻只挂载一个输入框，各自的校验规则/错误提示互不干扰 -->
              <el-form-item
                v-if="form.locationType === 'online'"
                :label="$t('publish.onlineLink')"
                prop="onlineUrl"
              >
                <el-input
                  v-model="form.onlineUrl"
                  :placeholder="$t('publish.onlineLinkPh')"
                  clearable
                />
              </el-form-item>
              <el-form-item
                v-else
                :label="$t('publish.offlineLab')"
                prop="offlineAddress"
              >
                <el-input
                  v-model="form.offlineAddress"
                  :placeholder="$t('publish.offlineLabPh')"
                  clearable
                />
              </el-form-item>
            </el-col>
          </el-row>

          <!-- 【Step 15】需携带物品（选填，多语言）：
               学生端按自身界面语言择优展示；留空显示「无需携带 / 持参物不要 / No items required」 -->
          <el-form-item :label="$t('publish.requiredItems')">
            <MultiLangInput
              v-model="form.requiredItems"
              :placeholder="$t('publish.requiredItemsPh')"
            />
          </el-form-item>

          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item :label="$t('publish.duration')" prop="duration">
                <el-input-number
                  v-model="form.duration"
                  :min="5"
                  :max="600"
                  :step="5"
                  controls-position="right"
                  class="full-num"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item :label="$t('publish.participants')" prop="participants">
                <el-input-number
                  v-model="form.participants"
                  :min="1"
                  :max="500"
                  :step="1"
                  controls-position="right"
                  class="full-num"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item :label="$t('publish.reward')" prop="reward">
                <el-input-number
                  v-model="form.reward"
                  :min="0"
                  :max="1000000"
                  :step="500"
                  controls-position="right"
                  class="full-num"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <!-- ============ 分组：数据质量要求控制（核心） ============ -->
        <section class="form-section quality-section">
          <div class="section-title quality-title">
            <el-icon><Aim /></el-icon>
            <span>{{ $t('publish.qualityControl') }}</span>
            <el-tag type="danger" size="small" effect="dark" round>{{ $t('publish.core') }}</el-tag>
          </div>

          <div class="quality-body">
            <!-- 左：滑动条 + 预设档位 -->
            <div class="quality-left">
              <div class="quality-value">
                <span class="qv-num">{{ form.minReputation }}</span>
                <span class="qv-label">{{ $t('publish.minReputation') }}</span>
              </div>

              <el-slider
                v-model="form.minReputation"
                :min="0"
                :max="100"
                :step="1"
                :marks="sliderMarks"
                class="quality-slider"
              />

              <div class="preset-row">
                <span class="preset-cap">{{ $t('publish.quickSet') }}：</span>
                <el-button
                  v-for="p in qualityPresets"
                  :key="p.value"
                  :type="form.minReputation === p.value ? 'primary' : 'default'"
                  size="small"
                  round
                  @click="form.minReputation = p.value"
                >
                  {{ t('publish.' + p.key) }}
                </el-button>
              </div>
            </div>

            <!-- 右：效果实时预览 -->
            <div class="quality-right">
              <el-tag
                :type="qualityLevel.type"
                effect="light"
                size="large"
                round
              >
                {{ qualityLevel.label }}
              </el-tag>
              <p class="quality-text">
                <el-icon><InfoFilled /></el-icon>
                {{ qualityLevel.text }}
              </p>

              <div class="eligible-box">
                <div class="eb-num">
                  {{ eligibleCount }}
                  <span class="eb-total">/ {{ totalSubjects }} {{ t('publish.people') }}</span>
                </div>
                <div class="eb-label">{{ t('publish.eligibleLabel') }}</div>
                <div class="eb-bar">
                  <div
                    class="eb-fill"
                    :style="{ width: eligibleRatio + '%' }"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ============ 操作栏 ============ -->
        <div class="form-actions">
          <el-button @click="handleReset">
            <el-icon><RefreshLeft /></el-icon>
            {{ $t('common.reset') }}
          </el-button>
          <el-button type="primary" size="large" class="publish-btn" :loading="submitting" @click="handlePublish">
            <el-icon><Promotion /></el-icon>
            {{ $t('publish.publishBtn') }}
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.publish {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 页头 */
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.page-head h1 {
  margin: 0 0 6px;
  font-size: 24px;
  color: #111827;
}
.page-head p {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
  max-width: 640px;
}
.page-head b {
  color: #4f46e5;
}

/* 卡片 */
.form-card {
  border-radius: 16px;
  border: 1px solid #eceef3;
}
.form-card:deep(.el-card__body) {
  padding: 26px 30px 10px;
}

/* 分组 */
.form-section {
  padding: 18px 22px;
  border: 1px solid #eef0f5;
  border-radius: 14px;
  background: #fbfbfd;
  margin-bottom: 18px;
}
.form-section:last-of-type {
  margin-bottom: 6px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #e5e7eb;
}
.section-title .el-icon {
  color: #4f46e5;
  font-size: 17px;
}

.full-num {
  width: 100%;
}

/* ---------- 数据质量要求控制（核心模块，特殊高亮） ---------- */
.quality-section {
  border: 1px solid #e5d5a6;
  background: linear-gradient(180deg, #fffdf6 0%, #fbfbfd 60%);
}
.quality-title {
  border-bottom-color: #f0e2b8;
}
.quality-body {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 26px;
  align-items: center;
}
.quality-left {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.quality-value {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.qv-num {
  font-size: 34px;
  font-weight: 800;
  line-height: 1;
  color: #4f46e5;
  font-variant-numeric: tabular-nums;
}
.qv-label {
  font-size: 13px;
  color: #6b7280;
}
/* 【问题 4】滑条刻度文字修复：
   1) 左右留白防止端点标签（0 / 100）被裁剪，底部预留两行刻度文字的高度；
   2) 端点文字 nowrap、不截断；
   3) 右端密集刻度（85/90/98/100）交错两行排布，避免水平重叠 */
.quality-slider {
  padding: 4px 24px 56px;
}
.quality-slider :deep(.el-slider__marks-text) {
  white-space: nowrap;      /* 端点长文案（如“Top”“最高品質”）不折行不截断 */
  max-width: none;
  overflow: visible;
  text-overflow: clip;
  font-size: 12px;
  margin-top: 14px;         /* 默认第一行刻度文字 */
}
/* 本版本 Element Plus 中 .el-slider__marks 的直接子节点就是各刻度标签 div，
   顺序为 0 / 60 / 85 / 90 / 98 / 100；将第 4、6 个（90、100）下沉到第二行，
   右端密集刻度（85/90/98/100）交错两行排布，避免水平重叠 */
.quality-slider :deep(.el-slider__marks-text:nth-child(4n + 4)) {
  margin-top: 34px;         /* 第二行刻度文字 */
}
.preset-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.preset-cap {
  font-size: 13px;
  color: #9ca3af;
}

.quality-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}
.quality-text {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #4b5563;
}
.eligible-box {
  width: 100%;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #eef0f5;
  border-radius: 12px;
}
.eb-num {
  font-size: 26px;
  font-weight: 800;
  color: #111827;
  font-variant-numeric: tabular-nums;
}
.eb-total {
  font-size: 13px;
  font-weight: 400;
  color: #9ca3af;
  margin-left: 4px;
}
.eb-label {
  font-size: 12px;
  color: #6b7280;
  margin: 2px 0 10px;
}
.eb-bar {
  height: 8px;
  border-radius: 4px;
  background: #eef0f5;
  overflow: hidden;
}
.eb-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #4f46e5, #7c6ff0);
  transition: width 0.3s ease;
}

/* 操作栏 */
.form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 22px 12px;
}
.publish-btn {
  font-weight: 600;
  letter-spacing: 1px;
  padding-inline: 26px;
}

/* 小屏：质量模块改为单列 */
@media (max-width: 900px) {
  .quality-body {
    grid-template-columns: 1fr;
  }
  .quality-right {
    align-items: flex-start;
  }
}
</style>
