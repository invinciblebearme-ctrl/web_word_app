// 학급 진도 공유 (선택 기능). 서버: Cloudflare Pages Functions + D1 (functions/_lib/api.js)
// 학생은 학급 코드 + 출석번호만 쓴다. 이름은 어디에도 보내지 않는다.
//   class_member_v1 : { code, name, no, device }      ← 학생으로 참여 중인 학급
//   class_outbox_v1 : { pending: {batch, answers} | null, queue: {[en]: [correct, wrong]} }
//   class_teacher_v1: [{ code, name, key }]            ← 이 기기에서 만든(또는 추가한) 학급

const MEMBER_KEY = 'class_member_v1'
const OUTBOX_KEY = 'class_outbox_v1'
const TEACHER_KEY = 'class_teacher_v1'
const API = '/api/classes'
const FLUSH_DELAY = 15000
export const MAX_NO = 99
export const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/

const read = (key, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(key))
    return v ?? fallback
  } catch {
    return fallback
  }
}
const write = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const normalizeCode = (code) => String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

const randomHex = (bytes) => {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---- 서버 호출 ----
// 결과: { ok, status, data, error }  (네트워크 오류는 status 0)
export const api = async (path, { method = 'GET', body, key, keepalive } = {}) => {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (key) headers.authorization = `Bearer ${key}`
  try {
    const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), keepalive })
    let data = null
    try { data = await res.json() } catch { /* JSON이 아님 */ }
    // 서버 기능이 없는 배포(정적 파일만)에서는 HTML이나 빈 응답이 온다
    if (!data || typeof data !== 'object') return { ok: false, status: res.status, data: null, error: 'not_configured' }
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : data.error || `http_${res.status}` }
  } catch {
    return { ok: false, status: 0, data: null, error: 'network' }
  }
}

// 오류 코드 → 학생·교사에게 보여 줄 말
export const errorMessage = (error) => ({
  network: '인터넷에 연결되지 않았어요. 잠시 뒤 다시 해 보세요.',
  not_configured: '학급 기능이 아직 설정되지 않았어요. (서버 준비 중)',
  no_class: '그런 학급 코드가 없어요. 코드를 다시 확인해 주세요.',
  bad_no: `번호는 1부터 ${MAX_NO}까지 쓸 수 있어요.`,
  bad_name: '학급 이름을 1~30자로 써 주세요.',
  bad_key: '선생님 키가 맞지 않아요.',
}[error] || '잠시 문제가 생겼어요. 다시 해 보세요.')

// ---- 학생 ----
export const getMembership = () => {
  const m = read(MEMBER_KEY, null)
  return m && CODE_RE.test(m.code) ? m : null
}

export const joinClass = async (rawCode, rawNo) => {
  const code = normalizeCode(rawCode)
  const no = Number(rawNo)
  if (!CODE_RE.test(code)) return { ok: false, error: 'no_class' }
  if (!Number.isInteger(no) || no < 1 || no > MAX_NO) return { ok: false, error: 'bad_no' }
  const prev = getMembership()
  const device = prev?.device || randomHex(16)
  const res = await api(`/${code}/join`, { method: 'POST', body: { device, no } })
  if (!res.ok) return res
  resetSchedule()
  // 다른 학급으로 옮기면 보내지 못한 기록은 버린다 (앞 학급 기록이 새 학급에 섞이지 않게)
  if (prev && prev.code !== code) write(OUTBOX_KEY, null)
  const member = { code, no, device, name: res.data?.name || code }
  write(MEMBER_KEY, member)
  return { ok: true, member }
}

export const leaveClass = async () => {
  const m = getMembership()
  if (!m) return { ok: true }
  await flushClass()
  const res = await api(`/${m.code}/members/${m.device}`, { method: 'DELETE' })
  // 서버가 꺼져 있어도 이 기기에서는 나간다
  write(MEMBER_KEY, null)
  write(OUTBOX_KEY, null)
  return { ok: true, remoteOk: res.ok }
}

const loadOutbox = () => {
  const o = read(OUTBOX_KEY, null)
  return { pending: o?.pending || null, queue: o?.queue && typeof o.queue === 'object' ? o.queue : {} }
}

export const pendingCount = () => {
  const { pending, queue } = loadOutbox()
  const sum = (a) => Object.values(a || {}).reduce((s, [c, w]) => s + c + w, 0)
  return sum(pending?.answers) + sum(queue)
}

let timer = null
let retryDelay = 0
let inflight = null

const schedule = (ms) => {
  clearTimeout(timer)
  timer = setTimeout(() => { timer = null; flushClass() }, ms)
}
const resetSchedule = () => { clearTimeout(timer); timer = null; retryDelay = 0 }

// 퀴즈에서 답할 때마다 불린다 (progress.recordAnswer). 학급에 참여하지 않았으면 아무것도 안 한다.
export const queueAnswer = (en, isCorrect) => {
  if (!getMembership()) return
  const box = loadOutbox()
  const [c, w] = box.queue[en] || [0, 0]
  box.queue[en] = isCorrect ? [c + 1, w] : [c, w + 1]
  write(OUTBOX_KEY, box)
  // 다시 보내기를 기다리는 중이 아니면 15초 뒤에 모아서 보낸다
  if (!timer) schedule(FLUSH_DELAY)
}

const SEND_LIMIT = 500 // 서버 한도와 같음
const WORD_LIMIT = 50
const MAX_ROUNDS = 20
const MAX_RETRY = 5 * 60 * 1000

