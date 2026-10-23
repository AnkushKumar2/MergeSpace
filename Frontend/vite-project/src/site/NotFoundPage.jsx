import { usePageMeta } from "./usePageMeta"

export default function NotFoundPage() {
  usePageMeta("notfound")
  return <main className="site-page site-center">
    <a className="site-brand" href="/"><span className="brand-mark">M</span>MergeSpace</a>
    <p className="site-code" aria-hidden="true">404</p>
    <h1>We couldn’t find that page.</h1>
    <p className="site-lede">The link may be old or mistyped. Head back home and pick up where you left off.</p>
    <a className="site-button" href="/">Back to MergeSpace ↗</a>
  </main>
}
