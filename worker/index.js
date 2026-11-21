// voca.allforedu.kr Worker (today-voca-800) 진입점
// /api/* 만 Worker가 처리하고(학급 진도), 나머지는 정적 파일(ASSETS)로 응답한다.
// 로컬 Pages 개발(functions/api/[[path]].js)과 같은 handle()을 쓴다.
import { handle } from '../functions/_lib/api.js'

export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/api/')) return handle(request, env)
    return env.ASSETS.fetch(request)
  },
}
