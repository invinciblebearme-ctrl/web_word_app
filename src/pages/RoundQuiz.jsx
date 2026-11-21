import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import allRounds from '../data/all_rounds.json'
import QuizRunner from '../components/QuizRunner'

function RoundQuiz() {
  const { id } = useParams()
  const navigate = useNavigate()
  const round = allRounds.find((r) => r.id === parseInt(id))

  if (!round) return <div className="challenge-body">회차를 찾을 수 없습니다.</div>

  return (
    <QuizRunner
      key={round.id}
      words={round.words}
      title={`${round.name} - 퀴즈`}
      onExit={() => navigate(`/challenge/${round.id}`)}
      exitLabel="단어 카드로"
    />
  )
}

export default RoundQuiz
