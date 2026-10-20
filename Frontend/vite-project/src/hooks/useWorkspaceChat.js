import { useCallback, useEffect, useRef, useState } from "react"
import { deleteMessage, editMessage, listMessages, onChatEvents, sendMessage } from "../lib/chatApi"
import { listMembers } from "../lib/insforge"

export function useWorkspaceChat({ workspaceId, currentUser, isOpen }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [unread, setUnread] = useState(0)
  const [memberNames, setMemberNames] = useState(() => new Map())
  const messagesRef = useRef(messages)
  const userRef = useRef(currentUser)
  const openRef = useRef(isOpen)
  const workspaceRef = useRef(workspaceId)
  const memberNamesRef = useRef(memberNames)
  messagesRef.current = messages
  userRef.current = currentUser
  openRef.current = isOpen
  workspaceRef.current = workspaceId
  memberNamesRef.current = memberNames

  const refreshMemberNames = useCallback(async (id) => {
    if (!id) return
    try {
      const rows = await listMembers(id)
      if (workspaceRef.current !== id) return
      const next = new Map()
      for (const row of rows || []) {
        const email = row.email || row.profile?.email
        next.set(row.user_id, row.profile?.name || (email ? email.split("@")[0] : "Member") || "Member")
      }
      memberNamesRef.current = next
      setMemberNames(next)
    } catch { /* Keep the last known names if membership lookup fails. */ }
  }, [])

  const nameFor = useCallback((userId) => memberNamesRef.current.get(userId) || (userId === userRef.current?.id && userRef.current?.name) || "Member", [])
  const resolveName = useCallback((message) => message?.user_id ? { ...message, name: nameFor(message.user_id) } : message, [nameFor])

  const addUnique = useCallback(async (incoming) => {
    const resolved = await Promise.all((incoming || []).map(resolveName))
    setMessages((previous) => {
      const ids = new Set(previous.map((message) => message.id))
      const additions = resolved.filter((message) => message?.id && !ids.has(message.id) && ids.add(message.id))
      return [...previous, ...additions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    })
  }, [resolveName])

  const updateMessages = useCallback(async (incoming) => {
    const resolved = await Promise.all((incoming || []).map(resolveName))
    setMessages((previous) => {
      const byId = new Map(previous.map((message) => [message.id, message]))
      for (const message of resolved) {
        if (message?.id) byId.set(message.id, { ...byId.get(message.id), ...message })
      }
      return [...byId.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    })
  }, [resolveName])

  const loadLatest = useCallback(async (id) => {
    if (!id) return
    try {
      const result = await listMessages(id)
      if (workspaceRef.current !== id) return
      addUnique(result)
      if (messagesRef.current.length === 0) setHasMore(result.length === 50)
    } catch (cause) {
      if (workspaceRef.current === id) setError(cause?.message || String(cause))
    }
  }, [addUnique])

  useEffect(() => {
    setMessages([])
    setLoading(Boolean(workspaceId))
    setError(null)
    setHasMore(false)
    setUnread(0)
    setMemberNames(new Map())
    memberNamesRef.current = new Map()
    if (!workspaceId) return undefined
    let active = true
    refreshMemberNames(workspaceId)
    const receive = (message) => {
      if (!message?.id) return
      if (!memberNamesRef.current.has(message.user_id)) refreshMemberNames(workspaceId)
      const alreadyKnown = messagesRef.current.some((item) => item.id === message.id)
      const temp = messagesRef.current.find((item) => item.pending && item.user_id === message.user_id && item.body === message.body)
      addUnique([message])
      if (temp) setMessages((items) => items.filter((item) => item.id !== temp.id))
      if (!alreadyKnown && message.user_id !== userRef.current?.id && (!openRef.current || document.hidden)) setUnread((n) => n + 1)
    }
    const unsubscribe = onChatEvents(workspaceId, {
      onMessage: receive,
      onUpdate: (message) => updateMessages([message]),
      onDelete: (message) => setMessages((items) => items.filter((item) => item.id !== (message?.id || message))),
    })
    listMessages(workspaceId).then((result) => {
      if (!active) return
      addUnique(result)
      setHasMore(result.length === 50)
    }).catch((cause) => { if (active) setError(cause?.message || String(cause)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false; unsubscribe?.() }
  }, [workspaceId, addUnique, updateMessages, refreshMemberNames])

  useEffect(() => { if (isOpen) setUnread(0) }, [isOpen])
  useEffect(() => {
    if (!workspaceId) return undefined
    const onFocus = () => loadLatest(workspaceId)
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [workspaceId, loadLatest])

  const send = useCallback(async (body) => {
    const user = userRef.current
    const temp = { id: `tmp-${Math.random().toString(36).slice(2)}`, pending: true, user_id: user?.id, name: user?.name, body, created_at: new Date().toISOString() }
    setError(null)
    addUnique([temp])
    try {
      const saved = await sendMessage({ workspaceId: workspaceRef.current, userId: user?.id, body })
      setMessages((items) => {
        const withoutTemp = items.filter((item) => item.id !== temp.id)
        if (withoutTemp.some((item) => item.id === saved.id)) return withoutTemp
        return [...withoutTemp, { ...saved, name: nameFor(saved.user_id) }]
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      })
      return saved
    } catch (cause) {
      setMessages((items) => items.map((item) => item.id === temp.id ? { ...item, failed: true, errorMessage: cause?.message || String(cause) } : item))
      setError(cause?.message || String(cause))
      return null
    }
  }, [addUnique, nameFor])

  const retry = useCallback(async (tempId) => {
    const failed = messagesRef.current.find((item) => item.id === tempId && item.failed)
    if (!failed) return null
    const user = userRef.current
    setMessages((items) => items.map((item) => item.id === tempId ? { ...item, failed: false, pending: true, errorMessage: undefined } : item))
    try {
      const saved = await sendMessage({ workspaceId: workspaceRef.current, userId: user?.id, body: failed.body })
      setMessages((items) => {
        const withoutTemp = items.filter((item) => item.id !== tempId)
        if (withoutTemp.some((item) => item.id === saved.id)) return withoutTemp
        return [...withoutTemp, { ...saved, name: nameFor(saved.user_id) }].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      })
      return saved
    } catch (cause) {
      setMessages((items) => items.map((item) => item.id === tempId ? { ...item, pending: false, failed: true, errorMessage: cause?.message || String(cause) } : item))
      setError(cause?.message || String(cause))
      return null
    }
  }, [nameFor])

  const edit = useCallback(async (id, body) => {
    try { const saved = await editMessage(id, body); updateMessages([saved]); setError(null); return saved }
    catch (cause) { setError(cause?.message || String(cause)); return null }
  }, [updateMessages])
  const remove = useCallback(async (id) => {
    try { await deleteMessage(id); setMessages((items) => items.filter((item) => item.id !== id)); setError(null); return true }
    catch (cause) { setError(cause?.message || String(cause)); return false }
  }, [])
  const loadEarlier = useCallback(async () => {
    const oldest = messagesRef.current[0]
    if (!workspaceRef.current || !oldest || loading) return
    setLoading(true)
    try {
      const result = await listMessages(workspaceRef.current, { before: oldest.created_at })
      addUnique(result)
      setHasMore(result.length === 50)
    } catch (cause) { setError(cause?.message || String(cause)) }
    finally { setLoading(false) }
  }, [loading, addUnique])
  const markRead = useCallback(() => setUnread(0), [])

  return { messages, loading, error, hasMore, unread, send, retry, edit, remove, loadEarlier, markRead, nameFor }
}
