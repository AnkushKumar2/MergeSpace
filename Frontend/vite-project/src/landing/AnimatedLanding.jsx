import "./landing-motion.css"
import { useEffect, useRef, useState } from "react"
import CountUp from "./CountUp"
import { reopenCookieSettings } from "../site/consent"
import { usePageMeta } from "../site/usePageMeta"
import { cardMotionProps, magneticProps, useLandingMotion } from "./useLandingMotion"

/* Splits a heading into words that rise out of a mask, one after another. */
function Words({ text, start = 0 }) {
  return text.split(" ").map((word, index) => (
    <span key={`${word}-${index}`}><span className="word"><span style={{ "--w": start + index }}>{word}</span></span>{" "}</span>
  ))
}

function Feature({ title, text, index, soon = false }) {
  return <article className={`feature-card${soon ? " is-soon" : ""}`} data-reveal="up" style={{ "--d": `${(index % 3) * 90}ms` }} {...cardMotionProps}><span>✦</span>{soon && <em className="soon-badge">Coming soon</em>}<h3>{title}</h3><p>{text}</p></article>
}

function CodeUniverse() {
  return <div className="code-universe" aria-hidden="true"><div className="universe-glow" /><div className="code-card card-back"><span className="window-dots">● ● ●</span><code><b>const</b> future = <em>await</em> build();<br />future.<strong>share</strong>(team);</code></div><div className="code-card card-front"><div className="code-card-top"><span className="window-dots">● ● ●</span><span>index.html</span><span>•••</span></div><code><i>01</i> <b>&lt;section</b> <em>class</em>=<u>"future"</u><b>&gt;</b><br /><i>02</i> &nbsp; <b>&lt;h1&gt;</b><span>Make it real.</span><b>&lt;/h1&gt;</b><br /><i>03</i> &nbsp; <b>&lt;p&gt;</b><span className="accent">Together.</span><b>&lt;/p&gt;</b><br /><i>04</i> <b>&lt;/section&gt;</b><br /><i>05</i> <span className="cursor-line">|</span></code><div className="cursor-label">Jordan <span /></div></div><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="floating-tag tag-one">● 2 editors</div><div className="floating-tag tag-two">⌁ Live preview</div></div>
}

const MARQUEE = ["Pair programming", "Live code reviews", "Technical interviews", "Teaching & mentoring", "Hackathons", "Debugging together", "Live preview", "Instant invites"]

const STEPS = [
  { n: "01", title: "Open a workspace", text: "Start a fresh shared editor in seconds, ready for your files and your people." },
  { n: "02", title: "Invite your team", text: "Send an invitation to the people you trust. They can accept or decline directly from their account." },
  { n: "03", title: "Build together", text: "Type, review, preview, and see who is actively editing in the same live space." }
]

function StoryVisual({ active }) {
  return <div className="story-visual" data-step={active} aria-hidden="true">
    <div className="story-window">
      <div className="story-bar"><span className="window-dots">● ● ●</span><span className="story-title">{["new-workspace", "invite-team", "index.html"][active]}</span><span className="story-live">● live</span></div>
      <div className="story-panel panel-0"><p className="story-label">Workspace name</p><div className="story-input"><span className="typing">Team playground</span></div><div className="story-files"><span>index.html</span><span>style.css</span><span>script.js</span></div><div className="story-button">Create workspace ↗</div></div>
      <div className="story-panel panel-1"><p className="story-label">Invite by email</p><div className="story-input"><span className="typing">jordan@team.dev</span></div><div className="story-role"><b>Editor</b><span>can edit files</span></div><div className="story-invited"><i>J</i><span>Jordan <small>invitation sent</small></span><em>Pending</em></div></div>
      <div className="story-panel panel-2"><div className="story-code"><i>01</i> <b>&lt;h1&gt;</b>Make it real.<b>&lt;/h1&gt;</b><span className="story-caret caret-a"><s>Ada</s></span><br /><i>02</i> <b>&lt;p&gt;</b><span className="accent">Together.</span><b>&lt;/p&gt;</b><span className="story-caret caret-b"><s>Jordan</s></span></div><div className="story-people"><i>A</i><i>J</i><span>2 editing now</span></div></div>
    </div>
  </div>
}

function Story() {
  const [active, setActive] = useState(0)
  const refs = useRef([])
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActive(Number(entry.target.dataset.index))
    }, { rootMargin: "-45% 0px -45% 0px" })
    refs.current.forEach((node) => node && observer.observe(node))
    return () => observer.disconnect()
  }, [])
  return <div className="story">
    <div className="story-sticky"><StoryVisual active={active} /><div className="story-progress"><span style={{ transform: `scaleY(${(active + 1) / STEPS.length})` }} /></div></div>
    <div className="story-steps">
      {STEPS.map((step, index) => <article key={step.n} data-index={index} ref={(node) => { refs.current[index] = node }} className={`step-card story-step ${active === index ? "is-active" : ""}`}><b>{step.n}</b><h3>{step.title}</h3><p>{step.text}</p></article>)}
    </div>
  </div>
}

