<script setup>
import { computed, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  Coin,
  Timer,
  User,
  Lock,
  Check,
  TrendCharts,
  Location,
  Suitcase,
  View,
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useSubjectStore } from '@/stores/subject'
import { useExperimentStore } from '@/stores/experiment'
import { pickLocalized } from '@/i18n'
import { apiEnabled } from '@/services/api'

/**
 * 学生端 · 实验大厅（Step 15：JSONB 多语言结构 + 结构化卡片 + 详情弹窗）
 *
 * 数据契约（匹配真实后端 JSONB）：
 *  - title / description / required_items → {zh, ja, en} 多语言对象
 *  - location_type   → 'online' | 'offline'
 *  - location_detail → 字符串（线下楼宇/房间号，或线上实验链接）
 *  - reward_points   → 数值（积分，1 积分 = 1 日元）
 *  - duration_minutes → 数值（分钟）
 *  - min_reputation_required → 仅静态演示在前端过滤；API 模式不向学生返回该字段
 *
 * 国际化：
 *  - 多语言字段由 pickLocalized() 按当前界面语言择优（当前语言 → zh → en → ja）
 *  - 学生切换界面语言时，标题/描述/携带物品实时切换，无需刷新
 *  - 「立即报名 / 查看详情 / 报酬 / 携带物品」等 UI 文案全部走 i18n
 */
const user = useUserStore()
const subjectStore = useSubjectStore()
const experimentStore = useExperimentStore()
const { t, locale, te } = useI18n()
const loading = ref(false)
const loadError = ref('')
const enrolling = ref(false)
async function load() {
  loading.value = true
  loadError.value = ''
  try { await Promise.all([subjectStore.load('student'), experimentStore.load()]) }
  catch (error) { loadError.value = error.message }
  finally { loading.value = false }
}
onMounted(load)

// API 模式只接收本人公开资料与参与记录，不接收隐藏信誉分。
const current = computed(() => subjectStore.getById(user.student?.id))

/* Step 16：name 为 {zh,ja,en} 多语言对象，按当前界面语言择优显示姓名
   （中文名→日语片假名/英语拼音；日文名→罗马音；欧美名→原名，随界面语言实时切换） */
const displayName = computed(() => pickLocalized(current.value?.name, locale.value))

// 仅静态演示使用模拟信誉分过滤；真实模式由服务端筛选。
const reputation = computed(() => current.value?.reputation ?? 0)

// ---------- 定向分发：前端过滤逻辑 ----------
const visibleExperiments = computed(() =>
  experimentStore.published.filter(
    (e) => apiEnabled || e.min_reputation_required <= reputation.value,
  ),
)
const lockedCount = computed(
  () => experimentStore.published.length - visibleExperiments.length,
)

// ---------- 信息卡统计（不含信誉分） ----------
const totalReward = computed(() => current.value?.totalReward ?? 0)
const finishedCount = computed(
  () =>
    (current.value?.participations || []).filter(
      (p) => p.status === '已完成',
    ).length,
)
const joinedYear = computed(() => (current.value?.joinedAt || '').slice(0, 4))

// 数字本地化（按当前语言做千分位）
const fmtReward = (n) => (n ?? 0).toLocaleString(locale.value)

/* 多语言内容择优渲染：
   Step 15 起 title / description / required_items 均为 {zh,en,ja} 对象，
   pickLocalized() 按「当前界面语言 → zh → en → ja」择优返回第一个非空值；
   兼容旧 Mock 纯字符串（原样返回） */
const locText = (exp, field) => pickLocalized(exp?.[field], locale.value)

/* 携带物品：多语言择优；留空时显示「无需携带 / 持参物不要 / No items required」 */
const itemsText = (exp) => locText(exp, 'required_items') || t('hall.noItems')

/* 地点类型语义（线上/线下） */
const isOnline = (exp) => exp?.location_type === 'online'

/* 标签渲染（Step 8 联动）：
   预定义标签存的是 i18n 稳定 key → 用 te() 探测后翻译为当前界面语言；
   研究者自创的自由文本（字典里没有）→ 原样展示，兜底不报错 */
const tagLabel = (tag) =>
  te(`publish.tagOptions.${tag}`) ? t(`publish.tagOptions.${tag}`) : tag

