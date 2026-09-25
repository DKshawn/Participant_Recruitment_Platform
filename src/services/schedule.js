export const SCHEDULE_TIME_ZONE = 'Asia/Tokyo'
export const MAX_SESSIONS = 50
export const jstInput = value => new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(0, 19)
export function makeSession(localStart, duration, capacity) {
  const start = new Date(`${localStart}+09:00`)
  return { starts_at: start.toISOString(), ends_at: new Date(start.getTime() + duration * 60000).toISOString(), capacity }
}
export function sessionLabel(session, locale = 'zh-CN') {
  if (!session?.starts_at) return ''
  const options = { timeZone: SCHEDULE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
  const start = new Date(session.starts_at), end = new Date(session.ends_at)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return ''
  const sameDay = jstInput(start).slice(0, 10) === jstInput(end).slice(0, 10)
  return `${start.toLocaleString(locale, options)} – ${end.toLocaleString(locale, sameDay ? { timeZone: SCHEDULE_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : options)}`
}
export function scheduleError(sessions, duration, total, existing = []) {
  if (!sessions.length) return 'required'
  if (sessions.length + existing.length > MAX_SESSIONS) return 'tooMany'
  for (const session of sessions) {
    const start = Date.parse(session.starts_at), end = Date.parse(session.ends_at)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= Date.now()) return 'futureOnly'
    if (end - start < duration * 60000) return 'durationError'
    if (!Number.isInteger(session.capacity) || session.capacity < 1 || session.capacity > total) return 'capacityError'
  }
  const sorted = [...existing, ...sessions].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
  if (sorted.some((s, i) => i > 0 && Date.parse(s.starts_at) < Date.parse(sorted[i - 1].ends_at))) return 'overlap'
  return ''
}
export const sessionUnavailable = session => Date.parse(session.starts_at) <= Date.now() || session.filled >= session.capacity
