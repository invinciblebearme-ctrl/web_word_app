import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyVoca, removeFromMyVoca } from '../utils/storage'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function VocaItem({ word, handleDelete, speakWord }) {
  const [showKo, setShowKo] = useState(false);
  const imgUrl = word.img ? `https://word-assets.pages.dev/${window.atob(word.img)}` : null;

  return (
    <div 
      className="challenge-card voca-card" 
      onClick={() => setShowKo(!showKo)}
    >
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={word.en}
          crossOrigin="anonymous"
          style={{ width: '30px', height: '30px', borderRadius: '10%', objectFit: 'cover', marginRight: '10px' }}
        />
      ) : (
        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', marginRight: '10px' }} />
      )}

      <div className="word-en fade-in" style={{ 
        fontSize: showKo ? (word.ko.length > 10 ? '0.75rem' : '0.85rem') : '1rem', 
        fontWeight: 'bold', 
        flex: 1, 
        textAlign: 'left',
        color: showKo ? '#38bdf8' : 'white',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        lineHeight: '1.2',
        maxHeight: '32px',
        wordBreak: 'break-all'
      }}>
        {showKo ? word.ko : word.en}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
        <button
          className="dark-button"
          onClick={() => speakWord(word.en)}
          style={{ padding: '2px 8px', fontSize: '0.7rem', margin: 0, height: '26px' }}
        >
          🔈 발음
        </button>
        <button
          className="voca-delete-btn"
          onClick={() => handleDelete(word.en)}
          style={{ position: 'static', padding: '0 5px', fontSize: '1.2rem', color: '#f87171', border: 'none', background: 'none' }}
          title="삭제"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function MyVocabulary() {
  const [vocaList, setVocaList] = useState([])
  const [isExporting, setIsExporting] = useState(false)
  const navigate = useNavigate()
  const printRef = useRef()

  useEffect(() => {
    setVocaList(getMyVoca())
  }, [])

  const handleDelete = (en) => {
    removeFromMyVoca(en)
    setVocaList(getMyVoca())
  }

  const speakWord = (word) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }

  const exportToPDF = async () => {
    if (vocaList.length === 0) return
    setIsExporting(true)
    
    // 잠깐의 딜레이를 주어 렌더링 확인
    setTimeout(async () => {
      try {
        const element = printRef.current
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        })
        
        const imgData = canvas.toDataURL('image/png')
        const pdf = new jsPDF('p', 'mm', 'a4')
        const imgWidth = 210
        const pageHeight = 297
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        let heightLeft = imgHeight
        
        let position = 0
        
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
        
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pageHeight
        }
        
        pdf.save(`나만의_단어장_${new Date().toLocaleDateString()}.pdf`)
      } catch (error) {
        console.error('PDF export failed:', error)
        alert('PDF 생성 중 오류가 발생했습니다.')
      } finally {
        setIsExporting(false)
      }
    }, 500)
  }

  return (
    <div className="container">
      <div className="home-body" style={{ 
        textAlign: 'center', 
        paddingTop: '25px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%'
      }}>
        <h1 className="home-title">나만의 <span className="title-gradient-accent">단어장</span></h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px' }}>
          <p style={{ color: '#8b98a5', margin: 0 }}>저장된 단어: {vocaList.length}개</p>
          {vocaList.length > 0 && (
            <button 
              className="dark-button" 
              onClick={exportToPDF}
              disabled={isExporting}
              style={{ padding: '5px 12px', fontSize: '0.85rem', background: '#38bdf8', color: '#1a1a2e', fontWeight: 'bold' }}
            >
              {isExporting ? '생성 중...' : '📥 PDF 저장'}
            </button>
          )}
        </div>

        {vocaList.length === 0 ? (
          <div className="challenge-card" style={{ padding: '50px' }}>
            <div className="word-ko">저장된 단어가 없습니다.</div>
            <p style={{ color: '#8b98a5', marginTop: '10px' }}>학습 중에 ⭐ 버튼을 눌러 단어를 추가해 보세요!</p>
            <button className="nav-btn-premium" style={{ marginTop: '20px' }} onClick={() => navigate('/')}>
              학습하러 가기
            </button>
          </div>
        ) : (
          <>
            <div className="voca-list-container">
              {vocaList.map((word, idx) => (
                <VocaItem 
                  key={idx} 
                  word={word} 
                  handleDelete={handleDelete} 
                  speakWord={speakWord} 
                />
              ))}
            </div>

            {/* PDF 출력을 위한 숨겨진 영역 (화이트 배경) */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
              <div ref={printRef} style={{ 
                width: '800px', 
                padding: '40px', 
                background: 'white', 
                color: 'black',
                fontFamily: 'Arial, sans-serif'
              }}>
                <h1 style={{ textAlign: 'center', color: '#0ea5e9', marginBottom: '30px' }}>나만의 단어장</h1>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                  {vocaList.map((word, idx) => {
                    const imgUrl = word.img ? `https://word-assets.pages.dev/${window.atob(word.img)}` : null;
                    return (
                      <div key={idx} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '15px', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '10px',
                        gap: '15px'
                      }}>
                        {imgUrl && <img src={imgUrl} crossOrigin="anonymous" style={{ width: '50px', height: '50px', borderRadius: '5px' }} alt="" />}
                        <div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{word.en}</div>
                          <div style={{ fontSize: '1rem', color: '#64748b' }}>{word.ko}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default MyVocabulary
