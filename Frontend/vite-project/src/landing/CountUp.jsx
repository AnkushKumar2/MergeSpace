import { useEffect, useRef } from "react"

/** Counts from 0 to `to` the first time it scrolls into view. Writes straight to the DOM. */
export default function CountUp({ to, suffix = "", prefix = "", duration = 1400 }) {
  const ref = useRef(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const final = `${prefix}${to}${suffix}`
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduced || typeof IntersectionObserver === "undefined") { node.textContent = final; return undefined }
    let frame = 0
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 4)
        node.textContent = `${prefix}${Math.round(to * eased)}${suffix}`
        if (t < 1) frame = window.requestAnimationFrame(tick)
      }
      frame = window.requestAnimationFrame(tick)
    }, { threshold: 0.6 })
    observer.observe(node)
    return () => { observer.disconnect(); if (frame) window.cancelAnimationFrame(frame) }
  }, [to, suffix, prefix, duration])
  return <span ref={ref}>{`${prefix}0${suffix}`}</span>
}