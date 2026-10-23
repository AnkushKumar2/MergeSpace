import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ToastContext } from "./toastContext"

let nextId = 1

export default function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const push = useCallback((type, message) => {
    if (!message) return
    const id = nextId++
    setItems((current) => [...current.slice(-3), { id, type, message: String(message) }])
    timers.current.set(id, window.setTimeout(() => dismiss(id), type === "error" ? 6500 : 4000))
  }, [dismiss])

  useEffect(() => {
    const active = timers.current
    return () => { active.forEach((timer) => window.clearTimeout(timer)); active.clear() }
  }, [])

  const api = useMemo(() => ({ success: (m) => push("success", m), error: (m) => push("error", m), info: (m) => push("info", m) }), [push])

  return <ToastContext.Provider value={api}>
    {children}
    <div className="toast-region" role="status" aria-live="polite">
      {items.map((item) => <div key={item.id} className={`toast toast-${item.type}`}>
        <span className="toast-icon" aria-hidden="true">{item.type === "success" ? "✓" : item.type === "error" ? "!" : "i"}</span>
        <span className="toast-text">{item.message}</span>
        <button type="button" className="toast-close" aria-label="Dismiss message" onClick={() => dismiss(item.id)}>×</button>
      </div>)}
    </div>
  </ToastContext.Provider>
}
