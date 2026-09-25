import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api, apiEnabled } from '@/services/api'
import { mockSubjects } from '@/mocks/subjects'
import i18n, { pickLocalized } from '@/i18n' // Step 15：报名时按当前界面语言择优实验标题主文本

/**
 * 被试（学生）数据 Store
 *
 * 定位：被试库的“数据层”单一数据源。
 *  - 隐藏信誉分（reputation）在此维护，学生端只读过滤、绝不展示数值
 *  - 信誉分变动留痕（adjustReputation 写入 reputationLog）
 *  - 报名动作（enroll 写入 participations）
 *
 * 学生端与研究者端共享此 store，保证两端数据一致。
 */
export const useSubjectStore = defineStore('subject', () => {
  // 从 mock 深拷贝一份，避免直接改动源常量（数组字段单独浅拷贝即可满足演示需求）
  const list = ref(
    (apiEnabled ? [] : mockSubjects).map((s) => ({
      ...s,
      reputationLog: [...s.reputationLog],
      participations: [...s.participations],
    })),
  )

  async function load(role) {
    if (!apiEnabled) return
    list.value = []
    list.value = role === 'researcher' ? await api('/subjects') : [await api('/me/profile')]
  }

  /** 按 id 获取被试 */
  function getById(id) {
    return list.value.find((s) => s.id === id)
  }

  /**
   * 调整信誉分（核心机制）
   * @param {string} id        被试 id
   * @param {number} delta     变动值（正为加分，负为扣分）
   * @param {string} reason    理由（写入日志，便于审计）
   * @param {string} operator  操作人（研究者姓名）
   * @returns {number} 调整后的信誉分（限制在 0~100）
   */
  async function adjustReputation(id, delta, reason, operator = '研究者', key) {
    if (apiEnabled) {
      const result = await api(`/subjects/${id}/reputation`, { method: 'POST', body: { delta, reason }, key })
      const subject = getById(id)
      if (subject) subject.reputation = result.after
      return result.after
    }
    const s = getById(id)
    if (!s) return
    const before = s.reputation
    const next = Math.max(0, Math.min(100, before + delta))
    s.reputation = next
    s.reputationLog.unshift({
      id: `log_${Date.now()}_${Math.round(Math.random() * 1e4)}`,
      delta: next - before,
      reason,
      operator,
      time: new Date().toISOString(),
    })
    return next
  }

  /**
   * 报名实验：为指定学生写入一条“已报名”参与记录
   * @param {string} subjectId 学生 id
   * @param {object} exp       实验对象（需含 id / name / reward）
   */
  async function enroll(subjectId, exp) {
    if (apiEnabled) {
      await api(`/experiments/${exp.id}/enroll`, { method: 'POST' })
      await load('student')
      return
    }
    const s = getById(subjectId)
    if (!s) return
    // 【Step 15】兼容新 JSONB 结构：
    //  - title 为 {zh,ja,en} 多语言对象 → 按当前界面语言择优落主文本；
    //  - reward_points 取代旧 reward 字段（旧字段兜底兼容）；
    //  - 完整多语言原文另存 experimentTitle，展示侧可按自身界面语言再次择优
    const locale = i18n.global.locale.value
    s.participations.unshift({
      id: `part_${Date.now()}`,
      experimentId: exp.id,
      experimentName: exp.name || pickLocalized(exp.title, locale),
      experimentTitle: { ...(exp.title || {}) },
      reward: exp.reward_points ?? exp.reward,
      status: '已报名',
      enrolledAt: new Date().toISOString(),
      reputationDelta: 0,
      reviewed: false,
    })
  }

  /** 从被试池中移除某位被试（仅影响当前演示数据） */
  function remove(id) {
    if (apiEnabled) return
    const idx = list.value.findIndex((s) => s.id === id)
    if (idx > -1) list.value.splice(idx, 1)
  }

  /**
   * 根据信誉分返回「质量等级」
   * 返回语义 key（供 i18n 翻译 quality.*）与 Element Plus tag 类型
   * @returns {{ key: string, type: string }} key: premium|qualified|observation|low
   */
  function qualityOf(reputation) {
    if (reputation >= 90) return { key: 'premium', type: 'success' }
    if (reputation >= 70) return { key: 'qualified', type: 'primary' }
    if (reputation >= 50) return { key: 'observation', type: 'warning' }
    return { key: 'low', type: 'danger' }
  }

  return {
    load,
    list,
    getById,
    adjustReputation,
    enroll,
    remove,
    qualityOf,
  }
})
