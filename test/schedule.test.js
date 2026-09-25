import test from 'node:test'
import assert from 'node:assert/strict'
import { restoreExperiments } from '../src/services/experiments.js'
import { makeSession, jstInput, scheduleError, sessionLabel, sessionUnavailable } from '../src/services/schedule.js'
import { mockExperiments } from '../src/mocks/experiments.js'

test('all original demo experiments render with capacity, status and sessions', () => {
  const restored = restoreExperiments({ getItem: () => null }, mockExperiments)
  assert.equal(restored.length, mockExperiments.length)
  for (const exp of restored) {
    assert.ok(exp.slots.total > 0)
    assert.equal(exp.status, 'published')
    assert.deepEqual(exp.sessions, [])
  }
  restored[0].title.zh = 'Changed only the copy'
  assert.notEqual(restored[0].title.zh, mockExperiments[0].title.zh)
})

test('refresh restores published sessions, occupancy and closed studies', () => {
  const saved = [{ id: 'custom', status: 'closed', slots: { total: 5, filled: 1 }, sessions: [{ id: 'chosen', ...makeSession('2099-01-01T10:00:00', 30, 2), filled: 1 }] }]
  assert.deepEqual(restoreExperiments({ getItem: () => JSON.stringify(saved) }, mockExperiments), saved)
  for (const getItem of [() => '{corrupt', () => '{}', () => '[null]', () => { throw new Error('disabled storage') }]) {
    assert.equal(restoreExperiments({ getItem }, mockExperiments).length, mockExperiments.length)
  }
})

test('Japan time survives serialization and midnight independent of browser time zone', () => {
  const session = makeSession('2099-01-01T23:45:00', 30, 2)
  assert.equal(session.starts_at, '2099-01-01T14:45:00.000Z')
  assert.equal(jstInput(session.ends_at), '2099-01-02T00:15:00')
  assert.match(sessionLabel(session, 'en-US'), /23:45.*00:15/)
})

test('schedule validation rejects invalid ranges and capacities while allowing adjacent sessions', () => {
  const a = makeSession('2099-01-01T10:00:00', 30, 2)
  const b = makeSession('2099-01-01T10:30:00', 30, 2)
  assert.equal(scheduleError([a, b], 30, 3), '')
  assert.equal(scheduleError([a], 30, 3, [a]), 'overlap')
  assert.equal(scheduleError([makeSession('2099-01-01T10:15:00', 30, 1)], 30, 3, [a]), 'overlap')
  assert.equal(scheduleError([], 30, 3), 'required')
  assert.equal(scheduleError([{ ...a, capacity: 4 }], 30, 3), 'capacityError')
  assert.equal(scheduleError([{ ...a, capacity: 1.5 }], 30, 3), 'capacityError')
  assert.equal(scheduleError([a], 60, 3), 'durationError')
  assert.equal(scheduleError([{ ...a, starts_at: '2000-01-01T00:00:00Z' }], 30, 3), 'futureOnly')
  assert.equal(scheduleError(Array(51).fill(a), 30, 3), 'tooMany')
  assert.equal(sessionUnavailable({ ...a, filled: 2 }), true)
  assert.equal(sessionUnavailable({ ...a, filled: 1 }), false)
})
