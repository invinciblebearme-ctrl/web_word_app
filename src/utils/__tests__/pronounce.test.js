import { describe, expect, it } from 'vitest'
import { gradePronunciation, letterMatch, normalizeSpeech, similarity } from '../pronounce'

describe('normalizeSpeech', () => {
  it('소문자, 문장부호 제거, 숫자는 영어 단어로', () => {
    expect(normalizeSpeech('  Apple! ')).toBe('apple')
    expect(normalizeSpeech('2')).toBe('two')
    expect(normalizeSpeech('ice-cream')).toBe('ice cream')
  })
})

describe('gradePronunciation', () => {
  it('정확히 같으면 3', () => {
    expect(gradePronunciation(['Apple'], 'apple')).toMatchObject({ level: 3, how: 'exact', score: 100 })
  })

  it('첫 후보가 틀려도 다른 후보가 맞으면 3', () => {
    expect(gradePronunciation(['bear', 'bare', 'beer'], 'beer')).toMatchObject({ level: 3, heard: 'beer' })
  })

  it('숫자와 소리가 같은 단어는 맞은 것으로', () => {
    expect(gradePronunciation(['2'], 'two')).toMatchObject({ level: 3 })
    expect(gradePronunciation(['to'], 'two')).toMatchObject({ level: 3, how: 'homophone' })
    expect(gradePronunciation(['eye'], 'I')).toMatchObject({ level: 3, how: 'homophone' })
  })

  it('짧은 말이 붙은 경우: 3글자 이상 단어만 인정', () => {
    expect(gradePronunciation(['the apple'], 'apple')).toMatchObject({ level: 3, how: 'inPhrase' })
    expect(gradePronunciation(['a cat'], 'a').level).toBeLessThan(3)
  })

  it('비슷하면 2, 많이 다르면 1', () => {
    expect(gradePronunciation(['aple'], 'apple')).toMatchObject({ level: 2, score: 80 })
    expect(gradePronunciation(['banana'], 'apple').level).toBe(1)
  })

  it('여러 단어 표현', () => {
    expect(gradePronunciation(['good morning'], 'good morning').level).toBe(3)
    expect(gradePronunciation(['good mourning'], 'good morning').level).toBe(2)
  })

  it('들린 게 없으면 null', () => {
    expect(gradePronunciation(['', '  '], 'apple')).toBeNull()
  })
})

describe('similarity / letterMatch', () => {
  it('similarity', () => {
    expect(similarity('apple', 'apple')).toBe(1)
    expect(similarity('aple', 'apple')).toBeCloseTo(0.8)
  })

  it('목표 글자 중 들리지 않은 글자를 표시', () => {
    const m = letterMatch('aple', 'apple').map((x) => (x.ok ? x.ch : '_')).join('')
    expect(['a_ple', 'ap_le']).toContain(m)
    expect(letterMatch('bnana', 'banana').filter((x) => !x.ok).map((x) => x.ch)).toEqual(['a'])
    expect(letterMatch('flower', 'flower').every((x) => x.ok)).toBe(true)
    expect(letterMatch('good', 'good morning').filter((x) => !x.ok && x.ch !== ' ').length).toBe(7)
  })
})
