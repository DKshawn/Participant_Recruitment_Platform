// Older demo records have no capacity or status. Normalize them at the store boundary.
export function normalizeExperiment(exp) {
  return {
    ...exp,
    status: exp.status || 'published',
    slots: { total: exp.slots?.total ?? 20, filled: exp.slots?.filled ?? 0 },
    sessions: Array.isArray(exp.sessions) ? exp.sessions : [],
  }
}

export function restoreExperiments(storage, seeds) {
  try {
    const saved = JSON.parse(storage.getItem('actmind.demo.experiments.v1') || 'null')
    if (Array.isArray(saved) && saved.every(exp => exp && typeof exp.id === 'string')) return saved.map(normalizeExperiment)
  } catch { /* A corrupt or unavailable browser store must not blank the management page. */ }
  return seeds.map(exp => normalizeExperiment(structuredClone(exp)))
}