// ---------- 报名 ----------
function isEnrolled(exp) {
  return (current.value?.participations || []).some(
    (p) => p.experimentId === exp.id,
  )
}
async function handleEnroll(exp) {
  if (!current.value || !exp || isEnrolled(exp) || enrolling.value) return
  enrolling.value = true
  try {
    await subjectStore.enroll(current.value.id, exp)
    ElMessage.success(t('hall.enrollSuccess', { name: locText(exp, 'title') }))
    detailVisible.value = false
    await experimentStore.load()
  } catch (error) { ElMessage.error(error.message) }
  finally { enrolling.value = false }
}

// ---------- 实验详情弹窗（Step 15 新增交互） ----------
const detailVisible = ref(false)
const detailExp = ref(null)
function openDetail(exp) {
  detailExp.value = exp
  detailVisible.value = true
}
/* 从详情弹窗内直接报名：报名成功后关闭弹窗 */
function handleEnrollFromDetail() {
  if (!detailExp.value) return
  handleEnroll(detailExp.value)
}

// ---------- 卡片标签判断 ----------
const isHighQuality = (exp) => exp.min_reputation_required >= 90
/* 高报酬判定：Step 15 起字段为 reward_points（积分） */
const isHighReward = (exp) => (exp.reward_points ?? 0) >= 5000
</script>

