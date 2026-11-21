import React, { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import allRounds from '../data/all_rounds.json'
import QuizRunner from '../components/QuizRunner'
import { loadProgress, levelOf, LEVELS } from '../utils/progress'
import { PHONICS_GROUPS, buildPhonics, splitMarks } from '../utils/phonics'
import { pickTopicQuiz } from '../utils/topics'
import { canSpeak, speak } from '../utils/speech'
import { clickable } from '../utils/a11y'

const ALL_WORDS = allRounds.flatMap((r) => r.words)
const PATTERNS = buildPhonics(ALL_WORDS)
// 주소에 쓰는 키: "-ight" → "fam-ight", "a_e" 그대로
const slug = (p) => (p.group === 'family' ? `fam${p.key}` : p.key)
const BY_SLUG = Object.fromEntries(PATTERNS.map((p) => [slug(p), p]))
const ROUND_OF = Object.fromEntries(allRounds.flatMap((r) => r.words.map((w) => [w.en, r.id])))
// 소리 패턴 퀴즈는 듣고 쓰기·듣고 뜻 고르기 위주 (소리 없는 브라우저에서는 기본 유형)
const PHONICS_TYPES = ['spell', 'audio2ko', 'spell', 'img2en']

function Marked({ text, marks }) {
  return (
    <span lang="en">
      {splitMarks(text, marks).map((p, i) => (p.mark ? <b key={i} className="ph-mark">{p.text}</b> : <span key={i}>{p.text}</span>))}
    </span>
  )
}

function PhonicsList({ progress }) {
  const navigate = useNavigate()
  return (
    <div className="container topics-page">
      <h1 className="home-title">소리 <span className="title-gradient-accent">패턴</span></h1>
      <p className="review-desc">철자가 같은 부분은 소리도 비슷해요. 같은 패턴끼리 읽어 봐요.</p>
      {PHONICS_GROUPS.map((g) => {
        const list = PATTERNS.filter((p) => p.group === g.key)
        if (list.length === 0) return null
        return (
          <section key={g.key} className="ph-group">
            <h2 className="ph-group-title"><span aria-hidden="true">{g.emoji}</span> {g.label}</h2>
            <p className="ph-group-desc">{g.desc}</p>
            <ul className="ph-grid">
              {list.map((p) => {
                const studied = p.items.filter((x) => levelOf(progress[x.word.en]) > 0).length
                // 카드에는 가장 짧은(쉬운) 단어를 보기로
                const sample = p.items.reduce((m, x) => (x.word.en.length < m.word.en.length ? x : m))
                return (
                  <li key={p.key}>
                    <div className="ph-card" {...clickable(() => navigate(`/phonics/${slug(p)}`), `${p.label} 패턴 ${p.items.length}단어`)}>
                      <span className="ph-label" lang="en">{p.label}</span>
                      <span className="ph-sample"><Marked text={sample.word.en} marks={sample.marks} /></span>
                      <span className="topic-count">{studied} / {p.items.length}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function PhonicsDetail({ pattern, progress, onQuiz }) {
  const navigate = useNavigate()
  const group = PHONICS_GROUPS.find((g) => g.key === pattern.group)
  const words = pattern.items.map((x) => x.word)
  // 전부 이어서 듣기: 단어 사이를 쉼표로 끊어 천천히
  const playAll = () => speak(words.slice(0, 12).map((w) => w.en).join(', '), { rate: 0.7 })
  return (
    <div className="container topics-page">
      <h1 className="home-title"><span lang="en">{pattern.label}</span> <span className="title-gradient-accent">{group.label}</span></h1>
      {pattern.note && <p className="ph-note">🔊 {pattern.note}</p>}
      <div className="topic-actions">
        <button className="mic-button" onClick={() => onQuiz(pickTopicQuiz(words, progress))}>📝 듣고 쓰기 퀴즈 ({Math.min(10, words.length)}문제)</button>
        <div className="sub-tabs-container" role="group" aria-label="소리 패턴 도구">
          {canSpeak() && <button className="sub-tab-item" onClick={playAll}>▶️ 이어 듣기</button>}
          <button className="sub-tab-item" onClick={() => navigate('/phonics')}>← 패턴 목록</button>
        </div>
      </div>
      <ul className="topic-words">
        {pattern.items.map(({ word: w, marks }) => {
          const lv = LEVELS[levelOf(progress[w.en])]
          return (
            <li key={w.en} className="topic-word ph-word">
              <button className="quiz-result-word" onClick={() => speak(w.en)} title="발음 듣기"><Marked text={w.en} marks={marks} /></button>
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

function Phonics() {
  const { key } = useParams()
  // 퀴즈는 시작한 패턴 주소와 함께 저장: 퀴즈 중 뒤로 가기로 주소가 바뀌면 그 주소 화면을 보여 준다
  const [quizState, setQuizState] = useState(null)
  const quiz = quizState && quizState.key === key ? quizState.words : null
  const progress = useMemo(() => loadProgress(), [quiz, key])
  const pattern = key ? BY_SLUG[key] : null

  if (key && !pattern) return <Navigate to="/phonics" replace />
  if (quiz) {
    return (
      <QuizRunner
        key={key}
        words={quiz}
        title={`${pattern.label} 소리 퀴즈`}
        onExit={() => setQuizState(null)}
        exitLabel="패턴 화면으로"
        types={canSpeak() ? PHONICS_TYPES : undefined}
      />
    )
  }
  return pattern ? <PhonicsDetail pattern={pattern} progress={progress} onQuiz={(words) => setQuizState({ key, words })} /> : <PhonicsList progress={progress} />
}

export default Phonics
