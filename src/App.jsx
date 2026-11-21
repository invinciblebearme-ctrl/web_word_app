import { lazy, Suspense } from 'react'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import WordChallenge from './pages/WordChallenge'
import ScrambleHome from './pages/ScrambleHome'
import ScrambleGame from './pages/ScrambleGame'
import MyVocabulary from './pages/MyVocabulary'
import RoundQuiz from './pages/RoundQuiz'
import Review from './pages/Review'
// 주제별 페이지는 주제 데이터가 커서 열 때 불러온다
const Topics = lazy(() => import('./pages/Topics'))
import Navbar from './components/Navbar'
import { ToastProvider } from './components/Toast'

function App() {
  return (
    <ToastProvider>
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/challenge/:id" element={<WordChallenge />} />
        <Route path="/scramble" element={<ScrambleHome />} />
        <Route path="/scramble-game/:id" element={<ScrambleGame />} />
        <Route path="/my-voca" element={<MyVocabulary />} />
        <Route path="/quiz/:id" element={<RoundQuiz />} />
        <Route path="/review" element={<Review />} />
        <Route path="/topics" element={<Suspense fallback={null}><Topics /></Suspense>} />
        <Route path="/topics/:key" element={<Suspense fallback={null}><Topics /></Suspense>} />
      </Routes>
    </Router>
    </ToastProvider>
  )
}

export default App
