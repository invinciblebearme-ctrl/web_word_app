import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import allRounds from '../data/all_rounds.json'
import { TOPICS, groupByTopic } from '../utils/topics'
import { shuffle } from '../utils/quiz'
import { wordImageUrl } from '../utils/image'
import { canSpeak, speak } from '../utils/speech'
import EasyMeaning from '../components/EasyMeaning'
import { beep, clampSize, CLASS_SIZE_KEY, formatTime, MAX_SIZE, MIN_SIZE, pickNumber, TIMER_PRESETS } from '../utils/classroom'

const ALL_WORDS = allRounds.flatMap((r) => r.words)
const BY_TOPIC = groupByTopic(ALL_WORDS)
const TOOLS = [
  { key: 'cards', label: '🃏 플래시카드' },
  { key: 'pick', label: '🎲 번호 뽑기' },
  { key: 'timer', label: '⏱ 타이머' },
]
const AUTO_OPTIONS = [0, 5, 10]

// 전자칠판에서 화면 전체로 보기
const useFullscreen = (ref) => {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const sync = () => setOn(document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [ref])
  const toggle = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else ref.current?.requestFullscreen?.().catch(() => {})
  }, [ref])
  return [on, toggle, !!document.documentElement.requestFullscreen]
}

function FullscreenButton({ on, toggle, supported }) {
  if (!supported) return null
  return <button className="sub-tab-item" onClick={toggle}>{on ? '↙ 작게 보기' : '⛶ 전체 화면'}</button>
}

function Flashcards({ preset }) {
  const [source, setSource] = useState(preset ? 'preset' : 'round:1')
  const [order, setOrder] = useState(0) // 섞기 버튼을 누를 때마다 바뀜
  const [index, setIndex] = useState(0)
  const [reveal, setReveal] = useState(false)
  const [auto, setAuto] = useState(0)
  const [front, setFront] = useState('en') // en: 영어 먼저, img: 그림 먼저
  const [imgFailed, setImgFailed] = useState(false)
  const boxRef = useRef(null)
  const [fs, toggleFs, fsSupported] = useFullscreen(boxRef)

  const words = useMemo(() => {
    const [kind, arg] = source.split(':')
    const list = kind === 'preset' ? preset.words : kind === 'topic' ? BY_TOPIC[arg] : allRounds.find((r) => String(r.id) === arg)?.words || []
    return order ? shuffle(list) : list
  }, [source, order, preset])

  useEffect(() => { setIndex(0); setReveal(false) }, [words])
  const word = words[Math.min(index, words.length - 1)]
  useEffect(() => { setImgFailed(false); setReveal(false) }, [word])

  const go = useCallback((d) => setIndex((i) => Math.min(words.length - 1, Math.max(0, i + d))), [words.length])
  const say = useCallback(() => word && speak(word.en, { rate: 0.8 }), [word])

  // 자동 넘기기: 절반 시간에 뜻을 보여 주고, 다 되면 다음 카드
  useEffect(() => {
    if (!auto || !word) return
    const half = setTimeout(() => setReveal(true), (auto * 1000) / 2)
    const next = setTimeout(() => setIndex((i) => (i + 1 < words.length ? i + 1 : i)), auto * 1000)
    return () => { clearTimeout(half); clearTimeout(next) }
  }, [auto, word, words.length])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('select, input, textarea')) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1) }
      else if (e.key === ' ' || e.key === 'Enter') { if (e.target.closest('button')) return; e.preventDefault(); setReveal((r) => !r) }
      else if (e.key === 's' || e.key === 'S') say()
      else if (e.key === 'f' || e.key === 'F') toggleFs()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, say, toggleFs])

  if (!word) return <p className="review-desc">카드가 없어요.</p>
  const img = wordImageUrl(word.img)
  const showEn = front === 'en' || reveal
  const showImg = front === 'img' || reveal

  return (
    <div className="cr-tool">
      <div className="cr-controls">
        <label>
          <span className="sr-only">카드 묶음</span>
          <select className="cr-select" value={source} onChange={(e) => { setSource(e.target.value); setOrder(0) }}>
            {preset && <option value="preset">{preset.title} ({preset.words.length})</option>}
            <optgroup label="회차">
              {allRounds.map((r) => <option key={r.id} value={`round:${r.id}`}>{r.id}회</option>)}
            </optgroup>
            <optgroup label="주제">
              {TOPICS.filter((t) => BY_TOPIC[t.key].length).map((t) => <option key={t.key} value={`topic:${t.key}`}>{t.emoji} {t.label} ({BY_TOPIC[t.key].length})</option>)}
            </optgroup>
          </select>
        </label>
        <div className="sub-tabs-container" role="group" aria-label="카드 설정">
          <button className={`sub-tab-item ${front === 'en' ? 'active' : ''}`} aria-pressed={front === 'en'} onClick={() => setFront('en')}>영어 먼저</button>
          <button className={`sub-tab-item ${front === 'img' ? 'active' : ''}`} aria-pressed={front === 'img'} onClick={() => setFront('img')}>그림 먼저</button>
          <button className="sub-tab-item" onClick={() => setOrder((n) => n + 1)}>🔀 섞기</button>
        </div>
        <div className="sub-tabs-container" role="group" aria-label="자동 넘기기">
          {AUTO_OPTIONS.map((s) => (
            <button key={s} className={`sub-tab-item ${auto === s ? 'active' : ''}`} aria-pressed={auto === s} onClick={() => setAuto(s)}>{s ? `${s}초 자동` : '직접 넘기기'}</button>
          ))}
        </div>
      </div>

      <div ref={boxRef} className={`cr-stage ${fs ? 'fullscreen' : ''}`}>
        <div className="cr-card" onClick={() => setReveal((r) => !r)} role="button" tabIndex={0} aria-label={reveal ? '카드 앞면 보기' : '뜻 보기'}>
          <div className="cr-image">
            {showImg && img && !imgFailed
              ? <img src={img} alt="" onError={() => setImgFailed(true)} />
              : showImg ? <span className="cr-noimg" aria-hidden="true">🖼</span> : <span className="cr-hidden" aria-hidden="true">?</span>}
          </div>
          <div className="cr-word" lang="en">{showEn ? word.en : '?'}</div>
          <div className={`cr-ko ${reveal ? '' : 'hidden'}`}>{reveal ? word.ko : '눌러서 뜻 보기'}</div>
          {reveal && <EasyMeaning en={word.en} className="cr-easy" />}
        </div>
        <div className="cr-nav">
          <button className="sub-tab-item" onClick={() => go(-1)} disabled={index === 0} aria-label="이전 카드">◀ 이전</button>
          <span className="cr-count" aria-live="polite">{index + 1} / {words.length}</span>
          {canSpeak() && <button className="sub-tab-item" onClick={say}>🔊 듣기</button>}
          <button className="sub-tab-item" onClick={() => go(1)} disabled={index >= words.length - 1} aria-label="다음 카드">다음 ▶</button>
          <FullscreenButton on={fs} toggle={toggleFs} supported={fsSupported} />
        </div>
        <p className="cr-hint">키보드: ← → 넘기기 · Space 뜻 보기 · S 듣기 · F 전체 화면</p>
      </div>
    </div>
  )
}

