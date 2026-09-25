import { BadRequestException } from '@nestjs/common';
import type { ExperimentSessionDto } from './dto.js';

export function validateSessions(sessions: ExperimentSessionDto[], duration: number, capacity: number, existing: { starts_at: Date; ends_at: Date }[] = []) {
  if (sessions.length + existing.length > 50) throw new BadRequestException('At most 50 sessions per experiment');
  const now = Date.now();
  for (const session of sessions) {
    const start = Date.parse(session.starts_at), end = Date.parse(session.ends_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= now) throw new BadRequestException('Sessions must start in the future');
    if (end - start < duration * 60000) throw new BadRequestException('Session must allow the full experiment duration');
    if (session.capacity > capacity) throw new BadRequestException('Session capacity exceeds total recruitment capacity');
  }
  const ranges = [...existing, ...sessions].map(s => ({ start: new Date(s.starts_at).getTime(), end: new Date(s.ends_at).getTime() })).sort((a, b) => a.start - b.start);
  for (let index = 1; index < ranges.length; index++) {
    if (ranges[index].start < ranges[index - 1].end) throw new BadRequestException('Duplicate or overlapping sessions are not allowed');
  }
}
