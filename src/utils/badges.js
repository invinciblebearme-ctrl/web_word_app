// 배지: 저장하지 않고 학습 기록에서 매번 계산한다 (기록과 어긋날 일이 없음)
// 경쟁보다 자기 기록 중심. 다음 배지까지 남은 양을 보여 준다.
import { levelOf, loadProgress } from './progress'
import { loadActivity, streakInfo } from './activity'

const tiers = (id, emoji, name, unit, values, desc) =>
  values.map((goal) => ({ id: `${id}-${goal}`, emoji, name: name(goal), goal, unit, metric: id, desc: desc(goal) }))

export const BADGES = [
  { id: 'first-1', emoji: '🌱', name: '첫 걸음', goal: 1, unit: '문제', metric: 'answered', desc: '퀴즈 첫 문제 풀기' },
  ...tiers('streak', '🔥', (g) => `${g}일 연속`, '일', [3, 7, 30], (g) => `${g}일 연속으로 공부하기`),
  ...tiers('days', '📅', (g) => `${g}일 공부`, '일', [10, 50], (g) => `공부한 날 ${g}일 채우기`),
  ...tiers('mastered', '🟢', (g) => `완전히 앎 ${g}`, '단어', [10, 100, 400, 800], (g) => `'완전히 앎' 단어 ${g}개`),
  ...tiers('rounds', '🏆', (g) => `${g}회차 정복`, '회차', [1, 10, 40, 80], (g) => `회차 단어를 모두 '거의 앎' 이상으로 만들기 ${g}회차`),
]

export const badgeMetrics = (rounds, progress, streak) => {
  let mastered = 0
  let roundsDone = 0
  for (const r of rounds) {
    const levels = r.words.map((w) => levelOf(progress[w.en]))
    mastered += levels.filter((l) => l === 3).length
    if (levels.every((l) => l >= 2)) roundsDone++
  }
  return {
    answered: streak.totalAnswered,
    streak: streak.best,
    days: streak.totalDays,
    mastered,
    rounds: roundsDone,
  }
}

export const evaluateBadges = (metrics) =>
  BADGES.map((b) => ({ ...b, value: Math.min(metrics[b.metric], b.goal), earned: metrics[b.metric] >= b.goal }))

// 지금 저장된 기록 기준 배지 상태
export const currentBadges = (rounds, now = Date.now()) =>
  evaluateBadges(badgeMetrics(rounds, loadProgress(), streakInfo(loadActivity(), now)))
