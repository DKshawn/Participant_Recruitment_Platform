<script setup>
import { computed, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSubjectStore } from '@/stores/subject'
import { useUserStore } from '@/stores/user'
import { pickLocalized } from '@/i18n'
import { sessionLabel } from '@/services/schedule'
const subjects = useSubjectStore()
const user = useUserStore()
const { locale } = useI18n()
const error = ref('')
const loading = ref(false)
const records = computed(() => subjects.getById(user.student?.id)?.participations || [])
async function load() {
  loading.value = true
  error.value = ''
  try { await subjects.load('student') } catch (err) { error.value = err.message }
  finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <section class="records">
    <h1>{{ $t('menu.records') }}</h1>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-button v-if="error" @click="load">{{ $t('backend.retry') }}</el-button>
    <el-card shadow="never">
      <el-table v-loading="loading" :data="records" :empty-text="$t('backend.empty')">
        <el-table-column :label="$t('backend.experiment')" min-width="240"><template #default="{ row }">{{ pickLocalized(row.experimentTitle || row.experimentName, locale) }}</template></el-table-column>
        <el-table-column :label="$t('backend.status')" width="180"><template #default="{ row }"><el-tag :type="row.status === '已完成' ? 'success' : 'info'">{{ $t(row.status === '已完成' ? 'backend.completed' : 'backend.enrolled') }}</el-tag></template></el-table-column>
        <el-table-column prop="reward" :label="$t('backend.reward')" width="120" />
        <el-table-column :label="$t('schedule.session') + ' (JST)'" min-width="250"><template #default="{ row }">{{ row.session ? sessionLabel(row.session, locale) : $t('schedule.noSchedule') }}</template></el-table-column>
        <el-table-column :label="$t('backend.time')" min-width="180"><template #default="{ row }">{{ new Date(row.enrolledAt).toLocaleString(locale) }}</template></el-table-column>
      </el-table>
    </el-card>
  </section>
</template>

<style scoped>
.records { display: grid; gap: 20px; }
h1 { margin: 0; font-size: 24px; }
</style>
