<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Plus, Minus, InfoFilled } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useSubjectStore } from '@/stores/subject'
import { pickLocalized } from '@/i18n'

/**
 * 信誉评分弹窗
 *
 * 功能：研究者对某位被试进行「加分 / 扣分」，
 *  1. 选择加分或扣分
 *  2. 填写分值
 *  3. 必填「评分理由」（支持常用理由快捷填入，提升清洗效率）
 *  4. 实时预览「信誉分变化前后」
 *  5. 确认后写入被试库（含操作日志留痕）
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false }, // 弹窗显隐
  subject: { type: Object, default: null }, // 当前评分的被试对象
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const user = useUserStore()
const subjectStore = useSubjectStore()
const { t, locale } = useI18n() // i18n：script 内使用 t()，模板内使用 $t()

/* Step 16：name 为 {zh,ja,en} 对象，被试姓名按当前界面语言择优（模板与消息共用） */
const locName = (s) => pickLocalized(s?.name, locale.value)

const formRef = ref(null)

const form = reactive({
  direction: 'add', // 'add' 加分 | 'sub' 扣分
  points: 5, // 分值
  reason: '', // 理由（必填）
})

// 校验规则：computed 保证切换语言后错误提示同步更新
const rules = computed(() => ({
  reason: [
    { required: true, message: t('rating.reasonRequired'), trigger: 'blur' },
    { min: 5, message: t('rating.reasonMin'), trigger: 'blur' },
  ],
}))

// 常用理由快捷填入（提升清洗效率；字典中为数组型 key，随语言实时切换）
const quickReasons = computed(() => t('rating.quickReasons', 'string:array'))

/* Step 16：操作人（研究者）姓名同为 {zh,ja,en} 对象，按当前界面语言择优 */
const operator = computed(
  () => pickLocalized(user.researcher?.name, locale.value) || t('common.researcher'),
)

// 实时预览：变化前 / 变化后（限制在 0~100）
const before = computed(() => props.subject?.reputation ?? 0)
const delta = computed(() =>
  form.direction === 'add' ? form.points : -form.points,
)
const after = computed(() =>
  Math.max(0, Math.min(100, before.value + delta.value)),
)
const isUp = computed(() => delta.value >= 0)

// 「加/减」方向词（zh：加/减；en：+ / −；ja：+ / −）
const dirWord = computed(() => t(isUp.value ? 'rating.addVerb' : 'rating.subVerb'))

function fillReason(text) {
  form.reason = text
}

async function handleConfirm() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  subjectStore.adjustReputation(
    props.subject.id,
    delta.value,
    form.reason.trim(),
    operator.value,
  )
  emit('confirm', { id: props.subject.id, delta: delta.value })
  ElMessage.success(
    t('rating.success', {
      name: locName(props.subject),
      dir: dirWord.value,
      n: Math.abs(delta.value),
      before: before.value,
      after: after.value,
    }),
  )
  handleClose()
}

function handleClose() {
  emit('update:modelValue', false)
}

