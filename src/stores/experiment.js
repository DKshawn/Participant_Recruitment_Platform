import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { mockExperiments } from '@/mocks/experiments'
import { api, apiEnabled } from '@/services/api'

/**
 * 实验 Store（已发布实验的单一数据源）
 *
 * 定位：所有「实验」数据的统一出口，被以下三处共享，保证数据一致：
 *  - 学生端·实验大厅：读取 published 并按信誉分过滤展示
 *  - 研究者端·发布新实验：add() 新增实验后实时插入列表顶部
 *  - 研究者端·实验管理：读取 / 删除等
 */
export const useExperimentStore = defineStore('experiment', () => {
  // 已发布实验列表：初始由 mock 注入（深拷贝，避免改动源常量）
  const published = ref(apiEnabled ? [] : mockExperiments.map((e) => ({ ...e })))

  async function load() {
    if (!apiEnabled) return
    published.value = []
    published.value = await api('/experiments')
  }

  const totalPublished = computed(() => published.value.length)

  /** 按 id 获取实验 */
  function getById(id) {
    return published.value.find((e) => e.id === id)
  }

  /** 新增（发布）一个实验：自动补 id / 创建时间，插入列表顶部 */
  async function add(exp) {
    if (apiEnabled) {
      const body = Object.fromEntries(['title', 'description', 'required_items', 'tags', 'tagsLocales', 'location_type', 'location_detail', 'reward_points', 'duration_minutes', 'min_reputation_required'].map(k => [k, exp[k]]))
      body.capacity = exp.slots.total
      const saved = await api('/experiments', { method: 'POST', body })
      published.value.unshift(saved)
      return saved
    }
    const newExp = {
      ...exp,
      id: `exp_${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    published.value.unshift(newExp)
    return newExp
  }

  /** 删除实验（实验管理页使用） */
  function remove(id) {
    if (apiEnabled) return
    const idx = published.value.findIndex((e) => e.id === id)
    if (idx > -1) published.value.splice(idx, 1)
  }

  return {
    load,
    published,
    totalPublished,
    getById,
    add,
    remove,
  }
})
