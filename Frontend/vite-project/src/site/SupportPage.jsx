import { useState } from "react"
import { SITE } from "./siteConfig"
import { useSpamGuard } from "./useSpamGuard"
import { useToast } from "./toastContext"

// Sends the visitor's message to SITE.contactEmail through FormSubmit (formsubmit.co),
// a free form-to-email service, so no mail server or secret key is needed.
// The very first message makes FormSubmit email you once to activate the address.
const ENDPOINT = `https://formsubmit.co/ajax/${SITE.contactEmail}`
const TOPICS = ["Something is not working", "Account or sign-in", "Workspace or invitations", "Feature request", "Other"]

export default function SupportPage({ user, workspaceName, onBack }) {
  const [name, setName] = useState(user?.name || "")
  const [email, setEmail] = useState(user?.email || "")
  const [topic, setTopic] = useState(TOPICS[0])
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState("idle") // idle | sending | sent | error
  const spam = useSpamGuard(1500)
  const toast = useToast()

  const submit = async (event) => {
    event.preventDefault()
    if (spam.isBot()) { toast.info("Please try again in a moment."); return }
    setStatus("sending")
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `MergeSpace support: ${topic}`,
          _replyto: email.trim(),
          _template: "table",
          _captcha: "false",
          name: name.trim(),
          email: email.trim(),
          topic,
          workspace: workspaceName || "(none open)",
          message: message.trim()
        })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.success === "false") throw new Error("send failed")
      setStatus("sent")
      toast.success("Message sent. We will contact you soon.")
    } catch {
      setStatus("error")
      toast.error(`Could not send your message. Please email ${SITE.contactEmail} directly.`)
    }
  }

  return <main className="content dashboard support-page">
    <div className="page-heading"><div><p className="kicker">SUPPORT</p><h1>Contact support</h1><p className="muted">Tell us what went wrong or what you need. We read every message.</p></div></div>
    {status === "sent" ? <section className="support-done" role="status">
      <span className="support-done-mark" aria-hidden="true">✓</span>
      <h2>Thanks, we got your message.</h2>
      <p>We will contact you soon at <strong>{email}</strong>.</p>
      <button type="button" className="primary-button" onClick={onBack}>Back to overview</button>
    </section> : <form className="form-section support-form" onSubmit={submit}>
      <input {...spam.trapProps} />
      <label>Your name<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Email address<input required type="email" maxLength={120} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
      <label>What is this about?<select value={topic} onChange={(event) => setTopic(event.target.value)}>{TOPICS.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Your message<textarea required minLength={10} maxLength={3000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe the problem or your complaint in as much detail as you can." /></label>
      {status === "error" && <p className="auth-error">We could not send your message. Please try again, or email {SITE.contactEmail}.</p>}
      <button className="primary-button" type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Send message"}</button>
    </form>}
  </main>
}
