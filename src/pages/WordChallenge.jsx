import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import allRounds from '../data/all_rounds.json'

function WordChallenge() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [roundData, setRoundData] = useState(null)
  const [index, setIndex] = useState(0)
  const [showingEnglish, setShowingEnglish] = useState(true)
  useEffect(() => {
    const round = allRounds.find(r => r.id === parseInt(id))
    if (round) {
      setRoundData(round)
    } else {
      navigate('/')
    }
  }, [id, navigate])

  const nextWord = () => {
    if (!roundData) return
    setIndex(prev => (prev + 1) % roundData.words.length)
    setShowingEnglish(true)
  }

  const prevWord = () => {
    if (!roundData) return
    setIndex(prev => (prev - 1 + roundData.words.length) % roundData.words.length)
    setShowingEnglish(true)
  }

  const speakWord = (word) => {
    window.speechSynthesis.cancel();
    if (!word) return;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const handleManualSpeak = () => {
    if (!roundData) return;
    const currentWord = roundData.words[index];
    if (currentWord) {
      speakWord(currentWord.en);
    }
  };

  // 단어가 바뀔 때(index 변경 시)만 최초 1회 자동 발음
  useEffect(() => {
    if (roundData && roundData.words[index]) {
      speakWord(roundData.words[index].en);
    }
  }, [index, roundData]);

  // 자동 의미 전환 (영어 <-> 한글 무한 반복)
  useEffect(() => {
    const timer = setInterval(() => {
      setShowingEnglish(prev => !prev);
    }, 1500); // 1.5초 간격 전환
    return () => clearInterval(timer);
  }, []);

  if (!roundData) return <div className="challenge-body">데이터를 불러오는 중...</div>;

  const currentWord = roundData.words[index]
  const imgUrl = currentWord.img ? `https://word-assets.invinciblebearme.workers.dev/${window.atob(currentWord.img)}` : null

  return (
    <div className="challenge-body">
      <div className="challenge-container">
        <h1>{roundData.name}</h1>
        <div className="challenge-index">단어 {index + 1} / {roundData.words.length}</div>
        
        <div className="challenge-card">
          {showingEnglish ? (
            <div className="word-en">{currentWord.en}</div>
          ) : (
            <div className="word-ko">{currentWord.ko}</div>
          )}
        </div>

        <div className="challenge-image" style={{ 
          backgroundImage: imgUrl ? `url("${imgUrl}")` : 'none'
        }}>
          {!imgUrl && "이미지 없음"}
          {imgUrl && (
            <img 
              src={imgUrl} 
              style={{ display: 'none' }} 
              onError={(e) => {
                e.target.parentElement.style.backgroundImage = 'none';
                e.target.parentElement.textContent = '이미지 준비중';
              }} 
            />
          )}
        </div>

        <div className="challenge-controls">
          <button onClick={prevWord}>← 이전</button>
          <button onClick={nextWord}>다음 →</button>
          <button onClick={handleManualSpeak}>발음 듣기</button>
          <button onClick={() => navigate('/')}>목록으로</button>
        </div>
      </div>
    </div>
  )
}

export default WordChallenge
