import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import allRounds from '../data/all_rounds.json'
import { wordImageUrl } from '../utils/image'
import { clickable } from '../utils/a11y'

function ScrambleHome() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredRounds, setFilteredRounds] = useState(allRounds)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentGroup = searchParams.get('group') || '전체'

  useEffect(() => {
    let filtered = allRounds;

    // 1. Filter by group (1-20회, etc)
    if (currentGroup !== '전체') {
      const [start, end] = currentGroup.replace('회', '').split('-').map(Number);
      filtered = filtered.filter(round => {
        // Extract number from "오늘의 영단어 [1회]"
        const match = round.name.match(/\[(\d+)회\]/);
        if (match) {
          const num = parseInt(match[1], 10);
          return num >= start && num <= end;
        }
        return false;
      });
    }

    // 2. Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(round => 
        round.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        round.words.some(word => 
          word.en.toLowerCase().includes(searchTerm.toLowerCase()) ||
          word.ko.includes(searchTerm)
        )
      )
    }

    setFilteredRounds(filtered)
  }, [searchTerm, currentGroup])

  const categories = [...new Set(allRounds.map(r => r.category))]

  return (
    <div className="container">
      <div className="home-body" style={{ textAlign: 'center' }}>
        <h1 className="home-title">오늘의 영단어로 <br /> 실력 <span className="title-gradient-accent">Up (쓰기)</span></h1>

        <div className="search-container" style={{ display: 'flex', width: '310px', margin: '50px auto 20px', gap: '8px' }}>
          <input 
            type="text" 
            placeholder="스크램블 회차 검색..." 
            className="home-search-input"
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
        
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
          <div className="sub-tabs-container">
            {['1-20회', '21-40회', '41-60회', '61-80회', '전체'].map(group => (
              <button
                key={group}
                className={`sub-tab-item ${currentGroup === group ? 'active' : ''}`}
                onClick={() => {
                  if (group === '전체') {
                    searchParams.delete('group')
                  } else {
                    searchParams.set('group', group)
                  }
                  navigate(`/scramble?${searchParams.toString()}`)
                }}
              >
                {group}
              </button>
            ))}
          </div>
        </div>
      </div>

      {categories.map((category) => (
        <div key={category} style={{ width: '100%', textAlign: 'center' }}>
          
          <div className="grid-container">
            {filteredRounds
              .filter(r => r.category === category)
              .map(round => (
                <div key={round.id} className="item" {...clickable(() => navigate(`/scramble-game/${round.id}`), round.name)}>
                  <img 
                    src={wordImageUrl(round.words[0].img)} 
                    loading="lazy"
                    decoding="async"
                    alt=""
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

export default ScrambleHome
