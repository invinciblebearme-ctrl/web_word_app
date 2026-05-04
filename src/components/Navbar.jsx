import React from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

function Navbar() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  
  // Reading mode is active for Home AND WordChallenge pages
  const isReadingActive = location.pathname === '/' || location.pathname.startsWith('/challenge')
  // Writing mode is active for Scramble pages
  const isWritingActive = location.pathname.startsWith('/scramble')

  return (
    <nav className="floating-navbar">
      <div className="navbar-container">
        <div className="segmented-control">
          <Link 
            to={`/?${searchParams.toString()}`} 
            className={`segment-item ${isReadingActive ? 'active' : ''}`}
          >
            <span className="nav-icon">🎧</span> 듣기 / 읽기
          </Link>
          <Link 
            to={`/scramble?${searchParams.toString()}`} 
            className={`segment-item ${isWritingActive ? 'active' : ''}`}
          >
            <span className="nav-icon">✍️</span> 쓰기 연습
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
