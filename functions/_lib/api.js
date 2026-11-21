import rounds from '../../src/data/all_rounds.json' with { type: 'json' }

const words = new Set(rounds.flatMap(round => round.words.map(word => word.en)))
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const maxBody = 32 * 1024
const batchRetention = 30 * 24 * 60 * 60 * 1000
const devicePattern = /^[a-fA-F0-9]{16,32}$/
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
})
const error = (code, status = 400) => json({ error: code }, status)
const randomHex = size => Array.from(crypto.getRandomValues(new Uint8Array(size)), byte => byte.toString(16).padStart(2, '0')).join('')
const hash = async key => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))), byte => byte.toString(16).padStart(2, '0')).join('')

function equalHash(left, right) {
  let difference = left.length ^ right.length
  for (let i = 0; i < 64; i++) difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0)
  return difference === 0
}

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > maxBody) return { response: error('too_large', 413) }
  const reader = request.body?.getReader()
  const chunks = []
  let size = 0
  if (reader) {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBody) {
        await reader.cancel()
        return { response: error('too_large', 413) }
      }
      chunks.push(value)
    }
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes))
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { response: error('bad_json') }
    return { data }
  } catch { return { response: error('bad_json') } }
}

export async function handle(request, env) {
  if (!env?.DB) return error('not_configured', 503)
  try {
    return await route(request, env.DB)
  } catch {
    // Never expose SQL, credentials, or request contents in an error response.
    return error('unavailable', 503)
  }
}

