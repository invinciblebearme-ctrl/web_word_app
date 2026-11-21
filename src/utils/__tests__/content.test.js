import { beforeEach, describe, expect, it } from 'vitest'
import allRounds from '../../data/all_rounds.json'
import { buildPhonics, rimeOf, splitMarks, vowelGroups } from '../phonics'
import { checkSentence, usesWord, markWords, saveSentence, loadSentences, deleteSentence, suggestWords } from '../sentences'
import { clozeOf, splitExample, BLANK } from '../examples'
import { buildQuestion, buildQuiz } from '../quiz'

const ALL = allRounds.flatMap((r) => r.words)
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

beforeEach(() => {
  const store = {}
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
  }
})

describe('소리 패턴', () => {
  const patterns = buildPhonics(ALL)
  const byKey = Object.fromEntries(patterns.map((p) => [`${p.group}:${p.key}`, p]))
  const words = (k) => byKey[k].items.map((x) => x.word.en)

  it('패턴마다 4단어 이상, 강조 구간이 철자와 맞음', () => {
    expect(patterns.length).toBeGreaterThan(30)
    for (const p of patterns) {
      expect(p.items.length).toBeGreaterThanOrEqual(4)
      for (const { word, marks } of p.items) {
        for (const [s, e] of marks) expect(s >= 0 && e <= word.en.length && s < e).toBe(true)
      }
    }
  })

  it('매직 e: 예외 단어와 r 앞 모음은 빠짐', () => {
    expect(words('magic:a_e')).toContain('make')
    expect(words('magic:i_e')).toContain('bike')
    const all = [...words('magic:a_e'), ...words('magic:i_e'), ...words('magic:o_e')]
    for (const w of ['give', 'live', 'come', 'love', 'care', 'fire', 'store']) expect(all).not.toContain(w)
  })

  it('r 모음: 다른 소리(ear, war, air)는 빠짐', () => {
    expect(words('rvowel:ar')).toEqual(expect.arrayContaining(['car', 'star', 'park']))
    for (const w of ['bear', 'ear', 'war', 'heart']) expect(words('rvowel:ar')).not.toContain(w)
    expect(words('rvowel:ir')).toEqual(expect.arrayContaining(['bird', 'nurse', 'girl']))
    expect(words('rvowel:er')).toEqual(expect.arrayContaining(['sister', 'water']))
    for (const w of ['hair', 'chair', 'here', 'very']) expect([...words('rvowel:ir'), ...words('rvowel:er')]).not.toContain(w)
    for (const w of ['doctor', 'color']) expect(words('rvowel:or')).not.toContain(w)
  })

  it('소리가 다른 단어는 따로 묶거나 뺌 (검수 반영)', () => {
    expect(words('team:ea')).toContain('eat')
    for (const w of ['bread', 'great', 'bear', 'learn', 'idea']) expect(words('team:ea')).not.toContain(w)
    expect(words('team:ea-short')).toEqual(expect.arrayContaining(['bread', 'head']))
    expect(words('team:ow')).toContain('cow')
    expect(words('team:ow')).not.toContain('snow')
    expect(words('team:ow-long')).toContain('snow')
    expect(patterns.some((p) => p.key === 'ew')).toBe(false) // homework를 빼면 3개라 묶음 없음
    expect(words('digraph:ch')).not.toContain('school')
    expect(words('team:oo')).not.toContain('blood')
  })

  it('단어 가족은 한 음절 단어의 끝소리로 묶고, 소리가 다른 단어는 뺌', () => {
    expect(rimeOf('night')).toBe('ight')
    expect(rimeOf('apple')).toBe(null)
    expect(vowelGroups('make')).toBe(1)
    expect(words('family:-ight')).toEqual(expect.arrayContaining(['light', 'night', 'right']))
    expect(words('family:-at')).not.toContain('what')
    expect(patterns.some((p) => p.key === '-ow')).toBe(false)
  })

  it('splitMarks', () => {
    expect(splitMarks('make', [[1, 2], [3, 4]])).toEqual([
      { text: 'm', mark: false }, { text: 'a', mark: true }, { text: 'k', mark: false }, { text: 'e', mark: true },
    ])
  })
})

