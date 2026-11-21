import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import allRounds from '../data/all_rounds.json'
import { useToast } from '../components/Toast'
import {
  addTeacherClass, createClass, deleteClass, errorMessage, fetchStats, flushClass, forgetTeacherClass,
  getMembership, getTeacherClasses, joinClass, leaveClass, MAX_NO, pendingCount,
} from '../utils/classSync'

const KO_OF = Object.fromEntries(allRounds.flatMap((r) => r.words.map((w) => [w.en, w.ko])))
const pct = (c, n) => (n ? `${Math.round((c / n) * 100)}%` : '-')
const dateText = (t) => {
  if (!t) return '-'
  const d = new Date(t)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function StudentPanel() {
  const toast = useToast()
  const [member, setMember] = useState(getMembership)
  const [code, setCode] = useState('')
  const [no, setNo] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(pendingCount)
  const refresh = () => { setMember(getMembership()); setPending(pendingCount()) }

  const join = async (e) => {
    e.preventDefault()
    setBusy(true)
    const res = await joinClass(code, no)
    setBusy(false)
    if (!res.ok) return toast(errorMessage(res.error), { type: 'error' })
    toast(`${res.member.name}에 ${res.member.no}번으로 참여했어요!`, { type: 'success' })
    refresh()
  }
  const send = async () => {
    setBusy(true)
    const res = await flushClass()
    setBusy(false)
    refresh()
    if (!res.ok) toast(errorMessage(res.error), { type: 'error' })
    else toast(res.sent ? `${res.sent}문제 기록을 보냈어요.` : '보낼 새 기록이 없어요.', { type: 'success' })
  }
  const leave = async () => {
    setBusy(true)
    await leaveClass()
    setBusy(false)
    refresh()
    toast('학급에서 나왔어요. 이제 기록을 보내지 않아요.', { type: 'info' })
  }

  return (
    <section className="review-section class-panel" aria-labelledby="student-title">
      <h2 id="student-title" className="review-heading">🧒 학생: 우리 반에 참여하기</h2>
      {member ? (
        <>
          <p className="class-status"><b>{member.name}</b> · <b>{member.no}번</b>으로 참여 중</p>
          <p className="review-desc small">
            퀴즈를 풀면 맞힌·틀린 단어 수가 선생님께 자동으로 보내져요.
            {pending > 0 ? ` 아직 못 보낸 기록 ${pending}개` : ' 모든 기록을 보냈어요.'}
            {member.lastSync && ` · 마지막 전송 ${dateText(member.lastSync)}`}
          </p>
          <div className="sub-tabs-container" role="group" aria-label="참여 관리">
            <button className="sub-tab-item" onClick={send} disabled={busy}>📤 지금 보내기</button>
            <button className="sub-tab-item" onClick={leave} disabled={busy}>🚪 학급 나가기</button>
          </div>
        </>
      ) : (
        <form className="class-form" onSubmit={join}>
          <label>학급 코드
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="예: K7MP2Q" autoComplete="off" autoCapitalize="characters" spellCheck={false} required />
          </label>
          <label>내 번호
            <input type="number" inputMode="numeric" min={1} max={MAX_NO} value={no} onChange={(e) => setNo(e.target.value)} placeholder="예: 7" required />
          </label>
          <button className="mic-button" type="submit" disabled={busy}>참여하기</button>
        </form>
      )}
      <p className="class-privacy">🔒 이름은 보내지 않아요. 번호와 단어별로 맞힌·틀린 횟수만 선생님이 볼 수 있어요.</p>
    </section>
  )
}

function Dashboard({ entry, onGone }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showKey, setShowKey] = useState(false)

  // 가장 마지막 요청의 응답만 반영 (늦게 온 예전 응답이 덮어쓰지 않게)
  const reqId = useRef(0)
  const load = useCallback(async () => {
    const id = ++reqId.current
    setError(null)
    const res = await fetchStats(entry)
    if (id !== reqId.current) return
    if (res.ok) setStats(res.data)
    else setError(res.error)
  }, [entry])
  useEffect(() => { load(); return () => { reqId.current++ } }, [load])

  const remove = async () => {
    const res = await deleteClass(entry)
    if (!res.ok) return toast(errorMessage(res.error), { type: 'error' })
    toast(`${entry.name} 학급과 모든 기록을 지웠어요.`, { type: 'info' })
    onGone()
  }
  const copy = (text, what) => navigator.clipboard?.writeText(text).then(() => toast(`${what}를 복사했어요.`, { type: 'success' }), () => {})

  const top = stats?.topWrong || []
  return (
    <div className="class-dashboard">
      <div className="class-codebox">
        <span>학생에게 알려 줄 학급 코드</span>
        <b className="class-code" lang="en">{entry.code}</b>
        <button className="sub-tab-item" onClick={() => copy(entry.code, '학급 코드')}>📋 복사</button>
      </div>
      <p className="review-desc small">
        선생님 키는 결과를 볼 때 필요해요. 다른 기기에서 보려면 복사해서 보관해 두세요.{' '}
        <button className="link-button" onClick={() => setShowKey((v) => !v)}>{showKey ? '키 숨기기' : '키 보기'}</button>
        {showKey && <> <code className="class-key">{entry.key}</code> <button className="link-button" onClick={() => copy(entry.key, '선생님 키')}>복사</button></>}
      </p>

      {error === 'no_class' && <p className="class-error" role="alert">이 학급은 지워졌어요. <button className="link-button" onClick={() => { forgetTeacherClass(entry.code); onGone() }}>목록에서 빼기</button></p>}
      {error && error !== 'no_class' && <p className="class-error" role="alert">{errorMessage(error)} <button className="link-button" onClick={load}>다시 불러오기</button></p>}
      {!stats && !error && <p className="review-desc small">불러오는 중…</p>}
      {stats && (
        <>
          <div className="class-totals">
            <div><b>{stats.totals.members}</b><span>참여 학생</span></div>
            <div><b>{stats.totals.answered}</b><span>푼 문제</span></div>
            <div><b>{pct(stats.totals.correct, stats.totals.answered)}</b><span>정답률</span></div>
            <button className="sub-tab-item" onClick={load} aria-label="새로 고침">↻</button>
          </div>

          <h3 className="class-subhead">❌ 반 전체가 많이 틀린 단어</h3>
          {top.length === 0 ? <p className="review-desc small">아직 틀린 단어 기록이 없어요.</p> : (
            <>
              <ol className="class-top">
                {top.map((w, i) => (
                  <li key={w.en}>
                    <span className="class-top-rank">{i + 1}</span>
                    <span className="class-top-en" lang="en">{w.en}</span>
                    <span className="class-top-ko">{KO_OF[w.en]}</span>
                    <span className="class-top-n">오답 {w.wrong} · 정답 {w.correct}</span>
                  </li>
                ))}
              </ol>
              <button className="mic-button class-cta" onClick={() => navigate('/classroom?tool=cards', { state: { words: top.map((w) => w.en), title: `${stats.name} 오답 Top ${top.length}` } })}>
                🃏 이 단어로 수업 카드 띄우기
              </button>
            </>
          )}

          <h3 className="class-subhead">🧒 번호별 학습</h3>
          {stats.members.length === 0 ? <p className="review-desc small">아직 참여한 학생이 없어요. 학급 코드를 알려 주세요.</p> : (
            <table className="class-table">
              <thead><tr><th scope="col">번호</th><th scope="col">푼 문제</th><th scope="col">정답률</th><th scope="col">마지막 학습</th></tr></thead>
              <tbody>
                {stats.members.map((m, i) => (
                  <tr key={`${m.no}-${i}`}><td>{m.no}번</td><td>{m.answered}</td><td>{pct(m.correct, m.answered)}</td><td>{dateText(m.lastSeen)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <div className="class-danger">
        {confirmDelete ? (
          <>
            <span>학급과 모든 기록을 지울까요? 되돌릴 수 없어요.</span>
            <button className="sub-tab-item danger" onClick={remove}>지우기</button>
            <button className="sub-tab-item" onClick={() => setConfirmDelete(false)}>취소</button>
          </>
        ) : (
          <>
            <button className="link-button" onClick={() => setConfirmDelete(true)}>🗑 학급 지우기</button>
            <button className="link-button" onClick={() => { forgetTeacherClass(entry.code); onGone() }}>이 기기 목록에서 숨기기</button>
          </>
        )}
      </div>
    </div>
  )
}

function TeacherPanel() {
  const toast = useToast()
  const [classes, setClasses] = useState(getTeacherClasses)
  const [selected, setSelected] = useState(() => getTeacherClasses()[0]?.code || null)
  const [mode, setMode] = useState(null) // 'create' | 'add'
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = (pick) => {
    const list = getTeacherClasses()
    setClasses(list)
    setSelected(pick !== undefined ? pick : list[0]?.code || null)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const res = mode === 'create' ? await createClass(name) : await addTeacherClass(code, key)
    setBusy(false)
    if (!res.ok) return toast(errorMessage(res.error), { type: 'error' })
    toast(mode === 'create' ? `학급을 만들었어요. 코드: ${res.entry.code}` : `${res.entry.name} 학급을 추가했어요.`, { type: 'success' })
    setMode(null); setName(''); setCode(''); setKey('')
    refresh(res.entry.code)
  }

  const entry = classes.find((c) => c.code === selected)
  return (
    <section className="review-section class-panel" aria-labelledby="teacher-title">
      <h2 id="teacher-title" className="review-heading">🧑‍🏫 선생님: 학급 진도 보기</h2>
      <div className="sub-tabs-container" role="group" aria-label="내 학급">
        {classes.map((c) => (
          <button key={c.code} className={`sub-tab-item ${c.code === selected ? 'active' : ''}`} aria-pressed={c.code === selected} onClick={() => { setSelected(c.code); setMode(null) }}>{c.name}</button>
        ))}
        <button className={`sub-tab-item ${mode === 'create' ? 'active' : ''}`} onClick={() => setMode(mode === 'create' ? null : 'create')}>＋ 새 학급</button>
        <button className={`sub-tab-item ${mode === 'add' ? 'active' : ''}`} onClick={() => setMode(mode === 'add' ? null : 'add')}>🔑 코드로 추가</button>
      </div>
      {mode && (
        <form className="class-form" onSubmit={submit}>
          {mode === 'create' ? (
            <label>학급 이름
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="예: 5학년 2반" required />
            </label>
          ) : (
            <>
              <label>학급 코드<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} autoComplete="off" spellCheck={false} required /></label>
              <label>선생님 키<input value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} required /></label>
            </>
          )}
          <button className="mic-button" type="submit" disabled={busy}>{mode === 'create' ? '만들기' : '추가하기'}</button>
        </form>
      )}
      <p className="class-privacy">🔒 학생 이름은 받지 않아요. 학생은 번호로만 참여하고, 학급을 지우면 모든 기록이 함께 지워져요.</p>
      {entry ? <Dashboard key={entry.code} entry={entry} onGone={() => refresh()} /> : !mode && (
        <p className="review-desc small">학급을 만들면 학급 코드가 생겨요. 학생들이 이 코드와 번호로 참여하면 반 전체 진도와 많이 틀린 단어를 볼 수 있어요.</p>
      )}
    </section>
  )
}

function ClassShare() {
  const navigate = useNavigate()
  return (
    <div className="container review-page class-page">
      <h1 className="home-title">학급 <span className="title-gradient-accent">진도</span></h1>
      <div className="sub-tabs-container cr-tabs">
        <button className="sub-tab-item" onClick={() => navigate('/classroom')}>🏫 수업 모드 열기</button>
      </div>
      <StudentPanel />
      <TeacherPanel />
    </div>
  )
}

export default ClassShare
