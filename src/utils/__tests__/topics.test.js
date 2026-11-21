import { describe, expect, it } from 'vitest'
import allRounds from '../../data/all_rounds.json'
import topicOf from '../../data/topics.json'
import { TOPICS, groupByTopic, pickTopicQuiz } from '../topics'

const ALL = allRounds.flatMap((r) => r.words)

describe('주제 데이터', () => {
  it('800단어 모두 정해진 주제 하나에 들어가고, 주제마다 퀴즈를 낼 만큼 단어가 있다', () => {
    const keys = new Set(TOPICS.map((t) => t.key))
    expect(ALL.every((w) => keys.has(topicOf[w.en]))).toBe(true)
    expect(Object.keys(topicOf)).toHaveLength(ALL.length)
    const groups = groupByTopic(ALL)
    expect(Object.values(groups).reduce((s, g) => s + g.length, 0)).toBe(ALL.length)
    Object.values(groups).forEach((g) => expect(g.length).toBeGreaterThanOrEqual(10))
  })

  it('단어 철자는 소문자 (I 제외) — 스프레드시트가 true를 True로 바꾼 사례 방지', () => {
    expect(ALL.filter((w) => w.en !== 'I' && /[A-Z]/.test(w.en)).map((w) => w.en)).toEqual([])
  })
})

describe('pickTopicQuiz', () => {
  const words = ['a', 'b', 'c', 'd', 'e', 'f'].map((en) => ({ en }))
  const progress = {
    a: { box: 4, correct: 4, wrong: 0 }, // 완전히 앎
    b: { box: 0, correct: 0, wrong: 1 }, // 익히는 중
    c: { box: 2, correct: 2, wrong: 0 }, // 거의 앎
    // d, e, f: 처음
  }

  it('익히는 중 → 처음 → 거의 앎 → 완전히 앎 순서로 n개', () => {
    const picked = pickTopicQuiz(words, progress, 5).map((w) => w.en)
    expect(picked[0]).toBe('b')
    expect(picked.slice(1, 4).sort()).toEqual(['d', 'e', 'f'])
    expect(picked[4]).toBe('c')
  })
})
