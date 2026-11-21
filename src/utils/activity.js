// 날짜별 학습량 기록 (연속 학습일, 오늘 목표, 학습 달력용)
// localStorage key: word_activity_v1
// { 'YYYY-MM-DD': { answered, correct } }  ← 학생 기기의 로컬 날짜 기준

const STORAGE_KEY = 'word_activity_v1'
export const DAILY_GOAL = 10 // 하루 목표 문제 수 (5~10분 분량)

const pad = (n) => String(n).padStart(2, '0')
export const dayKey = (now = Date.now()) => {
  const d = new Date(now)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const addDays = (now, n) => {
  const d = new Date(now)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

export const loadActivity = () => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

export const logAnswer = (isCorrect, now = Date.now()) => {
  const data = loadActivity()
  const key = dayKey(now)
  const day = data[key] || { answered: 0, correct: 0 }
  data[key] = { answered: day.answered + 1, correct: day.correct + (isCorrect ? 1 : 0) }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // 저장 실패해도 학습은 계속
  }
  return data[key]
}

const studied = (activity, t) => (activity[dayKey(t)]?.answered || 0) > 0

// current: 오늘(또는 오늘 아직 안 했으면 어제)까지 이어진 연속 학습일
export const streakInfo = (activity = loadActivity(), now = Date.now()) => {
  const today = activity[dayKey(now)] || { answered: 0, correct: 0 }
  let current = 0
  let t = studied(activity, now) ? now : addDays(now, -1)
  while (studied(activity, t)) {
    current++
    t = addDays(t, -1)
  }

  const days = Object.keys(activity).filter((k) => activity[k].answered > 0).sort()
  let best = 0
  let run = 0
  let prev = null
  for (const k of days) {
    const [y, m, d] = k.split('-').map(Number)
    const t2 = new Date(y, m - 1, d).getTime()
    run = prev !== null && dayKey(addDays(prev, 1)) === k ? run + 1 : 1
    best = Math.max(best, run)
    prev = t2
  }

  return {
    current,
    best: Math.max(best, current),
    totalDays: days.length,
    totalAnswered: days.reduce((s, k) => s + activity[k].answered, 0),
    today: today.answered,
    goalDone: today.answered >= DAILY_GOAL,
  }
}

// 최근 weeks주를 일요일 시작 달력으로. 미래 날짜는 future: true
export const calendarWeeks = (activity = loadActivity(), now = Date.now(), weeks = 5) => {
  const todayKey = dayKey(now)
  const start = addDays(now, -(new Date(now).getDay() + (weeks - 1) * 7))
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const t = addDays(start, w * 7 + d)
      const key = dayKey(t)
      return {
        key,
        day: new Date(t).getDate(),
        answered: activity[key]?.answered || 0,
        isToday: key === todayKey,
        future: key > todayKey,
      }
    })
  )
}
