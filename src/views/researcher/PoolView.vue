<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Star, Delete, Refresh, UserFilled, DataAnalysis } from '@element-plus/icons-vue'
import { useSubjectStore } from '@/stores/subject'
import RatingDialog from './components/RatingDialog.vue'
import { pickLocalized } from '@/i18n'

/**
 * 研究者端 · 被试池管理
 *
 * 功能：
 *  - 数据表格展示被试池名单：被试ID / 姓名 / 参与实验总数 / 平均完成耗时 / 当前信誉分
 *  - 顶部统计卡：总被试 / 平均信誉分 / 优质·合格·待观察·低质 人数
 *  - 搜索框：按「被试ID 或 姓名」检索（并可选按质量等级筛选）
 *  - 每行「信誉评分」：弹窗加分/扣分 + 必填理由，评分后实时更新表格与统计
 *
 * 说明：信誉分对学生端隐藏，仅研究者端可见并可调整。
 */
const subjectStore = useSubjectStore()
const { t, locale } = useI18n() // i18n：script 内使用 t()，模板内使用 $t()

/* Step 16：name 为 {zh,ja,en} 对象，被试姓名按当前界面语言择优（模板与消息共用） */
const locName = (row) => pickLocalized(row?.name, locale.value)

// 搜索关键字（被试ID 或 姓名）
const keyword = ref('')
// 质量等级筛选：'' 全部 | 'premium' | 'qualified' | 'observation' | 'low'（语义 key，便于 i18n）
const qualityFilter = ref('')

/* ---------------------- 统计（随评分实时更新） ---------------------- */
const total = computed(() => subjectStore.list.length)
const avgReputation = computed(() =>
  total.value
    ? Math.round(subjectStore.list.reduce((sum, s) => sum + s.reputation, 0) / total.value)
    : 0,
)
// 按质量等级计数（qualityOf 返回语义 key：premium/qualified/observation/low）
const countByQuality = computed(() => {
  const c = { premium: 0, qualified: 0, observation: 0, low: 0 }
  subjectStore.list.forEach((s) => {
    c[subjectStore.qualityOf(s.reputation).key] += 1
  })
  return c
})
// 统计卡：label 使用 i18n key，模板内统一翻译
const stats = computed(() => [
  { key: 'total', labelKey: 'pool.total', value: total.value, icon: UserFilled, color: '#4f46e5' },
  { key: 'avg', labelKey: 'pool.avgReputation', value: avgReputation.value, icon: DataAnalysis, color: '#0d9488' },
  { key: 'premium', labelKey: 'quality.premium', value: countByQuality.value.premium, icon: Star, color: '#16a34a' },
  { key: 'qualified', labelKey: 'quality.qualified', value: countByQuality.value.qualified, icon: Star, color: '#4f46e5' },
  { key: 'observation', labelKey: 'quality.observation', value: countByQuality.value.observation, icon: Star, color: '#d97706' },
  { key: 'low', labelKey: 'quality.low', value: countByQuality.value.low, icon: Star, color: '#dc2626' },
])

/* ---------------------- 检索 + 筛选 ---------------------- */
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return subjectStore.list.filter((s) => {
    // Step 16：name 为 {zh,ja,en} 对象，搜索跨三种语言匹配（任意界面语言下都能检索到）
    const nameHaystack = Object.values(s.name || {})
      .join(' ')
      .toLowerCase()
    const matchKw =
      !kw || s.id.toLowerCase().includes(kw) || nameHaystack.includes(kw)
    const matchQ =
      !qualityFilter.value || subjectStore.qualityOf(s.reputation).key === qualityFilter.value
    return matchKw && matchQ
  })
})

/* ---------------------- 评分弹窗 ---------------------- */
const dialogVisible = ref(false)
const currentSubject = ref(null)

function openRating(row) {
  currentSubject.value = row
  dialogVisible.value = true
}
function handleRatingConfirmed() {
  // 评分确认后：数据已在 store 中更新，此处仅做提示（可在此触发其它联动）
}

/* ---------------------- 移除被试（辅助操作） ---------------------- */
function handleRemove(row) {
  const nm = locName(row) // Step 16：姓名按当前界面语言择优
  ElMessageBox.confirm(
    t('pool.removeText', { name: nm, id: row.id }),
    t('pool.removeTitle'),
    {
      type: 'warning',
      confirmButtonText: t('common.remove'),
      cancelButtonText: t('common.cancel'),
    },
  )
    .then(() => {
      subjectStore.remove(row.id)
      ElMessage.success(t('pool.removed', { name: nm }))
    })
    .catch(() => {})
}

/* ---------------------- 其它 ---------------------- */
function handleReset() {
  keyword.value = ''
  qualityFilter.value = ''
  ElMessage.info(t('pool.resetDone'))
}
</script>