<template>
  <div class="hall-page">
  <p v-if="loading">{{ $t('backend.loading') }}</p>
  <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
  <el-button v-if="loadError" @click="load">{{ $t('backend.retry') }}</el-button>
  <div class="hall" v-if="current">
    <!-- ==================== 顶部：学生信息卡 ==================== -->
    <section class="info-card">
      <div class="info-left">
        <div class="info-avatar">{{ (displayName || 'U').slice(0, 1) }}</div>
        <div class="info-id">
          <div class="info-name">{{ displayName }}</div>
          <!-- Step 13：专业/年级由 i18n key 动态翻译（心理学 · 大二 / 学部2年 / 2nd-Year…）
               与上行姓名合起来即「name | major · grade」格式，姓名不重复渲染 -->
          <div v-if="current.majorKey" class="info-major">
            {{ $t(current.majorKey) }} · {{ $t(current.gradeKey) }}
          </div>
          <div class="info-joined">
            <el-icon><User /></el-icon>
            <span>{{ $t('hall.joined', { y: joinedYear }) }}</span>
          </div>
        </div>
      </div>

      <div class="info-right">
        <div class="stat">
          <div class="stat-label">
            <el-icon><Coin /></el-icon> {{ $t('hall.cumulativeReward') }}
          </div>
          <div class="stat-value reward">
            {{ fmtReward(totalReward) }}
            <span class="unit">{{ $t('common.jpy') }}</span>
          </div>
        </div>
        <div class="stat-divider" />
        <div class="stat">
          <div class="stat-label">
            <el-icon><TrendCharts /></el-icon> {{ $t('hall.finished') }}
          </div>
          <div class="stat-value">{{ finishedCount }}</div>
        </div>
      </div>
    </section>

    <!-- ==================== 主体：可用实验列表 ==================== -->
    <section class="list-section">
      <div class="list-header">
        <div class="list-title">
          <h2>{{ $t('hall.available') }}</h2>
          <el-tag
            type="primary"
            effect="light"
            round
          >
            {{ $t('hall.shown', { n: visibleExperiments.length }) }}
          </el-tag>
        </div>
        <!-- 温和提示：不透露具体分数，只提示“表现越好解锁越多” -->
        <p class="list-tip" v-if="lockedCount > 0">
          <el-icon><Lock /></el-icon>
          <span>{{ $t('hall.lockedHint', { n: lockedCount }) }}</span>
        </p>
      </div>

      <!-- 实验卡片网格 -->
      <div class="exp-grid" v-if="visibleExperiments.length">
        <el-card
          v-for="exp in visibleExperiments"
          :key="exp.id"
          shadow="hover"
          class="exp-card"
          :class="{ 'is-high': isHighQuality(exp) }"
        >
          <!-- 卡片头：名称 + 编号 + 高报酬徽标 -->
          <div class="exp-head">
            <div class="exp-title-wrap">
              <h3 class="exp-name">{{ locText(exp, 'title') }}</h3>
              <span class="exp-code">{{ exp.code }}</span>
            </div>
            <el-tag
              v-if="isHighReward(exp)"
              type="success"
              size="small"
              effect="dark"
              round
            >
              {{ $t('common.highReward') }}
            </el-tag>
          </div>

          <!-- 标签行：key 实时翻译为当前界面语言；自创标签原样展示 -->
          <div class="exp-tags">
            <el-tag
              v-for="tag in exp.tags"
              :key="tag"
              size="small"
              type="info"
              effect="plain"
              round
            >
              {{ tagLabel(tag) }}
            </el-tag>
            <el-tag
              v-if="isHighQuality(exp)"
              size="small"
              type="warning"
              effect="light"
              round
            >
              {{ $t('common.highQuality') }}
            </el-tag>
          </div>

          <!-- 简介（多语言择优） -->
          <p class="exp-desc">{{ locText(exp, 'description') }}</p>

          <!-- 结构化元信息（Step 15）：报酬/耗时 + 地点 + 携带物品 -->
          <div class="exp-meta">
            <!-- 第 1 行：报酬 + 预计耗时（数值字段，单位本地化） -->
            <div class="meta-line">
              <span class="meta-item reward">
                <el-icon><Coin /></el-icon>
                <span class="meta-val">
                  {{ fmtReward(exp.reward_points) }} {{ $t('common.jpy') }}
                </span>
              </span>
              <span class="meta-item">
                <el-icon><Timer /></el-icon>
                <span class="meta-val">
                  {{ exp.duration_minutes }} {{ $t('common.minutes') }}
                </span>
              </span>
            </div>
            <!-- 第 2 行：地点（线上/线下标签 + 具体地点；超长省略号，悬浮看全文） -->
            <div class="meta-line">
              <span class="meta-item grow">
                <el-icon><Location /></el-icon>
                <el-tag
                  size="small"
                  :type="isOnline(exp) ? 'primary' : 'info'"
                  effect="light"
                  round
                >
                  {{ isOnline(exp) ? $t('hall.online') : $t('hall.offline') }}
                </el-tag>
                <span class="meta-ellipsis" :title="exp.location_detail">
                  {{ exp.location_detail }}
                </span>
              </span>
            </div>
            <!-- 第 3 行：需携带物品（多语言择优；留空显示「无需携带」） -->
            <div class="meta-line">
              <span class="meta-item grow">
                <el-icon><Suitcase /></el-icon>
                <span class="meta-ellipsis" :title="itemsText(exp)">
                  {{ itemsText(exp) }}
                </span>
              </span>
            </div>
          </div>

          <!-- 底部：查看详情 + 立即报名 -->
          <div class="exp-foot">
            <el-button class="detail-btn" @click="openDetail(exp)">
              <el-icon><View /></el-icon>
              {{ $t('hall.viewDetail') }}
            </el-button>
            <el-button
              type="primary"
              size="large"
              class="enroll-btn"
              :disabled="isEnrolled(exp) || enrolling || (apiEnabled && exp.slots.filled >= exp.slots.total)"
              @click="handleEnroll(exp)"
            >
              <el-icon v-if="isEnrolled(exp)"><Check /></el-icon>
              {{ isEnrolled(exp) ? $t('common.enrolled') : $t('common.enroll') }}
            </el-button>
          </div>
        </el-card>
      </div>

      <!-- 空状态 -->
      <el-empty v-else :description="$t('hall.empty')" />
    </section>

    <!-- ==================== 实验详情弹窗（Step 15 新增交互） ==================== -->
    <el-dialog
      v-model="detailVisible"
      :title="$t('hall.detailsTitle')"
      width="600px"
      append-to-body
      class="detail-dialog"
    >
      <div v-if="detailExp" class="detail-body">
        <h3 class="detail-name">{{ locText(detailExp, 'title') }}</h3>
        <div class="detail-tags">
          <el-tag
            v-for="tag in detailExp.tags"
            :key="tag"
            size="small"
            type="info"
            effect="plain"
            round
          >
            {{ tagLabel(tag) }}
          </el-tag>
        </div>

        <el-descriptions :column="2" border class="detail-desc">
          <el-descriptions-item :label="$t('hall.location')" :span="2">
            <el-tag
              size="small"
              :type="isOnline(detailExp) ? 'primary' : 'info'"
              effect="light"
              round
            >
              {{ isOnline(detailExp) ? $t('hall.online') : $t('hall.offline') }}
            </el-tag>
            <span class="detail-loc">{{ detailExp.location_detail }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('hall.items')" :span="2">
            {{ itemsText(detailExp) }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('hall.reward')">
            {{ fmtReward(detailExp.reward_points) }} {{ $t('common.jpy') }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('hall.duration')">
            {{ detailExp.duration_minutes }} {{ $t('common.minutes') }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('publish.expDesc')" :span="2">
            {{ locText(detailExp, 'description') }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <template #footer>
        <el-button @click="detailVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button
          type="primary"
          :disabled="enrolling || (detailExp && (isEnrolled(detailExp) || (apiEnabled && detailExp.slots.filled >= detailExp.slots.total)))"
          @click="handleEnrollFromDetail"
        >
          {{
            detailExp && isEnrolled(detailExp)
              ? $t('common.enrolled')
              : $t('common.enroll')
          }}
        </el-button>
      </template>
    </el-dialog>
  </div>
  </div>
</template>

<style scoped>
.hall {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ================= 信息卡 ================= */
.info-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  padding: 26px 30px;
  border-radius: 18px;
  color: #fff;
  background: linear-gradient(120deg, #4f46e5 0%, #6366f1 55%, #7c6ff0 100%);
  box-shadow: 0 14px 34px rgba(79, 70, 229, 0.28);
}
.info-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.info-avatar {
  width: 58px;
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  font-size: 26px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.35);
}
.info-name {
  font-size: 22px;
  font-weight: 700;
}
.info-major {
  font-size: 14px;
  opacity: 0.9;
  margin-top: 2px;
}
.info-joined {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  opacity: 0.75;
  margin-top: 8px;
}
.info-right {
  display: flex;
  align-items: center;
  gap: 26px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stat-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  opacity: 0.85;
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
}
.stat-value .unit {
  font-size: 13px;
  font-weight: 400;
  opacity: 0.8;
  margin-left: 4px;
}
.stat-value.reward {
  color: #fde68a;
}
.stat-divider {
  width: 1px;
  height: 40px;
  background: rgba(255, 255, 255, 0.25);
}

/* ================= 列表区 ================= */
.list-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.list-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.list-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.list-title h2 {
  margin: 0;
  font-size: 20px;
  color: #111827;
}
.list-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  background: #fffbeb;
  border: 1px solid #fde9b3;
  padding: 8px 14px;
  border-radius: 10px;
}

/* ================= 实验卡片网格 ================= */
.exp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 18px;
}
.exp-card {
  border-radius: 16px;
  border: 1px solid #eceef3;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
}
.exp-card:deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
}
.exp-card.is-high {
  border-color: #e5d5a6;
  background: linear-gradient(180deg, #fffdf7 0%, #ffffff 40%);
}

.exp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.exp-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.exp-name {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #111827;
}
.exp-code {
  font-size: 12px;
  color: #9ca3af;
  letter-spacing: 0.5px;
}
.exp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.exp-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #6b7280;
  min-height: 42px;
}

/* 结构化元信息：纵向行布局，兼容长日文/英文（省略号 + 悬浮全文，避免挤压重叠） */
.exp-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  background: #f7f8fb;
  border-radius: 12px;
}
.meta-line {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #4b5563;
  font-weight: 600;
  min-width: 0;
}
.meta-item .el-icon,
.meta-item .el-tag {
  flex-shrink: 0;
}
.meta-item.reward {
  color: #b45309;
  font-weight: 700;
}
/* grow：该行占据整行宽度，允许内部文字省略 */
.meta-item.grow {
  flex: 1;
}
.meta-val {
  white-space: nowrap;
}
.meta-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  color: #4b5563;
}

/* 底部：查看详情 + 立即报名 */
.exp-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
}
.detail-btn {
  flex-shrink: 0;
}
.enroll-btn {
  flex: 1;
  font-weight: 600;
  letter-spacing: 1px;
}

/* ================= 实验详情弹窗 ================= */
.detail-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.detail-name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}
.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.detail-desc {
  margin-top: 6px;
}
.detail-loc {
  margin-left: 8px;
  color: #374151;
}
</style>
