// 교사용 수업 모드 도구 (서버 없이 동작)

// 1~size 가운데 아직 안 뽑힌 번호 하나. 모두 뽑혔으면 null.
export const pickNumber = (size, picked = [], rng = Math.random) => {
  const taken = new Set(picked)
  const left = []
  for (let i = 1; i <= size; i++) if (!taken.has(i)) left.push(i)
  return left.length ? left[Math.floor(rng() * left.length)] : null
}

// 초 → "m:ss"
export const formatTime = (sec) => {
  const s = Math.max(0, Math.ceil(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const TIMER_PRESETS = [30, 60, 180, 300]
export const CLASS_SIZE_KEY = 'classroom_size_v1'
export const MIN_SIZE = 2
export const MAX_SIZE = 40

export const clampSize = (n) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(Number(n)) || MIN_SIZE))

// 타이머 끝 알림음 (Web Audio, 짧은 삐삐삐). 소리를 낼 수 없으면 조용히 넘어간다.
export const beep = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[0, 0.35, 0.7].forEach((t) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.25, ctx.currentTime + t)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.3)
    })
    setTimeout(() => ctx.close(), 1500)
  } catch {
    // 무시
  }
}
