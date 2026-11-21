import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { loadExamples } from './utils/examples'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// 예문은 첫 화면이 뜬 뒤 쉬는 시간에 미리 불러 둔다 (퀴즈 빈칸 문제·단어 카드 예문)
const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500))
idle(() => loadExamples().catch(() => {}))

// 배포본에서만 서비스 워커 등록 (오프라인 사용, 그림 캐시)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('서비스 워커 등록 실패:', err))
  })
}
