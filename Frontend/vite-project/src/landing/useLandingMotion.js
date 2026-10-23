import { useEffect, useLayoutEffect } from "react"

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/**
 * One hook drives every landing animation. It only writes CSS classes and CSS
 * variables on DOM nodes (no React state), so scrolling never re-renders the page.
 *  - [data-reveal]      -> gets `.is-in` once it enters the viewport
 *  - --p                -> page scroll progress 0..1 (progress bar)
 *  - --hero-p           -> hero scroll progress 0..1 (hero fade/parallax)
 *  - --px / --py        -> pointer position -1..1 over the hero (parallax)
 *  - .is-scrolled       -> on the nav once the page has scrolled
 */
export function useLandingMotion(rootRef) {
  // Mark the page as "motion ready" before first paint, so hidden start states
  // only ever apply when JavaScript is running (no flash, no invisible content).
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return undefined
    root.classList.add("js-motion")
    return () => root.classList.remove("js-motion")
  }, [rootRef])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    const items = Array.from(root.querySelectorAll("[data-reveal]"))
    let observer = null
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      items.forEach((item) => item.classList.add("is-in"))
    } else {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add("is-in")
          observer.unobserve(entry.target)
        }
      }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" })
      items.forEach((item) => observer.observe(item))
    }

    const nav = root.querySelector(".landing-nav")
    const hero = root.querySelector("#top")
    let frame = 0
    const update = () => {
      frame = 0
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      root.style.setProperty("--p", Math.min(1, window.scrollY / max).toFixed(4))
      const heroHeight = hero?.offsetHeight || window.innerHeight
      root.style.setProperty("--hero-p", Math.min(1, Math.max(0, window.scrollY / heroHeight)).toFixed(4))
      nav?.classList.toggle("is-scrolled", window.scrollY > 24)
    }
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)

    const onPointer = (event) => {
      root.style.setProperty("--px", ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3))
      root.style.setProperty("--py", ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3))
    }
    const canHover = window.matchMedia?.("(hover: hover)").matches && !prefersReducedMotion()
    if (canHover) hero?.addEventListener("pointermove", onPointer)

    return () => {
      observer?.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      hero?.removeEventListener("pointermove", onPointer)
    }
  }, [rootRef])
}

/** Cursor-following spotlight + 3D tilt for cards. Spread onto any element. */
export const cardMotionProps = {
  onPointerMove(event) {
    if (event.pointerType === "touch") return
    const card = event.currentTarget
    const box = card.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width
    const y = (event.clientY - box.top) / box.height
    card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`)
    card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`)
    card.style.setProperty("--tx", `${((x - 0.5) * 7).toFixed(2)}deg`)
    card.style.setProperty("--ty", `${((0.5 - y) * 7).toFixed(2)}deg`)
  },
  onPointerLeave(event) {
    const card = event.currentTarget
    card.style.removeProperty("--tx")
    card.style.removeProperty("--ty")
  }
}

/** Buttons that lean toward the pointer. */
export const magneticProps = {
  onPointerMove(event) {
    if (event.pointerType === "touch") return
    const button = event.currentTarget
    const box = button.getBoundingClientRect()
    const dx = (event.clientX - (box.left + box.width / 2)) * 0.22
    const dy = (event.clientY - (box.top + box.height / 2)) * 0.3
    button.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`
  },
  onPointerLeave(event) { event.currentTarget.style.translate = "" }
}