function Picker() {
  const [size, setSize] = useState(() => clampSize(localStorage.getItem(CLASS_SIZE_KEY) || 25))
  const [picked, setPicked] = useState([])
  const [noRepeat, setNoRepeat] = useState(true)
  const [shown, setShown] = useState(null)
  const [rolling, setRolling] = useState(false)
  const boxRef = useRef(null)
  const [fs, toggleFs, fsSupported] = useFullscreen(boxRef)
  const rollRef = useRef(null)

  useEffect(() => { try { localStorage.setItem(CLASS_SIZE_KEY, String(size)) } catch { /* 무시 */ } }, [size])
  useEffect(() => () => clearInterval(rollRef.current), [])

  const left = noRepeat ? size - new Set(picked.filter((n) => n <= size)).size : size
  const roll = () => {
    if (rolling) return
    const final = pickNumber(size, noRepeat ? picked : [])
    if (final == null) return
    setRolling(true)
    let ticks = 0
    // 번호가 빠르게 바뀌다 멈추는 연출 (약 1초)
    rollRef.current = setInterval(() => {
      ticks++
      if (ticks < 12) { setShown(1 + Math.floor(Math.random() * size)); return }
      clearInterval(rollRef.current)
      setShown(final)
      setPicked((p) => [...p, final])
      setRolling(false)
    }, 80)
  }

  return (
    <div className="cr-tool">
      <div className="cr-controls">
        <label className="cr-size">
          학생 수
          <button className="sub-tab-item" onClick={() => setSize((s) => clampSize(s - 1))} aria-label="학생 수 줄이기">−</button>
          <input type="number" min={MIN_SIZE} max={MAX_SIZE} value={size} onChange={(e) => setSize(clampSize(e.target.value))} aria-label="학생 수" />
          <button className="sub-tab-item" onClick={() => setSize((s) => clampSize(s + 1))} aria-label="학생 수 늘리기">+</button>
        </label>
        <label className="cr-check">
          <input type="checkbox" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} />
          뽑힌 번호 빼기
        </label>
        <button className="sub-tab-item cr-reset" onClick={() => { setPicked([]); setShown(null) }} disabled={rolling}>↺ 처음부터</button>
      </div>
      <div ref={boxRef} className={`cr-stage ${fs ? 'fullscreen' : ''}`}>
        <div className={`cr-number ${rolling ? 'rolling' : ''}`} aria-live="polite">{shown ?? '?'}<small>{shown != null && !rolling ? '번' : ''}</small></div>
        <div className="cr-nav">
          <button className="mic-button" onClick={roll} disabled={rolling || left <= 0}>{left <= 0 ? '모두 뽑았어요' : '🎲 뽑기'}</button>
          <FullscreenButton on={fs} toggle={toggleFs} supported={fsSupported} />
        </div>
        {noRepeat && <p className="cr-hint">남은 학생 {left}명{picked.length > 0 && ` · 뽑힌 번호: ${[...new Set(picked)].join(', ')}`}</p>}
      </div>
    </div>
  )
}

