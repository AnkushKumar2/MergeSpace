import { setConsent, useConsent } from "./consent"

export default function CookieBanner() {
  const consent = useConsent()
  if (consent === "accepted" || consent === "declined") return null
  return <section className="cookie-banner" role="dialog" aria-live="polite" aria-label="Cookie preferences">
    <div>
      <strong>Your privacy, your choice</strong>
      <p>MergeSpace stores a small amount of data in your browser to keep you signed in. With your OK we also use privacy-friendly analytics to see which parts of the site help. <a href="/privacy">Read our privacy policy</a>.</p>
    </div>
    <div className="cookie-actions">
      <button type="button" className="cookie-secondary" onClick={() => setConsent("declined")}>Deny</button>
      <button type="button" className="cookie-primary" onClick={() => setConsent("accepted")}>Accept cookies</button>
    </div>
  </section>
}