// 탭이 여러 개여도 대기열은 localStorage 하나를 같이 쓰므로, 보내는 일은 한 번에 한 탭만 한다
const withLock = (fn) =>
  typeof navigator !== 'undefined' && navigator.locks?.request
    ? navigator.locks.request('class-sync', fn)
    : fn()

// 대기열 앞부분을 pending 묶음(새 batch 번호)으로 옮긴다
const takeBatch = () => {
  const box = loadOutbox()
  if (box.pending) return box.pending
  const entries = Object.entries(box.queue)
  if (entries.length === 0) return null
  const answers = {}
  let total = 0
  for (const [en, [c, w]] of entries) {
    const cc = Math.min(c, WORD_LIMIT), ww = Math.min(w, WORD_LIMIT)
    if (total + cc + ww > SEND_LIMIT) break
    answers[en] = [cc, ww]
    total += cc + ww
    const left = [c - cc, w - ww]
    if (left[0] + left[1] > 0) box.queue[en] = left
    else delete box.queue[en]
  }
  box.pending = { batch: randomHex(8), answers }
  write(OUTBOX_KEY, box)
  return box.pending
}

// 보낸 묶음이 아직 pending일 때만 지운다 (그사이 다른 탭이 새 묶음을 만들었으면 건드리지 않음)
const settle = (batch) => {
  const box = loadOutbox()
  if (box.pending?.batch === batch) write(OUTBOX_KEY, { ...box, pending: null })
}

// 쌓인 기록을 서버로. 같은 batch 번호로 다시 보내면 서버가 중복을 무시하므로
// 응답을 못 받았을 때 그대로 재전송해도 두 번 세지 않는다.
export const flushClass = ({ keepalive = false } = {}) => {
  if (inflight) return inflight
  if (!getMembership()) return Promise.resolve({ ok: true, sent: 0 })
  clearTimeout(timer)
  inflight = withLock(async () => {
    let sent = 0
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const m = getMembership()
      if (!m) break
      const pending = takeBatch()
      if (!pending) break
      const res = await api(`/${m.code}/sync`, { method: 'POST', body: { device: m.device, no: m.no, batch: pending.batch, answers: pending.answers }, keepalive })
      if (!res.ok) {
        if (res.error === 'no_class') {
          // 학급이 지워졌으면 참여를 끝낸다
          write(MEMBER_KEY, null); write(OUTBOX_KEY, null)
        } else if (res.error === 'not_configured') {
          // 서버 기능이 없는 배포: 기록은 남겨 두고, 다음에 풀거나 다시 열 때 보낸다
        } else if (res.status === 400) {
          // 서버가 거절한 형식 오류는 다시 보내도 같으므로 버린다
          settle(pending.batch)
        } else {
          // 네트워크·서버 오류: 점점 길게 기다렸다가 다시 보낸다
          retryDelay = Math.min(MAX_RETRY, retryDelay ? retryDelay * 2 : 30000)
          schedule(retryDelay)
        }
        return { ok: false, error: res.error, sent }
      }
      retryDelay = 0
      sent += res.data?.accepted || 0
      settle(pending.batch)
      const now = getMembership()
      if (now) write(MEMBER_KEY, { ...now, lastSync: Date.now() })
    }
    // 한 번에 다 못 보냈으면 이어서 보낸다
    if (getMembership() && pendingCount() > 0) schedule(2000)
    return { ok: true, sent }
  }).finally(() => { inflight = null })
  return inflight
}

// 앱을 열 때, 인터넷이 다시 연결될 때, 화면을 떠날 때 보내기
export const startClassSync = () => {
  const hasWork = () => getMembership() && pendingCount() > 0
  if (hasWork()) flushClass()
  window.addEventListener('online', () => { retryDelay = 0; if (hasWork()) flushClass() })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && hasWork()) flushClass({ keepalive: true })
  })
}

// ---- 교사 ----
export const getTeacherClasses = () => {
  const list = read(TEACHER_KEY, [])
  return Array.isArray(list) ? list.filter((c) => c && CODE_RE.test(c.code) && c.key) : []
}
const saveTeacherClasses = (list) => write(TEACHER_KEY, list)

const remember = (entry) => {
  const list = getTeacherClasses().filter((c) => c.code !== entry.code)
  saveTeacherClasses([entry, ...list])
}

export const createClass = async (name) => {
  const res = await api('', { method: 'POST', body: { name: String(name || '').trim() } })
  if (!res.ok) return res
  const entry = { code: res.data.code, name: res.data.name, key: res.data.teacherKey }
  remember(entry)
  return { ok: true, entry }
}

// 다른 기기에서 만든 학급을 코드 + 키로 추가 (키가 맞는지 바로 확인)
export const addTeacherClass = async (rawCode, key) => {
  const code = normalizeCode(rawCode)
  if (!CODE_RE.test(code)) return { ok: false, error: 'no_class' }
  const res = await api(`/${code}/stats`, { key: String(key || '').trim() })
  if (!res.ok) return res
  const entry = { code, name: res.data.name, key: String(key).trim() }
  remember(entry)
  return { ok: true, entry, stats: res.data }
}

export const fetchStats = (entry) => api(`/${entry.code}/stats`, { key: entry.key })

export const forgetTeacherClass = (code) => saveTeacherClasses(getTeacherClasses().filter((c) => c.code !== code))

export const deleteClass = async (entry) => {
  const res = await api(`/${entry.code}`, { method: 'DELETE', key: entry.key })
  const gone = res.error === 'no_class'
  if (res.ok || gone) forgetTeacherClass(entry.code)
  return gone ? { ...res, ok: true } : res
}
