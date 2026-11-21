import React, { useMemo, useRef, useState } from 'react'
import allRounds from '../data/all_rounds.json'
import { loadProgress } from '../utils/progress'
import { speak } from '../utils/speech'
import { useToast } from '../components/Toast'
import { useExamples } from '../utils/examples'
import { exportElementToPdf } from '../utils/pdf'
import { loadSentences, saveSentence, deleteSentence, checkSentence, suggestWords, markWords, MIN_WORDS } from '../utils/sentences'

const ALL_WORDS = allRounds.flatMap((r) => r.words)
const KO_OF = Object.fromEntries(ALL_WORDS.map((w) => [w.en, w.ko]))
const MAX_PICK = 3

// 고른 단어를 문장 안에서 밑줄로 보여 준다 (plays, played처럼 바뀐 꼴도)
function Highlighted({ text, words }) {
  return <>{markWords(text, words).map((p, i) => (p.mark ? <u key={i}>{p.text}</u> : <span key={i}>{p.text}</span>))}</>
}

function Sentences() {
  const toast = useToast()
  const examples = useExamples()
  const progress = useMemo(() => loadProgress(), [])
  const [choices, setChoices] = useState(() => suggestWords(ALL_WORDS, progress))
  const [picked, setPicked] = useState([])
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(loadSentences)
  const [hint, setHint] = useState(false)
  const [exporting, setExporting] = useState(false)
  const printRef = useRef(null)

  const check = checkSentence(text, picked)
  const canSave = picked.length >= 2 && check.ok

  const toggle = (en) => {
    setPicked((p) => (p.includes(en) ? p.filter((x) => x !== en) : p.length < MAX_PICK ? [...p, en] : p))
  }
  const reshuffle = () => {
    setChoices(suggestWords(ALL_WORDS, progress))
    setPicked([])
    setHint(false)
  }
  const save = () => {
    if (!canSave) return
    if (!saveSentence({ text, words: picked })) {
      toast('저장 공간이 부족해 문장을 저장하지 못했어요. 지난 문장을 몇 개 지우고 다시 해 보세요.', { type: 'error', duration: 6000 })
      return
    }
    setSaved(loadSentences())
    toast('✏️ 문장을 저장했어요!', { type: 'success' })
    setText('')
    setPicked([])
    setHint(false)
    setChoices(suggestWords(ALL_WORDS, progress))
  }
  const remove = (id) => {
    if (!deleteSentence(id)) toast('문장을 지우지 못했어요. 잠시 뒤 다시 해 보세요.', { type: 'error' })
    setSaved(loadSentences())
  }
  const exportPdf = () => {
    setExporting(true)
    setTimeout(async () => {
      try {
        await exportElementToPdf(printRef.current, `나만의_문장_${new Date().toLocaleDateString()}.pdf`)
      } catch (e) {
        console.error('PDF export failed:', e)
        toast('PDF를 만드는 중에 문제가 생겼어요. 잠시 뒤 다시 해 보세요.', { type: 'error' })
      } finally {
        setExporting(false)
      }
    }, 300)
  }

  return (
    <div className="container sentences-page">
      <h1 className="home-title">나만의 <span className="title-gradient-accent">문장</span></h1>
      <p className="review-desc">배운 단어 2~3개를 골라 영어 문장을 만들어 봐요.</p>

      <section className="review-section sentence-maker">
        <div className="sentence-step">1. 단어 고르기 <small>({picked.length}/{MAX_PICK})</small></div>
        <div className="word-chips" role="group" aria-label="문장에 쓸 단어">
          {choices.map((w) => (
            <button
              key={w.en}
              type="button"
              className={`word-chip ${picked.includes(w.en) ? 'on' : ''}`}
              aria-pressed={picked.includes(w.en)}
              onClick={() => toggle(w.en)}
            >
              <span lang="en">{w.en}</span>
              <small>{w.ko.split(',')[0]}</small>
            </button>
          ))}
        </div>
        <button type="button" className="sub-tab-item" onClick={reshuffle}>🔄 다른 단어</button>

        <div className="sentence-step">2. 문장 쓰기</div>
        <textarea
          className="sentence-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={picked.length >= 2 ? `${picked.join(', ')}(을)를 넣어 문장을 써 보세요` : '먼저 단어를 2개 이상 골라요'}
          rows={3}
          lang="en"
          autoCapitalize="sentences"
          autoCorrect="off"
          spellCheck={false}
          disabled={picked.length < 2}
          aria-label="영어 문장 쓰기"
          maxLength={200}
        />
        {picked.length >= 2 && (
          <ul className="sentence-checks" aria-live="polite">
            {check.used.map((u) => (
              <li key={u.en} className={u.ok ? 'ok' : ''}>{u.ok ? '✅' : '⬜'} <span lang="en">{u.en}</span> 넣기</li>
            ))}
            <li className={check.wordCount >= MIN_WORDS ? 'ok' : ''}>{check.wordCount >= MIN_WORDS ? '✅' : '⬜'} {MIN_WORDS}단어 이상</li>
            {!check.englishOnly && <li className="warn">⚠️ 영어로만 써요</li>}
            {text.trim() && !check.capital && <li className="tip">💡 첫 글자는 대문자로 써요</li>}
            {text.trim() && !check.punct && <li className="tip">💡 끝에 . ? ! 를 붙여요</li>}
          </ul>
        )}
        <div className="sentence-actions">
          <button type="button" className="nav-btn-premium" onClick={() => speak(text, { rate: 0.8 })} disabled={!text.trim() || !check.englishOnly}>🔊 들어 보기</button>
          {picked.length > 0 && examples && (
            <button type="button" className="nav-btn-premium" onClick={() => setHint((h) => !h)} aria-expanded={hint}>💡 예문 힌트</button>
          )}
          <button type="button" className="mic-button" onClick={save} disabled={!canSave}>💾 저장하기</button>
        </div>
        {hint && examples && (
          <ul className="sentence-hints">
            {picked.map((en) => examples[en] && (
              <li key={en}><span lang="en">{examples[en].s}</span> <small>{examples[en].ko}</small></li>
            ))}
          </ul>
        )}
      </section>

      <section className="review-section">
        <div className="sentence-saved-head">
          <h2 className="review-heading">📒 내가 쓴 문장 <span>({saved.length})</span></h2>
          {saved.length > 0 && (
            <button type="button" className="dark-button" onClick={exportPdf} disabled={exporting}>{exporting ? '만드는 중...' : '📥 학습지 PDF'}</button>
          )}
        </div>
        {saved.length === 0 ? (
          <p className="review-desc">아직 저장한 문장이 없어요. 첫 문장을 써 봐요!</p>
        ) : (
          <ul className="sentence-list">
            {saved.map((s) => (
              <li key={s.id}>
                <p className="sentence-text" lang="en"><Highlighted text={s.text} words={s.words} /></p>
                <div className="sentence-meta">
                  <span>{s.words.join(' · ')}</span>
                  <span>{new Date(s.at).toLocaleDateString()}</span>
                  <button type="button" onClick={() => speak(s.text, { rate: 0.8 })} aria-label="문장 듣기">🔊</button>
                  <button type="button" onClick={() => remove(s.id)} aria-label="문장 삭제">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* PDF 학습지: 화면 밖에 그려 두고 캡처한다 */}
      {saved.length > 0 && (
        <div style={{ position: 'fixed', top: '200%', left: 0, width: '794px', zIndex: -1000 }} aria-hidden="true">
          <div id="sentence-print-area" ref={printRef} className="print-sheet">
            <div className="print-head">
              <h1>나만의 영어 문장</h1>
              <table>
                <tbody>
                  <tr>
                    <th>학교</th><td style={{ width: 100 }} />
                    <th>학년/반</th><td style={{ width: 70 }} />
                    <th>번호</th><td style={{ width: 60 }} />
                    <th>이름</th><td style={{ width: 100 }} />
                  </tr>
                </tbody>
              </table>
            </div>
            <ol className="print-list">
              {saved.slice(0, 20).map((s) => (
                <li key={s.id}>
                  <div className="print-words">{s.words.map((en) => `${en} (${(KO_OF[en] || '').split(',')[0]})`).join('  ·  ')}</div>
                  <div className="print-sentence"><Highlighted text={s.text} words={s.words} /></div>
                  <div className="print-line" />
                  <div className="print-line" />
                </li>
              ))}
            </ol>
            <div className="print-foot">문장을 소리 내어 읽고, 아래 줄에 두 번 따라 써 보세요. · {new Date().toLocaleDateString()}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sentences
