<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { jstInput, makeSession, scheduleError, sessionLabel } from '@/services/schedule'

const props = defineProps({ modelValue: { type: Array, default: () => [] }, duration: { type: Number, required: true }, capacity: { type: Number, required: true }, existing: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const { t, locale } = useI18n()
const dates = ref([])
const time = ref('10:00')
const seats = ref(props.capacity)
const set = rows => emit('update:modelValue', rows)
function add() {
  if (!dates.value?.length || !time.value) return ElMessage.warning(t('schedule.selectDates'))
  if (!Number.isFinite(props.duration) || props.duration < 1) return ElMessage.warning(t('schedule.durationError'))
  const rows = [...props.modelValue, ...dates.value.map(date => makeSession(`${date}T${time.value}:00`, props.duration, seats.value))].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const error = scheduleError(rows, props.duration, props.capacity, props.existing)
  if (error) return ElMessage.warning(t(`schedule.${error}`))
  set(rows)
  dates.value = []
}
function updateStart(index, value) {
  if (!value) return
  set(props.modelValue.map((s, i) => i === index ? makeSession(value, props.duration, s.capacity) : s))
}
watch(() => props.duration, value => {
  if (Number.isFinite(value) && value > 0) set(props.modelValue.map(s => makeSession(jstInput(s.starts_at), value, s.capacity)))
})
watch(() => props.capacity, value => { if (seats.value > value) seats.value = value })
</script>

<template>
  <div class="session-editor">
    <p class="zone">{{ $t('schedule.timezone') }}</p>
    <p class="hint">{{ $t('schedule.hint') }} {{ $t('schedule.totalHint') }}</p>
    <div class="batch">
      <label><span>{{ $t('schedule.dates') }}</span><el-date-picker v-model="dates" type="dates" value-format="YYYY-MM-DD" format="YYYY-MM-DD" :placeholder="$t('schedule.dates')" :aria-label="$t('schedule.dates')" /></label>
      <label><span>{{ $t('schedule.start') }}</span><el-input v-model="time" type="time" :aria-label="$t('schedule.start')" /></label>
      <label><span>{{ $t('schedule.seats') }}</span><el-input-number v-model="seats" :min="1" :max="capacity" :precision="0" controls-position="right" :aria-label="$t('schedule.seats')" /></label>
      <el-button type="primary" plain @click="add">{{ $t('schedule.add') }}</el-button>
    </div>
    <div v-for="(session, index) in modelValue" :key="index" class="session-row">
      <span class="number">{{ index + 1 }}</span>
      <el-date-picker :model-value="jstInput(session.starts_at)" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" format="YYYY-MM-DD HH:mm" :clearable="false" :aria-label="`${$t('schedule.session')} ${index + 1}`" @update:model-value="value => updateStart(index, value)" />
      <span class="range">{{ sessionLabel(session, locale) }}</span>
      <el-input-number :model-value="session.capacity" :min="1" :max="capacity" :precision="0" controls-position="right" :aria-label="`${$t('schedule.seats')} ${index + 1}`" @update:model-value="value => set(modelValue.map((s, i) => i === index ? { ...s, capacity: value } : s))" />
      <el-button type="danger" text :aria-label="`${$t('common.remove')} ${index + 1}`" @click="set(modelValue.filter((_, i) => i !== index))">{{ $t('common.remove') }}</el-button>
    </div>
  </div>
</template>

<style scoped>
.session-editor { width: 100%; }
.zone { color: #4338ca; font-weight: 600; margin: 0 0 6px; }
.hint { color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0 0 16px; }
.batch { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; background: #f8fafc; padding: 16px; border-radius: 10px; }
.batch label { display: grid; gap: 6px; font-size: 13px; color: #475569; }
.batch :deep(.el-date-editor) { max-width: 100%; }
.session-row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 14px 0; border-bottom: 1px solid #edf0f5; }
.number { color: #6366f1; font-weight: 700; width: 18px; }
.range { font-size: 13px; color: #64748b; flex: 1; min-width: 200px; }
.session-row :deep(.el-input-number) { width: 110px; }
</style>
