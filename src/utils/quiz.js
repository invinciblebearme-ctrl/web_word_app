// 퀴즈 문제 생성
// 유형: ko2en(뜻→단어), img2en(그림→단어), audio2ko(소리→뜻), spell(뜻+소리→철자 쓰기)
// cloze(예문 빈칸 채우기)는 예문 데이터를 넘겼을 때만 섞는다
import { clozeOf } from './examples'

export const QUESTION_TYPES = ['ko2en', 'img2en', 'audio2ko', 'spell']

export const TYPE_LABELS = {
  ko2en: '뜻을 보고 알맞은 단어를 고르세요',
  img2en: '그림을 보고 알맞은 단어를 고르세요',
  audio2ko: '소리를 듣고 알맞은 뜻을 고르세요',
  spell: '뜻과 소리를 듣고 단어를 써 보세요',
  cloze: '빈칸에 들어갈 알맞은 단어를 고르세요',
}

export const shuffle = (arr, rng = Math.random) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 철자 비교용: 대소문자, 앞뒤 공백, 마침표 무시
export const normalizeAnswer = (s) => String(s).toLowerCase().trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ')

const pickDistractors = (word, pool, field, count, rng) => {
  const seen = new Set([word[field]])
  const out = []
  for (const w of shuffle(pool, rng)) {
    if (out.length >= count) break
    if (w.en === word.en || seen.has(w[field])) continue
    seen.add(w[field])
    out.push(w)
  }
  return out
}

export const buildQuestion = (word, type, pool, { rng = Math.random, hasAudio = true, examples = null } = {}) => {
  let t = type
  let extra = {}
  if (t === 'img2en' && !word.img) t = 'ko2en'
  if (t === 'audio2ko' && !hasAudio) t = 'ko2en'
  if (t === 'cloze') {
    const ex = examples?.[word.en]
    const cloze = ex && clozeOf(ex.s, word.en)
    if (cloze) extra = { cloze, sentence: ex.s, sentenceKo: ex.ko }
    else t = 'ko2en'
  }
  if (t === 'spell') return { type: t, word }
  const field = t === 'audio2ko' ? 'ko' : 'en'
  const options = shuffle([word, ...pickDistractors(word, pool, field, 3, rng)], rng).map((w) => w[field])
  return { type: t, word, options, answer: word[field], ...extra }
}

// 문제 순서는 섞고, 유형은 골고루 돌아가며 배정
export const buildQuiz = (words, pool, opts = {}) => {
  const rng = opts.rng || Math.random
  const types = opts.types || (opts.examples ? [...QUESTION_TYPES, 'cloze'] : QUESTION_TYPES)
  const offset = Math.floor(rng() * types.length)
  return shuffle(words, rng).map((w, i) =>
    buildQuestion(w, types[(i + offset) % types.length], pool, { ...opts, rng })
  )
}
