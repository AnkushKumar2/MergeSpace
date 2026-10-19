import { useEffect, useLayoutEffect, useRef, useState } from "react"
import "./ChatPanel.css"

const initialsFor = (name) => (name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?"

function MessageAvatar({ message }) {
  const [imageFailed, setImageFailed] = useState(false)
  const avatar = message.avatar_url
  const colors = ["coral", "mint", "blue"]
  const nameHash = [...(message.name || "")].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  const color = colors.includes(avatar) ? avatar : colors.includes(message.avatar_color) ? message.avatar_color : colors[nameHash % colors.length]
  const imageUrl = typeof avatar === "string" && /^https?:\/\//i.test(avatar) ? avatar : null
  if (imageUrl && !imageFailed) return <img className="chat-avatar" src={imageUrl} alt="" onError={() => setImageFailed(true)} />
  return <span className={`chat-avatar chat-avatar--${color}`} aria-hidden="true">{initialsFor(message.name)}</span>
}

function dayLabel(date) {
  const today = new Date()
  const target = new Date(date)
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(today, target)) return "Today"
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (sameDay(yesterday, target)) return "Yesterday"
  return target.toLocaleDateString([], { month: "short", day: "numeric", year: target.getFullYear() === today.getFullYear() ? undefined : "numeric" })
}

function timeLabel(date) {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

function dayKey(date) {
  const parsed = new Date(date)
  return `${parsed.getFullYear()}-${parsed.getMonth()}-${parsed.getDate()}`
}

export default function ChatPanel({ open, onClose, currentUser, chat }) {
  const listRef = useRef(null)
  const textareaRef = useRef(null)
  const wasNearBottom = useRef(true)
  const [showJump, setShowJump] = useState(false)
  const [draft, setDraft] = useState("")
  const messages = chat?.messages || []
  const latestId = messages[messages.length - 1]?.id

  useEffect(() => {
    if (!open) return undefined
    textareaRef.current?.focus()
    const onKeyDown = (event) => { if (event.key === "Escape") onClose?.() }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  useLayoutEffect(() => {
    const list = listRef.current
    if (list && wasNearBottom.current) {
      list.scrollTop = list.scrollHeight
      setShowJump(false)
    }
  }, [latestId, open])

  if (!open) return null

  const onScroll = () => {
    const list = listRef.current
    if (list) {
      wasNearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80
      setShowJump(!wasNearBottom.current)
    }
  }
  const submit = async (event) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || body.length > 2000 || !chat?.send) return
    setDraft("")
    await chat.send(body)
  }
  const jumpToLatest = () => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    wasNearBottom.current = true
    setShowJump(false)
  }

  return (
    <aside className="chat-panel" aria-label="Workspace chat">
      <header className="chat-header">
        <h2>Chat</h2>
        <button className="chat-close" type="button" onClick={onClose} aria-label="Close chat">×</button>
      </header>
      <div className="chat-list-wrap">
        {chat?.hasMore && <button className="chat-load-earlier" type="button" onClick={chat.loadEarlier} disabled={chat.loading}>Load earlier messages</button>}
        <div className="chat-message-list" ref={listRef} onScroll={onScroll} aria-live="polite">
          {messages.map((message, index) => {
            const date = new Date(message.created_at)
            const previous = messages[index - 1]
            const day = dayKey(message.created_at)
            const previousDay = previous ? dayKey(previous.created_at) : null
            const showDay = day !== previousDay
            const withinWindow = previous && date - new Date(previous.created_at) <= 5 * 60 * 1000
            const grouped = previous && previous.user_id === message.user_id && withinWindow && !showDay
            const own = message.user_id === currentUser?.id
            return <div key={message.id}>
              {showDay && <div className="chat-day-separator"><span>{dayLabel(message.created_at)}</span></div>}
              <article className={`chat-message${own ? " is-own" : ""}${message.pending ? " is-pending" : ""}${grouped ? " is-grouped" : ""}`}>
                {!grouped ? <MessageAvatar message={message} /> : <span className="chat-avatar-spacer" />}
                <div className="chat-message-content">
                  {!grouped && <div className="chat-message-meta"><strong>{message.name || "Unknown"}</strong><time dateTime={message.created_at}>{timeLabel(message.created_at)}</time></div>}
                  <div className="chat-message-body">{message.body}{message.edited_at && <span className="chat-edited"> (edited)</span>}</div>
                  {message.failed && <div className="chat-failure"><span>Message failed to send</span><button type="button" onClick={() => chat.retry?.(message.id)}>Retry</button></div>}
                </div>
              </article>
            </div>
          })}
        </div>
        {showJump && <button className="chat-jump-latest" type="button" onClick={jumpToLatest}>Jump to latest</button>}
      </div>
      <form className="chat-composer" onSubmit={submit}>
        <textarea ref={textareaRef} value={draft} maxLength={2000} placeholder="Write a message…" aria-label="Message" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />
        <div className="chat-composer-footer">
          <span className={`chat-counter${draft.length >= 1800 ? " is-visible" : ""}`}>{draft.length >= 1800 ? `${draft.length}/2000` : ""}</span>
          <button className="chat-send" type="submit" disabled={!draft.trim() || draft.length > 2000}>Send</button>
        </div>
      </form>
    </aside>
  )
}
