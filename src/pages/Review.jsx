import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import allRounds from '../data/all_rounds.json'
import QuizRunner from '../components/QuizRunner'
import { getDueWords, getWrongWords, loadProgress, levelOf, LEVELS } from '../utils/progress'
import { speak } from '../utils/speech'

const ALL_WORDS = allRounds.flatMap((r) => r.words)
const ROUND_OF = Object.fromEntries(allRounds.flatMap((r) => r.words.map((w) => [w.en, r.id])))

function Review() {
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState(null) // { words, title }
  // 퀴즈를 마치고 돌아오면 기록이 바뀌므로 quiz 상태가 바뀔 때마다 다시 계산
  const { progress, due, wrong, counts } = useMemo(() => {
    const progress = loadProgress()
    const counts = [0, 0, 0, 0]
    ALL_WORDS.forEach((w) => counts[levelOf(progress[w.en])]++)
    return { progress, due: getDueWords(ALL_WORDS, progress), wrong: getWrongWords(ALL_WORDS, progress), counts }
  }, [quiz])

  if (quiz) {
    return <QuizRunner words={quiz.words} title={quiz.title} onExit={() => setQuiz(null)} exitLabel="복습 화면으로" />
  }

  const studiedRounds = allRounds.filter((r) => r.words.some((w) => progress[w.en]))
  const nextRound = allRounds.find((r) => r.words.every((w) => levelOf(progress[w.en]) === 0)) || allRounds[0]

  return (
    <div className="container review-page">
      <h1 className="home-title">오늘의 <span className="title-gradient-accent">복습</span></h1>

      <div className="review-levels" aria-label="전체 800단어 숙련도">
        {LEVELS.map((l, i) => (
          <div key={l.key} className={`review-level level-box-${i}`}>
            <div className="review-level-num">{counts[i]}</div>
            <div className="review-level-label">{l.emoji} {l.label}</div>
          </div>
        ))}
      </div>

      <section className="review-section">
        {due.length > 0 ? (
          <>
            <p className="review-desc">오늘 다시 볼 때가 된 단어가 <b>{due.length}개</b> 있어요.</p>
            <button className="mic-button" onClick={() => setQuiz({ words: due, title: '오늘의 복습' })}>
              🔁 오늘의 복습 시작
            </button>
          </>
        ) : (
          <>
            <p className="review-desc">
              {studiedRounds.length === 0
                ? '아직 퀴즈를 푼 단어가 없어요. 첫 회차부터 시작해 볼까요?'
                : '오늘 복습할 단어를 모두 마쳤어요! 새 회차에 도전해 볼까요? 🎉'}
            </p>
            <button className="mic-button" onClick={() => navigate(`/challenge/${nextRound.id}`)}>
              📘 {nextRound.name} 학습하기
            </button>
          </>
        )}
      </section>

      <section className="review-section">
        <h2 className="review-heading">📒 오답 노트 <span>({wrong.length})</span></h2>
        {wrong.length === 0 ? (
          <p className="review-desc">틀린 단어가 없어요.</p>
        ) : (
          <>
            <button className="dark-button" onClick={() => setQuiz({ words: wrong.slice(0, 20), title: '오답 노트 퀴즈' })}>
              오답 단어로 퀴즈 풀기{wrong.length > 20 ? ' (20개)' : ''}
            </button>
            <ul className="quiz-result-list">
              {wrong.map((w) => {
                const r = progress[w.en]
                const lv = LEVELS[levelOf(r)]
                return (
                  <li key={w.en} className="ng">
                    <button className="quiz-result-word" onClick={() => speak(w.en)} title="발음 듣기">{w.en}</button>
                    <span className="quiz-result-ko">{w.ko}</span>
                    <span className="quiz-result-level">틀림 {r.wrong} · {lv.emoji} {lv.label}</span>
                    <button className="review-round-link" onClick={() => navigate(`/challenge/${ROUND_OF[w.en]}`)}>{ROUND_OF[w.en]}회</button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

export default Review
