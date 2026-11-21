import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import allRounds from '../data/all_rounds.json'
import { addToMyVoca, removeFromMyVoca, isFavorite } from '../utils/storage'
import { wordImageUrl } from '../utils/image'
import { markSeen } from '../utils/progress'
import { speak, getSpeechRecognition } from '../utils/speech'
import { useToast } from '../components/Toast'
import { clickable } from '../utils/a11y'
import { gradePronunciation, letterMatch } from '../utils/pronounce'
import { useExamples, splitExample } from '../utils/examples'

function WordChallenge() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const browserWarned = useRef(false)
  const recognitionRef = useRef(null) // 진행 중인 음성 인식 (가비지 컬렉션으로 결과가 사라지지 않게 붙잡아 둔다)
  const watchdogRef = useRef(null)
  const [roundData, setRoundData] = useState(null)
  const [index, setIndex] = useState(0)
  const [showingEnglish, setShowingEnglish] = useState(true)
  useEffect(() => {
    const round = allRounds.find(r => r.id === parseInt(id))
    if (round) {
      setRoundData(round)
      setIndex(0) // 다른 회차로 바로 이동해도 첫 단어부터
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
  const examples = useExamples()
  const [showExKo, setShowExKo] = useState(false)
  
  // 단어가 바뀔 때마다 이미지 에러 및 발음 점수 초기화
  useEffect(() => {
    setImgError(false)
    setPronunciationScore(null)
    setShowingEnglish(true) // 단어 변경 시 영어부터 표시
    setTypedAnswer('')
    setShowExKo(false)
    if (currentWord) {
      setFav(isFavorite(currentWord.en))
      markSeen(currentWord.en)
    }
  }, [index, id, currentWord])

  // 단어가 바뀌거나 화면을 떠나면 듣던 것을 멈춘다
  const stopListening = () => {
    clearTimeout(watchdogRef.current)
    const r = recognitionRef.current
    recognitionRef.current = null
    if (r) {
      r.onresult = r.onerror = r.onend = null
      try { r.abort() } catch { /* 이미 끝남 */ }
    }
    setIsListening(false)
  }
  useEffect(() => stopListening, [index, id])

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

  // 직접 입력한 답: 철자가 정확해야 정답
  const gradeTyped = (raw) => {
    const transcript = raw.toLowerCase().trim();
    if (!transcript) return;
    const level = transcript === currentWord.en.toLowerCase().trim() ? 3 : 1;
    setPronunciationScore({ transcript, level, mode: 'typed' });
  };

  // 음성 인식 결과(후보 여러 개): 가장 가까운 후보로 채점하고 비슷한 정도와 틀린 글자를 보여 준다
  const gradeSpoken = (alternatives) => {
    const r = gradePronunciation(alternatives, currentWord.en);
    if (!r) return;
    setPronunciationScore({ transcript: r.heard, level: r.level, score: r.score, how: r.how, mode: 'speech' });
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

    stopListening();
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 5; // 크롬·웨일은 후보 여러 개, 엣지는 1개만 줄 수 있다

    // 아무 결과도 오지 않고 멈춰 있는 경우(마이크·네트워크 문제)를 대비한 안전장치
    const giveUp = () => {
      if (recognitionRef.current !== recognition) return;
      stopListening();
      toast("소리를 알아듣지 못했어요. 마이크 가까이에서 또박또박 다시 말해 보세요.", { type: 'info' });
    };

    recognition.onstart = () => {
      setIsListening(true);
      clearTimeout(watchdogRef.current);
      watchdogRef.current = setTimeout(giveUp, 10000);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      clearTimeout(watchdogRef.current);
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const result = event.results[event.resultIndex ?? 0] || event.results[0];
      const alternatives = [];
      for (let i = 0; i < result.length; i++) alternatives.push(result[i].transcript);
      gradeSpoken(alternatives);
    };

    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      console.error("Speech Recognition Error:", event.error);
      stopListening();
      if (event.error === 'aborted') return;

      if (event.error === 'not-allowed') {
        toast("🎤 마이크 권한이 꺼져 있어요. 주소창 왼쪽의 아이콘을 눌러 마이크를 '허용'해 주세요.", { type: 'error', duration: 7000 });
      } else if (event.error === 'service-not-allowed' || !window.isSecureContext) {
        toast("🔒 음성 인식은 보안 연결(https://)에서만 돼요. 주소가 https://로 시작하는지 확인해 주세요.", { type: 'error', duration: 7000 });
      } else if (event.error === 'audio-capture') {
        toast("🎤 마이크를 찾지 못했어요. 마이크가 연결돼 있는지 확인해 주세요.", { type: 'error', duration: 6000 });
      } else if (event.error === 'network') {
        toast("🌐 인터넷 연결이 불안정해요. 연결을 확인하고 잠시 뒤 다시 해 보세요.", { type: 'error', duration: 6000 });
      } else if (event.error === 'no-speech') {
        toast("목소리가 들리지 않았어요. 마이크 가까이에서 다시 말해 보세요.", { type: 'info' });
      } else {
        toast(`발음을 알아듣지 못했어요. 잠시 뒤 다시 해 보세요. (${event.error})`, { type: 'error' });
      }
    };

    try {
      recognition.start();
    } catch (e) {
      // 이전 인식이 아직 정리되지 않았을 때 등
      console.error("Speech Recognition start failed:", e);
      stopListening();
      toast("잠시 뒤 다시 눌러 보세요.", { type: 'info' });
    }
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

        {(() => {
          const ex = examples?.[currentWord.en]
          const parts = ex && splitExample(ex.s, currentWord.en)
          if (!parts) return null
          return (
            <div className="example-box">
              <div className="example-head">
                <span className="example-label">예문</span>
                <button type="button" className="example-speak" onClick={() => speak(ex.s, { rate: 0.8 })} aria-label="예문 듣기">🔊</button>
              </div>
              <p className="example-en" lang="en">{parts[0]}<b className="ex-word">{parts[1]}</b>{parts[2]}</p>
              {showExKo
                ? <p className="example-ko">{ex.ko}</p>
                : <button type="button" className="example-ko-btn" onClick={() => setShowExKo(true)}>뜻 보기</button>}
            </div>
          )
        })()}

        {pronunciationScore && (
          <div className={`stt-feedback level-${pronunciationScore.level}`} role="status">
            {pronunciationScore.level === 3 && "Excellent! ⭐⭐⭐"}
            {pronunciationScore.level === 2 && "Good Job! ⭐⭐"}
            {pronunciationScore.level === 1 && "Try Again! ⭐"}
            {pronunciationScore.mode === 'speech' ? (
              <div className="pron-detail">
                <div className="pron-row">
                  <span className="pron-label">목표</span>
                  <span className="pron-target" lang="en" aria-label={currentWord.en}>
                    {(pronunciationScore.level === 3
                      ? [...currentWord.en].map((ch) => ({ ch, ok: true }))
                      : letterMatch(pronunciationScore.transcript, currentWord.en)
                    ).map((x, i) => (
                      <span key={i} className={x.ok ? '' : 'pron-miss'}>{x.ch}</span>
                    ))}
                  </span>
                </div>
                <div className="pron-row">
                  <span className="pron-label">들린 말</span>
                  <span className="pron-heard" lang="en">{pronunciationScore.transcript}</span>
                </div>
                {pronunciationScore.level < 3 && (
                  <div className="pron-score" aria-label={`비슷한 정도 ${pronunciationScore.score}%`}>
                    <div className="pron-score-bar"><div style={{ width: `${pronunciationScore.score}%` }} /></div>
                    <span>{pronunciationScore.score}%</span>
                  </div>
                )}
                <div className="pron-tip">
                  {pronunciationScore.how === 'homophone' && '소리가 같은 다른 단어로 알아들었어요. 발음은 맞아요!'}
                  {pronunciationScore.how === 'inPhrase' && '단어 앞뒤로 다른 말이 함께 들렸지만 단어는 정확해요.'}
                  {pronunciationScore.level === 2 && '거의 다 왔어요! 빨간 글자 부분을 천천히 들어 보고 다시 해 봐요.'}
                  {pronunciationScore.level === 1 && '천천히 듣고 따라 한 다음 다시 말해 봐요.'}
                </div>
                {pronunciationScore.level < 3 && (
                  <div className="pron-actions">
                    <button type="button" onClick={() => speak(currentWord.en)}>🔊 정답 듣기</button>
                    <button type="button" onClick={() => speak(currentWord.en, { rate: 0.55 })}>🐢 천천히</button>
                    <button type="button" onClick={startSTT} disabled={isListening}>🎤 다시 하기</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="transcript-hint">입력한 단어: "{pronunciationScore.transcript}"</div>
                {pronunciationScore.level < 3 && <div className="transcript-hint">정답: "{currentWord.en}"</div>}
              </>
            )}
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
            onSubmit={(e) => { e.preventDefault(); gradeTyped(typedAnswer) }}
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
