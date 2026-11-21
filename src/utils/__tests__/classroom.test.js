import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clampSize, formatTime, pickNumber } from '../classroom'
import {
  addTeacherClass, createClass, deleteClass, flushClass, getMembership, getTeacherClasses,
  joinClass, leaveClass, normalizeCode, pendingCount, queueAnswer,
} from '../classSync'
import { recordAnswer } from '../progress'

let store
beforeEach(() => {
  store = {}
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
  }
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('수업 도구', () => {
  it('번호 뽑기는 뽑힌 번호를 빼고, 다 뽑으면 null', () => {
    const picked = []
    for (let i = 0; i < 5; i++) picked.push(pickNumber(5, picked))
    expect([...picked].sort()).toEqual([1, 2, 3, 4, 5])
    expect(pickNumber(5, picked)).toBeNull()
    expect(pickNumber(3, [], () => 0.99)).toBe(3)
  })
  it('시간 표시와 학생 수 범위', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(59.2)).toBe('1:00')
    expect(formatTime(185)).toBe('3:05')
    expect(clampSize(0)).toBe(2)
    expect(clampSize('abc')).toBe(2)
    expect(clampSize(100)).toBe(40)
    expect(clampSize(24.6)).toBe(25)
  })
})

// 가짜 서버: 요청을 기록하고 정해 둔 응답을 돌려준다
const mockFetch = (handler) => {
  const calls = []
  vi.stubGlobal('fetch', async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : undefined
    calls.push({ url, method: opts.method || 'GET', body, auth: opts.headers?.authorization })
    const [status, data] = await handler({ url, method: opts.method || 'GET', body })
    return { ok: status < 400, status, json: async () => data }
  })
  return calls
}

