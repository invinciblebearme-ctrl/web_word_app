import React from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

function Navbar() {
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Reading mode is active for Home AND WordChallenge pages
  const isReadingActive = location.pathname === '/' || location.pathname.startsWith('/challenge') || location.pathname.startsWith('/quiz') || location.pathname.startsWith('/topics')
  // Writing mode is active for Scramble pages
  const isWritingActive = location.pathname.startsWith('/scramble')
  // My Vocabulary mode is active
  const isMyVocaActive = location.pathname === '/my-voca'
  const isReviewActive = location.pathname === '/review'

  return (
    <nav className="floating-navbar" aria-label="주 메뉴">
      <div className="navbar-container">
        <div className="segmented-control">
          <Link
            to={`/?${searchParams.toString()}`}
            className={`segment-item ${isReadingActive ? 'active' : ''}`}
            aria-current={isReadingActive ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">🎧</span> 듣기 / 읽기
          </Link>
          <Link
            to={`/scramble?${searchParams.toString()}`}
            className={`segment-item ${isWritingActive ? 'active' : ''}`}
            aria-current={isWritingActive ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">✍️</span> 쓰기 연습
          </Link>
          <Link 
            to="/my-voca" 
            className={`segment-item ${isMyVocaActive ? 'active' : ''}`}
            aria-current={isMyVocaActive ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">⭐</span> 나만의 단어장
          </Link>
          <Link
            to="/review"
            className={`segment-item ${isReviewActive ? 'active' : ''}`}
            aria-current={isReviewActive ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">📅</span> 학습
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
