// Upgrade only known historical demo titles; keep saved enrollments and custom text.
export function restoreParticipationTitles(subjects, seeds) {
  const historical = new Map(seeds.flatMap(s => s.participations.map(p => [p.experimentId, p])))
  return subjects.map(subject => ({
    ...subject,
    participations: subject.participations.map(record => {
      const seed = historical.get(record.experimentId)
      if (!seed?.experimentTitle || record.experimentName !== seed.experimentName || typeof record.experimentTitle === 'string') return record
      const savedTitles = Object.entries(record.experimentTitle || {}).filter(([, title]) => typeof title === 'string' && title.trim())
      return { ...record, experimentTitle: { ...seed.experimentTitle, ...Object.fromEntries(savedTitles) } }
    }),
  }))
}
