import { describe, expect, it } from 'vitest'
import allRounds from '../../data/all_rounds.json'
import { buildQuiz, buildQuestion, normalizeAnswer, QUESTION_TYPES } from '../quiz'

const ALL = allRounds.flatMap((r) => r.words)
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

describe('buildQuestion', () => {
  it('보기 4개, 중복 없음, 정답 포함 (800단어 전체로 확인)', () => {
    for (const type of ['ko2en', 'img2en', 'audio2ko']) {
      for (const w of ALL) {
        const q = buildQuestion(w, type, ALL, { rng: seeded(7) })
        expect(q.options).toHaveLength(4)
        expect(new Set(q.options).size).toBe(4)
        expect(q.options).toContain(q.answer)
      }
    }
  })

  it('소리 재생이 안 되면 소리 문제를 뜻 문제로 바꿈', () => {
    expect(buildQuestion(ALL[0], 'audio2ko', ALL, { hasAudio: false }).type).toBe('ko2en')
  })

  it('이미지가 없으면 그림 문제를 뜻 문제로 바꿈', () => {
    expect(buildQuestion({ en: 'x', ko: '엑스' }, 'img2en', ALL).type).toBe('ko2en')
  })
})

describe('buildQuiz', () => {
  it('회차 10단어를 모두 한 번씩, 유형을 골고루', () => {
    const words = allRounds[0].words
    const quiz = buildQuiz(words, ALL, { rng: seeded(42) })
    expect(quiz.map((q) => q.word.en).sort()).toEqual(words.map((w) => w.en).sort())
    const types = new Set(quiz.map((q) => q.type))
    expect(types.size).toBe(QUESTION_TYPES.length)
  })
})

describe('normalizeAnswer', () => {
  it('대소문자·앞뒤 공백·끝 문장부호·연속 공백 무시', () => {
    expect(normalizeAnswer('  Apple. ')).toBe('apple')
    expect(normalizeAnswer('ice  cream')).toBe('ice cream')
  })
})
