import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

// Native require also works with Vitest versions that externalize node:sqlite
// incorrectly. No test-runner dependency: reusable by the local E2E server.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')

export function createD1(sqlFile = new URL('../../migrations/0001_class.sql', import.meta.url)) {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(sqlFile, 'utf8'))
  let pending = Promise.resolve()

  function statement(sql, values = []) {
    return {
      bind(...parameters) { return statement(sql, parameters) },
      async run() {
        const result = sqlite.prepare(sql).run(...values)
        return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }
      },
      async all() {
        return { success: true, results: sqlite.prepare(sql).all(...values).map(row => ({ ...row })) }
      },
      async first(column) {
        const row = sqlite.prepare(sql).get(...values)
        return row ? column === undefined ? { ...row } : row[column] : null
      },
    }
  }

  return {
    prepare: statement,
    batch(statements) {
      // Model D1's serialized writes even when a local server gets parallel fetches.
      const execution = pending.then(async () => {
        sqlite.exec('BEGIN IMMEDIATE')
        try {
          const results = []
          for (const item of statements) results.push(await item.run())
          sqlite.exec('COMMIT')
          return results
        } catch (error) {
          sqlite.exec('ROLLBACK')
          throw error
        }
      })
      pending = execution.catch(() => {})
      return execution
    },
    close() { sqlite.close() },
  }
}
