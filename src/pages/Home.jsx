import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import allRounds from '../data/all_rounds.json'

function Home() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredRounds, setFilteredRounds] = useState(allRounds)
  const navigate = useNavigate()

  useEffect(() => {
    const filtered = allRounds.filter(round => 
      round.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      round.words.some(word => 
        word.en.toLowerCase().includes(searchTerm.toLowerCase()) ||
        word.ko.includes(searchTerm)
      )
    )
    setFilteredRounds(filtered)
  }, [searchTerm])

  const categories = [...new Set(allRounds.map(r => r.category))]

  return (
    <div className="container">
      <div className="home-body" style={{ textAlign: 'center' }}>
        <h1 className="home-title">
          오늘의 영단어로 <span className="title-gradient-accent">실력 Up</span>
        </h1>

        <div className="search-container" style={{ display: 'flex', width: '310px', margin: '50px auto', gap: '8px' }}>
          <input 
            type="text" 
            className="search-input" 
            placeholder="회차 또는 단어 검색..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '10px 15px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'rgba(2, 6, 23, 0.6)',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              outline: 'none',
              flex: 1
            }}
          />
          <button className="dark-button" onClick={() => setSearchTerm('')} style={{ margin: 0 }}>초기화</button>
        </div>
      </div>

      {categories.map((category) => (
        <div key={category} style={{ width: '100%', textAlign: 'center' }}>
          
          <div className="grid-container">
            {filteredRounds
              .filter(r => r.category === category)
              .map(round => (
                <div key={round.id} className="item" onClick={() => navigate(`/challenge/${round.id}`)}>
                  <img 
                    src={`https://word-assets.invinciblebearme.workers.dev/${window.atob(round.words[0].img)}`} 
                    alt={round.name}
                    style={{ objectFit: 'contain' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const fallback = e.target.nextSibling;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="image-fallback" style={{ 
                    display: 'none', width: '50px', height: '50px', borderRadius: '20%', 
                    background: '#333', color: '#888', fontSize: '9px', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
                    lineHeight: '1.2', border: '1px solid #444'
                  }}>
                    이미지<br/>준비중
                  </div>
                  <p>오늘의<br />영단어<br />{round.name.replace('오늘의 영단어 ', '')}</p>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default Home
