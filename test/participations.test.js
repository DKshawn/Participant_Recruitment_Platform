import test from 'node:test'
import assert from 'node:assert/strict'
import { mockSubjects } from '../src/mocks/subjects.js'
import { restoreParticipationTitles } from '../src/services/participations.js'

test('previously cached Chinese-only demo records gain Japanese and English titles without losing data', () => {
  const cached = structuredClone(mockSubjects)
  for (const subject of cached) for (const record of subject.participations) delete record.experimentTitle
  cached[0].reputation = 88
  cached[0].participations.push({ id: 'custom-enrollment', experimentId: 'custom-study', experimentName: '用户发布的实验', session: { id: 'chosen-session' } })
  const before = structuredClone(cached)
  const restored = restoreParticipationTitles(cached, mockSubjects)
  assert.deepEqual(restored.map(s => s.participations[0].experimentTitle.ja), ['リスク選好測定実験', '異時点間選択行動実験', '注意と反応時間タスク'])
  assert.equal(restored[0].participations[0].experimentTitle.en, 'Risk Preference Measurement Experiment')
  const withoutTitles = structuredClone(restored)
  for (const subject of withoutTitles) for (const record of subject.participations) delete record.experimentTitle
  assert.deepEqual(withoutTitles, before)
  assert.deepEqual(cached, before)
  assert.deepEqual(restoreParticipationTitles(restored, mockSubjects), restored)
})

test('migration fills missing translations but preserves edited and unknown titles', () => {
  const cached = structuredClone(mockSubjects)
  cached[0].participations[0].experimentTitle = { zh: '风险偏好测量实验', ja: '独自の日本語タイトル', en: ' ' }
  cached[1].participations[0].experimentName = '另一个名称'
  delete cached[1].participations[0].experimentTitle
  cached[2].participations[0].experimentTitle = 'A custom historical title'
  const restored = restoreParticipationTitles(cached, mockSubjects)
  assert.equal(restored[0].participations[0].experimentTitle.ja, '独自の日本語タイトル')
  assert.equal(restored[0].participations[0].experimentTitle.en, 'Risk Preference Measurement Experiment')
  assert.equal(restored[1].participations[0].experimentTitle, undefined)
  assert.equal(restored[2].participations[0].experimentTitle, 'A custom historical title')
})
