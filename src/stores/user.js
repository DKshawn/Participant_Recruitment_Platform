import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { mockSubjects } from '@/mocks/subjects'
import i18n, { pickLocalized } from '@/i18n'
import { api, apiEnabled } from '@/services/api'

const SESSION_KEY = 'actmind.session'
export const useUserStore = defineStore('user', () => {
  const role = ref(null)
  const student = ref(null)
  const researcher = ref(null)
  const ssoEmail = ref(null)
  const ready = ref(false)
  let initializing
  const studentOptions = mockSubjects.map(s => ({ id:s.id,name:s.name,majorKey:s.majorKey,gradeKey:s.gradeKey }))
  const researcherOptions = [
    { id:'res_001',name:{zh:'顾言',en:'Gu Yan',ja:'ゴ・エン'},title:'行为经济学实验室 · PI' },
    { id:'res_002',name:{zh:'沈知',en:'Shen Zhi',ja:'シン・ジ'},title:'认知心理学 · 研究助理' },
  ]
  const isLoggedIn = computed(() => Boolean(role.value))
  const isStudent = computed(() => role.value === 'student')
  const isResearcher = computed(() => role.value === 'researcher')
  const displayName = computed(() => pickLocalized((isStudent.value ? student.value : researcher.value)?.name, i18n.global.locale.value))
  function apply(profile) {
    role.value = profile?.role || null
    student.value = profile?.role === 'student' ? profile : null
    researcher.value = profile?.role === 'researcher' ? profile : null
    ssoEmail.value = profile?.email || null
  }
  function saveDemo() {
    if (apiEnabled) return
    try {
      const person = isStudent.value ? student.value : researcher.value
      if (person) localStorage.setItem(SESSION_KEY, JSON.stringify({ role:role.value,id:person.id,email:ssoEmail.value }))
      else localStorage.removeItem(SESSION_KEY)
    } catch { /* storage is optional in demo mode */ }
  }
  function loginAsStudent(id=studentOptions[0].id) {
    if (apiEnabled) throw new Error('Server authentication required')
    apply({ ...(studentOptions.find(s=>s.id===id)||studentOptions[0]),role:'student' })
    saveDemo()
  }
  function loginAsResearcher(id=researcherOptions[0].id) {
    if (apiEnabled) throw new Error('Server authentication required')
    apply({ ...(researcherOptions.find(s=>s.id===id)||researcherOptions[0]),role:'researcher' })
    saveDemo()
  }
  function switchRole(target) { if (target==='student') loginAsStudent(); else loginAsResearcher() }
  function loginWithSso(target,email) {
    switchRole(target)
    ssoEmail.value=email
    saveDemo()
  }
  async function initialize() {
    if (ready.value) return
    if (initializing) return initializing
    initializing = (async () => {
      if (apiEnabled) {
        try { apply(await api('/auth/me')) }
        catch (error) { if (error.status===401) apply(null); else throw error }
      } else {
        try {
          const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null')
          const person = saved?.role==='student' ? studentOptions.find(s=>s.id===saved.id) : saved?.role==='researcher' ? researcherOptions.find(s=>s.id===saved.id) : null
          apply(person ? { ...person, role:saved.role, email:saved.email || null } : null)
        } catch { apply(null) }
      }
      ready.value=true
    })().finally(()=>{ initializing=null })
    return initializing
  }
  async function loginDevelopment(target) {
    apply(await api('/auth/dev',{method:'POST',body:{role:target}}))
    ready.value=true
  }
  async function logout() {
    if(apiEnabled) {
      try { await api('/auth/logout',{method:'POST'}) }
      catch(error) { if(error.status!==401) throw error }
    }
    apply(null)
    saveDemo()
  }
  return { role,student,researcher,ssoEmail,studentOptions,researcherOptions,isLoggedIn,isStudent,isResearcher,displayName,initialize,loginDevelopment,loginAsStudent,loginAsResearcher,switchRole,loginWithSso,logout }
})
