// Ten distinct colours that keep white 11px text readable on top of them.
const PALETTE = ["#e05a47", "#1f9d74", "#3b7de0", "#b8860b", "#9b51e0", "#d6458f", "#1a9fb0", "#5a9a2a", "#d9701f", "#5b6bf0"]

export function cursorColorFor(userId = "") {
  let hash = 0
  for (const ch of String(userId)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]
}