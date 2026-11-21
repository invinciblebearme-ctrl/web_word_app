import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import allRounds from '../data/all_rounds.json'
import QuizRunner from '../components/QuizRunner'
import { getWrongWords, loadProgress, levelOf, LEVELS } from '../utils/progress'
import { loadActivity, streakInfo, calendarWeeks, DAILY_GOAL } from '../utils/activity'
import { buildDailySession } from '../utils/daily'
import { badgeMetrics, evaluateBadges } from '../utils/badges'
import { loadSentences } from '../utils/sentences'
import { speak } from '../utils/speech'

const ALL_WORDS = allRounds.flatMap((r) => r.words)
const ROUND_OF = Object.fromEntries(allRounds.flatMap((r) => r.words.map((w) => [w.en, r.id])))
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 하루 푼 문제 수 → 달력 칸 진하기 (0~3)
const heat = (n) => (n === 0 ? 0 : n < 5 ? 1 : n < DAILY_GOAL ? 2 : 3)

function Review() {
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState(null) // { words, title }
  // 퀴즈를 마치고 돌아오면 기록이 바뀌므로 quiz 상태가 바뀔 때마다 다시 계산
  const data = useMemo(() => {
    const now = Date.now()
    const progress = loadProgress()
    const activity = loadActivity()
    const streak = streakInfo(activity, now)
    const counts = [0, 0, 0, 0]
    ALL_WORDS.forEach((w) => counts[levelOf(progress[w.en])]++)
    return {
      progress,
      streak,
      counts,
      session: buildDailySession(allRounds, progress, now),
      wrong: getWrongWords(ALL_WORDS, progress),
      weeks: calendarWeeks(activity, now),
      badges: evaluateBadges(badgeMetrics(allRounds, progress, streak, loadSentences().length)),
    }
  }, [quiz])

  if (quiz) {
    return <QuizRunner words={quiz.words} title={quiz.title} onExit={() => setQuiz(null)} exitLabel="학습 화면으로" />
  }

  const { progress, streak, counts, session, wrong, weeks, badges } = data
  const { due: nDue, wrong: nWrong, new: nNew } = session.counts
  const goalPct = Math.min(streak.today / DAILY_GOAL, 1) * 100
  const earnedCount = badges.filter((b) => b.earned).length

  return (
    <div className="container review-page">
      <h1 className="home-title">오늘의 <span className="title-gradient-accent">학습</span></h1>

      <section className="review-section habit-card" aria-label="오늘의 기록">
        <div className="habit-streak">
          <span className="habit-streak-num">{streak.current > 0 ? `🔥 ${streak.current}일` : '🌱 0일'}</span>
          <span className="habit-streak-label">
            {streak.current === 0 ? '오늘 시작하면 1일째!' : streak.today > 0 ? '연속 공부 중' : '연속 중 · 오늘도 이어 가요'}
          </span>
        </div>
        <div className="habit-goal">
          <div className="habit-goal-text">
            오늘 목표 <b>{Math.min(streak.today, DAILY_GOAL)}</b> / {DAILY_GOAL}문제 {streak.goalDone && '🎯'}
          </div>
          <div className="habit-goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={DAILY_GOAL} aria-valuenow={Math.min(streak.today, DAILY_GOAL)} aria-label="오늘 목표">
            <div style={{ width: `${goalPct}%` }} />
          </div>
          <div className="habit-sub">최고 기록 {streak.best}일 · 공부한 날 {streak.totalDays}일</div>
        </div>
      </section>

      <section className="review-section">
        {session.words.length > 0 ? (
          <>
            <p className="review-desc">
              오늘은 <b>{session.words.length}문제</b>를 준비했어요.
              <span className="session-mix">
                {nDue > 0 && <span>🔁 복습 {nDue}</span>}
                {nWrong > 0 && <span>📒 오답 {nWrong}</span>}
                {nNew > 0 && <span>✨ 새 단어 {nNew}</span>}
              </span>
            </p>
            <button className="mic-button" onClick={() => setQuiz({ words: session.words, title: '오늘의 학습' })}>
              ▶️ 오늘의 학습 시작
            </button>
            {session.totalDue > nDue && (
              <p className="review-desc small">복습할 단어가 {session.totalDue - nDue}개 더 있어요. 한 번 더 하면 이어서 나와요.</p>
            )}
          </>
        ) : (
          <p className="review-desc">오늘 할 학습을 모두 마쳤어요! 800단어를 다 익혔어요. 🎉</p>
        )}
      </section>

      <div className="review-levels" aria-label="전체 800단어 숙련도">
        {LEVELS.map((l, i) => (
          <div key={l.key} className={`review-level level-box-${i}`}>
            <div className="review-level-num">{counts[i]}</div>
            <div className="review-level-label">{l.emoji} {l.label}</div>
          </div>
        ))}
      </div>

      <section className="review-section">
        <h2 className="review-heading">📅 학습 달력 <span>(최근 5주)</span></h2>
        <table className="habit-calendar">
          <thead>
            <tr>{WEEKDAYS.map((d) => <th key={d} scope="col">{d}</th>)}</tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0].key}>
                {week.map((d) => (
                  <td
                    key={d.key}
                    className={`cal-day heat-${heat(d.answered)}${d.isToday ? ' today' : ''}${d.future ? ' future' : ''}`}
                    title={d.future ? '' : `${d.key} · ${d.answered}문제`}
                    aria-label={d.future ? undefined : `${d.key} ${d.answered}문제`}
                  >
                    {d.day}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="cal-legend" aria-hidden="true">
          적게 <span className="cal-day heat-0" /> <span className="cal-day heat-1" /> <span className="cal-day heat-2" /> <span className="cal-day heat-3" /> 많이 ({DAILY_GOAL}문제 이상)
        </div>
      </section>

      <section className="review-section">
        <h2 className="review-heading">🏅 배지 <span>({earnedCount}/{badges.length})</span></h2>
        <ul className="badge-grid">
          {badges.map((b) => (
            <li key={b.id} className={`badge ${b.earned ? 'earned' : 'locked'}`} title={b.desc}>
              <span className="badge-emoji" aria-hidden="true">{b.earned ? b.emoji : '🔒'}</span>
              <span className="badge-name">{b.name}</span>
              {!b.earned && <span className="badge-progress">{b.value}/{b.goal}{b.unit}</span>}
              <span className="sr-only">{b.earned ? '받음' : '아직'} · {b.desc}</span>
            </li>
          ))}
        </ul>
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
