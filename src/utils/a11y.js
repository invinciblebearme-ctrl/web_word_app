// div 같은 요소를 버튼처럼 쓸 때 키보드(Enter/Space)와 스크린리더에서도 동작하게 한다
export const clickable = (onActivate, label) => ({
  role: 'button',
  tabIndex: 0,
  'aria-label': label,
  onClick: onActivate,
  onKeyDown: (e) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onActivate(e)
    }
  },
})
