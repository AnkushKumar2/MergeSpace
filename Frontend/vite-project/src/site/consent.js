import { useSyncExternalStore } from "react"

// Cookie / analytics consent. Essential storage (the sign-in session) needs no consent;
// analytics only ever loads after the visitor clicks "Accept".
const KEY = "mergespace-consent"
const listeners = new Set()
let memory = null // used when the browser blocks localStorage

export function getConsent() {
  try { return window.localStorage.getItem(KEY) || memory } catch { return memory }
}
function notify() { listeners.forEach((listener) => listener()) }

export function setConsent(value) {
  memory = value
  try { window.localStorage.setItem(KEY, value) } catch { /* storage blocked: keep in memory */ }
  if (value === "accepted") loadAnalytics()
  else disableAnalytics()
  notify()
}

/** Lets the footer's "Cookie settings" link show the banner again. */
export function reopenCookieSettings() {
  memory = null
  try { window.localStorage.removeItem(KEY) } catch { /* ignore */ }
  notify()
}

export function useConsent() {
  return useSyncExternalStore((callback) => { listeners.add(callback); return () => listeners.delete(callback) }, getConsent, () => null)
}

// ---- Analytics (off unless you set one of these in your .env) ----
//   VITE_PLAUSIBLE_DOMAIN=mergespace.insforge.site
//   VITE_GA_ID=G-XXXXXXXXXX
let loaded = false
export function loadAnalytics() {
  if (loaded || typeof document === "undefined") return
  const plausible = import.meta.env.VITE_PLAUSIBLE_DOMAIN
  const ga = import.meta.env.VITE_GA_ID
  if (plausible) {
    const script = document.createElement("script")
    script.defer = true
    script.dataset.domain = plausible
    script.src = "https://plausible.io/js/script.js"
    document.head.appendChild(script)
    loaded = true
  } else if (/^G-[A-Z0-9]+$/.test(ga || "")) {
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() { window.dataLayer.push(arguments) }
    window.gtag("js", new Date())
    window.gtag("config", ga, { anonymize_ip: true })
    const script = document.createElement("script")
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ga}`
    document.head.appendChild(script)
    loaded = true
  }
}
function disableAnalytics() {
  const ga = import.meta.env.VITE_GA_ID
  if (ga) window[`ga-disable-${ga}`] = true
}
/** Call once at startup: loads analytics only for visitors who already accepted. */
export function initAnalytics() { if (getConsent() === "accepted") loadAnalytics() }
