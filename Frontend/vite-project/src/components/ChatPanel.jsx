import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { cursorColorFor } from "../lib/cursorColor"
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

function LinkedText({ text }) {
  const parts = String(text || "").split(/(https?:\/\/[^\s<]+)/gi)
  return parts.map((part, index) => /^https?:\/\//i.test(part)
    ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
    : part)
}

function RichMessage({ text }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef(null)
  useEffect(() => () => window.clearTimeout(timerRef.current), [])
  const segments = String(text || "").split(/```([^\n`]*)\n([\s\S]*?)```/g)
  return segments.map((segment, index) => {
    if (index % 3 === 1) {
      const code = segments[index + 1]
      return <pre className="chat-code" key={index}><div className="chat-code-header"><span>{segment || "code"}</span><button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(code); setCopied(true); window.clearTimeout(timerRef.current); timerRef.current = window.setTimeout(() => setCopied(false), 1500) } catch { /* ignore: clipboard unavailable */ }
      }}>{copied ? "Copied" : "Copy"}</button></div><code>{code}</code></pre>
    }
    if (index % 3 === 2) return null
    return <LinkedText key={index} text={segment} />
  })
}

function dayKey(date) {
  const parsed = new Date(date)
  return `${parsed.getFullYear()}-${parsed.getMonth()}-${parsed.getDate()}`
}

export default function ChatPanel({ open, onClose, currentUser, chat, isOwner = false }) {
  const listRef = useRef(null)
  const textareaRef = useRef(null)
  const wasNearBottom = useRef(true)
  const [showJump, setShowJump] = useState(false)
  const [draft, setDraft] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState("")
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
  const saveEdit = async (event, id) => {
    event?.preventDefault()
    const body = editDraft.trim()
    if (!body || body.length > 2000 || !chat?.edit) return
    await chat.edit(id, body)
    setEditingId(null)
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
                {!own && (!grouped ? <MessageAvatar message={{ ...message, name: chat?.nameFor?.(message.user_id) || "Member" }} /> : <span className="chat-avatar-spacer" />)}
                <div className="chat-message-content">
                  {!grouped && <div className="chat-message-meta">{own ? <strong>You</strong> : <strong style={{ color: cursorColorFor(message.user_id) }}>{chat?.nameFor?.(message.user_id) || "Member"}</strong>}<time dateTime={message.created_at}>{timeLabel(message.created_at)}</time></div>}
                  {editingId === message.id ? <form className="chat-edit-form" onSubmit={(event) => saveEdit(event, message.id)}><textarea autoFocus maxLength={2000} value={editDraft} onChange={(event) => setEditDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setEditingId(null) } else if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); saveEdit(event, message.id) } }} /><div><button type="button" onClick={() => setEditingId(null)}>Cancel</button><button type="submit" disabled={!editDraft.trim()}>Save</button></div></form> : <div className="chat-message-body"><RichMessage text={message.body} />{message.edited_at && <span className="chat-edited"> (edited)</span>}</div>}
                  {(own || isOwner) && !message.pending && <div className="chat-message-actions">{own && <button type="button" onClick={() => { setEditingId(message.id); setEditDraft(message.body || "") }}>Edit</button>}<button type="button" onClick={() => { const other = !own; if (window.confirm(other ? "Delete someone else's message? This cannot be undone." : "Delete your message? This cannot be undone.")) chat.remove?.(message.id) }}>Delete</button></div>}
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
