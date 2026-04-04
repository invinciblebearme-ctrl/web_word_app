import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import WordChallenge from './pages/WordChallenge'
import ScrambleHome from './pages/ScrambleHome'
import ScrambleGame from './pages/ScrambleGame'
import Navbar from './components/Navbar'

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/challenge/:id" element={<WordChallenge />} />
        <Route path="/scramble" element={<ScrambleHome />} />
        <Route path="/scramble-game/:id" element={<ScrambleGame />} />
      </Routes>
    </Router>
  )
}

export default App
