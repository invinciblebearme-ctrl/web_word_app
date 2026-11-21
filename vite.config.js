import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 단어 팡팡 게임(public/WordGame)이 회차별 단어를 쓸 수 있게 WordGame/rounds.json 을 만든다.
// 형식: [{ id, words: [[영어, 뜻], ...] }]
const ROUNDS_FILE = 'WordGame/rounds.json'
const roundsJson = () => {
  const rounds = JSON.parse(readFileSync(new URL('./src/data/all_rounds.json', import.meta.url), 'utf8'))
  return JSON.stringify(rounds.map((r) => ({ id: r.id, words: r.words.map((w) => [w.en, w.ko]) })))
}
const wordGameRounds = () => ({
  name: 'word-game-rounds',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.split('?')[0].endsWith('/' + ROUNDS_FILE)) return next()
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(roundsJson())
    })
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: ROUNDS_FILE, source: roundsJson() })
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), wordGameRounds()],
  base: './',
})