describe('학급 참여와 기록 보내기', () => {
  it('코드 정규화와 입력 검증', async () => {
    expect(normalizeCode(' k7mp-2q ')).toBe('K7MP2Q')
    const calls = mockFetch(() => [200, {}])
    expect((await joinClass('abc', 3)).error).toBe('no_class')
    expect((await joinClass('K7MP2Q', 0)).error).toBe('bad_no')
    expect((await joinClass('K7MP2Q', 100)).error).toBe('bad_no')
    expect(calls).toHaveLength(0)
  })

  it('참여하지 않으면 기록을 쌓지 않는다', () => {
    queueAnswer('apple', true)
    recordAnswer('apple', false)
    expect(pendingCount()).toBe(0)
  })

  it('참여 → 답 기록 → 한 번에 보내기, 실패하면 같은 batch로 다시 보낸다', async () => {
    let fail = false
    const calls = mockFetch(({ url }) => (url.endsWith('/join') ? [200, { name: '5-2' }] : fail ? [500, { error: 'x' }] : [200, { ok: true, accepted: 3 }]))
    const res = await joinClass('k7mp2q', '7')
    expect(res.ok).toBe(true)
    expect(getMembership()).toMatchObject({ code: 'K7MP2Q', no: 7, name: '5-2' })
    expect(getMembership().device).toMatch(/^[0-9a-f]{32}$/)

    vi.useFakeTimers()
    recordAnswer('apple', true)
    recordAnswer('apple', false)
    recordAnswer('bear', true)
    expect(pendingCount()).toBe(3)

    fail = true
    expect((await flushClass()).ok).toBe(false)
    const first = calls.at(-1)
    expect(first.body.answers).toEqual({ apple: [1, 1], bear: [1, 0] })
    expect(first.body).toMatchObject({ no: 7, device: getMembership().device })
    expect(pendingCount()).toBe(3)

    recordAnswer('cat', true) // 보내는 사이에 새로 푼 문제는 다음 묶음으로
    fail = false
    const ok = await flushClass()
    expect(ok).toMatchObject({ ok: true, sent: 6 })
    const sync = calls.filter((c) => c.url.endsWith('/sync'))
    expect(sync[1].body.batch).toBe(first.body.batch) // 같은 batch 재전송 (서버가 중복 무시)
    expect(sync[2].body.answers).toEqual({ cat: [1, 0] })
    expect(sync[2].body.batch).not.toBe(first.body.batch)
    expect(pendingCount()).toBe(0)
    expect(getMembership().lastSync).toBeGreaterThan(0)
  })

  it('한 번에 500문제까지만 보내고 나머지는 다음 요청으로', async () => {
    const calls = mockFetch(({ url, body }) => (url.endsWith('/join') ? [200, { name: 'A' }] : [200, { ok: true, accepted: Object.values(body.answers).reduce((s, [c, w]) => s + c + w, 0) }]))
    await joinClass('K7MP2Q', 1)
    const queue = {}
    for (let i = 0; i < 20; i++) queue[`w${i}`] = [40, 0]
    store.class_outbox_v1 = JSON.stringify({ pending: null, queue })
    const res = await flushClass()
    expect(res.sent).toBe(800)
    const sizes = calls.filter((c) => c.url.endsWith('/sync')).map((c) => Object.values(c.body.answers).reduce((s, [a, b]) => s + a + b, 0))
    expect(Math.max(...sizes)).toBeLessThanOrEqual(500)
    expect(pendingCount()).toBe(0)
  })

  it('학급이 지워졌으면(404) 참여를 끝내고, 나가기는 서버가 없어도 된다', async () => {
    mockFetch(({ url }) => (url.endsWith('/join') ? [200, { name: 'A' }] : [404, { error: 'no_class' }]))
    await joinClass('K7MP2Q', 1)
    vi.useFakeTimers()
    queueAnswer('apple', true)
    expect((await flushClass()).ok).toBe(false)
    expect(getMembership()).toBeNull()

    mockFetch(() => [200, { name: 'A' }])
    await joinClass('K7MP2Q', 1)
    vi.stubGlobal('fetch', async () => { throw new Error('offline') })
    expect((await leaveClass()).ok).toBe(true)
    expect(getMembership()).toBeNull()
  })

  it('서버 기능이 없는 배포(HTML 응답)에서는 설정 안 됨으로 보고, 참여·기록은 그대로 둔다', async () => {
    mockFetch(() => [200, { name: 'A' }])
    await joinClass('K7MP2Q', 1)
    vi.useFakeTimers()
    queueAnswer('apple', true)
    mockFetch(() => [404, null])
    expect(await flushClass()).toMatchObject({ ok: false, error: 'not_configured' })
    expect(getMembership()).not.toBeNull()
    expect(pendingCount()).toBe(1)
    expect((await joinClass('BBBBBB', 2)).error).toBe('not_configured')
  })

  it('한 단어를 많이 풀어도(단어당 50회 한도) 한 번에 끝까지 보낸다', async () => {
    mockFetch(({ url, body }) => (url.endsWith('/join') ? [200, { name: 'A' }] : [200, { ok: true, accepted: Object.values(body.answers).reduce((s, [c, w]) => s + c + w, 0) }]))
    await joinClass('K7MP2Q', 1)
    store.class_outbox_v1 = JSON.stringify({ pending: null, queue: { apple: [300, 0] } })
    expect(await flushClass()).toMatchObject({ ok: true, sent: 300 })
    expect(pendingCount()).toBe(0)
  })

  it('보내는 사이 다른 탭이 새 묶음을 만들었으면 그 묶음은 지우지 않는다', async () => {
    let first = true
    mockFetch(({ url }) => {
      if (url.endsWith('/join')) return [200, { name: 'A' }]
      if (first) {
        first = false
        // 다른 탭: 이 요청의 묶음을 이미 끝내고 새 묶음 B를 만든 상태
        store.class_outbox_v1 = JSON.stringify({ pending: { batch: 'other-tab', answers: { bear: [1, 0] } }, queue: {} })
        return [200, { ok: true, accepted: 1 }]
      }
      return [0, null]
    })
    await joinClass('K7MP2Q', 1)
    vi.useFakeTimers()
    queueAnswer('apple', true)
    await flushClass()
    const box = JSON.parse(store.class_outbox_v1)
    expect(box.pending.batch).toBe('other-tab')
  })

  it('네트워크 오류가 나면 기다렸다가 같은 묶음을 다시 보낸다', async () => {
    let online = false
    const calls = mockFetch(({ url }) => (url.endsWith('/join') ? [200, { name: 'A' }] : online ? [200, { ok: true, accepted: 1 }] : [500, { error: 'x' }]))
    await joinClass('K7MP2Q', 1)
    vi.useFakeTimers()
    queueAnswer('apple', true)
    await vi.advanceTimersByTimeAsync(15000)
    expect(calls.filter((c) => c.url.endsWith('/sync'))).toHaveLength(1)
    expect(pendingCount()).toBe(1)
    online = true
    await vi.advanceTimersByTimeAsync(30000)
    const syncs = calls.filter((c) => c.url.endsWith('/sync'))
    expect(syncs).toHaveLength(2)
    expect(syncs[1].body.batch).toBe(syncs[0].body.batch)
    expect(pendingCount()).toBe(0)
  })

  it('다른 학급으로 옮기면 못 보낸 기록은 버린다', async () => {
    mockFetch(() => [200, { name: 'A' }])
    await joinClass('AAAAAA', 1)
    vi.useFakeTimers()
    queueAnswer('apple', true)
    store.class_outbox_v1 = JSON.stringify({ pending: null, queue: { apple: [1, 0] } })
    await joinClass('BBBBBB', 2)
    expect(pendingCount()).toBe(0)
  })
})

describe('선생님', () => {
  it('학급 만들기 → 목록 저장, 키는 Authorization 헤더로만', async () => {
    const calls = mockFetch(({ url, method }) =>
      method === 'POST' ? [201, { code: 'K7MP2Q', name: '5-2', teacherKey: 'secret-key-123456789012' }]
        : method === 'DELETE' ? [200, { ok: true }] : [200, { name: '5-2', members: [], totals: {}, topWrong: [] }])
    const res = await createClass('  5-2  ')
    expect(calls[0].body).toEqual({ name: '5-2' })
    expect(res.entry).toEqual({ code: 'K7MP2Q', name: '5-2', key: 'secret-key-123456789012' })
    expect(getTeacherClasses()).toHaveLength(1)

    await addTeacherClass('zzzzzz', 'other-key')
    expect(calls.at(-1).url).toBe('/api/classes/ZZZZZZ/stats')
    expect(calls.at(-1).auth).toBe('Bearer other-key')
    expect(calls.every((c) => !String(c.url).includes('key'))).toBe(true)
    expect(getTeacherClasses().map((c) => c.code)).toEqual(['ZZZZZZ', 'K7MP2Q'])

    await deleteClass(getTeacherClasses()[1])
    expect(getTeacherClasses().map((c) => c.code)).toEqual(['ZZZZZZ'])
  })

  it('키가 틀리면 목록에 넣지 않는다', async () => {
    mockFetch(() => [401, { error: 'bad_key' }])
    const res = await addTeacherClass('K7MP2Q', 'wrong')
    expect(res).toMatchObject({ ok: false, error: 'bad_key' })
    expect(getTeacherClasses()).toHaveLength(0)
  })
})
