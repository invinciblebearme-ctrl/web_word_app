import { beforeEach, describe, expect, it } from 'vitest'
import { logAnswer, loadActivity, streakInfo, calendarWeeks, dayKey, DAILY_GOAL } from '../activity'
import { buildDailySession, SESSION_SIZE, NEW_PER_SESSION } from '../daily'
import { badgeMetrics, evaluateBadges } from '../badges'
import { recordAnswer, loadProgress } from '../progress'

const DAY = 86400000
const NOW = new Date(2026, 10, 20, 15, 0).getTime() // 2026-11-20(금) 15:00
const MIDNIGHT = new Date(2026, 10, 20).getTime()
const at = (daysAgo) => NOW - daysAgo * DAY

beforeEach(() => {
  const store = {}
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
  }
})

describe('학습량 기록', () => {
  it('날짜별로 푼 문제와 맞힌 문제를 센다', () => {
    logAnswer(true, NOW)
    logAnswer(false, NOW)
    logAnswer(true, at(1))
    expect(loadActivity()).toEqual({
      '2026-11-20': { answered: 2, correct: 1 },
      '2026-11-19': { answered: 1, correct: 1 },
    })
  })

  it('recordAnswer를 부르면 학습량도 함께 기록된다', () => {
    recordAnswer('apple', true, NOW)
    expect(loadActivity()[dayKey(NOW)]).toEqual({ answered: 1, correct: 1 })
  })
})

describe('연속 학습일', () => {
  const act = (...daysAgo) => Object.fromEntries(daysAgo.map((d) => [dayKey(at(d)), { answered: 3, correct: 2 }]))

  it('오늘까지 이어진 날 수', () => {
    expect(streakInfo(act(0, 1, 2, 4), NOW)).toMatchObject({ current: 3, best: 3, totalDays: 4, today: 3 })
  })

  it('오늘 아직 안 했으면 어제까지의 연속을 유지', () => {
    expect(streakInfo(act(1, 2), NOW).current).toBe(2)
  })

  it('어제도 안 했으면 0, 최고 기록은 남는다', () => {
    expect(streakInfo(act(2, 3, 4, 5, 6), NOW)).toMatchObject({ current: 0, best: 5 })
  })

  it('월이 바뀌어도 이어진다', () => {
    const a = { '2026-10-31': { answered: 1, correct: 1 }, '2026-11-01': { answered: 1, correct: 1 } }
    expect(streakInfo(a, new Date(2026, 10, 1, 9).getTime())).toMatchObject({ current: 2, best: 2 })
  })

  it('오늘 목표 달성 여부', () => {
    expect(streakInfo({ [dayKey(NOW)]: { answered: DAILY_GOAL, correct: 0 } }, NOW).goalDone).toBe(true)
    expect(streakInfo({}, NOW)).toMatchObject({ current: 0, best: 0, today: 0, goalDone: false })
  })
})

describe('학습 달력', () => {
  it('일요일 시작 5주, 마지막 주에 오늘이 있고 이후는 미래', () => {
    const weeks = calendarWeeks({ [dayKey(NOW)]: { answered: 4, correct: 4 } }, NOW)
    expect(weeks).toHaveLength(5)
    expect(new Date(weeks[0][0].key).getDay()).toBe(0)
    const last = weeks[4]
    expect(last[5]).toMatchObject({ key: '2026-11-20', isToday: true, answered: 4 })
    expect(last[6].future).toBe(true)
    expect(weeks[0][0].key).toBe('2026-10-18')
  })
})

describe('오늘의 학습 구성', () => {
  const rounds = Array.from({ length: 3 }, (_, r) => ({
    id: r + 1,
    words: Array.from({ length: 10 }, (_, i) => ({ en: `w${r}${i}`, ko: `뜻${r}${i}` })),
  }))
  const rec = (box, wrong, due) => ({ box, correct: box, wrong, due, lastSeen: 0 })

  it('처음이면 첫 회차 새 단어부터 최대 8개', () => {
    const s = buildDailySession(rounds, {}, NOW)
    expect(s.counts).toEqual({ due: 0, wrong: 0, new: 8 })
    expect(s.words[0].en).toBe('w00')
  })

  it('복습할 단어가 많아도 새 단어 자리는 남긴다', () => {
    const p = Object.fromEntries(rounds[0].words.concat(rounds[1].words).map((w) => [w.en, rec(1, 0, MIDNIGHT)]))
    const s = buildDailySession(rounds, p, NOW)
    expect(s.words).toHaveLength(SESSION_SIZE)
    expect(s.counts).toEqual({ due: SESSION_SIZE - NEW_PER_SESSION, wrong: 0, new: NEW_PER_SESSION })
    expect(s.totalDue).toBe(20)
    expect(s.words.at(-1).en).toBe('w23')
  })

  it('복습일이 아닌 오답 단어로 빈자리를 채우고, 단어는 겹치지 않는다', () => {
    const p = {
      w00: rec(0, 2, MIDNIGHT),
      w01: rec(1, 1, MIDNIGHT + 3 * DAY),
      w02: rec(3, 0, MIDNIGHT + 7 * DAY),
    }
    const s = buildDailySession(rounds, p, NOW)
    expect(s.counts).toEqual({ due: 1, wrong: 1, new: 8 })
    expect(s.words.slice(0, 2).map((w) => w.en)).toEqual(['w00', 'w01'])
    expect(new Set(s.words.map((w) => w.en)).size).toBe(s.words.length)
    expect(s.words.map((w) => w.en)).not.toContain('w02')
  })

  it('모두 익혀서 할 게 없으면 빈 목록', () => {
    const p = Object.fromEntries(rounds.flatMap((r) => r.words).map((w) => [w.en, rec(5, 0, MIDNIGHT + 30 * DAY)]))
    expect(buildDailySession(rounds, p, NOW).words).toEqual([])
  })
})

describe('배지', () => {
  const rounds = [{ id: 1, words: [{ en: 'a' }, { en: 'b' }] }, { id: 2, words: [{ en: 'c' }] }]

  it('기록으로부터 계산하고, 연속 학습 배지는 최고 기록 기준', () => {
    const progress = { a: { box: 4, correct: 4, wrong: 0 }, b: { box: 2, correct: 2, wrong: 0 }, c: { box: 1, correct: 1, wrong: 0 } }
    const m = badgeMetrics(rounds, progress, { totalAnswered: 7, best: 3, totalDays: 4 })
    expect(m).toEqual({ answered: 7, streak: 3, days: 4, mastered: 1, rounds: 1 })
    const b = Object.fromEntries(evaluateBadges(m).map((x) => [x.id, x]))
    expect(b['first-1'].earned).toBe(true)
    expect(b['streak-3'].earned).toBe(true)
    expect(b['streak-7']).toMatchObject({ earned: false, value: 3, goal: 7 })
    expect(b['rounds-1'].earned).toBe(true)
    expect(b['mastered-10']).toMatchObject({ earned: false, value: 1 })
  })

  it('하루에 여러 번 맞혀도 완전히 앎이 되지 않는다', () => {
    for (let i = 0; i < 6; i++) recordAnswer('a', true, NOW + i * 1000)
    const m = badgeMetrics(rounds, loadProgress(), streakInfo(loadActivity(), NOW))
    expect(m.mastered).toBe(0)
    expect(m.answered).toBe(6)
  })
})