function Faq({ question, answer, defaultOpen = false, index }) {
  const [open, setOpen] = useState(defaultOpen)
  // The reveal class lives on a wrapper whose className never changes, because React
  // would otherwise overwrite the `is-in` class when `open` toggles.
  return <div className="faq-wrap" data-reveal="up" style={{ "--d": `${index * 70}ms` }}>
    <div className={`faq-item ${open ? "is-open" : ""}`}>
      <button type="button" className="faq-q" aria-expanded={open} onClick={() => setOpen(!open)}><span>{question}</span><i aria-hidden="true" /></button>
      <div className="faq-a"><div><p>{answer}</p></div></div>
    </div>
  </div>
}

export default function AnimatedLanding({ onEnter, onLogin, configured }) {
  const rootRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  useLandingMotion(rootRef)
  usePageMeta("landing")
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (event) => { if (event.key === "Escape") setMenuOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [menuOpen])
  const jump = (id) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }) }
  return <main ref={rootRef} className="landing extended-landing motion-landing">
    <div className="landing-progress" aria-hidden="true"><span /></div>
    <nav className="landing-nav"><button className="brand light" onClick={() => jump("top")}><span className="brand-mark">M</span>MergeSpace</button><div className="landing-links"><button className="text-button" onClick={() => jump("features")}>Features</button><button className="text-button" onClick={() => jump("how-it-works")}>How it works</button><button className="text-button" onClick={onLogin}>Log in</button><button className="nav-cta" onClick={onEnter}>Start building ↗</button></div><button type="button" className="menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="landing-mobile-menu" onClick={() => setMenuOpen(!menuOpen)}><span /><span /><span /></button>
      <div id="landing-mobile-menu" className={`mobile-menu${menuOpen ? " is-open" : ""}`} hidden={!menuOpen}><button onClick={() => jump("features")}>Features</button><button onClick={() => jump("how-it-works")}>How it works</button><button onClick={() => { setMenuOpen(false); onLogin() }}>Log in</button><button className="mobile-menu-cta" onClick={() => { setMenuOpen(false); onEnter() }}>Start building ↗</button></div>
    </nav>

    <section className="landing-content" id="top">
      <div className="landing-copy">
        <p className="kicker hero-rise" style={{ "--h": 0 }}>THE COLLABORATIVE CODE EDITOR</p>
        <h1 className="hero-title"><span className="hero-line"><span style={{ "--h": 1 }}>Make it real.</span></span><br /><span className="hero-line"><i style={{ "--h": 2 }}>Together.</i></span></h1>
        <p className="landing-lede hero-rise" style={{ "--h": 3 }}>A shared space for pair programming, live reviews, interviews, and the ideas your team ships next.</p>
        <div className="hero-actions hero-rise" style={{ "--h": 4 }}><button className="primary-button magnetic" onClick={onEnter} {...magneticProps}>Create your workspace ↗</button><button className="landing-secondary" onClick={() => jump("how-it-works")}>See how it works</button></div>
        <p className="fine-print hero-rise" style={{ "--h": 5 }}>{configured ? "No installs · live editing · join from any browser" : "Add InsForge env vars to connect your backend"}</p>
      </div>
      <CodeUniverse />
      <button className="scroll-hint" onClick={() => jump("marquee")} aria-label="Scroll to content"><span /></button>
    </section>

    <section className="marquee" id="marquee" aria-label="What teams use MergeSpace for">
      <div className="marquee-track">{[0, 1].map((copy) => <div className="marquee-group" key={copy} aria-hidden={copy === 1}>{MARQUEE.map((item) => <span key={item}>{item}<i>✦</i></span>)}</div>)}</div>
    </section>

    <section className="landing-section stats-section">
      <div className="stats-grid">
        {[{ to: 0, label: "installs needed", suffix: "" }, { to: 3, label: "languages with live preview", suffix: "" }, { to: 2, label: "roles: owner & editor", suffix: "" }, { to: 100, label: "in your browser", suffix: "%" }].map((stat, index) => <div className="stat" key={stat.label} data-reveal="up" style={{ "--d": `${index * 90}ms` }}><strong><CountUp to={stat.to} suffix={stat.suffix} /></strong><span>{stat.label}</span></div>)}
      </div>
    </section>

    <section className="landing-section" id="features">
      <p className="kicker" data-reveal="up">EVERYTHING IN ONE SPACE</p>
      <h2 data-reveal="words"><Words text="Built for the way developers actually work together." /></h2>
      <p className="section-lede" data-reveal="up" style={{ "--d": "200ms" }}>From a quick fix to a full technical interview, MergeSpace brings the tools your team needs into one focused room.</p>
      <div className="feature-grid">
        <Feature index={0} title="Live multi-cursor editing" text="See each teammate’s cursor, selection, and edits as they happen—without merge conflicts." />
        <Feature index={1} title="Live preview" text="Work on HTML, CSS, and JavaScript together, then review the result without leaving the room." />
        <Feature index={2} title="Workspace permissions" text="Owners manage people and roles. Editors can focus on the work, with the right access every time." />
        <Feature index={3} title="One shared context" text="Keep files, collaborators, and decisions together so every session starts where the last one ended." />
        <Feature index={4} title="Chat in the room" text="Talk through a change without leaving the editor. Every workspace has its own conversation." />
        <Feature index={5} title="Names on every cursor" text="Always know who is typing where: each collaborator’s cursor carries their name and colour." />
      </div>
    </section>

    <section className="landing-section steps-section" id="how-it-works">
      <p className="kicker" data-reveal="up">FROM ZERO TO COLLABORATING</p>
      <h2 data-reveal="words"><Words text="Three steps. No setup." /></h2>
      <Story />
    </section>

    <section className="landing-section">
      <p className="kicker" data-reveal="up">ONE WORKSPACE, MANY JOBS</p>
      <h2 data-reveal="words"><Words text="Wherever code needs more than one person." /></h2>
      <div className="feature-grid usecase-grid">
        <Feature index={0} title="Pair programming" text="Work through a problem together while both contributors remain in the same source of truth." />
        <Feature index={1} soon title="Technical interviews" text="Give candidates a focused editor and watch their thinking unfold in real time." />
        <Feature index={2} title="Code reviews" text="Trace a change together, annotate the intent, and move from feedback to a better implementation." />
        <Feature index={3} soon title="Teaching & mentoring" text="Walk a class through a solution, then let a learner take the keyboard when they are ready." />
      </div>
    </section>

    <section className="landing-section faq-section">
      <div className="faq-layout">
        <div className="faq-intro">
          <p className="kicker" data-reveal="up">GOOD TO KNOW</p>
          <h2 data-reveal="words"><Words text="Frequently asked questions" /></h2>
          <p className="section-lede" data-reveal="up" style={{ "--d": "200ms" }}>Quick answers about editing together, roles, and getting started.</p>
          <div className="faq-help" data-reveal="up" style={{ "--d": "300ms" }}><strong>Still have a question?</strong><p>We’re happy to help you get set up.</p><a href="mailto:ankushgupta97412@gmail.com">Contact us ↗</a></div>
        </div>
        <div className="faq-list">
          <Faq index={0} defaultOpen question="Can more than one person edit a file at once?" answer="Yes. Active workspace members can edit together and see live changes, cursors, and the people currently in the room." />
          <Faq index={1} question="Who can manage members and invitations?" answer="Only workspace owners can invite, remove, or change another member’s role. Editors have file-editing access only." />
          <Faq index={2} question="Do I need to install anything?" answer="No. MergeSpace runs in the browser and keeps your workspace available on desktop, tablet, and mobile." />
          <Faq index={3} question="Which languages can I work in?" answer="Workspaces support HTML, CSS, and JavaScript files, with a live preview that updates as anyone types." />
          <Faq index={4} question="How do I invite a teammate?" answer="Open your workspace settings and invite them by email. They accept or decline from their own account, and an owner can change their role at any time." />
        </div>
      </div>
    </section>

    <section className="landing-cta">
      <p className="kicker" data-reveal="up">PRESS SHARE. START CODING.</p>
      <h2 data-reveal="words"><Words text="Your next workspace is one click away." /></h2>
      <p data-reveal="up" style={{ "--d": "250ms" }}>Open a live editor, invite your team, and start collaborating in seconds.</p>
      <button className="primary-button magnetic" data-reveal="up" style={{ "--d": "350ms" }} onClick={onEnter} {...magneticProps}>Start building free ↗</button>
    </section>

    <footer className="landing-footer"><div><button className="brand light"><span className="brand-mark">M</span>MergeSpace</button><p>The shared workspace for pair programming, reviews, interviews, and teams that build together.</p></div><div><strong>Product</strong><button onClick={() => jump("features")}>Features</button><button onClick={() => jump("how-it-works")}>How it works</button></div><div><strong>Company</strong><a href="mailto:ankushgupta97412@gmail.com">Contact</a><a href="mailto:ankushgupta97412@gmail.com">Support</a></div><div><strong>Legal</strong><a href="/privacy">Privacy Policy</a><a href="/terms">Terms &amp; Conditions</a><button onClick={reopenCookieSettings}>Cookie settings</button></div><small>© {new Date().getFullYear()} MergeSpace. All rights reserved.</small></footer>
  </main>
}