function Timer() {
  const [total, setTotal] = useState(60)
  const [left, setLeft] = useState(60)
  const [running, setRunning] = useState(false)
  const endRef = useRef(0)
  const boxRef = useRef(null)
  const [fs, toggleFs, fsSupported] = useFullscreen(boxRef)

  useEffect(() => {
    if (!running) return
    endRef.current = Date.now() + left * 1000
    const id = setInterval(() => {
      const rest = (endRef.current - Date.now()) / 1000
      if (rest <= 0) { setLeft(0); setRunning(false); beep() } else setLeft(rest)
    }, 200)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const set = (sec) => { setRunning(false); setTotal(sec); setLeft(sec) }
  const adjust = (d) => { if (!running) set(Math.min(3600, Math.max(10, total + d))) }
  const pct = total ? (left / total) * 100 : 0
  const done = left <= 0

  return (
    <div className="cr-tool">
      <div className="cr-controls">
        <div className="sub-tabs-container" role="group" aria-label="시간 고르기">
          {TIMER_PRESETS.map((s) => (
            <button key={s} className={`sub-tab-item ${total === s ? 'active' : ''}`} aria-pressed={total === s} onClick={() => set(s)}>{s < 60 ? `${s}초` : `${s / 60}분`}</button>
          ))}
          <button className="sub-tab-item" onClick={() => adjust(-30)} disabled={running} aria-label="30초 줄이기">−30초</button>
          <button className="sub-tab-item" onClick={() => adjust(30)} disabled={running} aria-label="30초 늘리기">+30초</button>
        </div>
      </div>
      <div ref={boxRef} className={`cr-stage ${fs ? 'fullscreen' : ''} ${done ? 'time-up' : ''}`}>
        <div className="cr-time" role="timer" aria-live="off">{done ? '끝!' : formatTime(left)}</div>
        <div className="cr-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        <div className="cr-nav">
          {done
            ? <button className="mic-button" onClick={() => set(total)}>↺ 다시</button>
            : <button className="mic-button" onClick={() => setRunning((r) => !r)}>{running ? '⏸ 멈춤' : '▶ 시작'}</button>}
          {!done && left < total && !running && <button className="sub-tab-item" onClick={() => set(total)}>↺ 처음으로</button>}
          <FullscreenButton on={fs} toggle={toggleFs} supported={fsSupported} />
        </div>
      </div>
    </div>
  )
}

function Classroom() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const tool = TOOLS.some((t) => t.key === params.get('tool')) ? params.get('tool') : 'cards'
  // 학급 진도 화면에서 '많이 틀린 단어'를 카드로 보낼 때
  const preset = useMemo(() => {
    const st = location.state
    if (!st?.words?.length) return null
    const set = new Set(st.words)
    const words = ALL_WORDS.filter((w) => set.has(w.en))
    return words.length ? { title: st.title || '고른 단어', words } : null
  }, [location.state])

  return (
    <div className="container classroom-page">
      <h1 className="home-title">수업 <span className="title-gradient-accent">모드</span></h1>
      <p className="review-desc">전자칠판에 띄워 반 전체가 함께 해요.</p>
      <div className="sub-tabs-container cr-tabs" role="tablist" aria-label="수업 도구">
        {TOOLS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tool === t.key} className={`sub-tab-item ${tool === t.key ? 'active' : ''}`}
            onClick={() => setParams({ tool: t.key }, { replace: true, state: location.state })}>{t.label}</button>
        ))}
        <button className="sub-tab-item" onClick={() => navigate('/class')}>📊 학급 진도</button>
      </div>
      {tool === 'cards' && <Flashcards preset={preset} />}
      {tool === 'pick' && <Picker />}
      {tool === 'timer' && <Timer />}
    </div>
  )
}

export default Classroom
