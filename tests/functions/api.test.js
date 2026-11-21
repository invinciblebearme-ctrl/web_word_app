import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handle } from '../../functions/_lib/api.js'
import { onRequest } from '../../functions/api/[[path]].js'
import { createD1 } from './d1shim.js'

const device = '0123456789abcdef'
const otherDevice = 'fedcba9876543210'
let db
let classroom

async function call(path, method = 'GET', body, key, env = { DB: db }) {
  const headers = {}
  if (key) headers.Authorization = `Bearer ${key}`
  const request = new Request(`https://example.test/api/classes${path}`, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const response = await handle(request, env)
  expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
  expect(response.headers.get('cache-control')).toBe('no-store')
  return { status: response.status, data: await response.json() }
}
const sync = (answers = { apple: [3, 2] }, batch = 'batch-1', id = device, no = 1) => call(`/${classroom.code}/sync`, 'POST', { device: id, no, batch, answers })
const stats = () => call(`/${classroom.code}/stats`, 'GET', undefined, classroom.teacherKey)

beforeEach(async () => {
  db = createD1()
  classroom = (await call('', 'POST', { name: '  우리 반  ' })).data
})
afterEach(() => { db.close(); vi.restoreAllMocks() })

describe('classroom API', () => {
  it('creates random credentials, stores only the teacher hash, and trims the name', async () => {
    expect(classroom).toMatchObject({ name: '우리 반' })
    expect(classroom.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
    expect(classroom.teacherKey).toMatch(/^[a-f0-9]{48}$/)
    const row = await db.prepare('SELECT * FROM classes').first()
    expect(row.teacher_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(row)).not.toContain(classroom.teacherKey)
    expect((await call('', 'POST', { name: '다른 반' })).status).toBe(201)
  })

  it.each([{}, { name: '' }, { name: '  ' }, { name: 7 }, { name: '가'.repeat(31) }])('rejects invalid names %j', async body => {
    expect(await call('', 'POST', body)).toEqual({ status: 400, data: { error: 'bad_name' } })
  })

  it('joins with a lowercase code, syncs, sorts members and aggregates stats', async () => {
    expect(await call(`/${classroom.code.toLowerCase()}/join`, 'POST', { device, no: 9 })).toEqual({ status: 200, data: { name: '우리 반', code: classroom.code, no: 9 } })
    expect(await sync({ apple: [3, 2], about: [1, 1] }, 'one', device, 9)).toEqual({ status: 200, data: { ok: true, accepted: 7 } })
    await sync({ apple: [2, 1] }, 'two', otherDevice, 2)
    const result = await stats()
    expect(result.status).toBe(200)
    expect(result.data.totals).toEqual({ members: 2, answered: 10, correct: 6 })
    expect(result.data.members.map(member => member.no)).toEqual([2, 9])
    expect(result.data.members[1]).toMatchObject({ answered: 7, correct: 4, lastSeen: expect.any(Number) })
    expect(result.data.topWrong).toEqual([{ en: 'apple', wrong: 3, correct: 5 }, { en: 'about', wrong: 1, correct: 1 }])
    expect(JSON.stringify(result.data)).not.toContain(device)
    expect(JSON.stringify(result.data)).not.toContain('teacher_hash')
  })

  it('rejoins by updating only the number and preserving accumulated answers', async () => {
    await sync()
    await call(`/${classroom.code}/join`, 'POST', { device, no: 8 })
    expect((await stats()).data.members).toEqual([{ no: 8, answered: 5, correct: 3, lastSeen: expect.any(Number) }])
  })

  it('deduplicates the previous batch, including after rejoining, and accepts the next batch', async () => {
    await sync()
    await call(`/${classroom.code}/join`, 'POST', { device, no: 3 })
    expect((await sync()).data).toEqual({ ok: true, accepted: 0, duplicate: true })
    expect((await stats()).data.totals.answered).toBe(5)
    expect((await stats()).data.topWrong[0].wrong).toBe(2)
    await sync({ apple: [1, 1] }, 'batch-2')
    expect((await stats()).data.totals.answered).toBe(7)
  })

  it('deduplicates a batch replayed after a newer batch without changing either aggregate', async () => {
    await sync()
    await sync({ apple: [1, 1], about: [0, 1] }, 'batch-2')
    const before = (await stats()).data
    expect((await sync()).data).toEqual({ ok: true, accepted: 0, duplicate: true })
    expect((await stats()).data).toEqual(before)
    expect(before.totals).toEqual({ members: 1, answered: 8, correct: 4 })
    expect(await db.prepare('SELECT COUNT(*) AS n FROM sync_batches WHERE applied = 1').first('n')).toBe(2)
  })

  it('ignores words outside the supplied word list, including their malformed counts', async () => {
    expect((await sync({ not_a_valid_word: 'ignored', apple: [1, 0] })).data.accepted).toBe(1)
    expect((await stats()).data.totals.answered).toBe(1)
  })

  it('counts concurrent identical retries once', async () => {
    const results = await Promise.all([sync(), sync(), sync()])
    expect(results.every(result => result.status === 200)).toBe(true)
    expect(results.filter(result => result.data.duplicate)).toHaveLength(2)
    expect((await stats()).data.totals.answered).toBe(5)
    expect((await stats()).data.topWrong[0].wrong).toBe(2)
    expect(await db.prepare('SELECT COUNT(*) AS n FROM sync_batches WHERE applied = 1').first('n')).toBe(1)
  })

  it('counts each batch once when concurrent retries interleave with other batches', async () => {
    const results = await Promise.all(['a', 'b', 'a', 'c', 'b', 'a'].map(batch => sync(undefined, batch)))
    expect(results.every(result => result.status === 200)).toBe(true)
    expect(results.filter(result => result.data.duplicate)).toHaveLength(3)
    expect(results.reduce((sum, result) => sum + result.data.accepted, 0)).toBe(15)
    const result = (await stats()).data
    expect(result.totals).toEqual({ members: 1, answered: 15, correct: 9 })
    expect(result.topWrong).toEqual([{ en: 'apple', correct: 9, wrong: 6 }])
    expect(await db.prepare('SELECT COUNT(*) AS n FROM sync_batches WHERE applied = 1').first('n')).toBe(3)
  })

  it('keeps identical batch ids independent for different devices', async () => {
    await sync()
    await sync({ apple: [1, 1] }, 'batch-1', otherDevice, 1)
    expect((await stats()).data.totals).toEqual({ members: 2, answered: 7, correct: 4 })
  })

  it('prunes only expired batches for the syncing classroom and device', async () => {
    const start = Date.now()
    const day = 24 * 60 * 60 * 1000
    const clock = vi.spyOn(Date, 'now').mockReturnValue(start)
    await sync(undefined, 'expired')
    await sync(undefined, 'other-device', otherDevice)
    const other = (await call('', 'POST', { name: '다른 반' })).data
    await call(`/${other.code}/sync`, 'POST', { device, no: 1, batch: 'other-class', answers: { apple: [1, 0] } })
    clock.mockReturnValue(start + day)
    await sync(undefined, 'boundary')
    clock.mockReturnValue(start + 2 * day)
    await sync(undefined, 'recent')
    clock.mockReturnValue(start + 31 * day)
    expect((await sync(undefined, 'new')).data).toEqual({ ok: true, accepted: 5 })
    const { results } = await db.prepare('SELECT batch FROM sync_batches ORDER BY batch').all()
    expect(results.map(row => row.batch)).toEqual(['boundary', 'new', 'other-class', 'other-device', 'recent'])
    expect((await sync(undefined, 'boundary')).data).toEqual({ ok: true, accepted: 0, duplicate: true })
    expect((await sync(undefined, 'recent')).data).toEqual({ ok: true, accepted: 0, duplicate: true })
    expect((await stats()).data.totals).toEqual({ members: 2, answered: 25, correct: 15 })
  })

  it.each([0, 100, 1.5, '1', null])('rejects invalid number %j', async no => {
    expect((await sync({}, 'a', device, no)).data).toEqual({ error: 'bad_no' })
    expect((await call(`/${classroom.code}/join`, 'POST', { device, no })).status).toBe(400)
  })

  it.each(['short', 'g'.repeat(16), 'a'.repeat(33), 123, null])('rejects invalid device %j', async id => {
    expect((await sync({}, 'a', id)).data).toEqual({ error: 'bad_device' })
    expect((await call(`/${classroom.code}/join`, 'POST', { device: id, no: 1 })).status).toBe(400)
  })

  it.each(['', 'b'.repeat(41), 2, null])('rejects invalid batch %j', async batch => {
    expect((await sync({}, batch)).data).toEqual({ error: 'bad_batch' })
  })

  it.each([null, [], 'invalid', { apple: [51, 0] }, { apple: [-1, 0] }, { apple: [1.1, 0] }, { apple: ['1', 0] }, { apple: [1] }, { apple: [0, 1, 2] }])('rejects invalid answers %j without partial writes', async answers => {
    expect(await sync(answers)).toEqual({ status: 400, data: { error: 'bad_answers' } })
    expect((await stats()).data.totals.members).toBe(0)
  })

  it('enforces the total limit and accepts exactly 500 answers', async () => {
    const answers = { a: [50, 50], about: [50, 50], above: [50, 50], across: [50, 50], act: [50, 50] }
    expect(await sync({ ...answers, apple: [1, 0] })).toEqual({ status: 400, data: { error: 'too_many' } })
    expect((await stats()).data.totals.answered).toBe(0)
    expect((await sync(answers)).data.accepted).toBe(500)
  })

  it('orders tied wrong counts by error rate and returns at most ten words', async () => {
    await sync({ a: [5, 2], about: [0, 2], above: [1, 1], across: [1, 1], act: [1, 1], add: [1, 1], address: [1, 1], adult: [1, 1], apple: [1, 1], age: [1, 1], after: [1, 1], afternoon: [1, 1] })
    const result = (await stats()).data.topWrong
    expect(result).toHaveLength(10)
    expect(result.slice(0, 2).map(word => word.en)).toEqual(['about', 'a'])
  })

  it('requires the teacher key for stats and deletion', async () => {
    for (const [path, method] of [[`/${classroom.code}/stats`, 'GET'], [`/${classroom.code}`, 'DELETE']]) {
      for (const key of [undefined, 'wrong']) expect(await call(path, method, undefined, key)).toEqual({ status: 401, data: { error: 'bad_key' } })
    }
  })

  it('leaves idempotently while retaining anonymous word stats', async () => {
    await sync()
    for (let i = 0; i < 2; i++) expect((await call(`/${classroom.code}/members/${device}`, 'DELETE')).data).toEqual({ ok: true })
    const result = (await stats()).data
    expect(result.totals).toEqual({ members: 0, answered: 0, correct: 0 })
    expect(result.topWrong[0]).toEqual({ en: 'apple', correct: 3, wrong: 2 })
    expect((await call(`/${classroom.code}/members/invalid`, 'DELETE')).data.error).toBe('bad_device')
  })

  it('deletes all class data and preserves another classroom', async () => {
    await sync()
    const other = (await call('', 'POST', { name: '두 번째 반' })).data
    await call(`/${other.code}/sync`, 'POST', { device, no: 1, batch: 'batch-1', answers: { apple: [1, 0] } })
    expect((await call(`/${classroom.code}`, 'DELETE', undefined, classroom.teacherKey)).data).toEqual({ ok: true })
    expect(await stats()).toEqual({ status: 404, data: { error: 'no_class' } })
    for (const table of ['members', 'word_stats', 'sync_batches']) {
      expect(await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE class_code = ?`).bind(classroom.code).first('n')).toBe(0)
      expect(await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE class_code = ?`).bind(other.code).first('n')).toBe(1)
    }
    expect((await call(`/${other.code}/stats`, 'GET', undefined, other.teacherKey)).status).toBe(200)
    expect((await sync()).status).toBe(404)
  })

  it('returns 503 for every API when DB is missing, including the Pages entrypoint', async () => {
    expect(await call('', 'POST', { name: '반' }, undefined, {})).toEqual({ status: 503, data: { error: 'not_configured' } })
    const response = await onRequest({ request: new Request('https://example.test/api/unknown'), env: {} })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'not_configured' })
  })

  it('rejects malformed JSON and oversized bodies with and without content-length', async () => {
    for (const [body, status, error] of [['{', 400, 'bad_json'], ['null', 400, 'bad_json'], ['[]', 400, 'bad_json'], [' '.repeat(32769), 413, 'too_large'], ['가'.repeat(11000), 413, 'too_large']]) {
      const response = await handle(new Request('https://example.test/api/classes', { method: 'POST', body }), { DB: db })
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual({ error })
    }
    const response = await handle(new Request('https://example.test/api/classes', { method: 'POST', body: '{}', headers: { 'content-length': '32769' } }), { DB: db })
    expect(response.status).toBe(413)
  })

  it('distinguishes missing paths, missing classes, and unsupported methods', async () => {
    expect(await call('/unknown/path')).toEqual({ status: 404, data: { error: 'not_found' } })
    expect(await call('/ZZZZZZ/stats')).toEqual({ status: 404, data: { error: 'no_class' } })
    for (const path of ['', `/${classroom.code}/join`, `/${classroom.code}/sync`, `/${classroom.code}`]) expect((await call(path)).status).toBe(405)
    expect((await call(`/${classroom.code}/stats`, 'POST', {})).status).toBe(405)
  })

  it('rolls back a failed D1 batch', async () => {
    await expect(db.batch([
      db.prepare('DELETE FROM classes'),
      db.prepare('INSERT INTO missing_table VALUES (1)'),
    ])).rejects.toThrow()
    expect((await stats()).status).toBe(200)
  })

  it('rolls back the batch registration and partial aggregates so a failed sync can be retried', async () => {
    await db.prepare(`CREATE TRIGGER fail_member_insert BEFORE INSERT ON members
      BEGIN SELECT RAISE(ABORT, 'injected sync failure'); END`).run()
    expect(await sync()).toEqual({ status: 503, data: { error: 'unavailable' } })
    for (const table of ['sync_batches', 'word_stats', 'members']) {
      expect(await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first('n')).toBe(0)
    }
    await db.prepare('DROP TRIGGER fail_member_insert').run()
    expect((await sync()).data).toEqual({ ok: true, accepted: 5 })
    expect((await stats()).data.totals).toEqual({ members: 1, answered: 5, correct: 3 })
  })
})
