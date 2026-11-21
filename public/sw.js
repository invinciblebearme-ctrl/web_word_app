// 오늘의 영단어 서비스 워커
// - 페이지(HTML): 네트워크 우선, 오프라인이면 저장해 둔 화면
// - 앱 파일(JS/CSS/아이콘): 저장본을 바로 쓰고 뒤에서 새로 받아 둠
// - 단어 그림: 한 번 본 그림은 저장해 두고 재사용 (최대 IMAGE_LIMIT개)
const VERSION = 'v1'
const APP_CACHE = `voca-app-${VERSION}`
const IMAGE_CACHE = `voca-img-${VERSION}`
const IMAGE_HOST = 'word-assets.pages.dev'
const IMAGE_LIMIT = 900

const SCOPE = new URL(self.registration.scope)
const INDEX_URL = new URL('index.html', SCOPE).href

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => cache.addAll([SCOPE.href, 'manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('voca-') && ![APP_CACHE, IMAGE_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const isAppShell = (url) => url.href === SCOPE.href || url.href === INDEX_URL

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(isAppShell(new URL(request.url)) ? SCOPE.href : request, response.clone())
    return response
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true })
    if (cached) return cached
    // 앱 화면(해시 라우팅)만 저장된 메인 화면으로 대신한다
    if (isAppShell(new URL(request.url))) {
      const shell = await cache.match(SCOPE.href)
      if (shell) return shell
    }
    throw err
  }
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(APP_CACHE)
  const cached = await cache.match(event.request)
  const update = fetch(event.request).then((response) => {
    if (response.ok) cache.put(event.request, response.clone())
    return response
  })
  if (cached) {
    event.waitUntil(update.catch(() => {}))
    return cached
  }
  return update
}

async function trimImages() {
  const cache = await caches.open(IMAGE_CACHE)
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - IMAGE_LIMIT; i++) await cache.delete(keys[i])
}

async function cacheFirstImage(event) {
  const cache = await caches.open(IMAGE_CACHE)
  const key = event.request.url
  const cached = await cache.match(key)
  if (cached) return cached
  // 항상 CORS로 받아 저장한다. 불투명(opaque) 응답을 저장하면
  // 나만의 단어장(crossOrigin 이미지 → PDF)에서 같은 그림이 깨지기 때문.
  let response
  try {
    response = await fetch(key, { mode: 'cors', credentials: 'omit' })
  } catch {
    return fetch(event.request)
  }
  if (response.ok) {
    await cache.put(key, response.clone())
    event.waitUntil(trimImages())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.hostname === IMAGE_HOST) {
    event.respondWith(cacheFirstImage(event))
    return
  }
  if (url.origin !== self.location.origin) return
  // 학급 진도 API는 항상 서버에서 새로 받는다 (저장하면 옛 진도가 보이고, 교사용 통계가 기기에 남는다)
  if (url.pathname.startsWith('/api/')) return
  // 별도 정적 페이지(WordGame, quizn)는 간섭하지 않음
  if (!url.href.startsWith(SCOPE.href) || /\/(WordGame|quizn)\//.test(url.pathname)) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
  } else {
    event.respondWith(staleWhileRevalidate(event))
  }
})
