// Every browser/device gets its own random id, persisted so the same
// browser sees its own documents again after a reload -- but a different
// browser (or someone else's phone) never does. This is what actually
// keeps one visitor's uploads from being listed, searched, or summarized
// by another visitor hitting the same deployment; see app.py's
// require_session_id for the server side of this.
const STORAGE_KEY = 'rag-summarizer-session-id'

let memoryFallback: string | null = null

export function getSessionId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    // localStorage unavailable (private browsing, etc.) -- fall back to an
    // id that's at least stable for this page load, so a single session's
    // own requests still see a consistent identity.
    if (!memoryFallback) memoryFallback = crypto.randomUUID()
    return memoryFallback
  }
}
