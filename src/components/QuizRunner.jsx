import React, { useEffect, useMemo, useRef, useState } from 'react'
import allRounds from '../data/all_rounds.json'
import { buildQuiz, normalizeAnswer, TYPE_LABELS } from '../utils/quiz'
import { recordAnswer, levelOf, LEVELS } from '../utils/progress'
import { canSpeak, speak } from '../utils/speech'
import { wordImageUrl } from '../utils/image'

const ALL_WORDS = allRounds.flatMap((r) => r.words)

// words: 문제로 낼 단어 목록. onExit: 끝내기 버튼 동작. exitLabel: 버튼 이름
function QuizRunner({ words, title, onExit, exitLabel = '목록으로' }) {
  const [quizWords, setQuizWords] = useState(words)
  const questions = useMemo(
    () => buildQuiz(quizWords, ALL_WORDS, { hasAudio: canSpeak() }),
    [quizWords]
  )
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null) // 고른 보기 또는 입력한 철자
  const [typed, setTyped] = useState('')
  const [results, setResults] = useState([]) // { word, correct, level }
  const inputRef = useRef(null)

  const q = questions[index]
  const answered = selected !== null
  const isCorrect = answered && (q.type === 'spell'
    ? normalizeAnswer(selected) === normalizeAnswer(q.word.en)
    : selected === q.answer)

  // 소리 문제는 문제가 바뀔 때 자동으로 한 번 들려준다
  useEffect(() => {
    if (!q) return
    if (q.type === 'audio2ko' || q.type === 'spell') speak(q.word.en)
    if (q.type === 'spell') inputRef.current?.focus()
  }, [q])

  const submit = (value) => {
    if (answered) return
    const correct = q.type === 'spell'
      ? normalizeAnswer(value) === normalizeAnswer(q.word.en)
      : value === q.answer
    const rec = recordAnswer(q.word.en, correct)
    setSelected(value)
    setResults((prev) => [...prev, { word: q.word, correct, level: levelOf(rec) }])
    if (correct && q.type !== 'audio2ko') speak(q.word.en)
  }

  const next = () => {
    setSelected(null)
    setTyped('')
    setIndex((i) => i + 1)
  }

  const restartWith = (list) => {
    setQuizWords(list)
    setIndex(0)
    setSelected(null)
    setTyped('')
    setResults([])
  }

  if (questions.length === 0) {
    return (
      <div className="challenge-body">
        <div className="challenge-container">
          <h1>{title}</h1>
          <p className="quiz-empty">풀 문제가 없어요.</p>
          <button className="nav-btn-premium" onClick={onExit}>{exitLabel}</button>
        </div>
      </div>
    )
  }

  // 결과 화면
  if (index >= questions.length) {
    const correctCount = results.filter((r) => r.correct).length
    const wrong = results.filter((r) => !r.correct).map((r) => r.word)
    const ratio = correctCount / results.length
    return (
      <div className="challenge-body">
        <div className="challenge-container">
          <h1>{title}</h1>
          <div className="challenge-card quiz-result-card">
            <div className="quiz-score">{correctCount} / {results.length}</div>
            <div className="quiz-score-msg">
              {ratio === 1 ? '모두 맞혔어요! 최고예요! 🎉' : ratio >= 0.7 ? '잘했어요! 틀린 단어만 한 번 더 볼까요? 👍' : '괜찮아요. 틀린 단어를 다시 풀어 봐요! 💪'}
            </div>
          </div>
          <ul className="quiz-result-list">
            {results.map((r, i) => (
              <li key={i} className={r.correct ? 'ok' : 'ng'}>
                <span className="quiz-result-mark">{r.correct ? '⭕' : '❌'}</span>
                <button className="quiz-result-word" onClick={() => speak(r.word.en)} title="발음 듣기">{r.word.en}</button>
                <span className="quiz-result-ko">{r.word.ko}</span>
                <span className="quiz-result-level" title="숙련도">{LEVELS[r.level].emoji} {LEVELS[r.level].label}</span>
              </li>
            ))}
          </ul>
          <div className="challenge-controls quiz-result-controls">
            {wrong.length > 0 && (
              <button className="nav-btn-premium" onClick={() => restartWith(wrong)}>틀린 단어 다시 ({wrong.length})</button>
            )}
            <button className="nav-btn-premium" onClick={() => restartWith(words)}>처음부터 다시</button>
            <button className="nav-btn-premium" onClick={onExit}>{exitLabel}</button>
          </div>
        </div>
      </div>
    )
  }

  const imgUrl = wordImageUrl(q.word.img)

  return (
    <div className="challenge-body">
      <div className="challenge-container">
        <h1>{title}</h1>
        <div className="challenge-index">문제 {index + 1} / {questions.length}</div>
        <div className="quiz-progress"><div style={{ width: `${(index / questions.length) * 100}%` }} /></div>
        <div className="quiz-instruction">{TYPE_LABELS[q.type]}</div>

        <div className="challenge-card quiz-card">
          {q.type === 'ko2en' && <div className="word-ko">{q.word.ko}</div>}
          {q.type === 'img2en' && (
            <div className="challenge-image quiz-image">
              <img src={imgUrl} alt="문제 그림" className="word-image" />
            </div>
          )}
          {(q.type === 'audio2ko' || q.type === 'spell') && (
            <>
              {q.type === 'spell' && <div className="word-ko">{q.word.ko}</div>}
              <button className="quiz-audio-btn" onClick={() => speak(q.word.en)}>🔊 다시 듣기</button>
            </>
          )}
        </div>

        {q.type === 'spell' ? (
          <form
            className="quiz-spell"
            onSubmit={(e) => { e.preventDefault(); if (typed.trim()) submit(typed) }}
          >
            <input
              ref={inputRef}
              className="scramble-input"
              value={answered ? selected : typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="영어로 써 보세요"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              disabled={answered}
              aria-label="답 입력"
            />
            {!answered && <button type="submit" className="nav-btn-premium" disabled={!typed.trim()}>확인</button>}
          </form>
        ) : (
          <div className="quiz-options">
            {q.options.map((opt) => {
              const state = !answered ? '' : opt === q.answer ? 'correct' : opt === selected ? 'wrong' : 'dim'
              return (
                <button
                  key={opt}
                  className={`quiz-option ${state}`}
                  onClick={() => submit(opt)}
                  disabled={answered}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        )}

        {answered && (
          <div className={`stt-feedback ${isCorrect ? 'level-3' : 'level-1'}`} role="status">
            {isCorrect ? '정답이에요! ⭐' : '아쉬워요!'}
            <div className="transcript-hint">
              {q.word.en} = {q.word.ko}
            </div>
          </div>
        )}

        <div className="challenge-controls">
          {answered && (
            <button className="nav-btn-premium" onClick={next} autoFocus>
              {index + 1 < questions.length ? '다음 문제' : '결과 보기'}
            </button>
          )}
          <button className="nav-btn-premium" onClick={onExit}>그만하기</button>
        </div>
      </div>
    </div>
  )
}

export default QuizRunner
