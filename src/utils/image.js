export const IMAGE_BASE_URL = 'https://word-assets.pages.dev/'

// 예전 버전은 파일명을 base64로 저장했음 (나만의 단어장 localStorage 호환용).
// base64에는 '.'이 없으므로 확장자 유무로 구분한다.
const toFileName = (img) => {
  if (img.includes('.')) return img
  try {
    return window.atob(img)
  } catch {
    return img
  }
}

export const wordImageUrl = (img) => (img ? `${IMAGE_BASE_URL}${toFileName(img)}` : null)
