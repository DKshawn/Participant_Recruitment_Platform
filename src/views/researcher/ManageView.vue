<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useExperimentStore } from '@/stores/experiment'
import { api, apiEnabled } from '@/services/api'
import { pickLocalized } from '@/i18n'

const store = useExperimentStore()
const { t, locale } = useI18n()
const loading = ref(false)
const error = ref('')
const selected = ref(null)
const participants = ref([])
const visible = ref(false)
const busy = ref(false)
const participantLoading = ref(false)
const participantError = ref('')
const text = value => pickLocalized(value, locale.value)
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
  try { participants.value = await api(`/experiments/${exp.id}/enrollments`) }
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
  try { await api(`/experiments/${exp.id}/close`, { method: 'POST' }); await load() }
  catch (err) { ElMessage.error(err.message) }
  finally { busy.value = false }
}
onMounted(load)
</script>

<template>
  <section class="manage">
    <div class="heading"><h1>{{ $t('menu.manage') }}</h1><el-button :loading="loading" @click="load">{{ $t('backend.retry') }}</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-if="!apiEnabled" :title="$t('backend.demoOnly')" type="info" :closable="false" />
    <el-card shadow="never">
      <el-table v-loading="loading" :data="store.published" :empty-text="$t('backend.empty')">
        <el-table-column :label="$t('backend.experiment')" min-width="240"><template #default="{ row }"><b>{{ text(row.title) }}</b><div class="code">{{ row.code }}</div></template></el-table-column>
        <el-table-column :label="$t('backend.participants')" width="120"><template #default="{ row }">{{ row.slots.filled }} / {{ row.slots.total }}</template></el-table-column>
        <el-table-column prop="reward_points" :label="$t('backend.reward')" width="100" />
        <el-table-column :label="$t('backend.status')" width="160"><template #default="{ row }"><el-tag :type="row.status === 'closed' ? 'info' : 'success'">{{ $t('backend.' + (row.status || 'published')) }}</el-tag></template></el-table-column>
        <el-table-column v-if="apiEnabled" :label="$t('backend.actions')" min-width="240"><template #default="{ row }">
          <el-button type="primary" plain :disabled="busy" @click="showParticipants(row)">{{ $t('backend.participants') }}</el-button>
          <el-button v-if="row.status === 'published'" :disabled="busy" @click="close(row)">{{ $t('backend.close') }}</el-button>
        </template></el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="visible" :title="text(selected?.title)" width="min(900px, 95vw)" :close-on-click-modal="!busy" :show-close="!busy" :close-on-press-escape="!busy">
      <el-alert v-if="participantError" :title="participantError" type="error" :closable="false" />
      <el-button v-if="participantError" @click="showParticipants(selected)">{{ $t('backend.retry') }}</el-button>
      <el-table v-loading="participantLoading" :data="participants" :empty-text="$t('backend.empty')">
        <el-table-column :label="$t('backend.participants')" min-width="150"><template #default="{ row }">{{ text(row.name) }}</template></el-table-column>
        <el-table-column :label="$t('backend.status')" width="130"><template #default="{ row }">{{ $t('backend.' + row.status) }}</template></el-table-column>
        <el-table-column prop="reward_points" :label="$t('backend.reward')" width="100" />
        <el-table-column :label="$t('backend.actions')" min-width="250"><template #default="{ row }"><el-button v-if="row.status === 'enrolled'" type="primary" :loading="busy" @click="complete(row)">{{ $t('backend.complete') }}</el-button></template></el-table-column>
      </el-table>
    </el-dialog>
  </section>
</template>

<style scoped>
.manage { display: grid; gap: 20px; }
.heading { display: flex; justify-content: space-between; align-items: center; }
h1 { margin: 0; font-size: 24px; }
.code { color: #9ca3af; font-size: 12px; margin-top: 6px; }
</style>