// 弹窗每次打开 / 切换被试时，重置表单
watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.direction = 'add'
      form.points = 5
      form.reason = ''
      formRef.value?.clearValidate()
    }
  },
)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="$t('rating.title')"
    width="520px"
    align-center
    :close-on-click-modal="false"
    @update:model-value="(v) => emit('update:modelValue', v)"
    @closed="formRef?.clearValidate()"
  >
    <template v-if="subject">
      <!-- 被试信息 -->
      <div class="subject-head">
        <el-avatar :size="42" class="avatar">{{ (locName(subject) || '').slice(0, 1) }}</el-avatar>
        <div class="s-meta">
          <div class="s-name">
            {{ locName(subject) }}
            <el-tag
              :type="subjectStore.qualityOf(subject.reputation).type"
              size="small"
              effect="light"
              round
            >
              {{ t('quality.' + subjectStore.qualityOf(subject.reputation).key) }}
            </el-tag>
          </div>
          <div class="s-id">
            <!-- Step 13：专业/年级由 i18n key 动态翻译 -->
            {{ subject.id }} · {{ $t(subject.majorKey) }} · {{ $t(subject.gradeKey) }}
          </div>
        </div>
      </div>

      <!-- 分数变化预览 -->
      <div class="preview">
        <div class="pv-col">
          <div class="pv-label">{{ $t('rating.current') }}</div>
          <div class="pv-num">{{ before }}</div>
        </div>
        <el-icon class="pv-arrow" :class="{ up: isUp }">
          <Plus v-if="isUp" />
          <Minus v-else />
        </el-icon>
        <div class="pv-col">
          <div class="pv-label">{{ $t('rating.after') }}</div>
          <div class="pv-num" :class="isUp ? 'up' : 'down'">
            {{ after }}
          </div>
        </div>
      </div>

      <!-- 评分表单 -->
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="rating-form"
      >
        <el-form-item :label="$t('rating.type')" prop="direction" required>
          <el-radio-group v-model="form.direction">
            <el-radio-button value="add" class="add-btn">
              <el-icon><Plus /></el-icon> {{ $t('rating.add') }}
            </el-radio-button>
            <el-radio-button value="sub" class="sub-btn">
              <el-icon><Minus /></el-icon> {{ $t('rating.sub') }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item :label="$t('rating.points')" prop="points" required>
          <el-input-number
            v-model="form.points"
            :min="1"
            :max="50"
            :step="1"
            controls-position="right"
            class="points-input"
          />
          <span class="points-hint">
            {{ t('rating.pointsHint', { dir: dirWord, n: Math.abs(delta) }) }}
          </span>
        </el-form-item>

        <el-form-item :label="$t('rating.reason')" prop="reason" required>
          <el-input
            v-model="form.reason"
            type="textarea"
            :rows="3"
            maxlength="120"
            show-word-limit
            :placeholder="$t('rating.reasonPh')"
          />
        </el-form-item>
      </el-form>

      <!-- 快捷理由 -->
      <div class="quick">
        <div class="quick-cap">
          <el-icon><InfoFilled /></el-icon> {{ $t('rating.quick') }}
        </div>
        <div class="quick-list">
          <el-button
            v-for="r in quickReasons"
            :key="r"
            size="small"
            type="info"
            plain
            round
            @click="fillReason(r)"
          >
            {{ r.length > 24 ? r.slice(0, 24) + '…' : r }}
          </el-button>
        </div>
      </div>
    </template>

    <template #footer>
      <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" @click="handleConfirm">{{ $t('rating.confirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.subject-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f1f5;
}
.avatar {
  background: #4f46e5;
  font-weight: 700;
}
.s-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}
.s-id {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
}

/* 分数预览 */
.preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 18px;
  margin: 16px 0;
  background: #f7f8fb;
  border-radius: 12px;
}
.pv-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.pv-label {
  font-size: 12px;
  color: #9ca3af;
}
.pv-num {
  font-size: 28px;
  font-weight: 800;
  color: #4b5563;
  font-variant-numeric: tabular-nums;
}
.pv-num.up {
  color: #16a34a;
}
.pv-num.down {
  color: #dc2626;
}
.pv-arrow {
  font-size: 22px;
  color: #9ca3af;
}
.pv-arrow.up {
  color: #16a34a;
}

.rating-form {
  margin-top: 6px;
}
.add-btn {
  color: #16a34a;
}
.sub-btn {
  color: #dc2626;
}
.points-input {
  width: 140px;
}
.points-hint {
  margin-left: 10px;
  font-size: 13px;
  color: #6b7280;
}

/* 快捷理由 */
.quick {
  margin-top: 6px;
  padding-top: 14px;
  border-top: 1px dashed #e5e7eb;
}
.quick-cap {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 10px;
}
.quick-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
