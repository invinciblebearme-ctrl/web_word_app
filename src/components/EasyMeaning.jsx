import React from 'react'
import { easyOf } from '../utils/meaning'

// 원래 뜻 밑에 붙이는 쉬운 뜻 한 줄. 원래 뜻과 같으면 아무것도 그리지 않는다.
function EasyMeaning({ en, className = '' }) {
  const easy = easyOf(en)
  if (!easy) return null
  return <div className={`word-easy ${className}`}><span className="word-easy-tag">쉬운 뜻</span>{easy}</div>
}

export default EasyMeaning
