import React, { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import allRounds from '../data/all_rounds.json'
import QuizRunner from '../components/QuizRunner'
import { loadProgress, levelOf, LEVELS } from '../utils/progress'
import { TOPICS, TOPIC_BY_KEY, groupByTopic, pickTopicQuiz } from '../utils/topics'
import { wordImageUrl } from '../utils/image'
import { speak } from '../utils/speech'
import { clickable } from '../utils/a11y'

const ALL_WORDS = allRounds.flatMap((r) => r.words)
const GROUPS = groupByTopic(ALL_WORDS)
const ROUND_OF = Object.fromEntries(allRounds.flatMap((r) => r.words.map((w) => [w.en, r.id])))

function TopicList({ progress }) {
  const navigate = useNavigate()
  return (
    <div className="container topics-page">
      <h1 className="home-title">주제별 <span className="title-gradient-accent">단어</span></h1>
      <p className="review-desc">관련 있는 단어끼리 모아서 익히면 더 잘 기억나요.</p>
      <ul className="topic-grid">
        {TOPICS.map((t) => {
          const words = GROUPS[t.key]
          const studied = words.filter((w) => levelOf(progress[w.en]) > 0).length
          return (
            <li key={t.key}>
              <div className="topic-card" {...clickable(() => navigate(`/topics/${t.key}`), `${t.label} ${words.length}단어, ${studied}개 익힘`)}>
                <span className="topic-emoji" aria-hidden="true">{t.emoji}</span>
                <span className="topic-label">{t.label}</span>
                <span className="topic-count">{studied} / {words.length}</span>
                <span className="topic-bar" aria-hidden="true"><span style={{ width: `${(studied / Math.max(words.length, 1)) * 100}%` }} /></span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TopicDetail({ topic, progress, onQuiz }) {
  const navigate = useNavigate()
  const words = GROUPS[topic.key]
  const [sort, setSort] = useState('round') // round | level
  const list = sort === 'level'
    ? [...words].sort((a, b) => levelOf(progress[a.en]) - levelOf(progress[b.en]))
    : words
  return (
    <div className="container topics-page">
      <h1 className="home-title"><span className="emoji-plain" aria-hidden="true">{topic.emoji}</span> {topic.label}</h1>
      <p className="review-desc">{words.length}단어</p>
      <div className="topic-actions">
        <button className="mic-button" onClick={() => onQuiz(pickTopicQuiz(words, progress))}>📝 이 주제 퀴즈 ({Math.min(10, words.length)}문제)</button>
        <div className="sub-tabs-container" role="group" aria-label="정렬">
          <button className={`sub-tab-item ${sort === 'round' ? 'active' : ''}`} aria-pressed={sort === 'round'} onClick={() => setSort('round')}>회차순</button>
          <button className={`sub-tab-item ${sort === 'level' ? 'active' : ''}`} aria-pressed={sort === 'level'} onClick={() => setSort('level')}>덜 익힌 순</button>
          <button className="sub-tab-item" onClick={() => navigate('/topics')}>← 주제 목록</button>
        </div>
      </div>
      <ul className="topic-words">
        {list.map((w) => {
          const lv = LEVELS[levelOf(progress[w.en])]
          return (
            <li key={w.en} className="topic-word">
              <img src={wordImageUrl(w.img)} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
              <button className="quiz-result-word" lang="en" onClick={() => speak(w.en)} title="발음 듣기">{w.en}</button>
              <span className="quiz-result-ko">{w.ko}</span>
              <span className="topic-word-level" title={lv.label}>{lv.emoji}<span className="sr-only">{lv.label}</span></span>
              <button className="review-round-link" onClick={() => navigate(`/challenge/${ROUND_OF[w.en]}`)}>{ROUND_OF[w.en]}회</button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Topics() {
  const { key } = useParams()
  // 퀴즈는 시작한 주제 주소와 함께 저장: 퀴즈 중 뒤로 가기로 주소가 바뀌면 그 주소 화면을 보여 준다
  const [quizState, setQuizState] = useState(null)
  const quiz = quizState && quizState.key === key ? quizState.words : null
  const progress = useMemo(() => loadProgress(), [quiz, key])
  const topic = key ? TOPIC_BY_KEY[key] : null

  if (key && !topic) return <Navigate to="/topics" replace />
  if (quiz) {
    return <QuizRunner key={key} words={quiz} title={`${topic.emoji} ${topic.label} 퀴즈`} onExit={() => setQuizState(null)} exitLabel="주제 화면으로" />
  }
  return topic ? <TopicDetail topic={topic} progress={progress} onQuiz={(words) => setQuizState({ key, words })} /> : <TopicList progress={progress} />
}

export default Topics
