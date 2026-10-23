import { useEffect } from "react"
import { SITE } from "./siteConfig"

// Titles, descriptions and indexing rules per view. Only public pages are indexable.
const PAGES = {
  landing: { title: "MergeSpace | Real-time collaborative code editor", description: SITE.description, index: true, path: "/" },
  login: { title: "Log in | MergeSpace", description: "Log in to your MergeSpace workspaces." },
  signup: { title: "Create your account | MergeSpace", description: "Create a free MergeSpace account and start coding together." },
  dashboard: { title: "Your workspaces | MergeSpace" },
  workspace: { title: "Editor | MergeSpace" },
  activity: { title: "Activity | MergeSpace" },
  settings: { title: "Workspace settings | MergeSpace" },
  invite: { title: "Invite teammates | MergeSpace" },
  profile: { title: "My profile | MergeSpace" },
  privacy: { title: "Privacy Policy | MergeSpace", description: "How MergeSpace collects, uses and protects your information.", index: true, path: "/privacy" },
  terms: { title: "Terms and Conditions | MergeSpace", description: "The terms that apply when you use MergeSpace.", index: true, path: "/terms" },
  notfound: { title: "Page not found | MergeSpace" }
}

function upsert(selector, create, apply) {
  let node = document.head.querySelector(selector)
  if (!node) { node = create(); document.head.appendChild(node) }
  apply(node)
}
const meta = (attr, key, value) => upsert(`meta[${attr}="${key}"]`, () => { const m = document.createElement("meta"); m.setAttribute(attr, key); return m }, (m) => m.setAttribute("content", value))

/** Keeps <title>, description, robots, canonical and Open Graph tags in step with the visible page. */
export function usePageMeta(page, detail) {
  useEffect(() => {
    const info = PAGES[page] || PAGES.landing
    const title = detail && info.title.startsWith("Editor") ? `${detail} | MergeSpace` : info.title
    const description = info.description || SITE.description
    document.title = title
    meta("name", "description", description)
    meta("name", "robots", info.index ? "index,follow" : "noindex,nofollow")
    meta("property", "og:title", title)
    meta("property", "og:description", description)
    meta("name", "twitter:title", title)
    meta("name", "twitter:description", description)
    const url = info.index ? SITE.url + info.path : null
    if (url) {
      upsert('link[rel="canonical"]', () => { const l = document.createElement("link"); l.rel = "canonical"; return l }, (l) => { l.href = url })
      meta("property", "og:url", url)
    } else {
      document.head.querySelector('link[rel="canonical"]')?.remove()
    }
  }, [page, detail])
}