async function route(request, db) {
  const path = new URL(request.url).pathname
  const create = path === '/api/classes'
  const match = path.match(/^\/api\/classes\/([^/]+)(?:\/(join|sync|stats)|\/members\/([^/]+))?$/)
  if (!create && !match) return error('not_found', 404)
  const action = create ? 'create' : match[3] !== undefined ? 'leave' : match[2] || 'delete'
  const method = { create: 'POST', join: 'POST', sync: 'POST', stats: 'GET', delete: 'DELETE', leave: 'DELETE' }[action]
  if (request.method !== method) return error('method_not_allowed', 405)
  let body
  if (request.method === 'POST') {
    const parsed = await readBody(request)
    if (parsed.response) return parsed.response
    body = parsed.data
  }
  if (create) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || Array.from(name).length > 30) return error('bad_name')
    const teacherKey = randomHex(24)
    const teacherHash = await hash(teacherKey)
    for (let attempt = 0; attempt < 10; attempt++) {
      // Rejection sampling keeps code generation unbiased if the alphabet changes.
      let code = ''
      while (code.length < 6) {
        for (const byte of crypto.getRandomValues(new Uint8Array(12))) {
          if (byte < Math.floor(256 / alphabet.length) * alphabet.length) code += alphabet[byte % alphabet.length]
          if (code.length === 6) break
        }
      }
      const result = await db.prepare('INSERT INTO classes (code, name, teacher_hash, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(code) DO NOTHING').bind(code, name, teacherHash, Date.now()).run()
      if (result.meta.changes) return json({ code, teacherKey, name }, 201)
    }
    return error('unavailable', 503)
  }
  const code = match[1].toUpperCase()
  const classroom = await db.prepare('SELECT name, teacher_hash FROM classes WHERE code = ?').bind(code).first()
  if (!classroom) return error('no_class', 404)
  if (action === 'stats' || action === 'delete') {
    const key = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1]
    if (!key || !equalHash(await hash(key), classroom.teacher_hash)) return error('bad_key', 401)
  }
  if (action === 'delete') {
    await db.batch([
      db.prepare('DELETE FROM members WHERE class_code = ?').bind(code),
      db.prepare('DELETE FROM word_stats WHERE class_code = ?').bind(code),
      db.prepare('DELETE FROM sync_batches WHERE class_code = ?').bind(code),
      db.prepare('DELETE FROM classes WHERE code = ?').bind(code),
    ])
    return json({ ok: true })
  }
  if (action === 'leave') {
    if (!devicePattern.test(match[3])) return error('bad_device')
    await db.prepare('DELETE FROM members WHERE class_code = ? AND device = ?').bind(code, match[3]).run()
    return json({ ok: true })
  }
  if (action === 'stats') {
    const { results: members } = await db.prepare('SELECT no, answered, correct, last_seen AS lastSeen FROM members WHERE class_code = ? ORDER BY no, device').bind(code).all()
    const { results: topWrong } = await db.prepare('SELECT en, wrong, correct FROM word_stats WHERE class_code = ? AND wrong > 0 ORDER BY wrong DESC, (1.0 * wrong / (wrong + correct)) DESC, en ASC LIMIT 10').bind(code).all()
    const totals = members.reduce((sum, member) => ({ members: sum.members + 1, answered: sum.answered + member.answered, correct: sum.correct + member.correct }), { members: 0, answered: 0, correct: 0 })
    return json({ name: classroom.name, code, members, totals, topWrong })
  }
  const { device, no } = body
  if (typeof device !== 'string' || !devicePattern.test(device)) return error('bad_device')
  if (!Number.isInteger(no) || no < 1 || no > 99) return error('bad_no')
  const now = Date.now()
  if (action === 'join') {
    await db.prepare('INSERT INTO members (class_code, device, no, joined_at, last_seen) VALUES (?, ?, ?, ?, ?) ON CONFLICT(class_code, device) DO UPDATE SET no = excluded.no').bind(code, device, no, now, now).run()
    return json({ name: classroom.name, code, no })
  }
  const { batch, answers } = body
  if (typeof batch !== 'string' || batch.length < 1 || batch.length > 40) return error('bad_batch')
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return error('bad_answers')
  let accepted = 0
  let correct = 0
  const entries = []
  for (const [en, counts] of Object.entries(answers)) {
    if (!words.has(en)) continue
    if (!Array.isArray(counts) || counts.length !== 2 || counts.some(count => !Number.isInteger(count) || count < 0 || count > 50)) return error('bad_answers')
    accepted += counts[0] + counts[1]
    correct += counts[0]
    if (accepted > 500) return error('too_many')
    if (counts[0] + counts[1]) entries.push([en, ...counts])
  }
  // D1 batch is transactional: only a newly registered, unapplied batch can
  // change aggregates. Retain each batch for 30 days, regardless of arrival order.
  const statements = [
    db.prepare('DELETE FROM sync_batches WHERE class_code = ? AND device = ? AND created_at < ?').bind(code, device, now - batchRetention),
    db.prepare(`INSERT INTO sync_batches (class_code, device, batch, created_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(class_code, device, batch) DO NOTHING`).bind(code, device, batch, now),
    ...entries.map(([en, right, wrong]) => db.prepare(`INSERT INTO word_stats (class_code, en, correct, wrong)
      SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM sync_batches WHERE class_code = ? AND device = ? AND batch = ? AND applied = 0)
      ON CONFLICT(class_code, en) DO UPDATE SET correct = correct + excluded.correct, wrong = wrong + excluded.wrong`).bind(code, en, right, wrong, code, device, batch)),
  ]
  statements.push(db.prepare(`INSERT INTO members (class_code, device, no, answered, correct, joined_at, last_seen)
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM sync_batches WHERE class_code = ? AND device = ? AND batch = ? AND applied = 0)
    ON CONFLICT(class_code, device) DO UPDATE SET
    no = excluded.no, answered = answered + excluded.answered, correct = correct + excluded.correct,
    last_seen = excluded.last_seen`).bind(code, device, no, accepted, correct, now, now, code, device, batch))
  statements.push(db.prepare('UPDATE sync_batches SET applied = 1 WHERE class_code = ? AND device = ? AND batch = ? AND applied = 0').bind(code, device, batch))
  const results = await db.batch(statements)
  if (!results[results.length - 1].meta.changes) return json({ ok: true, accepted: 0, duplicate: true })
  return json({ ok: true, accepted })
}
