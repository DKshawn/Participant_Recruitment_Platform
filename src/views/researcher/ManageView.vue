<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useExperimentStore } from '@/stores/experiment'
import { useSubjectStore } from '@/stores/subject'
import SessionEditor from '@/components/SessionEditor.vue'
import { scheduleError, sessionLabel } from '@/services/schedule'
import { api, apiEnabled } from '@/services/api'
import { pickLocalized } from '@/i18n'

const store = useExperimentStore()
const subjects = useSubjectStore()
const { t, locale } = useI18n()
const loading = ref(false)
const error = ref('')
const selected = ref(null)
const participants = ref([])
const visible = ref(false)
const busy = ref(false)
const participantLoading = ref(false)
const participantError = ref('')
const query = ref('')
const status = ref('all')
const detailVisible = ref(false)
const scheduleVisible = ref(false)
const newSessions = ref([])
const text = value => pickLocalized(value, locale.value)
const filtered = computed(() => store.published.filter(exp => (status.value === 'all' || exp.status === status.value) && `${text(exp.title)} ${exp.code || ''}`.toLowerCase().includes(query.value.trim().toLowerCase())))
function showDetail(exp) { selected.value = exp; detailVisible.value = true }
function editSchedule(exp) { selected.value = exp; newSessions.value = []; scheduleVisible.value = true }
async function saveSchedule() {
  const exp = selected.value
  const validation = scheduleError(newSessions.value, exp.duration_minutes, exp.slots.total, exp.sessions)
  if (validation) return ElMessage.warning(t(`schedule.${validation}`))
  busy.value = true
  try {
    await store.addSessions(exp.id, newSessions.value)
    selected.value = store.getById(exp.id)
    scheduleVisible.value = false
    ElMessage.success(t('schedule.saved'))
  } catch (err) { ElMessage.error(err.message) }
  finally { busy.value = false }
}
async function load() {
  loading.value = true
  error.value = ''
  try { await store.load() } catch (err) { error.value = err.message }
  finally { loading.value = false }
}
async function showParticipants(exp) {
  selected.value = exp
  visible.value = true
  participants.value = []
  participantError.value = ''
  participantLoading.value = true
  try {
    participants.value = apiEnabled ? await api(`/experiments/${exp.id}/enrollments`) : subjects.list.flatMap(subject => subject.participations.filter(p => p.experimentId === exp.id).map(p => ({
      id: p.id, name: subject.name, status: p.status === '已完成' ? 'completed' : 'enrolled', reward_points: p.reward,
      session_id: p.session?.id, starts_at: p.session?.starts_at, ends_at: p.session?.ends_at,
    })))
  }
  catch (err) { participantError.value = err.message }
  finally { participantLoading.value = false }
}
async function complete(row) {
  if (busy.value) return
  busy.value = true
  try {
    await ElMessageBox.confirm(t('backend.completeConfirm', { n: row.reward_points }), t('backend.complete'), { type: 'warning', confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel') })
  } catch { busy.value = false; return }
  try {
    await api(`/enrollments/${row.id}/complete`, { method: 'POST' })
    row.status = 'completed'
    ElMessage.success(t('backend.credited'))
  } catch (err) { ElMessage.error(err.message) }
  finally { busy.value = false }
}
async function close(exp) {
  if (busy.value) return
  busy.value = true
  try {
    await ElMessageBox.confirm(t('backend.closeConfirm'), t('backend.close'), { type: 'warning', confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel') })
  } catch { busy.value = false; return }
  try { await store.close(exp.id) }
  catch (err) { ElMessage.error(err.message) }
  finally { busy.value = false }
}
onMounted(load)
</script>

<template>
  <section class="manage">
    <div class="heading"><div><h1>{{ $t('menu.manage') }}</h1><p class="hint">{{ $t('schedule.manageHint') }} {{ apiEnabled ? $t('schedule.mine') : '' }}</p></div><div><el-button :loading="loading" @click="load">{{ $t('backend.retry') }}</el-button><el-button type="primary" @click="$router.push('/researcher/publish')">{{ $t('schedule.create') }}</el-button></div></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-if="!apiEnabled" :title="$t(store.storageError ? 'schedule.storageError' : 'schedule.demoSaved')" :type="store.storageError ? 'warning' : 'info'" :closable="false" />
    <el-card shadow="never">
      <div class="filters"><el-input v-model="query" :placeholder="$t('schedule.search')" :aria-label="$t('schedule.search')" clearable /><el-select v-model="status" :aria-label="$t('backend.status')"><el-option value="all" :label="$t('schedule.all')" /><el-option value="published" :label="$t('backend.published')" /><el-option value="closed" :label="$t('backend.closed')" /></el-select></div>
      <el-table v-loading="loading" :data="filtered" :empty-text="$t('backend.empty')">
        <el-table-column :label="$t('backend.experiment')" min-width="200"><template #default="{ row }"><b>{{ text(row.title) }}</b><div class="code">{{ row.code }}</div></template></el-table-column>
        <el-table-column :label="$t('backend.participants')" width="120"><template #default="{ row }">{{ row.slots.filled }} / {{ row.slots.total }}</template></el-table-column>
        <el-table-column :label="$t('schedule.session') + ' (JST)'" min-width="210"><template #default="{ row }"><el-tag :type="row.sessions.length ? 'primary' : 'info'">{{ row.sessions.length ? $t('schedule.count', { n: row.sessions.length }) : $t('schedule.noSchedule') }}</el-tag><div v-if="row.sessions.length" class="hint">{{ sessionLabel(row.sessions.find(s => Date.parse(s.starts_at) > Date.now()) || row.sessions[0], locale) }}</div></template></el-table-column>
        <el-table-column prop="reward_points" :label="$t('backend.reward')" width="100" />
        <el-table-column :label="$t('backend.status')" width="120"><template #default="{ row }"><el-tag :type="row.status === 'closed' ? 'info' : 'success'">{{ $t('backend.' + row.status) }}</el-tag></template></el-table-column>
        <el-table-column :label="$t('backend.actions')" min-width="210"><template #default="{ row }"><div class="row-actions">
          <el-button type="primary" link @click="showDetail(row)">{{ $t('schedule.details') }}</el-button>
          <el-button type="primary" link :disabled="busy" @click="showParticipants(row)">{{ $t('backend.participants') }}</el-button>
          <el-button v-if="row.status === 'published'" type="primary" link :disabled="busy" @click="editSchedule(row)">{{ $t('schedule.addMore') }}</el-button>
          <el-button v-if="row.status === 'published'" type="danger" link :disabled="busy" @click="close(row)">{{ $t('backend.close') }}</el-button>
          </div>
        </template></el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="detailVisible" :title="text(selected?.title)" width="min(820px, 95vw)">
      <template v-if="selected">
        <p class="description">{{ text(selected.description) }}</p>
        <p>{{ $t('publish.locationType') }}：{{ selected.location_detail }} · {{ selected.duration_minutes }} {{ $t('common.minutes') }}</p>
        <h3>{{ $t('schedule.existing') }}</h3><p class="hint">{{ $t('schedule.timezone') }}</p>
        <p v-if="!selected.sessions.length">{{ $t('schedule.noSchedule') }}</p>
        <div v-for="session in selected.sessions" :key="session.id" class="session-line"><span>{{ sessionLabel(session, locale) }}</span><el-tag>{{ session.filled }} / {{ session.capacity }}</el-tag></div>
      </template>
      <template #footer><el-button v-if="selected?.status === 'published'" type="primary" @click="detailVisible = false; editSchedule(selected)">{{ $t('schedule.addMore') }}</el-button></template>
    </el-dialog>
    <el-dialog v-model="scheduleVisible" :title="$t('schedule.addMore')" width="min(1000px, 95vw)" destroy-on-close :close-on-click-modal="!busy" :show-close="!busy" :close-on-press-escape="!busy">
      <template v-if="selected">
        <h3>{{ text(selected.title) }}</h3><p class="hint">{{ $t('schedule.appendHint') }}</p>
        <div v-for="session in selected.sessions" :key="session.id" class="session-line"><span>{{ sessionLabel(session, locale) }} (JST)</span><el-tag>{{ session.filled }} / {{ session.capacity }}</el-tag></div>
        <el-form :disabled="busy"><SessionEditor v-model="newSessions" :duration="selected.duration_minutes" :capacity="selected.slots.total" :existing="selected.sessions" /></el-form>
      </template>
      <template #footer><el-button :disabled="busy" @click="scheduleVisible = false">{{ $t('common.cancel') }}</el-button><el-button type="primary" :loading="busy" @click="saveSchedule">{{ $t('schedule.save') }}</el-button></template>
    </el-dialog>
    <el-dialog v-model="visible" :title="text(selected?.title)" width="min(900px, 95vw)" :close-on-click-modal="!busy" :show-close="!busy" :close-on-press-escape="!busy">
      <el-alert v-if="participantError" :title="participantError" type="error" :closable="false" />
      <el-button v-if="participantError" @click="showParticipants(selected)">{{ $t('backend.retry') }}</el-button>
      <el-table v-loading="participantLoading" :data="participants" :empty-text="$t('backend.empty')">
        <el-table-column :label="$t('backend.participants')" min-width="150"><template #default="{ row }">{{ text(row.name) }}</template></el-table-column>
        <el-table-column :label="$t('schedule.session') + ' (JST)'" min-width="210"><template #default="{ row }">{{ row.session_id ? sessionLabel(row, locale) : $t('schedule.noSchedule') }}</template></el-table-column>
        <el-table-column :label="$t('backend.status')" width="130"><template #default="{ row }">{{ $t('backend.' + row.status) }}</template></el-table-column>
        <el-table-column prop="reward_points" :label="$t('backend.reward')" width="100" />
        <el-table-column v-if="apiEnabled" :label="$t('backend.actions')" min-width="250"><template #default="{ row }"><el-button v-if="row.status === 'enrolled'" type="primary" :loading="busy" @click="complete(row)">{{ $t('backend.complete') }}</el-button></template></el-table-column>
      </el-table>
    </el-dialog>
  </section>
</template>

<style scoped>
.manage { display: grid; gap: 20px; }
.heading { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
.hint { color: #64748b; font-size: 13px; line-height: 1.7; margin: 8px 0; }
.filters { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.filters .el-input { max-width: 380px; }
.filters .el-select { width: 180px; }
.row-actions { display: flex; gap: 10px 16px; flex-wrap: wrap; }
.row-actions .el-button { margin-left: 0; }
.session-line { display: flex; justify-content: space-between; gap: 20px; padding: 12px 0; border-bottom: 1px solid #eef0f5; margin-bottom: 10px; }
.description { white-space: pre-wrap; line-height: 1.8; }
h1 { margin: 0; font-size: 24px; }
.code { color: #9ca3af; font-size: 12px; margin-top: 6px; }
</style>
