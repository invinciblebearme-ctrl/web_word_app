import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyVoca, removeFromMyVoca } from '../utils/storage'

function MyVocabulary() {
  const [vocaList, setVocaList] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    setVocaList(getMyVoca())
  }, [])

  const handleDelete = (en) => {
    removeFromMyVoca(en)
    setVocaList(getMyVoca())
  }

  const speakWord = (word) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="container">
      <div className="home-body" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <h1 className="home-title">나만의 <span className="title-gradient-accent">단어장</span></h1>
        <p style={{ color: '#8b98a5', marginBottom: '40px' }}>저장된 단어: {vocaList.length}개</p>

        {vocaList.length === 0 ? (
          <div className="challenge-card" style={{ padding: '50px' }}>
            <div className="word-ko">저장된 단어가 없습니다.</div>
            <p style={{ color: '#8b98a5', marginTop: '10px' }}>학습 중에 ⭐ 버튼을 눌러 단어를 추가해 보세요!</p>
            <button className="nav-btn-premium" style={{ marginTop: '20px' }} onClick={() => navigate('/')}>
              학습하러 가기
            </button>
          </div>
        ) : (
          <div className="voca-list-container">
            {vocaList.map((word, idx) => (
              <div key={idx} className="challenge-card" style={{ marginBottom: '20px', position: 'relative' }}>
                <button 
                  className="favorite-btn active" 
                  onClick={() => handleDelete(word.en)}
                  style={{ top: '15px', right: '15px' }}
                >
                  ⭐
                </button>
                <div className="word-en" style={{ fontSize: '1.8rem' }}>{word.en}</div>
                <div className="word-ko" style={{ color: '#38bdf8', marginTop: '5px' }}>{word.ko}</div>
                
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
                  <button className="dark-button" onClick={() => speakWord(word.en)}>🔈 발음 듣기</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MyVocabulary
