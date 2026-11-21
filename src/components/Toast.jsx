import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// alert() 대신 쓰는 알림. 화면을 막지 않고 잠시 뒤 사라진다.
const ToastContext = createContext(() => {})

const ICONS = { info: 'ℹ️', success: '🎉', warning: '⚠️', error: '❗' }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
  }, [])

  const show = useCallback((message, { type = 'info', duration = 4000 } = {}) => {
    const id = nextId.current++
    // 같은 내용이 이미 떠 있으면 새로 쌓지 않는다
    setToasts((list) => (list.some((t) => t.message === message) ? list : [...list.slice(-2), { id, message, type }]))
    timers.current.set(id, setTimeout(() => dismiss(id), duration))
    return id
  }, [dismiss])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon" aria-hidden="true">{ICONS[t.type]}</span>
            <span className="toast-message">{t.message}</span>
            <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="알림 닫기">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
