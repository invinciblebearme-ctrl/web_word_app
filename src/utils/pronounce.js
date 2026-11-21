// 발음 확인 채점: 음성 인식 결과(여러 후보)와 목표 단어를 비교한다.
// 음성 인식은 소리만 듣기 때문에 숫자·소리가 같은 단어(two/to)도 맞은 것으로 본다.

const NUMBER_WORDS = {
  0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine',
  10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen',
  17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty',
  60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety', 100: 'hundred', 1000: 'thousand',
}

// 소리가 같거나 거의 같은 단어 묶음
const HOMOPHONES = [
  ['to', 'too', 'two'], ['for', 'four'], ['one', 'won'], ['eight', 'ate'], ['by', 'buy', 'bye'],
  ['i', 'eye'], ['see', 'sea'], ['sun', 'son'], ['our', 'hour'], ['meet', 'meat'], ['no', 'know'],
  ['here', 'hear'], ['right', 'write'], ['week', 'weak'], ['dear', 'deer'], ['tail', 'tale'],
  ['pair', 'pear'], ['flower', 'flour'], ['new', 'knew'], ['red', 'read'], ['blue', 'blew'],
  ['wear', 'where'], ['there', 'their'], ['road', 'rode'], ['night', 'knight'], ['hi', 'high'],
  ['whole', 'hole'], ['sale', 'sail'], ['mail', 'male'], ['plane', 'plain'], ['piece', 'peace'],
]
const SAME_SOUND = new Map()
HOMOPHONES.forEach((group) => group.forEach((w) => SAME_SOUND.set(w, group)))

export const normalizeSpeech = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/\d+/g, (n) => NUMBER_WORDS[n] || n)
    .replace(/[^a-z' -]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const levenshtein = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return dp
}

export const similarity = (a, b) => {
  if (!a && !b) return 1
  const dp = levenshtein(a, b)
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length)
}

const isSameSound = (heard, target) => SAME_SOUND.get(target)?.includes(heard) ?? false

// 후보 하나를 목표와 비교 → { score 0~1, how }
const compare = (heard, target) => {
  if (heard === target) return { score: 1, how: 'exact' }
  if (isSameSound(heard, target)) return { score: 1, how: 'homophone' }
  // "the apple", "an apple"처럼 앞뒤에 말이 붙은 경우: 짧은 단어(a, I 등)는 우연히 맞을 수 있어 제외
  const words = heard.split(' ')
  if (target.length >= 3 && words.length <= 3 && (words.includes(target) || ` ${heard} `.includes(` ${target} `))) {
    return { score: 1, how: 'inPhrase' }
  }
  return { score: similarity(heard.replace(/ /g, ''), target.replace(/ /g, '')), how: 'close' }
}

export const PASS = 0.999
export const CLOSE = 0.6

// alternatives: 음성 인식 후보 문자열 배열 (가장 그럴듯한 것부터)
export const gradePronunciation = (alternatives, target) => {
  const t = normalizeSpeech(target)
  let best = null
  for (const raw of alternatives) {
    const heard = normalizeSpeech(raw)
    if (!heard) continue
    const r = { heard, ...compare(heard, t) }
    if (!best || r.score > best.score) best = r
    if (best.score >= PASS) break
  }
  if (!best) return null
  const level = best.score >= PASS ? 3 : best.score >= CLOSE ? 2 : 1
  return { level, heard: best.heard, how: best.how, score: Math.round(best.score * 100) }
}

// 목표 단어 글자마다 들린 소리와 맞았는지 표시 (화면에서 틀린 부분 강조용)
export const letterMatch = (heard, target) => {
  const a = normalizeSpeech(heard).replace(/ /g, '')
  const chars = [...target]
  const b = chars.filter((c) => /[a-z]/i.test(c)).map((c) => c.toLowerCase())
  const dp = levenshtein(a, b.join(''))
  const ok = Array(b.length).fill(false)
  let i = a.length
  let j = b.length
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1] && dp[i][j] === dp[i - 1][j - 1]) { ok[j - 1] = true; i--; j-- }
    else if (dp[i][j] === dp[i - 1][j - 1] + 1) { i--; j-- }
    else if (dp[i][j] === dp[i - 1][j] + 1) i--
    else j--
  }
  let k = 0
  return chars.map((ch) => (/[a-z]/i.test(ch) ? { ch, ok: ok[k++] } : { ch, ok: true }))
}
