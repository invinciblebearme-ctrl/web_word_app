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
        <h1>오늘의 영단어로 실력 <span style={{ color: '#38bdf8' }}>Up</span></h1>

        <div className="search-container">
          <input 
            type="text" 
            placeholder="회차 또는 단어 검색..." 
            className="home-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="dark-button" onClick={() => setSearchTerm('')}>초기화</button>
          )}
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
                  <p>
                    {round.name.split(' ').map((text, i) => (
                      <React.Fragment key={i}>
                        {text}
                        <br />
                      </React.Fragment>
                    ))}
                  </p>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default Home
