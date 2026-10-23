import { useEffect } from "react"

const HEX = /^#[0-9a-f]{6}$/i
const ACTIVE_MS = 3000

const safeColor = (value) => (HEX.test(String(value)) ? String(value) : "#e05a47")

// A collaborator's name is untrusted. Keep only letters, numbers, space . _ - so it can never
// break out of a CSS string.
const safeText = (value, max = 24) =>
  Array.from(String(value ?? "").replace(/[^\p{L}\p{N} ._-]/gu, "").trim()).slice(0, max).join("")

const initialsOf = (name) =>
  name.split(" ").filter(Boolean).map((word) => Array.from(word)[0]).join("").slice(0, 2).toUpperCase()

// y-monaco gives every remote caret/selection a class containing the Yjs awareness client id.
// This writes one <style> element with a coloured caret, selection and name label per remote user.
// Active (typed/moved in the last 3 s): full name. Idle: initials only.
export function useRemoteCursorStyles(awareness, fileKey) {
  useEffect(() => {
    if (!awareness) return undefined
    const style = document.createElement("style")
    style.setAttribute("data-remote-cursors", "")
    document.head.appendChild(style)

    const render = () => {
      const now = Date.now()
      const rules = []
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID || !state?.user) return
        const color = safeColor(state.user.color)
        const name = safeText(state.user.name) || "Guest"
        const active = now - (state.activity?.lastActive || 0) < ACTIVE_MS
        const label = active ? name : (initialsOf(name) || "?")
        rules.push(
          `.monaco-editor .yRemoteSelection-${clientId}{background-color:${color}40 !important}`,
          `.monaco-editor .yRemoteSelectionHead-${clientId}{border-left:2px solid ${color} !important;border-top:0 !important;border-bottom:0 !important}`,
          `.monaco-editor .yRemoteSelectionHead-${clientId}::after{content:"${label}";position:absolute;left:-2px;top:auto !important;bottom:100%;border:0 !important;border-radius:4px 4px 4px 0;padding:1px 6px;background:${color};color:#fff;font:600 11px/16px "DM Sans",sans-serif;white-space:nowrap;pointer-events:none;z-index:50;opacity:${active ? 1 : 0.85};transition:opacity .2s}`,
        )
      })
      const text = rules.join("\n")
      if (style.textContent !== text) style.textContent = text
    }

    render()
    awareness.on("change", render)
    const timer = window.setInterval(render, 1500) // lets labels collapse to initials when idle
    return () => {
      window.clearInterval(timer)
      awareness.off("change", render)
      style.remove()
    }
  }, [awareness, fileKey])
}

// Marks the local user as active when they type, click or move the caret themselves.
// Remote edits are ignored on purpose (they would also fire model-content events).
export function trackLocalActivity(editor, awareness) {
  let last = 0
  const ping = () => {
    const now = Date.now()
    if (now - last < 1000) return
    last = now
    awareness.setLocalStateField("activity", { lastActive: now })
  }
  const subscriptions = [
    editor.onKeyDown(ping),
    editor.onMouseDown(ping),
    editor.onDidChangeCursorSelection((event) => {
      if (event.source === "keyboard" || event.source === "mouse") ping()
    }),
  ]
  return () => subscriptions.forEach((subscription) => subscription.dispose())
}