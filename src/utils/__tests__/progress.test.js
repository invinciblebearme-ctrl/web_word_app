import { beforeEach, describe, expect, it } from 'vitest'
import {
  nextRecord, recordAnswer, markSeen, loadProgress, levelOf,
  getDueWords, getWrongWords, roundSummary, INTERVAL_DAYS, MAX_BOX,
} from '../progress'

const DAY = 86400000
// 2026-11-20 15:00 (로컬)
const NOW = new Date(2026, 10, 20, 15, 0).getTime()
const MIDNIGHT = new Date(2026, 10, 20).getTime()

beforeEach(() => {
  const store = {}
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
  }
})

describe('nextRecord', () => {
  it('맞히면 상자가 하나씩 올라가고 다음 복습일은 자정 기준', () => {
    let r = nextRecord(undefined, true, NOW)
    expect(r).toMatchObject({ box: 1, correct: 1, wrong: 0, due: MIDNIGHT + INTERVAL_DAYS[1] * DAY })
    r = nextRecord(r, true, NOW)
    expect(r.box).toBe(2)
    expect(r.due).toBe(MIDNIGHT + 3 * DAY)
  })

  it('틀리면 상자 0으로 돌아가고 오늘 바로 복습 대상', () => {
    const r = nextRecord({ box: 4, correct: 4, wrong: 0 }, false, NOW)
    expect(r).toMatchObject({ box: 0, correct: 4, wrong: 1, due: MIDNIGHT })
  })

  it('상자는 최대치를 넘지 않음', () => {
    let r
    for (let i = 0; i < 10; i++) r = nextRecord(r, true, NOW)
    expect(r.box).toBe(MAX_BOX)
  })
})

describe('levelOf', () => {
  it('기록 없음/카드만 봄 → 처음', () => {
    expect(levelOf(undefined)).toBe(0)
    expect(levelOf({ box: 0, correct: 0, wrong: 0, seenOnly: true })).toBe(0)
  })
  it('상자 단계별 숙련도', () => {
    expect(levelOf({ box: 0, correct: 0, wrong: 1 })).toBe(1)
    expect(levelOf({ box: 1, correct: 1, wrong: 0 })).toBe(1)
    expect(levelOf({ box: 2, correct: 2, wrong: 0 })).toBe(2)
    expect(levelOf({ box: 4, correct: 4, wrong: 0 })).toBe(3)
  })
})

describe('저장소', () => {
  it('recordAnswer는 localStorage에 누적 저장', () => {
    recordAnswer('apple', true, NOW)
    recordAnswer('apple', false, NOW)
    expect(loadProgress().apple).toMatchObject({ box: 0, correct: 1, wrong: 1 })
  })

  it('markSeen은 숙련도를 바꾸지 않음', () => {
    recordAnswer('apple', true, NOW)
    markSeen('apple', NOW + 1000)
    expect(loadProgress().apple).toMatchObject({ box: 1, correct: 1, lastSeen: NOW + 1000 })
    markSeen('bear', NOW)
    expect(levelOf(loadProgress().bear)).toBe(0)
  })

  it('저장 데이터가 깨져 있으면 빈 기록으로 시작', () => {
    localStorage.setItem('word_progress_v1', '{not json')
    expect(loadProgress()).toEqual({})
  })
})

describe('복습 목록', () => {
  const words = ['a', 'b', 'c', 'd'].map((en) => ({ en, ko: en }))

  it('복습일이 된, 퀴즈를 푼 단어만 낮은 상자·많이 틀린 순으로', () => {
    const p = {
      a: { box: 2, correct: 2, wrong: 0, due: MIDNIGHT },
      b: { box: 0, correct: 0, wrong: 3, due: MIDNIGHT },
      c: { box: 1, correct: 1, wrong: 0, due: MIDNIGHT + DAY }, // 내일
      d: { box: 0, correct: 0, wrong: 0, due: MIDNIGHT, seenOnly: true }, // 카드만 봄
    }
    expect(getDueWords(words, p, NOW).map((w) => w.en)).toEqual(['b', 'a'])
    expect(getDueWords(words, p, NOW + DAY).map((w) => w.en)).toEqual(['b', 'c', 'a'])
  })

  it('오답 노트는 틀린 적 있고 아직 완전히 익히지 못한 단어', () => {
    const p = {
      a: { box: 4, correct: 4, wrong: 1 }, // 다시 익힘 → 제외
      b: { box: 1, correct: 1, wrong: 1 },
      c: { box: 0, correct: 0, wrong: 2 },
    }
    expect(getWrongWords(words, p).map((w) => w.en)).toEqual(['c', 'b'])
  })

  it('roundSummary', () => {
    const p = { a: { box: 4, correct: 4, wrong: 0 }, b: { box: 0, correct: 0, wrong: 0, seenOnly: true } }
    expect(roundSummary({ words }, p)).toEqual({ total: 4, seen: 2, studied: 1, mastered: 1 })
  })
})
