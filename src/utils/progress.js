// 단어별 학습 기록 (Leitner 상자 방식 간격 반복)
// localStorage key: word_progress_v1
// { [en]: { box, correct, wrong, due, lastSeen } }
//   box  0~5  : 숙련도. 맞히면 +1, 틀리면 0으로
//   due       : 다음 복습 날짜(자정 기준 timestamp)

const STORAGE_KEY = 'word_progress_v1'
const DAY = 24 * 60 * 60 * 1000
// box별 다음 복습까지의 일수
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30]
export const MAX_BOX = INTERVAL_DAYS.length - 1

export const LEVELS = [
  { key: 'new', label: '처음', emoji: '⚪' },
  { key: 'learning', label: '익히는 중', emoji: '🟠' },
  { key: 'almost', label: '거의 앎', emoji: '🟡' },
  { key: 'mastered', label: '완전히 앎', emoji: '🟢' },
]

const startOfDay = (now) => {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export const loadProgress = () => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

const saveProgress = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // 저장 공간 부족 등: 학습은 계속할 수 있게 무시
  }
}

// 순수 함수: 기존 기록 + 정답 여부 → 새 기록
export const nextRecord = (rec, isCorrect, now = Date.now()) => {
  const prev = rec || { box: 0, correct: 0, wrong: 0 }
  const box = isCorrect ? Math.min(prev.box + 1, MAX_BOX) : 0
  return {
    ...prev,
    box,
    correct: prev.correct + (isCorrect ? 1 : 0),
    wrong: prev.wrong + (isCorrect ? 0 : 1),
    due: startOfDay(now) + INTERVAL_DAYS[box] * DAY,
    lastSeen: now,
  }
}

export const recordAnswer = (en, isCorrect, now = Date.now()) => {
  const data = loadProgress()
  data[en] = nextRecord(data[en], isCorrect, now)
  saveProgress(data)
  return data[en]
}

// 카드만 본 경우: 숙련도는 그대로, '본 적 있음'만 표시
export const markSeen = (en, now = Date.now()) => {
  const data = loadProgress()
  if (data[en]) {
    data[en] = { ...data[en], lastSeen: now }
  } else {
    data[en] = { box: 0, correct: 0, wrong: 0, due: startOfDay(now), lastSeen: now, seenOnly: true }
  }
  saveProgress(data)
}

// 0: 처음, 1: 익히는 중, 2: 거의 앎, 3: 완전히 앎
export const levelOf = (rec) => {
  if (!rec || rec.correct + rec.wrong === 0) return 0
  if (rec.box >= 4) return 3
  if (rec.box >= 2) return 2
  return 1
}

// 퀴즈를 한 번이라도 푼 단어 중 복습할 날이 된 것. 틀린 횟수가 많은 순.
export const getDueWords = (allWords, progress = loadProgress(), now = Date.now(), limit = 15) =>
  allWords
    .filter((w) => {
      const r = progress[w.en]
      return r && r.correct + r.wrong > 0 && r.due <= now
    })
    .sort((a, b) => {
      const ra = progress[a.en], rb = progress[b.en]
      return ra.box - rb.box || rb.wrong - ra.wrong || ra.due - rb.due
    })
    .slice(0, limit)

// 한 번이라도 틀렸고 아직 완전히 익히지 못한 단어
export const getWrongWords = (allWords, progress = loadProgress()) =>
  allWords
    .filter((w) => {
      const r = progress[w.en]
      return r && r.wrong > 0 && levelOf(r) < 3
    })
    .sort((a, b) => progress[b.en].wrong - progress[a.en].wrong)

export const roundSummary = (round, progress = loadProgress()) => {
  const levels = round.words.map((w) => levelOf(progress[w.en]))
  return {
    total: round.words.length,
    seen: round.words.filter((w) => progress[w.en]).length,
    studied: levels.filter((l) => l > 0).length,
    mastered: levels.filter((l) => l === 3).length,
  }
}