<template>
  <div class="pool">
    <!-- 页头 -->
    <div class="page-head">
      <div>
        <h1>{{ $t('pool.title') }}</h1>
        <p>{{ $t('pool.desc') }}</p>
      </div>
      <el-button @click="handleReset">
        <el-icon><Refresh /></el-icon>
        {{ $t('common.reset') }}
      </el-button>
    </div>

    <!-- 统计卡 -->
    <div class="stat-strip">
      <div v-for="s in stats" :key="s.key" class="stat-card">
        <el-icon class="stat-icon" :style="{ color: s.color }">
          <component :is="s.icon" />
        </el-icon>
        <div class="stat-num">{{ s.value }}</div>
        <div class="stat-label">{{ t(s.labelKey) }}</div>
      </div>
    </div>

    <!-- 搜索 + 筛选 -->
    <el-card shadow="never" class="table-card">
      <div class="toolbar">
        <el-input
          v-model="keyword"
          :placeholder="$t('pool.searchPh')"
          clearable
          class="search-input"
          :prefix-icon="Search"
        />
        <el-select
          v-model="qualityFilter"
          :placeholder="$t('pool.allQuality')"
          clearable
          class="quality-select"
        >
          <el-option :label="$t('pool.qPremium')" value="premium" />
          <el-option :label="$t('pool.qQualified')" value="qualified" />
          <el-option :label="$t('pool.qObservation')" value="observation" />
          <el-option :label="$t('pool.qLow')" value="low" />
        </el-select>
        <span class="result-count">{{ t('pool.resultCount', { n: filtered.length }) }}</span>
      </div>

      <!-- 数据表格 -->
      <el-table
        :data="filtered"
        stripe
        border
        style="width: 100%"
        :empty-text="$t('pool.empty')"
      >
        <el-table-column prop="id" :label="$t('pool.colId')" width="120">
          <template #default="{ row }">
            <span class="cell-id">{{ row.id }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="name" :label="$t('pool.colName')" min-width="120">
          <template #default="{ row }">
            <div class="cell-name">
              <el-avatar :size="28" class="row-avatar">{{ (locName(row) || '').slice(0, 1) }}</el-avatar>
              <div>
                <div class="name-main">{{ locName(row) }}</div>
                <!-- Step 13：专业/年级由 i18n key 动态翻译（随界面语言切换） -->
                <div class="name-sub">
                  {{ $t(row.majorKey) }} · {{ $t(row.gradeKey) }}
                </div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column :label="$t('pool.colTotal')" width="120" align="center">
          <template #default="{ row }">
            <el-tag type="info" effect="plain" round>
              {{ (row.participations || []).length }} {{ t('pool.countSuffix') }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column :label="$t('pool.colAvg')" width="130" align="center">
          <template #default="{ row }">
            <span class="cell-duration">
              {{ row.avgDuration ? row.avgDuration + ' ' + t('common.minutes') : '—' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column :label="$t('pool.colScore')" width="140" align="center">
          <template #default="{ row }">
            <div class="cell-score">
              <span
                class="score-num"
                :class="subjectStore.qualityOf(row.reputation).type"
              >
                {{ row.reputation }}
              </span>
              <el-tag
                :type="subjectStore.qualityOf(row.reputation).type"
                size="small"
                effect="light"
                round
              >
                {{ t('quality.' + subjectStore.qualityOf(row.reputation).key) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <!-- 操作列 -->
        <el-table-column :label="$t('pool.colActions')" width="150" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="openRating(row)">
              <el-icon><Star /></el-icon>
              {{ $t('pool.rating') }}
            </el-button>
            <el-button type="danger" size="small" plain @click="handleRemove(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 信誉评分弹窗 -->
    <RatingDialog
      v-model="dialogVisible"
      :subject="currentSubject"
      @confirm="handleRatingConfirmed"
    />
  </div>
</template>

<style scoped>
.pool {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

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

/* 统计卡 */
.stat-strip {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
}
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid #eceef3;
  border-radius: 14px;
}
.stat-icon {
  font-size: 18px;
  margin-bottom: 2px;
}
.stat-num {
  font-size: 26px;
  font-weight: 800;
  color: #111827;
  font-variant-numeric: tabular-nums;
}
.stat-label {
  font-size: 12px;
  color: #9ca3af;
}

/* 表格卡片 */
.table-card {
  border-radius: 16px;
  border: 1px solid #eceef3;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.search-input {
  width: 320px;
}
.quality-select {
  width: 170px;
}
.result-count {
  margin-left: auto;
  font-size: 13px;
  color: #9ca3af;
}

/* 单元格 */
.cell-id {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  color: #4f46e5;
  font-weight: 600;
}
.cell-name {
  display: flex;
  align-items: center;
  gap: 10px;
}
.row-avatar {
  background: #6366f1;
  flex-shrink: 0;
}
.name-main {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.name-sub {
  font-size: 12px;
  color: #9ca3af;
}
.cell-duration {
  color: #4b5563;
  font-weight: 600;
}
.cell-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.score-num {
  font-size: 20px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.score-num.success {
  color: #16a34a;
}
.score-num.primary {
  color: #4f46e5;
}
.score-num.warning {
  color: #d97706;
}
.score-num.danger {
  color: #dc2626;
}

/* 小屏：统计卡改为 3 列 */
@media (max-width: 1000px) {
  .stat-strip {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 560px) {
  .stat-strip {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
