// 영어 발음 듣기 (Web Speech TTS). 네이티브에 가까운 영어 음성을 우선 사용.
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export const speak = (text) => {
  if (!canSpeak() || !text) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const voices = window.speechSynthesis.getVoices()
  const voice =
    voices.find((v) => v.lang === 'en-US' && v.name.includes('Google')) ||
    voices.find((v) => v.lang === 'en-US' && v.name.includes('Samantha')) ||
    voices.find((v) => v.lang.startsWith('en-US')) ||
    voices.find((v) => v.lang.startsWith('en'))
  if (voice) utterance.voice = voice
  utterance.lang = 'en-US'
  utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
}

export const getSpeechRecognition = () =>
  typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null
