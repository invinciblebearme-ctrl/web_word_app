// 오늘의 학습: 복습할 단어 + 틀린 단어 + 새 단어를 섞어 한 번에 5~10분 분량으로 구성
import { getDueWords, getWrongWords, levelOf } from './progress'

export const SESSION_SIZE = 12
export const NEW_PER_SESSION = 4 // 복습이 많아도 새 단어는 이만큼 자리를 남겨 둔다
const MAX_NEW = 8 // 복습할 게 없을 때도 새 단어는 이만큼만

export const buildDailySession = (rounds, progress, now = Date.now(), size = SESSION_SIZE) => {
  const allWords = rounds.flatMap((r) => r.words)
  const due = getDueWords(allWords, progress, now, Infinity)
  const dueSet = new Set(due.map((w) => w.en))
  const wrong = getWrongWords(allWords, progress).filter((w) => !dueSet.has(w.en))
  // 새 단어: 회차 순서대로 아직 퀴즈로 확인하지 않은 단어
  const fresh = allWords.filter((w) => levelOf(progress[w.en]) === 0)

  const reviewSlots = size - Math.min(NEW_PER_SESSION, fresh.length)
  const pickedDue = due.slice(0, reviewSlots)
  const pickedWrong = wrong.slice(0, reviewSlots - pickedDue.length)
  const newSlots = Math.min(size - pickedDue.length - pickedWrong.length, MAX_NEW)
  const pickedNew = fresh.slice(0, newSlots)

  return {
    words: [...pickedDue, ...pickedWrong, ...pickedNew],
    counts: { due: pickedDue.length, wrong: pickedWrong.length, new: pickedNew.length },
    totalDue: due.length,
  }
}
