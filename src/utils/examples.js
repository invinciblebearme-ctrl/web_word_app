// 단어별 예문 {en: {s, ko}}. 예문 데이터(약 80KB)는 처음 화면을 늦추지 않도록 따로 불러온다.
import { useEffect, useState } from 'react'

let cache = null
let pending = null

export const loadExamples = () => {
  if (cache) return Promise.resolve(cache)
  pending ||= import('../data/examples.json').then((m) => (cache = m.default))
  return pending
}

// 이미 불러온 예문 (아직이면 null)
export const getExamplesSync = () => cache

export const useExamples = () => {
  const [data, setData] = useState(cache)
  useEffect(() => {
    if (!data) loadExamples().then(setData).catch(() => {})
  }, [data])
  return data
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const wordRe = (en) => new RegExp(`(^|[^A-Za-z'])(${escapeRe(en)})(?![A-Za-z])`, 'i')

// 예문을 [앞, 단어, 뒤]로 나눈다. 단어가 없으면 null
export const splitExample = (sentence, en) => {
  const m = sentence.match(wordRe(en))
  if (!m) return null
  const start = m.index + m[1].length
  return [sentence.slice(0, start), sentence.slice(start, start + m[2].length), sentence.slice(start + m[2].length)]
}

export const BLANK = '_____'

// 빈칸 문장: 단어 자리를 BLANK로 바꾼다
export const clozeOf = (sentence, en) => {
  const parts = splitExample(sentence, en)
  return parts ? parts[0] + BLANK + parts[2] : null
}