describe('예문 빈칸', () => {
  it('단어 경계로만 찾음 (an 속 a는 아님)', () => {
    expect(splitExample('I have an apple and a cat.', 'a')).toEqual(['I have an apple and ', 'a', ' cat.'])
    expect(clozeOf('Apples are red.', 'apple')).toBe(null)
    expect(clozeOf('Go to bed.', 'go')).toBe(`${BLANK} to bed.`)
  })

  it('예문이 있으면 cloze 문제를 섞고, 없으면 뜻 문제로', () => {
    const word = ALL.find((w) => w.en === 'apple')
    const examples = { apple: { s: 'I eat an apple every day.', ko: '나는 매일 사과를 먹어요.' } }
    const q = buildQuestion(word, 'cloze', ALL, { examples, rng: seeded(3) })
    expect(q.type).toBe('cloze')
    expect(q.cloze).toBe(`I eat an ${BLANK} every day.`)
    expect(q.options).toContain('apple')
    expect(buildQuestion(ALL[1], 'cloze', ALL, { examples }).type).toBe('ko2en')
    const quiz = buildQuiz(ALL.slice(0, 20), ALL, { examples: {}, rng: seeded(1), types: ['cloze'] })
    expect(quiz.every((x) => x.type === 'ko2en')).toBe(true)
  })
})

describe('나만의 문장', () => {
  it('변화형도 단어를 쓴 것으로 봄', () => {
    expect(usesWord('My cats play.', 'cat')).toBe(true)
    expect(usesWord('She is making a cake.', 'make')).toBe(true)
    expect(usesWord('He stopped.', 'stop')).toBe(true)
    expect(usesWord('She studies.', 'study')).toBe(true)
    expect(usesWord("Tom's dog runs.", 'dog')).toBe(true)
    expect(usesWord('I like category.', 'cat')).toBe(false)
  })

  it('검사: 단어·길이는 조건, 대문자·문장부호는 도움말', () => {
    const c = checkSentence('my dog likes apples', ['dog', 'apple'])
    expect(c.ok).toBe(true)
    expect(c.capital).toBe(false)
    expect(c.punct).toBe(false)
    expect(checkSentence('Dog apple.', ['dog', 'apple']).ok).toBe(false) // 2단어
    expect(checkSentence('My dog 사과 먹어.', ['dog', 'apple']).ok).toBe(false)
  })

  it('markWords', () => {
    expect(markWords('Cats like fish.', ['cat']).filter((p) => p.mark).map((p) => p.text)).toEqual(['Cats'])
  })

  it('저장·삭제는 최신 문장이 위로', () => {
    const a = saveSentence({ text: ' I like cats. ', words: ['like', 'cat'] }, 1)
    saveSentence({ text: 'Dogs run fast.', words: ['dog', 'run'] }, 2)
    expect(loadSentences().map((s) => s.text)).toEqual(['Dogs run fast.', 'I like cats.'])
    deleteSentence(a.id)
    expect(loadSentences()).toHaveLength(1)
  })

  it('저장 공간이 가득 차면 실패를 돌려주고 기존 문장은 그대로', () => {
    saveSentence({ text: 'Dogs run fast.', words: ['dog', 'run'] }, 1)
    const setItem = localStorage.setItem
    localStorage.setItem = () => { throw new Error('QuotaExceededError') }
    expect(saveSentence({ text: 'Cats sleep a lot.', words: ['cat', 'sleep'] }, 2)).toBe(null)
    expect(deleteSentence(loadSentences()[0].id)).toBe(false)
    localStorage.setItem = setItem
    expect(loadSentences().map((s) => s.text)).toEqual(['Dogs run fast.'])
  })

  it('추천 단어: 익힌 단어를 먼저', () => {
    const progress = { cat: { box: 1, correct: 1, wrong: 0, due: 0 } }
    const s = suggestWords(ALL, progress, 6, seeded(5))
    expect(s).toHaveLength(6)
    expect(s[0].en).toBe('cat')
  })
})

describe('예문 데이터', () => {
  it('800단어 모두 예문이 있고, 단어가 그대로 들어 있어 빈칸 문제를 만들 수 있음', async () => {
    const { default: examples } = await import('../../data/examples.json')
    for (const w of ALL) {
      const ex = examples[w.en]
      expect(ex, w.en).toBeTruthy()
      expect(clozeOf(ex.s, w.en), `${w.en}: ${ex.s}`).not.toBe(null)
      expect(ex.s, w.en).toMatch(/[.!?]$/)
      expect(ex.ko.length, w.en).toBeGreaterThan(0)
    }
  })
})
