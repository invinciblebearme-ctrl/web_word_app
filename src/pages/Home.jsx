import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import allRounds from '../data/all_rounds.json'
import { wordImageUrl } from '../utils/image'
import { clickable } from '../utils/a11y'
import { loadProgress, roundSummary, getDueWords } from '../utils/progress'
import { loadActivity, streakInfo, DAILY_GOAL } from '../utils/activity'

const ALL_WORDS = allRounds.flatMap((r) => r.words)

function Home() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredRounds, setFilteredRounds] = useState(allRounds)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentGroup = searchParams.get('group') || '전체'
  const progress = useMemo(() => loadProgress(), [])
  const dueCount = useMemo(() => getDueWords(ALL_WORDS, progress, Date.now(), Infinity).length, [progress])
  const streak = useMemo(() => streakInfo(loadActivity()), [])

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
        <h1 className="home-title">
          오늘의 영단어로 <span className="title-gradient-accent">실력 Up</span>
        </h1>

        <button className={`review-banner ${streak.goalDone ? 'done' : ''}`} onClick={() => navigate('/review')}>
          {streak.current > 0 && <span className="banner-streak">🔥 {streak.current}일 연속</span>}
          {streak.goalDone
            ? <span>🎯 오늘 목표 완료! 더 해 볼까요?</span>
            : streak.today > 0
              ? <span>오늘 <b>{streak.today}</b>/{DAILY_GOAL}문제 · 이어서 하기</span>
              : dueCount > 0
                ? <span>오늘 복습할 단어 <b>{dueCount}개</b> · 오늘의 학습 시작</span>
                : <span>▶️ 오늘의 학습 시작하기</span>}
        </button>

        <div className="search-container" style={{ display: 'flex', width: '310px', margin: '50px auto 20px', gap: '8px' }}>
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
                  navigate(`/?${searchParams.toString()}`)
                }}
              >
                {group}
              </button>
            ))}
          </div>
        </div>
        <div className="entry-row">
          <button className="topic-entry" onClick={() => navigate('/topics')}>🗂 주제별 <small>동물 · 음식 …</small></button>
          <button className="topic-entry" onClick={() => navigate('/phonics')}>🔤 소리 패턴 <small>sh · ee · -ight …</small></button>
          <button className="topic-entry" onClick={() => navigate('/sentences')}>✏️ 나만의 문장</button>
          <button className="topic-entry" onClick={() => navigate('/classroom')}>🏫 수업 모드 <small>카드 · 뽑기 · 타이머</small></button>
          <button className="topic-entry" onClick={() => navigate('/class')}>📊 학급 진도 <small>참여 · 통계</small></button>
        </div>
      </div>

      {categories.map((category) => (
        <div key={category} style={{ width: '100%', textAlign: 'center' }}>
          
          <div className="grid-container">
            {filteredRounds
              .filter(r => r.category === category)
              .map(round => (
                <div key={round.id} className="item" {...clickable(() => navigate(`/challenge/${round.id}`), round.name)}>
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
                  {(() => {
                    const sum = roundSummary(round, progress)
                    if (sum.seen === 0) return null
                    const done = sum.mastered === sum.total
                    return (
                      <div
                        className={`round-progress ${done ? 'done' : ''}`}
                        title={`퀴즈로 익힌 단어 ${sum.studied}/${sum.total}, 완전히 앎 ${sum.mastered}`}
                        aria-label={`익힌 단어 ${sum.studied}/${sum.total}`}
                      >
                        {done ? '✅' : <div className="round-progress-bar"><div style={{ width: `${Math.max(sum.studied / sum.total, 0.08) * 100}%` }} /></div>}
                      </div>
                    )
                  })()}
                </div>
              ))}
          </div>
        </div>
      ))}

      <footer className="home-extras">
        <a href="./WordGame/" className="extra-link">🎮 단어 팡팡 게임 <small>(회차 선택 · 웹캠 손동작)</small></a>
        <a href="./quizn/" className="extra-link">🔗 퀴즈앤 링크 모음</a>
      </footer>
    </div>
  )
}

export default Home
