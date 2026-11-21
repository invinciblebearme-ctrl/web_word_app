// 소리 패턴(파닉스) 묶음: 단어 철자에서 규칙으로 찾는다 (따로 태그를 달지 않음)
// 같은 철자라도 소리가 여러 개인 패턴은 note로 알려 준다.

const VOWEL = 'aeiou'
const isVowel = (ch) => VOWEL.includes(ch)

// 모음 덩어리 수(끝의 묵음 e 제외) = 대략 음절 수
export const vowelGroups = (word) => {
  const w = word.replace(/e$/, '')
  return (w.match(/[aeiouy]+/g) || []).length
}

// 매직 e에서 빼는 단어: 철자는 모음+자음+e지만 긴 소리가 아님
const MAGIC_E_EXCEPTIONS = new Set([
  'come', 'some', 'love', 'have', 'give', 'live', 'done', 'gone', 'one', 'none', 'move', 'lose',
  'whose', 'were', 'where', 'there', 'are', 'sure', 'once', 'since', 'glove', 'dove', 'above',
])

// 패턴 정의: find(word) → 강조할 [시작, 끝) 구간 배열, 없으면 null
const anywhere = (s) => (w) => {
  const i = w.indexOf(s)
  return i >= 0 ? [[i, i + s.length]] : null
}
const atStart = (s) => (w) => (w.startsWith(s) ? [[0, s.length]] : null)
const atEnd = (s) => (w) => (w.endsWith(s) ? [[w.length - s.length, w.length]] : null)
// 정규식 첫 일치 구간 (r-모음처럼 앞뒤 글자를 따져야 하는 패턴)
const byRegex = (re) => (w) => {
  const m = w.match(re)
  return m ? [[m.index, m.index + m[0].length]] : null
}
// 철자는 같지만 소리가 다른 단어를 뺀다
const except = (words, find) => {
  const skip = new Set(words.split(' '))
  return (w) => (skip.has(w) ? null : find(w))
}

const magicE = (v) => (w) => {
  if (MAGIC_E_EXCEPTIONS.has(w) || vowelGroups(w) !== 1) return null
  const m = w.match(new RegExp(`([^aeiou]|^)(${v})([^aeiouwxyr])e$`))
  if (!m) return null
  const vi = w.length - 3
  return [[vi, vi + 1], [w.length - 1, w.length]]
}

export const PHONICS_GROUPS = [
  { key: 'digraph', label: '두 자음이 한 소리', emoji: '🤝', desc: '자음 두 개가 만나 새로운 소리 하나가 돼요.' },
  { key: 'blend', label: '이어 읽는 첫소리', emoji: '🔗', desc: '첫 자음 두 개의 소리를 빠르게 이어서 읽어요.' },
  { key: 'magic', label: '매직 e', emoji: '🪄', desc: '끝의 e는 소리가 나지 않고, 앞 모음을 알파벳 이름대로 읽게 해요.' },
  { key: 'team', label: '모음 짝꿍', emoji: '👯', desc: '모음 두 개가 함께 하나의 소리를 내요.' },
  { key: 'rvowel', label: 'r과 만난 모음', emoji: '🌀', desc: '모음 뒤에 r이 오면 소리가 달라져요.' },
  { key: 'family', label: '단어 가족', emoji: '🏡', desc: '끝소리가 같은 단어들이에요. 첫소리만 바꿔 읽어 봐요.' },
]

const P = (group, key, label, find, note) => ({ group, key, label, find, note })

// ea는 소리가 여러 개라 짧은 "에"를 따로 묶고, 나머지 소리(break, bear, ear, learn …)는 뺀다
const EA_SHORT = 'ahead already bread breakfast dead death head heavy ready weather'
const EA_OTHER = 'break great steak bear wear clear ear near year early earth learn heart beauty area idea recreation'
// ow: "아우"로 나는 단어. 나머지 ow는 "오우"
const OW_AU = new Set('brown cow down flower how however now power town'.split(' '))

