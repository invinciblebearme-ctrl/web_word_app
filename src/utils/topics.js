// 주제별 묶음: 교과서 단원처럼 관련 단어끼리 모아 함께 익힌다
import topicOf from '../data/topics.json'
import { levelOf } from './progress'
import { shuffle } from './quiz'

export const TOPICS = [
  { key: 'animals', label: '동물', emoji: '🐶' },
  { key: 'food', label: '음식', emoji: '🍎' },
  { key: 'people', label: '사람·가족·직업', emoji: '👪' },
  { key: 'body', label: '몸·건강', emoji: '🖐️' },
  { key: 'clothes', label: '옷', emoji: '👕' },
  { key: 'school', label: '학교·공부', emoji: '🏫' },
  { key: 'home', label: '집·물건', emoji: '🏠' },
  { key: 'nature', label: '자연·날씨', emoji: '🌳' },
  { key: 'places', label: '장소·교통', emoji: '🚌' },
  { key: 'hobbies', label: '운동·놀이·취미', emoji: '⚽' },
  { key: 'time', label: '시간·날짜', emoji: '⏰' },
  { key: 'numbers', label: '수·양·순서', emoji: '🔢' },
  { key: 'describe', label: '모양·색깔·상태', emoji: '🎨' },
  { key: 'feelings', label: '감정·성격', emoji: '😊' },
  { key: 'abstract', label: '생각·개념', emoji: '💡' },
  { key: 'actions', label: '동작', emoji: '🏃' },
  { key: 'basic', label: '기본 낱말', emoji: '🔤' },
]
export const TOPIC_BY_KEY = Object.fromEntries(TOPICS.map((t) => [t.key, t]))

export const topicKeyOf = (en) => topicOf[en] || 'basic'

export const groupByTopic = (allWords) => {
  const groups = Object.fromEntries(TOPICS.map((t) => [t.key, []]))
  allWords.forEach((w) => groups[topicKeyOf(w.en)].push(w))
  return groups
}

// 주제 퀴즈: 덜 익힌 단어부터 n개 (같은 숙련도 안에서는 무작위)
export const pickTopicQuiz = (words, progress, n = 10, rng = Math.random) => {
  const byLevel = [[], [], [], []]
  shuffle(words, rng).forEach((w) => byLevel[levelOf(progress[w.en])].push(w))
  // 처음 보는 단어(0)보다 익히는 중(1)인 단어를 먼저: 복습 효과가 크고, 새 단어는 그다음
  return [...byLevel[1], ...byLevel[0], ...byLevel[2], ...byLevel[3]].slice(0, n)
}
