// 나만의 문장: 배운 단어 2~3개로 직접 문장을 쓰고 기기에 저장한다
import { levelOf } from './progress'
import { shuffle } from './quiz'

export const STORAGE_KEY = 'my_sentences_v1'
export const MAX_SAVED = 200

export const loadSentences = () => {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

// 저장 공간이 꽉 찼거나 막혀 있으면 false (화면에서 알려 주고 쓰던 문장은 그대로 둔다)
const store = (list) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_SAVED)))
    return true
  } catch {
    return false
  }
}

// 최신 문장이 위로. 저장에 실패하면 null
export const saveSentence = ({ text, words }, now = Date.now()) => {
  const item = { id: `${now}-${Math.random().toString(36).slice(2, 7)}`, text: text.trim(), words, at: now }
  return store([item, ...loadSentences()]) ? item : null
}

export const deleteSentence = (id) => store(loadSentences().filter((s) => s.id !== id))

// 단어의 흔한 변화형: cats, watches, played, liked, making, stopped, studies …
export const wordForms = (en) => {
  const w = en.toLowerCase()
  const forms = new Set([w, `${w}s`, `${w}es`, `${w}ed`, `${w}d`, `${w}ing`, `${w}er`, `${w}est`])
  if (w.endsWith('e')) forms.add(`${w.slice(0, -1)}ing`)
  if (/[^aeiou]y$/.test(w)) ['ies', 'ied', 'ier', 'iest'].forEach((x) => forms.add(w.slice(0, -1) + x))
  if (/[^aeiou][aeiou][bdgmnpt]$/.test(w)) {
    const d = w + w.at(-1)
    ;['ed', 'ing', 'er', 'est'].forEach((x) => forms.add(d + x))
  }
  return forms
}

const tokens = (text) => (text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []).map((t) => t.replace(/'s$/, ''))

export const usesWord = (text, en) => {
  // 띄어쓰기가 있는 표현(예: "ice cream")은 그대로 들어 있는지 본다
  if (/\s/.test(en)) return text.toLowerCase().includes(en.toLowerCase())
  const forms = wordForms(en)
  return tokens(text).some((t) => forms.has(t))
}

export const MIN_WORDS = 3

// 문장 검사: 고른 단어를 모두 썼는지가 조건이고, 대문자·문장부호는 도움말로만 알려 준다
export const checkSentence = (text, words) => {
  const t = text.trim()
  const used = words.map((en) => ({ en, ok: usesWord(t, en) }))
  const wordCount = tokens(t).length
  return {
    used,
    wordCount,
    capital: /^[A-Z]/.test(t),
    punct: /[.!?]$/.test(t),
    englishOnly: !/[ㄱ-ㅎ가-힣]/.test(t),
    ok: used.every((u) => u.ok) && wordCount >= MIN_WORDS && !/[ㄱ-ㅎ가-힣]/.test(t),
  }
}

// 문장 재료로 쓸 단어: 퀴즈로 익힌 단어를 먼저, 부족하면 앞 회차 단어로 채운다
export const suggestWords = (allWords, progress, n = 6, rng = Math.random) => {
  const usable = allWords.filter((w) => w.en.length >= 2 && /^[a-z]+$/.test(w.en))
  const studied = shuffle(usable.filter((w) => levelOf(progress[w.en]) > 0), rng)
  const fresh = shuffle(usable.filter((w) => levelOf(progress[w.en]) === 0).slice(0, 100), rng)
  return [...studied, ...fresh].slice(0, n)
}

// 문장을 [{text, mark}]로 나눈다: 고른 단어(변화형 포함)에 표시
export const markWords = (text, words) => {
  const forms = new Set(words.flatMap((en) => [...wordForms(en)]))
  const out = []
  let pos = 0
  for (const m of text.matchAll(/[A-Za-z]+(?:'[A-Za-z]+)?/g)) {
    if (!forms.has(m[0].toLowerCase().replace(/'s$/, ''))) continue
    if (m.index > pos) out.push({ text: text.slice(pos, m.index), mark: false })
    out.push({ text: m[0], mark: true })
    pos = m.index + m[0].length
  }
  if (pos < text.length) out.push({ text: text.slice(pos), mark: false })
  return out
}