const BASE_PATTERNS = [
  P('digraph', 'sh', 'sh', anywhere('sh'), 'ship, fish처럼 "쉬" 소리'),
  P('digraph', 'ch', 'ch', except('school', anywhere('ch')), 'chair, lunch처럼 "취" 소리'),
  P('digraph', 'th', 'th', anywhere('th'), '혀를 살짝 이 사이에 두고 내는 소리 (think, this)'),
  P('digraph', 'wh', 'wh', except('who', atStart('wh')), 'what, white처럼 "w" 소리'),
  P('digraph', 'ph', 'ph', anywhere('ph'), 'phone처럼 "f" 소리'),
  P('digraph', 'ck', 'ck', anywhere('ck'), 'duck, back처럼 "k" 소리'),
  P('digraph', 'ng', '-ng', atEnd('ng'), 'king, long처럼 코로 내는 "응" 소리'),
  P('digraph', 'kn', 'kn-', atStart('kn'), 'k는 소리가 나지 않아요 (knife, know)'),
  P('digraph', 'wr', 'wr-', atStart('wr'), 'w는 소리가 나지 않아요 (write)'),
  ...['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr']
    .map((b) => P('blend', b, `${b}-`, atStart(b))),
  P('magic', 'a_e', 'a_e', magicE('a'), 'make, name처럼 a를 "에이"로'),
  P('magic', 'i_e', 'i_e', magicE('i'), 'bike, time처럼 i를 "아이"로'),
  P('magic', 'o_e', 'o_e', magicE('o'), 'home, nose처럼 o를 "오우"로'),
  P('magic', 'u_e', 'u_e', magicE('u'), 'cute처럼 u를 "유"로'),
  P('team', 'ee', 'ee', anywhere('ee'), 'tree, see처럼 길게 "이-"'),
  P('team', 'ea', 'ea', except(`${EA_SHORT} ${EA_OTHER}`, anywhere('ea')), 'eat, sea처럼 길게 "이-"'),
  P('team', 'ea-short', 'ea (에)', (w) => (EA_SHORT.split(' ').includes(w) ? anywhere('ea')(w) : null), 'bread, head처럼 짧게 "에" 소리가 나는 ea'),
  P('team', 'ai', 'ai', except('again against certain curtain mountain campaign', byRegex(/ai(?!r)/)), 'rain, train처럼 "에이"'),
  P('team', 'ay', 'ay', anywhere('ay'), 'day, play처럼 "에이"'),
  P('team', 'oa', 'oa', except('board', anywhere('oa')), 'boat, road처럼 "오우"'),
  P('team', 'oo', 'oo', except('blood door floor poor', anywhere('oo')), 'moon처럼 길게 "우-", book처럼 짧게 "우"'),
  P('team', 'ou', 'ou', except('could should would country cousin couple course court delicious double doughnut enough four your group soup touch you young', anywhere('ou')), 'house, mouth처럼 "아우"'),
  P('team', 'ow', 'ow (아우)', (w) => (OW_AU.has(w) ? anywhere('ow')(w) : null), 'cow, down처럼 "아우"'),
  P('team', 'ow-long', 'ow (오우)', (w) => (OW_AU.has(w) ? null : anywhere('ow')(w)), 'snow, window처럼 "오우"'),
  P('team', 'oi', 'oi / oy', (w) => anywhere('oi')(w) || anywhere('oy')(w), 'coin, boy처럼 "오이"'),
  P('team', 'au', 'au / aw', except('away aunt beauty restaurant', (w) => anywhere('au')(w) || anywhere('aw')(w)), 'draw, autumn처럼 "오-"'),
  P('team', 'ew', 'ew', except('homework', anywhere('ew')), 'new처럼 "우-" 또는 "유-"'),
  P('rvowel', 'ar', 'ar', except('sugar', byRegex(/(?<![aeiouw])ar(?![aeiouyr])/)), 'car, star처럼 "아r"'),
  P('rvowel', 'or', 'or', except('color doctor forget history memory scissors', byRegex(/(?<![aeiouw])or(?![aeiour])/)), 'fork, horse처럼 "오r"'),
  P('rvowel', 'ir', 'ir / ur', byRegex(/(?<![aeiou])[iu]r(?![aeiouyr])/), 'bird, nurse처럼 힘주어 "어r"'),
  P('rvowel', 'er', '-er', atEnd('er'), 'sister, water처럼 끝에서 약하게 "어r"'),
]

// 단어 가족: 한 음절 단어의 첫 모음부터 끝까지(라임)가 같은 것끼리
export const rimeOf = (w) => {
  if (!/^[a-z]+$/.test(w) || vowelGroups(w) !== 1) return null
  const i = w.search(/[aeiouy]/)
  if (i <= 0) return null // 모음으로 시작하면 첫소리를 바꿔 볼 수 없다
  return w.slice(i)
}

export const MIN_WORDS = 4

// 끝 철자는 같아도 소리가 달라 가족으로 묶지 않는 것
const FAMILY_SKIP_WORDS = new Set(['what', 'read', 'wind', 'give', 'live', 'blood', 'war'])
const FAMILY_SKIP_RIMES = new Set(['ow', 'ear', 'ood'])

// 단어 목록으로 패턴 목록을 만든다. 단어가 MIN_WORDS개 이상인 패턴만
export const buildPhonics = (allWords) => {
  const words = allWords.filter((w) => /^[a-z]+$/.test(w.en))
  const patterns = []
  for (const p of BASE_PATTERNS) {
    const list = words.map((w) => ({ word: w, marks: p.find(w.en) })).filter((x) => x.marks)
    if (list.length >= MIN_WORDS) patterns.push({ ...p, items: list })
  }
  const byRime = {}
  for (const w of words) {
    const r = rimeOf(w.en)
    if (r && r.length >= 2 && !FAMILY_SKIP_RIMES.has(r) && !FAMILY_SKIP_WORDS.has(w.en)) (byRime[r] ||= []).push(w)
  }
  Object.entries(byRime)
    .filter(([, list]) => list.length >= MIN_WORDS)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .forEach(([rime, list]) => {
      patterns.push({
        group: 'family', key: `-${rime}`, label: `-${rime}`,
        note: `${list.slice(0, 3).map((w) => w.en).join(', ')}처럼 끝이 "${rime}"`,
        items: list.map((w) => ({ word: w, marks: [[w.en.length - rime.length, w.en.length]] })),
      })
    })
  return patterns.map(({ find, ...rest }) => rest)
}

// 강조 구간대로 글자를 나눈다: [{text, mark}]
export const splitMarks = (text, marks) => {
  const out = []
  let pos = 0
  for (const [s, e] of [...marks].sort((a, b) => a[0] - b[0])) {
    if (s > pos) out.push({ text: text.slice(pos, s), mark: false })
    out.push({ text: text.slice(s, e), mark: true })
    pos = e
  }
  if (pos < text.length) out.push({ text: text.slice(pos), mark: false })
  return out
}
