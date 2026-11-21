import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import allRounds from '../data/all_rounds.json'
import { addToMyVoca, removeFromMyVoca, isFavorite } from '../utils/storage'
import { wordImageUrl } from '../utils/image'
import { markSeen } from '../utils/progress'
import { speak, getSpeechRecognition } from '../utils/speech'
import { useToast } from '../components/Toast'
import { clickable } from '../utils/a11y'

function WordChallenge() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const browserWarned = useRef(false)
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

  const speakWord = speak

  const handleManualSpeak = () => {
    if (!roundData) return;
    const currentWord = roundData.words[index];
    if (currentWord) {
      speakWord(currentWord.en);
    }
  };

  const currentWord = roundData?.words[index]
  const imgUrl = wordImageUrl(currentWord?.img)

  const [imgError, setImgError] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [pronunciationScore, setPronunciationScore] = useState(null)
  const [fav, setFav] = useState(false)
  const [typedAnswer, setTypedAnswer] = useState('')
  const sttSupported = !!getSpeechRecognition()
  
  // 단어가 바뀔 때마다 이미지 에러 및 발음 점수 초기화
  useEffect(() => {
    setImgError(false)
    setPronunciationScore(null)
    setShowingEnglish(true) // 단어 변경 시 영어부터 표시
    setTypedAnswer('')
    if (currentWord) {
      setFav(isFavorite(currentWord.en))
      markSeen(currentWord.en)
    }
  }, [index, id, currentWord])

  const toggleShowingEnglish = () => {
    setShowingEnglish(prev => !prev)
  }

  const toggleFavorite = () => {
    if (fav) {
      removeFromMyVoca(currentWord.en);
      setFav(false);
    } else {
      addToMyVoca(currentWord);
      setFav(true);
    }
  };

  if (!roundData) return <div className="challenge-body">데이터를 불러오는 중...</div>;

  // 음성 인식 결과 또는 직접 입력한 답을 채점
  // 음성 인식은 인식 오차가 있어 부분 일치도 Good으로, 직접 입력은 철자가 정확해야 정답
  const gradeAnswer = (raw, { strict = false } = {}) => {
    const transcript = raw.toLowerCase().trim();
    if (!transcript) return;
    const target = currentWord.en.toLowerCase().trim();
    let level = 1; // Try Again
    if (transcript === target) {
      level = 3; // Excellent
    } else if (!strict && (transcript.includes(target) || target.includes(transcript))) {
      level = 2; // Good
    }
    setPronunciationScore({ transcript, level });
  };

  // STT 발음 측정 시작
  const startSTT = () => {
    // 브라우저 판별
    const ua = navigator.userAgent;
    const isWhale = ua.indexOf("Whale") > -1;
    const isEdge = ua.indexOf("Edg") > -1;
    const isChrome = !isWhale && !isEdge && /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
    
    const isSupported = isChrome || isEdge || isWhale;
    
    if (!isSupported && !browserWarned.current) {
      browserWarned.current = true;
      toast("이 브라우저에서는 음성 인식이 정확하지 않을 수 있어요. 크롬·엣지·웨일을 추천해요.", { type: 'warning' });
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast("이 브라우저는 음성 인식을 지원하지 않아요. 크롬 브라우저에서 해 보세요!", { type: 'error' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event) => {
      gradeAnswer(event.results[0][0].transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      setIsListening(false);
      
      const isHttps = window.location.protocol === 'https:';

      if (event.error === 'not-allowed') {
        toast("🎤 마이크 권한이 꺼져 있어요. 주소창 왼쪽의 아이콘을 눌러 마이크를 '허용'해 주세요.", { type: 'error', duration: 7000 });
      } else if (event.error === 'service-not-allowed' || !isHttps) {
        toast("🔒 음성 인식은 보안 연결(https://)에서만 돼요. 주소가 https://로 시작하는지 확인해 주세요.", { type: 'error', duration: 7000 });
      } else if (event.error === 'network') {
        toast("🌐 인터넷 연결이 불안정해요. 연결을 확인하고 잠시 뒤 다시 해 보세요.", { type: 'error', duration: 6000 });
      } else if (event.error === 'no-speech') {
        toast("목소리가 들리지 않았어요. 마이크 가까이에서 다시 말해 보세요.", { type: 'info' });
      } else {
        toast(`발음을 알아듣지 못했어요. 잠시 뒤 다시 해 보세요. (${event.error})`, { type: 'error' });
      }
    };

    recognition.start();
  };

  return (
    <div className="challenge-body">
      <div className="challenge-container">
        <h1>
          {roundData.name}
        </h1>
        <div className="challenge-index">단어 {index + 1} / {roundData.words.length}</div>
        
        <div 
          className="challenge-card" 
          {...clickable(toggleShowingEnglish, showingEnglish ? '눌러서 우리말 뜻 보기' : '눌러서 영어 단어 보기')}
          style={{ cursor: 'pointer' }}
        >
          <button 
            className={`favorite-btn ${fav ? 'active' : ''}`} 
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite();
            }}
            title="나만의 단어장에 저장"
            aria-label={fav ? '나만의 단어장에서 빼기' : '나만의 단어장에 저장'}
            aria-pressed={fav}
          >
            {fav ? '⭐' : '☆'}
          </button>
          {showingEnglish ? (
            <div className="word-en" lang="en">{currentWord.en}</div>
          ) : (
            <div className="word-ko">{currentWord.ko}</div>
          )}
        </div>

        <div className="challenge-image">
          {imgUrl && !imgError ? (
            <img 
              src={imgUrl} 
              alt={currentWord.en}
              className="word-image"
              onError={() => setImgError(true)} 
            />
          ) : (
            <div className="no-image">{imgUrl ? "이미지 준비중" : "이미지 없음"}</div>
          )}
        </div>

        {pronunciationScore && (
          <div className={`stt-feedback level-${pronunciationScore.level}`} role="status">
            {pronunciationScore.level === 3 && "Excellent! ⭐⭐⭐"}
            {pronunciationScore.level === 2 && "Good Job! ⭐⭐"}
            {pronunciationScore.level === 1 && "Try Again! ⭐"}
            <div className="transcript-hint">{sttSupported ? '인식된 발음' : '입력한 단어'}: "{pronunciationScore.transcript}"</div>
            {pronunciationScore.level < 3 && <div className="transcript-hint">정답: "{currentWord.en}"</div>}
          </div>
        )}

        <div className="challenge-controls">
          <button onClick={prevWord} className="nav-btn-premium">이전</button>
          <button onClick={nextWord} className="nav-btn-premium">다음</button>
          <button onClick={handleManualSpeak} className="nav-btn-premium">발음 듣기</button>
          <button onClick={() => navigate('/')} className="nav-btn-premium">목록으로</button>
        </div>

        <button className="quiz-start-btn" onClick={() => navigate(`/quiz/${roundData.id}`)}>
          📝 이 회차 퀴즈 풀기
        </button>

        {sttSupported ? (
          <div className="stt-controls">
            <button 
              className={`mic-button ${isListening ? 'listening' : ''}`} 
              onClick={startSTT}
              disabled={isListening}
            >
              {isListening ? "🎤 측정중..." : "🎤 발음하기"}
            </button>
            <div className="mic-hint">※ 크롬, 엣지, 웨일 브라우저에서 발음 확인이 가능합니다.</div>
          </div>
        ) : (
          <form
            className="stt-controls"
            onSubmit={(e) => { e.preventDefault(); gradeAnswer(typedAnswer, { strict: true }) }}
          >
            <input
              className="scramble-input"
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              placeholder="단어를 써서 확인해 보세요"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              aria-label="단어 입력"
            />
            <button type="submit" className="mic-button" disabled={!typedAnswer.trim()}>✍️ 확인하기</button>
            <div className="mic-hint">※ 이 브라우저는 음성 인식을 지원하지 않아 직접 써서 확인해요. (크롬·엣지·웨일에서는 발음 확인 가능)</div>
          </form>
        )}
      </div>
    </div>
  )
}

export default WordChallenge
