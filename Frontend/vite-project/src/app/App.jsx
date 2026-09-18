import "./App.css"
import "./landing-extended.css"
import "./readability.css"
import { Editor } from "@monaco-editor/react"
import { Component, useCallback, useEffect, useRef, useState } from "react"
import { acceptInvitation, createFile, createWorkspace, declineInvitation, deleteFile, deleteWorkspace, getCurrentUser, insforgeConfigured, inviteMember, listFiles, listInvitations, listMembers, listMyInvitations, listWorkspaces, publishFileCreated, publishFileDeleted, requestEmailCode, removeMember, saveFile, signIn, signInWithProvider, signOut, signUp, subscribeToWorkspace, updateMemberRole, updateProfile, updateWorkspace, verifyEmailCode } from "../lib/insforge"
import * as Y from "yjs"
import { SocketIOProvider } from "y-socket.io"
import { MonacoBinding } from "y-monaco"
import { io } from "socket.io-client"

function getSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL
  if (typeof window !== "undefined") {
    if (window.location.port === "5173") return "http://localhost:3000"
    return window.location.origin
  }
  return "http://localhost:3000"
}

const files = [
  { name: "index.html", language: "html", icon: "<>" },
  { name: "styles.css", language: "css", icon: "#" },
  { name: "app.js", language: "javascript", icon: "JS" },
]

const HTML_BOILERPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    
  </body>
</html>
`

let completionsConfigured = false
// React Strict Mode can briefly mount the same workspace/file twice. Seed a
// previously empty Yjs room at most once per browser session; otherwise both
// mounts append the database content to the same CRDT document.
const seededYjsRooms = new Set()
function configureEditorCompletions(monaco) {
  if (completionsConfigured || !monaco) return
  completionsConfigured = true
  const { CompletionItemKind, CompletionItemInsertTextRule } = monaco.languages
  const snippet = (label, documentation, insertText) => ({
    label,
    kind: CompletionItemKind.Snippet,
    documentation,
    insertText,
    insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
  })
  monaco.languages.registerCompletionItemProvider("html", {
    triggerCharacters: ["<", "."],
    provideCompletionItems: () => ({ suggestions: [
      snippet("HTML document", "Complete HTML5 document", "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>${1:Document}</title>\n  </head>\n  <body>\n    ${0}\n  </body>\n</html>"),
      snippet("section", "Semantic page section", "<section class=\"${1:section}\">\n  <h2>${2:Heading}</h2>\n  <p>${0}</p>\n</section>"),
      snippet("navigation", "Accessible navigation", "<nav aria-label=\"${1:Main navigation}\">\n  <a href=\"${2:#}\">${0:Home}</a>\n</nav>"),
      snippet("button", "Accessible button", "<button type=\"button\">${0:Button}</button>"),
    ] }),
  })
  monaco.languages.registerCompletionItemProvider("css", {
    triggerCharacters: [".", ":", "@"],
    provideCompletionItems: () => ({ suggestions: [
      snippet("flex center", "Center children with Flexbox", "display: flex;\nalign-items: center;\njustify-content: center;\n${0}"),
      snippet("responsive container", "Centered responsive content container", "width: min(100% - 2rem, ${1:70rem});\nmargin-inline: auto;\n${0}"),
      snippet("media query", "Responsive media query", "@media (max-width: ${1:48rem}) {\n  ${0}\n}"),
      snippet("visually hidden", "Hide content visually but keep it accessible", ".${1:sr-only} {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  padding: 0;\n  margin: -1px;\n  overflow: hidden;\n  clip: rect(0, 0, 0, 0);\n  white-space: nowrap;\n  border: 0;\n}"),
    ] }),
  })
}

function initials(name = "") {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
}

function makeColor(name = "") {
  return ["coral", "mint", "blue"][name.length % 3]
}

const appViews = new Set(["landing", "login", "signup", "dashboard", "workspace", "activity", "settings", "invite", "profile"])

function pageFromLocation() {
  const view = new URLSearchParams(window.location.search).get("view")
  return appViews.has(view) ? view : "landing"
}

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [page, setPage] = useState(pageFromLocation)
  const [workspaces, setWorkspaces] = useState([])
  const [workspace, setWorkspace] = useState("")
  const [workspaceId, setWorkspaceId] = useState("")
  const [appError, setAppError] = useState("")
  const [loading, setLoading] = useState(insforgeConfigured)
  const [activeFile, setActiveFile] = useState(files[0])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [saved, setSaved] = useState(true)
  const editorRef = useRef(null)
  const [onlineUsers, setOnlineUsersState] = useState([])
  // CRITICAL: wrap in useCallback so the reference is stable across renders.
  // Without this, every App re-render (e.g. menuOpen toggle, page change) creates
  // a new function → WorkspaceEditor's useEffect re-runs → listFiles resets the
  // active tab to data[0] and setContent resets the editor cursor. Infinite loop.
  const setOnlineUsers = useCallback((nextUsers) => setOnlineUsersState((currentUsers) => {
    const resolvedUsers = typeof nextUsers === "function" ? nextUsers(currentUsers) : nextUsers
    return (resolvedUsers || []).map((cursor) => cursor || {})
  }), [])

  useEffect(() => {
    if (!insforgeConfigured) return undefined
    getCurrentUser().then(async (user) => {
      if (!user) return
      const profile = { ...user, name: user.profile?.name || user.email.split("@")[0], color: makeColor(user.profile?.name || user.email), initials: initials(user.profile?.name || user.email) }
      setCurrentUser(profile)
      setPage("dashboard")
      try {
        const data = await listWorkspaces()
        setWorkspaces(data)
        setWorkspace(data[0]?.name || "")
        setWorkspaceId(data[0]?.id || "")
      } catch (error) {
        setAppError(`Signed in, but your workspace data is unavailable: ${error.message}`)
      }
    }).catch((error) => setAppError(error.message)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const syncPageWithHistory = () => setPage(pageFromLocation())
    window.addEventListener("popstate", syncPageWithHistory)
    return () => window.removeEventListener("popstate", syncPageWithHistory)
  }, [])

  const bindEditor = (editor) => { editorRef.current = editor }

  const enterApp = (destination = "dashboard") => {
    setPage(destination)
    const url = destination === "landing" ? window.location.pathname : `?view=${destination}`
    window.history.pushState({ view: destination }, "", url)
  }

  const returnHome = () => {
    setPage("landing")
    window.history.replaceState({ view: "landing" }, "", window.location.pathname)
  }

  const handleAuth = async (profile, mode) => {
    try {
      setAppError("")
      const result = mode === "signup" ? await signUp(profile) : await signIn(profile)
      if (result?.requireEmailVerification) {
        setAppError("Check your email to verify your account, then log in.")
        return
      }
      const user = result?.user
      const normalized = { ...user, name: user?.profile?.name || profile.name || user?.email?.split("@")[0], color: makeColor(profile.name || user?.email), initials: initials(profile.name || user?.email) }
      setCurrentUser(normalized)
      const pendingInvitations = await listMyInvitations()
      const data = await listWorkspaces()
      let nextWorkspaces = data
      if (!nextWorkspaces.length && !pendingInvitations.length && normalized.id) nextWorkspaces = [await createWorkspace({ name: `${normalized.name.split(" ")[0]}'s workspace`, description: "Your first collaborative space", color: normalized.color, ownerId: normalized.id })]
      setWorkspaces(nextWorkspaces)
      setWorkspace(nextWorkspaces[0]?.name || "")
      setWorkspaceId(nextWorkspaces[0]?.id || "")
      enterApp("dashboard")
    } catch (error) {
      setAppError(error.message)
    }
  }

  const handleEmailCode = async (email, code) => {
    try {
      setAppError("")
      const result = code ? await verifyEmailCode(email, code) : await requestEmailCode(email)
      if (!code) return { sent: true, message: result?.message || "Check your email for the sign-in code." }
      const user = result?.user
      const normalized = { ...user, name: user?.profile?.name || email.split("@")[0], color: makeColor(email), initials: initials(email) }
      setCurrentUser(normalized)
      const data = await listWorkspaces()
      setWorkspaces(data)
      setWorkspace(data[0]?.name || "")
      setWorkspaceId(data[0]?.id || "")
      setPage("dashboard")
      window.history.pushState({}, "", "?view=dashboard")
      return { sent: false }
    } catch (error) {
      setAppError(error.message)
      return { error: error.message }
    }
  }

  const handleSignOut = async () => {
    await signOut()
    setCurrentUser(null)
    returnHome()
  }

  const handleCreateWorkspace = async () => {
    if (!currentUser?.id) {
      setAppError("Please log in before creating a workspace.")
      enterApp("login")
      return
    }
    try {
      setAppError("")
      const next = await createWorkspace({ name: "Untitled workspace", description: "A new space for your ideas", color: makeColor(workspaces.length + workspace), ownerId: currentUser.id })
      if (!next?.id) throw new Error("Workspace was created but could not be loaded. Please refresh and try again.")
      setWorkspaces((current) => [...current, next])
      setWorkspace(next.name)
      setWorkspaceId(next.id)
      setActiveFile(files[0])
      setPreviewOpen(false)
      enterApp("workspace")
    } catch (error) {
      setAppError(`Could not create workspace: ${error.message}`)
    }
  }

  const handleInvite = async ({ email, role }) => {
    await inviteMember({ workspaceId: workspaceId || workspaces.find((item) => item.name === workspace)?.id, email, role, invitedBy: currentUser.id })
    setPage("settings")
  }

  const handleWorkspaceUpdated = (updated) => {
    setWorkspaces((current) => current.map((item) => item.id === updated.id ? updated : item))
    setWorkspace(updated.name)
    setWorkspaceId(updated.id)
  }

  if (loading) return <main className="auth-page"><section className="auth-panel"><p className="muted">Connecting to MergeSpace...</p></section></main>
  if (page === "landing") return <LandingExtended onEnter={() => enterApp("signup")} onLogin={() => enterApp("login")} configured={insforgeConfigured} />
  if (page === "login" || page === "signup") return <Auth mode={page} onBack={returnHome} onSubmit={handleAuth} onProvider={signInWithProvider} onEmailCode={handleEmailCode} error={appError} configured={insforgeConfigured} />

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => enterApp("dashboard")}><span className="brand-mark">M</span>MergeSpace</button>
        <div className="topbar-actions"><span className="sync-status"><span className="status-dot" /> All changes saved</span><button className="icon-button" aria-label="Notifications">◌</button><button className="user-chip" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-haspopup="menu"><span className={`avatar ${currentUser?.color}`}>{currentUser?.initials}</span><span className="user-name">{currentUser?.name}</span><span className={`chevron ${menuOpen ? "down" : "right"}`} aria-hidden="true">{menuOpen ? "⌄" : "›"}</span></button>{menuOpen && <div className="profile-menu" role="menu"><button onClick={() => { setMenuOpen(false); enterApp("profile") }}>My profile</button><button onClick={() => { setMenuOpen(false); handleSignOut() }}>Sign out</button></div>}</div>
      </header>
      <div className="app-body">
        <aside className="sidebar"><div className="sidebar-product"><span className="brand-mark">M</span> MergeSpace</div><div className="workspace-switcher"><span className="workspace-icon">{initials(workspace) || "MS"}</span><span><small>WORKSPACE</small><strong>{workspace || "No workspace yet"}</strong></span><span className="chevron">&gt;</span></div><nav className="main-nav"><button className={page === "dashboard" ? "active" : ""} onClick={() => setPage("dashboard")}><span>▦</span> Overview</button><button className={page === "workspace" ? "active" : ""} onClick={() => setPage("workspace")}><span>⌁</span> Editor</button><button className={page === "activity" ? "active" : ""} onClick={() => setPage("activity")}><span>◷</span> Activity <em>4</em></button></nav><div className="sidebar-bottom"><button onClick={() => setPage("settings")}><span>⚙</span> Workspace settings</button><button onClick={() => setPage("profile")}><span>◎</span> My profile</button><div className="sidebar-help"><span className="help-avatar" role="img" aria-label="Customer support">👩🏽‍💻</span><span><strong>Need a hand?</strong><small>Visit our help center</small></span></div></div></aside>
        {page === "dashboard" && <Dashboard user={currentUser} error={appError} workspaces={workspaces} onOpen={(id) => { const selected = workspaces.find((item) => item.id === id); if (!selected) return; setWorkspace(selected.name); setWorkspaceId(selected.id); setPreviewOpen(false); enterApp("workspace") }} onNew={handleCreateWorkspace} onDelete={async (id) => { await deleteWorkspace(id); const next = workspaces.filter((item) => item.id !== id); setWorkspaces(next); setWorkspace(next[0]?.name || ""); setWorkspaceId(next[0]?.id || "") }} />}
        {page === "activity" && <ActivityPage user={currentUser} workspaces={workspaces} onOpen={() => enterApp("workspace")} onJoined={async () => { const nextWorkspaces = await listWorkspaces(); setWorkspaces(nextWorkspaces); const joined = nextWorkspaces.find((item) => item.id === workspaceId) || nextWorkspaces[0]; setWorkspace(joined?.name || ""); setWorkspaceId(joined?.id || "") }} />}
        {page === "workspace" && workspaceId && <WorkspaceErrorBoundary workspaceId={workspaceId} onBack={() => enterApp("dashboard")}><Workspace workspace={workspace} workspaceId={workspaceId} currentUser={currentUser} activeFile={activeFile} setActiveFile={setActiveFile} previewOpen={previewOpen} setPreviewOpen={setPreviewOpen} saved={saved} setSaved={setSaved} bindEditor={bindEditor} onlineUsers={onlineUsers} setOnlineUsers={setOnlineUsers} onSettings={() => setPage("settings")} /></WorkspaceErrorBoundary>}
        {page === "workspace" && !workspaceId && <main className="content"><p className="auth-error">This workspace could not be loaded. Return to Overview and try again.</p><button className="primary-button" onClick={() => enterApp("dashboard")}>Back to overview</button></main>}
        {page === "settings" && <Settings workspace={workspace} workspaceId={workspaceId} setWorkspace={setWorkspace} user={currentUser} onBack={() => setPage("dashboard")} onInvite={() => setPage("invite")} onUpdated={handleWorkspaceUpdated} />}
        {page === "invite" && <InviteUser workspace={workspace} onBack={() => setPage("settings")} onInvite={handleInvite} />}
        {page === "profile" && <Profile user={currentUser} onSave={async (profile) => { const savedProfile = await updateProfile({ ...profile, id: currentUser.id }); const name = savedProfile?.name || profile.name || currentUser.name; const nextUser = { ...currentUser, profile: { ...(currentUser.profile || {}), ...savedProfile, name }, name, color: makeColor(name), initials: initials(name) }; setCurrentUser(nextUser) }} onBack={() => setPage("dashboard")} />}
      </div>
    </div>
  )
}

class WorkspaceErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidUpdate(previousProps) {
    if (previousProps.workspaceId !== this.props.workspaceId && this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="content"><section className="form-section"><p className="kicker">EDITOR UNAVAILABLE</p><h1>We could not open this workspace.</h1><p className="auth-error">{this.state.error.message || "An editor error occurred. Return to your workspaces and try again."}</p><button className="primary-button" onClick={this.props.onBack}>Back to overview</button></section></main>
  }
}

function Landing({ onEnter, onLogin, configured }) {
  return <main className="landing"><nav className="landing-nav"><button className="brand light" onClick={onLogin}><span className="brand-mark">M</span>MergeSpace</button><div><button className="text-button" onClick={onLogin}>Log in</button><button className="nav-cta" onClick={onEnter}>Start building <span>↗</span></button></div></nav><section className="landing-content"><div className="landing-copy"><p className="kicker">THE COLLABORATIVE CODE EDITOR</p><h1>Make it real.<br /><i>Together.</i></h1><p className="landing-lede">A shared space for your team to think, make, and ship at the speed of conversation.</p><button className="primary-button" onClick={onEnter}>Create your workspace <span>↗</span></button><p className="fine-print">{configured ? "Powered by InsForge + PostgreSQL" : "Add InsForge env vars to connect your backend"}</p></div><CodeUniverse /></section><footer className="landing-footer"><div><strong>MergeSpace</strong><span>Built for teams who make things together.</span></div><nav><a href="mailto:support@mergespace.app">Contact us</a><a href="mailto:support@mergespace.app">Support</a></nav><small>© {new Date().getFullYear()} MergeSpace. All rights reserved.</small></footer></main>
}

function LandingExtended({ onEnter, onLogin, configured }) {
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
  return <main className="landing extended-landing"><nav className="landing-nav"><button className="brand light" onClick={() => jump("top")}><span className="brand-mark">M</span>MergeSpace</button><div className="landing-links"><button className="text-button" onClick={() => jump("features")}>Features</button><button className="text-button" onClick={() => jump("how-it-works")}>How it works</button><button className="text-button" onClick={onLogin}>Log in</button><button className="nav-cta" onClick={onEnter}>Start building ↗</button></div></nav><section className="landing-content" id="top"><div className="landing-copy"><p className="kicker">THE COLLABORATIVE CODE EDITOR</p><h1>Make it real.<br /><i>Together.</i></h1><p className="landing-lede">A shared space for pair programming, live reviews, interviews, and the ideas your team ships next.</p><div className="hero-actions"><button className="primary-button" onClick={onEnter}>Create your workspace ↗</button><button className="landing-secondary" onClick={() => jump("how-it-works")}>See how it works</button></div><p className="fine-print">{configured ? "No installs · live editing · join from any browser" : "Add InsForge env vars to connect your backend"}</p></div><CodeUniverse /></section><section className="landing-section" id="features"><p className="kicker">EVERYTHING IN ONE SPACE</p><h2>Built for the way developers actually work together.</h2><p className="section-lede">From a quick fix to a full technical interview, MergeSpace brings the tools your team needs into one focused room.</p><div className="feature-grid"><Feature title="Live multi-cursor editing" text="See each teammate’s cursor, selection, and edits as they happen—without merge conflicts." /><Feature title="Live preview" text="Work on HTML, CSS, and JavaScript together, then review the result without leaving the room." /><Feature title="Workspace permissions" text="Owners manage people and roles. Editors can focus on the work, with the right access every time." /><Feature title="One shared context" text="Keep files, collaborators, and decisions together so every session starts where the last one ended." /></div></section><section className="landing-section steps-section" id="how-it-works"><p className="kicker">FROM ZERO TO COLLABORATING</p><h2>Three steps. No setup.</h2><div className="steps-grid"><Step n="01" title="Open a workspace" text="Start a fresh shared editor in seconds, ready for your files and your people." /><Step n="02" title="Invite your team" text="Send an invitation to the people you trust. They can accept or decline directly from their account." /><Step n="03" title="Build together" text="Type, review, preview, and see who is actively editing in the same live space." /></div></section><section className="landing-section"><p className="kicker">ONE WORKSPACE, MANY JOBS</p><h2>Wherever code needs more than one person.</h2><div className="feature-grid"><Feature title="Pair programming" text="Work through a problem together while both contributors remain in the same source of truth." /><Feature title="Technical interviews" text="Give candidates a focused editor and watch their thinking unfold in real time." /><Feature title="Code reviews" text="Trace a change together, annotate the intent, and move from feedback to a better implementation." /><Feature title="Teaching & mentoring" text="Walk a class through a solution, then let a learner take the keyboard when they are ready." /></div></section><section className="landing-section faq-section"><p className="kicker">GOOD TO KNOW</p><h2>Frequently asked questions</h2><details open><summary>Can more than one person edit a file at once?</summary><p>Yes. Active workspace members can edit together and see live changes, cursors, and the people currently in the room.</p></details><details><summary>Who can manage members and invitations?</summary><p>Only workspace owners can invite, remove, or change another member’s role. Editors have file-editing access only.</p></details><details><summary>Do I need to install anything?</summary><p>No. MergeSpace runs in the browser and keeps your workspace available on desktop, tablet, and mobile.</p></details></section><section className="landing-cta"><p className="kicker">PRESS SHARE. START CODING.</p><h2>Your next workspace is one click away.</h2><p>Open a live editor, invite your team, and start collaborating in seconds.</p><button className="primary-button" onClick={onEnter}>Start building free ↗</button></section><footer className="landing-footer"><div><button className="brand light"><span className="brand-mark">M</span>MergeSpace</button><p>The shared workspace for pair programming, reviews, interviews, and teams that build together.</p></div><div><strong>Product</strong><button onClick={() => jump("features")}>Features</button><button onClick={() => jump("how-it-works")}>How it works</button></div><div><strong>Company</strong><a href="mailto:ankushgupta97412@gmail.com">Contact</a><a href="mailto:ankushgupta97412@gmail.com">Support</a></div><small>© {new Date().getFullYear()} MergeSpace. All rights reserved.</small></footer></main>
}
function Feature({ title, text }) { return <article className="feature-card"><span>✦</span><h3>{title}</h3><p>{text}</p></article> }
function Step({ n, title, text }) { return <article className="step-card"><b>{n}</b><h3>{title}</h3><p>{text}</p></article> }

function CodeUniverse() {
  return <div className="code-universe" aria-hidden="true"><div className="universe-glow" /><div className="code-card card-back"><span className="window-dots">● ● ●</span><code><b>const</b> future = <em>await</em> build();<br />future.<strong>share</strong>(team);</code></div><div className="code-card card-front"><div className="code-card-top"><span className="window-dots">● ● ●</span><span>index.html</span><span>•••</span></div><code><i>01</i> <b>&lt;section</b> <em>class</em>=<u>"future"</u><b>&gt;</b><br /><i>02</i> &nbsp; <b>&lt;h1&gt;</b><span>Make it real.</span><b>&lt;/h1&gt;</b><br /><i>03</i> &nbsp; <b>&lt;p&gt;</b><span className="accent">Together.</span><b>&lt;/p&gt;</b><br /><i>04</i> <b>&lt;/section&gt;</b><br /><i>05</i> <span className="cursor-line">|</span></code><div className="cursor-label">Jordan <span /></div></div><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="floating-tag tag-one">● 2 editors</div><div className="floating-tag tag-two">⌁ Live preview</div></div>
}

function Auth({ mode, onBack, onSubmit, onProvider, onEmailCode, error, configured }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [useCode, setUseCode] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const submit = (event) => {
    event.preventDefault()
    onSubmit({ name: name.trim() || email.split("@")[0], email: email.trim(), password }, mode)
  }
  const handleCodeSubmit = async (event) => { event.preventDefault(); const result = await onEmailCode(email.trim(), codeSent ? event.currentTarget.code.value.trim() : ""); if (result?.sent) setCodeSent(true) }
  return <main className="auth-page"><div className="auth-art"><button className="brand light" onClick={onBack}><span className="brand-mark">M</span>MergeSpace</button><div className="auth-art-copy"><span className="quote-mark">“</span><h2>Great work happens<br />in the <i>in-between.</i></h2><p>Capture the spark. Keep the momentum.</p></div><div className="auth-art-lines"><span /> <span /> <span /></div></div><section className="auth-panel"><button className="back-button" onClick={onBack}>← Back home</button><form className="auth-form" onSubmit={useCode ? handleCodeSubmit : submit}><p className="kicker">{mode === "signup" ? "GET STARTED" : "WELCOME BACK"}</p><h1>{mode === "signup" ? "Create your space." : "Good to see you."}</h1><p className="auth-subtitle">{mode === "signup" ? "Bring your best people together." : "Pick up right where you left off."}</p>{error && <p className="auth-error">{error}</p>}<div className="oauth-row"><button type="button" onClick={() => onProvider("google")} disabled={!configured}><b>G</b> Google</button><button type="button" onClick={() => onProvider("github")} disabled={!configured}><b>◆</b> GitHub</button></div><div className="or"><span />or continue with email<span /></div>{mode === "signup" && !useCode && <label>Your name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Lovelace" /></label>}<label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>{useCode ? codeSent && <label>Verification code<input required name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter the code from your email" /></label> : <label>Password<input required minLength="8" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8+ characters" /></label>}<button className="primary-button wide" type="submit" disabled={!configured}>{useCode ? (codeSent ? "Verify code" : "Send email code") : mode === "signup" ? "Create account" : "Log in"} <span>↗</span></button><button type="button" className="code-toggle" onClick={() => { setUseCode(!useCode); setCodeSent(false) }}>{useCode ? "Use password instead" : "Use a one-time email code"}</button><p className="switch-auth">Your profile is stored in InsForge PostgreSQL and restored on your next visit.</p></form></section></main>
}

function Greeting({ name }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])
  const hour = now.getHours()
  const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  return <>{salutation}, {name} <span className="sun">✦</span></>
}

function Dashboard({ user, error, workspaces, onOpen, onNew, onDelete }) {
  return <main className="content dashboard"><div className="page-heading"><div><p className="kicker">YOUR MERGESPACE</p><h1><Greeting name={user?.name} /></h1><p className="muted">Here's what's happening across your spaces.</p></div><button className="primary-button" onClick={onNew}>+ New workspace</button></div>{error && <p className="auth-error dashboard-error">{error}</p>}<section className="dashboard-grid"><div className="section-block"><div className="section-heading"><h2>Your workspaces</h2><button className="quiet-button">{workspaces.length} total</button></div><div className="workspace-grid">{workspaces.map((item) => <WorkspaceCard key={item.id || item.name} {...item} updated="Ready to build" onOpen={() => onOpen(item.id)} onDelete={() => onDelete(item.id)} />)}</div></div><div className="activity-panel"><div className="section-heading"><h2>Your account</h2></div><Activity name={user?.name} action="owns" file={`${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"}`} time={user?.email} color={user?.color} /><Activity name={user?.name} action="is ready to edit" file="index.html" time="Just now" color={user?.color} /></div></section><div className="dashboard-tip"><span>✦</span><div><strong>Make space for the good stuff.</strong><p>Invite your team and start building something worth sharing.</p></div><button onClick={() => workspaces[0] && onOpen(workspaces[0].id)} disabled={!workspaces.length}>Open your workspace ↗</button></div></main>
}

function ActivityPage({ user, workspaces, onOpen, onJoined }) {
  const [invitations, setInvitations] = useState([])
  const [notice, setNotice] = useState("")
  useEffect(() => { if (user?.email) listMyInvitations().then(setInvitations).catch((error) => setNotice(error.message)) }, [user?.email])
  const respond = async (invitation, accepted) => { try { if (accepted) { await acceptInvitation(invitation.id); await onJoined?.() } else await declineInvitation(invitation.id); setInvitations((current) => current.filter((item) => item.id !== invitation.id)); setNotice(accepted ? "Invitation accepted. Your workspace is ready." : "Invitation declined.") } catch (error) { setNotice(error.message) } }
  return <main className="content dashboard"><div className="page-heading"><div><p className="kicker">WORKSPACE ACTIVITY</p><h1>Stay in the loop.</h1><p className="muted">The latest activity across your MergeSpace workspaces.</p></div></div><section className="activity-panel activity-page">{notice && <p className="auth-error">{notice}</p>}{invitations.length > 0 && <div className="pending-invitations"><h2>Pending invitations</h2>{invitations.map((invitation) => <div className="member-row" key={invitation.id}><span className="avatar small blue">{(invitation.inviter_email || "M")[0].toUpperCase()}</span><span><strong>{invitation.workspace_name || "Workspace"}</strong><small>Invited by {invitation.inviter_email || "workspace owner"} as {invitation.role}</small></span><button className="outline-button" onClick={() => respond(invitation, false)}>Reject</button><button className="primary-button small-button" onClick={() => respond(invitation, true)}>Accept</button></div>)}</div>}<Activity name={user?.name || "You"} action="is active in" file={`${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"}`} time="Just now" color={user?.color} />{workspaces.map((space) => <Activity key={space.id} name={user?.name || "You"} action="created or joined" file={space.name} time="Recently" color={space.color} />)}<button className="primary-button" onClick={onOpen}>Open editor ↗</button></section></main> }

function WorkspaceCard({ name, description, color, updated, onOpen, onDelete, add }) { return <div className={`workspace-card ${add ? "add-card" : ""}`} onClick={onOpen} onKeyDown={(event) => event.key === "Enter" && onOpen()} role="button" tabIndex="0">{add ? <><span className="add-icon">+</span><strong>Create a workspace</strong><small>For your next big idea</small></> : <><div className={`card-art ${color}`}><span className="card-art-shape">{color === "coral" ? "◒" : color === "blue" ? "✦" : "⌁"}</span><span className="card-art-code">{`</>`}</span></div><div className="card-details"><span className="card-status"><span className="status-dot" /> Active <button className="card-delete" onClick={(event) => { event.stopPropagation(); onDelete() }} aria-label={`Delete ${name}`}>×</button></span><h3>{name}</h3><p>{description}</p><small>{updated}</small></div></>}</div> }
function Activity({ name, action, file, time, color }) { return <div className="activity-item"><span className={`avatar small ${color}`}>{name.split(" ").map((part) => part[0]).join("")}</span><p><strong>{name}</strong> {action} <b>{file}</b><small>{time}</small></p></div> }

function LivePreview({ files: workspaceFiles }) {
  const html = workspaceFiles.find((file) => file.language === "html")?.content || ""
  const css = workspaceFiles.find((file) => file.language === "css")?.content || ""
  const javascript = workspaceFiles.find((file) => file.language === "javascript")?.content || ""
  const source = `<!doctype html><html><head><style>${css}</style></head><body>${html}<script>${javascript.replace(/<\/script>/gi, "<\\/script>")}</script></body></html>`
  return <div className="preview-pane external-live-preview"><div className="preview-title"><span>Live preview</span><span className="preview-url">Current file</span></div><iframe className="live-preview-frame" title="Live code preview" srcDoc={source} sandbox="allow-scripts" /></div>
}

function Workspace({ onlineUsers, ...props }) {
  return <WorkspaceEditor {...props} onlineUsers={(onlineUsers || []).filter(Boolean)} />
}

/* Legacy workspace implementation retained below for reference while the
   stable editor implementation follows it. */
/*
function WorkspaceEditor({ workspace, workspaceId, currentUser, activeFile, setActiveFile, previewOpen, setPreviewOpen, saved, setSaved, bindEditor, onlineUsers: rawOnlineUsers, setOnlineUsers, onSettings }) {
  const onlineUsers = (rawOnlineUsers || []).filter(Boolean)
function WorkspaceEditor({
  workspace,
  workspaceId,
  currentUser,
  activeFile,
  setActiveFile,
  previewOpen,
  setPreviewOpen,
  saved,
  setSaved,
  bindEditor,
  onlineUsers: rawOnlineUsers,
  setOnlineUsers,
  onSettings
}) {
  const [workspaceFiles, setWorkspaceFiles] = useState(files)
  const [content, setContent] = useState(initialCode)
  const contentRef = useRef(initialCode)          // tracks latest content without causing re-renders
  const [remoteCursors, setRemoteCursors] = useState([])
  const [memberCount, setMemberCount] = useState(0)
  const [memberCount, setMemberCount] = useState(1)
  const [memberProfiles, setMemberProfiles] = useState([])
  const changeTimer = useRef(null)
  const [socketConnected, setSocketConnected] = useState(false)

  const activeFileRef = useRef(activeFile)
  const editorRef = useRef(null)
  const isRemoteApplyingRef = useRef(false)
  const filesLoadedRef = useRef(false)            // prevents listFiles from resetting tab on every effect re-run
  const visibleFiles = workspaceFiles.length ? workspaceFiles : files
  const providerRef = useRef(null)
  const bindingRef = useRef(null)
  const ydocRef = useRef(null)
  const autoSaveTimerRef = useRef(null)
  const activeFileContentRef = useRef(activeFile?.content || "")

  useEffect(() => {
    activeFileRef.current = activeFile
    activeFileContentRef.current = activeFile?.content || ""
  }, [activeFile])

  // Keep local current user registered in onlineUsers immediately
  // Fetch workspace files and total registered members once per workspaceId.
  // CRITICAL: only depends on [workspaceId] so typing/presence changes never re-run this!
  useEffect(() => {
    if (!currentUser?.id) return
    const me = {
      userId: currentUser.id,
      name: currentUser.name || "You",
      color: currentUser.color || "coral",
      initials: currentUser.initials || "ME",
      lastSeen: Date.now()
    }
    setOnlineUsers((current) => {
      const rest = (current || []).filter((u) => u && u.userId !== currentUser.id)
      return [me, ...rest]
    })
  }, [currentUser?.color, currentUser?.id, currentUser?.initials, currentUser?.name, setOnlineUsers])
    if (!workspaceId || !insforgeConfigured) return
    let isMounted = true

  useEffect(() => {
    if (!workspaceId || !insforgeConfigured || !currentUser?.id) return undefined
    let stopSubscription
    let heartbeatTimer
    let pruneTimer

    // Reset the load guard whenever the workspace changes so files are freshly loaded.
    filesLoadedRef.current = false

    listFiles(workspaceId).then((data) => {
      if (data && data.length && !filesLoadedRef.current) {
        filesLoadedRef.current = true
        setWorkspaceFiles(data)
        setActiveFile(data[0])
        const initialContent = data[0].content || ""
        setContent(initialContent)
        contentRef.current = initialContent
      }
      if (!isMounted || !data || !data.length) return
      setWorkspaceFiles(data)
      // Keep user's current file if it exists in data; only fall back to data[0] if unset/missing
      setActiveFile((curr) => {
        const found = data.find((f) => f.id === curr?.id || f.name === curr?.name)
        return found || data[0]
      })
    }).catch(() => undefined)

    const refreshMemberCount = () => {
    const fetchMembers = () => {
      listMembers(workspaceId).then((members) => {
        if (!isMounted) return
        setMemberCount(members.length)
        setMemberProfiles(members)
      }).catch(() => undefined)
    }
    refreshMemberCount()
    window.addEventListener("focus", refreshMemberCount)

    const sendPresence = (type = "heartbeat") => {
      publishPresence(workspaceId, {
        type,
        user: {
          userId: currentUser.id,
          name: currentUser.name || "Collaborator",
          color: currentUser.color || "coral",
          initials: currentUser.initials || "CO"
    fetchMembers()
    window.addEventListener("focus", fetchMembers)

    return () => {
      isMounted = false
      window.removeEventListener("focus", fetchMembers)
    }
  }, [workspaceId, setActiveFile])

  // Membership is durable state, not socket presence.  The database trigger
  // publishes this event after an invite is accepted, a role changes, or a
  // member is removed, so every open workspace refreshes its total promptly.
  useEffect(() => {
    if (!workspaceId || !insforgeConfigured) return undefined
    let disposed = false
    const refreshMembers = async () => {
      try {
        const members = await listMembers(workspaceId)
        if (!disposed) {
          setMemberCount(members.length)
          setMemberProfiles(members)
        }
      }).catch(() => undefined)
      } catch {
        // The normal focus refresh remains available if a transient socket error occurs.
      }
    }
    let unsubscribe = () => undefined
    subscribeToWorkspace(workspaceId, { onMembershipChanged: refreshMembers })
      .then((cleanup) => { if (disposed) cleanup(); else unsubscribe = cleanup })
      .catch(() => undefined)
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [workspaceId])

    // Announce join immediately
    sendPresence("join")
  // Instant workspace-level presence: join workspace room and receive live active user list.
  // When a member leaves or closes their tab, socket disconnects immediately and count decreases.
  useEffect(() => {
    if (!workspaceId || !currentUser?.id) return

    // Periodic heartbeat to announce continued presence
    heartbeatTimer = window.setInterval(() => {
      sendPresence("heartbeat")
    }, 7000)
    const socketUrl = getSocketUrl()
    const socket = io(socketUrl, { transports: ["websocket", "polling"] })

    // Prune collaborators who haven't sent a heartbeat within 20s (e.g. tab closed without beforeunload)
    pruneTimer = window.setInterval(() => {
      const threshold = Date.now() - 20000
      setOnlineUsers((current) => {
        const pruned = (current || []).filter((user) => {
          if (!user || !user.userId) return false
          if (user.userId === currentUser.id) return true
          return user.lastSeen && user.lastSeen > threshold
        })
        // If someone was pruned, re-fetch the DB count so the footer stays accurate
        // for users who close the tab without firing beforeunload (e.g. browser crash).
        if (pruned.length !== (current || []).length) refreshMemberCount()
        return pruned
      })
    }, 5000)

    const onBeforeUnload = () => {
      sendPresence("leave")
    const userPayload = {
      userId: currentUser.id,
      name: currentUser.name || "Collaborator",
      color: currentUser.color === "mint" ? "#10b981" : currentUser.color === "blue" ? "#3b82f6" : "#ff6b4a",
      initials: currentUser.initials || "CO"
    }
    window.addEventListener("beforeunload", onBeforeUnload)

    subscribeToWorkspace(workspaceId, {
      onPresence: (payload) => {
        if (!payload || !payload.user || payload.user.userId === currentUser.id) return
        const { type, user } = payload
        if (type === "leave") {
          setOnlineUsers((current) => (current || []).filter((u) => u?.userId !== user.userId))
          setRemoteCursors((current) => (current || []).filter((c) => c.userId !== user.userId))
          // Re-fetch the DB member count so the footer count decreases immediately.
          refreshMemberCount()
        } else if (type === "join" || type === "heartbeat") {
          setOnlineUsers((current) => {
            const list = (current || []).filter((u) => u?.userId !== user.userId)
            return [...list, { ...user, lastSeen: Date.now() }]
          })
          if (type === "join") {
            // Respond so new joiner sees existing users immediately
            sendPresence("heartbeat")
          }
    socket.on("connect", () => {
      socket.emit("join-workspace", { workspaceId, user: userPayload })
    })

    socket.on("presence-update", (users) => {
      const seen = new Set()
      const unique = []
      for (const u of users) {
        const k = u.userId || u.name
        if (!seen.has(k)) {
          seen.add(k)
          unique.push(u)
        }
      },
      onFileChange: (changedFile) => {
        // Prevent self-echo which causes cursor jumping
        if (!changedFile || changedFile.senderId === currentUser.id) return
        setWorkspaceFiles((current) => current.map((file) => file.id === changedFile.id ? { ...file, ...changedFile } : file))
        if (changedFile.id === activeFileRef.current?.id) {
          // Do NOT call setContent() here — updating the controlled React `value`
          // prop makes Monaco replace the whole document and reset the cursor for
          // every user. Apply changes directly to the Monaco model via executeEdits
          // so the cursor position is preserved for all collaborators.
          setSaved(false)
          if (editorRef.current) {
            const model = editorRef.current.getModel()
            if (model && model.getValue() !== (changedFile.content || "")) {
              const currentPos = editorRef.current.getPosition()
              const currentSelections = editorRef.current.getSelections()
              const fullRange = model.getFullModelRange()
              isRemoteApplyingRef.current = true
              editorRef.current.executeEdits("remote-peer", [{
                range: fullRange,
                text: changedFile.content || "",
                forceMoveMarkers: true
              }])
              if (currentPos) editorRef.current.setPosition(currentPos)
              if (currentSelections) editorRef.current.setSelections(currentSelections)
              // Defer the flag reset to a microtask: Monaco fires its onChange
              // on the next microtask tick, so the guard must still be true
              // when that fires to prevent re-broadcasting the remote content.
              Promise.resolve().then(() => { isRemoteApplyingRef.current = false })
            }
          }
        }
      },
      onCursorChange: (cursor) => {
        if (!cursor || cursor.userId === currentUser.id) return
        setRemoteCursors((current) => [
          ...current.filter((item) => item?.userId !== cursor.userId),
          cursor
        ])
      }
    }).then((stop) => { stopSubscription = stop }).catch(() => undefined)
      setOnlineUsers(unique.length ? unique : [userPayload])
    })

    return () => {
      window.clearTimeout(changeTimer.current)
      window.clearInterval(heartbeatTimer)
      window.clearInterval(pruneTimer)
      window.removeEventListener("focus", refreshMemberCount)
      window.removeEventListener("beforeunload", onBeforeUnload)
      sendPresence("leave")
      stopSubscription?.()
      socket.emit("leave-workspace", { workspaceId })
      socket.disconnect()
    }
  }, [currentUser?.color, currentUser?.id, currentUser?.initials, currentUser?.name, setActiveFile, setOnlineUsers, setSaved, workspaceId])
  }, [workspaceId, currentUser?.id, currentUser?.name, currentUser?.color, currentUser?.initials, setOnlineUsers])

  const selectFile = (file) => {
    const nextContent = file.content || initialCode
    setActiveFile(file)
    setContent(nextContent)       // drives defaultValue when editor remounts via key change
    contentRef.current = nextContent
    setSaved(true)
  }
  // Debounced auto-save to Postgres
  const debouncedSaveToDb = useCallback(() => {
    window.clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = window.setTimeout(async () => {
      if (!activeFileRef.current?.id || !editorRef.current) return
      const currentCode = editorRef.current.getValue()
      try {
        await saveFile({ ...activeFileRef.current, content: currentCode })
        setSaved(true)
        setWorkspaceFiles((prev) =>
          prev.map((f) => (f.id === activeFileRef.current?.id ? { ...f, content: currentCode } : f))
        )
      } catch {
        // silent auto-save
      }
    }, 1200)
  }, [setSaved])

  // Explicit Save (Ctrl+S or Save button)
  const persistFile = async () => {
    if (activeFile.id) {
      // Prefer live editor value, then ref, then state (triple fallback)
      const latestContent = editorRef.current
        ? editorRef.current.getValue()
        : (contentRef.current ?? content)
      const savedFile = await saveFile({ ...activeFile, content: latestContent })
      setWorkspaceFiles((current) => current.map((file) => file.id === savedFile.id ? savedFile : file))
      // Do NOT call publishFileChange here — broadcastChange (triggered from
      // onChange) already handles real-time propagation with a 120ms debounce.
    window.clearTimeout(autoSaveTimerRef.current)
    if (activeFileRef.current?.id && editorRef.current) {
      const currentCode = editorRef.current.getValue()
      try {
        const savedFile = await saveFile({ ...activeFileRef.current, content: currentCode })
        setWorkspaceFiles((prev) =>
          prev.map((f) => (f.id === savedFile.id ? savedFile : f))
        )
        setSaved(true)
      } catch (err) {
        console.error("Save error:", err)
      }
    }
    setSaved(true)
  }

  const broadcastChange = (nextContent) => {
    if (!workspaceId || !activeFileRef.current?.id) return
    window.clearTimeout(changeTimer.current)
    changeTimer.current = window.setTimeout(() => {
      publishFileChange(workspaceId, {
        ...activeFileRef.current,
        content: nextContent,
        senderId: currentUser?.id
      }).catch(() => undefined)
    }, 120)
  }
  // Setup Yjs real-time collaboration whenever activeFile or workspaceId changes
  useEffect(() => {
    if (!workspaceId || !activeFile?.id) return

  const publishCursor = (editor) => {
    if (!workspaceId || !currentUser || !activeFileRef.current?.id) return
    const position = editor.getPosition()
    if (position) {
      publishCursorChange(workspaceId, {
        userId: currentUser.id,
        name: currentUser.name,
        color: currentUser.color,
        fileId: activeFileRef.current.id,
        lineNumber: position.lineNumber,
        column: position.column
      }).catch(() => undefined)
    // Clean up previous file session
    if (bindingRef.current) {
      bindingRef.current.destroy()
      bindingRef.current = null
    }
    if (providerRef.current) {
      providerRef.current.destroy()
      providerRef.current = null
    }
    if (ydocRef.current) {
      ydocRef.current.destroy()
      ydocRef.current = null
    }

    const socketUrl = getSocketUrl()
    const roomName = `workspace-${workspaceId}-file-${activeFile.id}`
    const doc = new Y.Doc()
    ydocRef.current = doc

    const provider = new SocketIOProvider(socketUrl, roomName, doc, { autoConnect: true })
    providerRef.current = provider

    provider.on("status", ({ status }) => {
      setSocketConnected(status === "connected")
    })

    const ytext = doc.getText("monaco")

    // Wait for the server handshake before seeding a newly created room.  Doing
    // this before sync lets two clients independently seed the document and
    // causes duplicated content, cursor jumps, and tab resets.
    let seeded = false
    const seedAfterSync = (synced) => {
      if (!synced || seeded || ytext.length > 0) return
      seeded = true
      const initialContent = activeFileContentRef.current
      if (initialContent) ytext.insert(0, initialContent)
    }
    provider.on("sync", seedAfterSync)

    // Set local awareness for real-time cursor indicators
    const colorHex = currentUser?.color === "mint" ? "#10b981" : currentUser?.color === "blue" ? "#3b82f6" : "#ff6b4a"
    provider.awareness.setLocalStateField("user", {
      id: currentUser?.id,
      name: currentUser?.name || "You",
      color: colorHex,
      initials: currentUser?.initials || "ME"
    })

    // Listen to Yjs text changes (character-level CRDT)
    const onYTextChange = (_event, transaction) => {
      // The author persists the change.  Remote edits must not restart local
      // save timers or race a tab/file change in this browser.
      if (!transaction.local) return
      setSaved(false)
      debouncedSaveToDb()
    }
    ytext.observe(onYTextChange)

    // Listen to awareness changes: when someone joins or leaves (tab close / disconnect),
    // awareness updates immediately so member count decreases in real time!
    const handleAwareness = () => {
      const states = provider.awareness.getStates()
      const users = []
      states.forEach((state, clientId) => {
        if (state.user) {
          users.push({
            clientId,
            userId: state.user.id || String(clientId),
            name: state.user.name,
            color: state.user.color,
            initials: state.user.initials
          })
        }
      })
      const seen = new Set()
      const unique = []
      for (const u of users) {
        const k = u.userId || u.name
        if (!seen.has(k)) {
          seen.add(k)
          unique.push(u)
        }
      }
      setOnlineUsers(unique.length ? unique : [{
        userId: currentUser?.id,
        name: currentUser?.name || "You",
        color: colorHex,
        initials: currentUser?.initials || "ME"
      }])
    }
    provider.awareness.on("change", handleAwareness)

    // Bind Monaco editor if already mounted
    if (editorRef.current) {
      const model = editorRef.current.getModel()
      if (model) {
        bindingRef.current = new MonacoBinding(
          ytext,
          model,
          new Set([editorRef.current]),
          provider.awareness
        )
      }
    }

    return () => {
      window.clearTimeout(autoSaveTimerRef.current)
      ytext.unobserve(onYTextChange)
      provider.off("sync", seedAfterSync)
      provider.awareness.off("change", handleAwareness)
      if (bindingRef.current) {
        bindingRef.current.destroy()
        bindingRef.current = null
      }
      if (providerRef.current) {
        providerRef.current.destroy()
        providerRef.current = null
      }
      if (ydocRef.current) {
        ydocRef.current.destroy()
        ydocRef.current = null
      }
    }
  }, [activeFile?.id, activeFile?.content, currentUser?.color, currentUser?.id, currentUser?.initials, currentUser?.name, debouncedSaveToDb, setOnlineUsers, setSaved, workspaceId])

  const selectFile = (file) => {
    setActiveFile(file)
    setSaved(true)
  }

  const addFile = async () => {
    const name = window.prompt("File name", "component.html")
    if (!name || !workspaceId) return
    const language = name.endsWith(".css") ? "css" : name.endsWith(".js") ? "javascript" : "html"
    const file = await createFile({ workspace_id: workspaceId, name, language, content: "" })
    setWorkspaceFiles((current) => [...current, file])
    selectFile(file)
  }

  const removeFile = async (file) => {
    if (!file.id || !window.confirm(`Delete ${file.name}?`)) return
    await deleteFile(file.id)
    const deletedIndex = visibleFiles.findIndex((item) => item.id === file.id)
    const remaining = visibleFiles.filter((item) => item.id !== file.id)
    const remaining = workspaceFiles.filter((item) => item.id !== file.id)
    setWorkspaceFiles(remaining)
    if (activeFile.id === file.id) selectFile(remaining[deletedIndex] || remaining[deletedIndex - 1] || files[0])
    if (activeFile.id === file.id) {
      selectFile(remaining[0] || files[0])
    }
  }

  const renameFile = async () => {
    if (!activeFile.id) return
    const name = window.prompt("Rename file", activeFile.name)
    if (!name || name === activeFile.name) return
    const updated = await saveFile({ ...activeFile, name, content })
    setWorkspaceFiles((current) => current.map((file) => file.id === updated.id ? updated : file))
    const updated = await saveFile({ ...activeFile, name })
    setWorkspaceFiles((current) => current.map((file) => (file.id === updated.id ? updated : file)))
    setActiveFile(updated)
  }

  const otherCollaborators = onlineUsers.filter((u) => u.userId !== currentUser?.id)
  const displayPresenceName = (user) => user?.name || memberProfiles.find((member) => member.user_id === user?.userId)?.profile?.name || user?.username || user?.email || "Member"
  const visibleFiles = workspaceFiles.length ? workspaceFiles : files
  const onlineList = (rawOnlineUsers || []).filter(Boolean)
  const otherCollaborators = onlineList.filter((u) => u.userId !== currentUser?.id)
  const displayPresenceName = (user) =>
    user?.name || memberProfiles.find((member) => member.user_id === user?.userId)?.profile?.name || "Member"

  // Live preview files with current active editor content
  const previewFiles = visibleFiles.map((f) =>
    f.id === activeFile?.id && editorRef.current
      ? { ...f, content: editorRef.current.getValue() }
      : f
  )

  return (
    <main className="workspace-page">
      <div className="workspace-header">
        <div>
          <button className="breadcrumb">Workspaces</button>
          <span> / </span>
          <strong>{workspace}</strong>
          <p className="muted">A quiet place for loud ideas.</p>
        </div>
        <div className="workspace-actions">
          <div className="presence-stack">
            {onlineUsers.map((user) => (
            {onlineList.map((user) => (
              <span
                key={user.userId || user.presenceId || user.name}
                className={`avatar small ${user.color || "blue"}`}
                key={user.userId || user.clientId || user.name}
                className="avatar small"
                style={{ backgroundColor: user.color || "var(--coral)", color: "#fff" }}
                title={`${displayPresenceName(user)}${user.userId === currentUser?.id ? " (You)" : ""}`}
              >
                {(displayPresenceName(user)[0] || "M").toUpperCase()}
              </span>
            ))}
            <span
              className="presence-more"
              title={`${onlineUsers.length} active online · ${memberCount} total workspace member${memberCount === 1 ? "" : "s"}`}
              title={`${onlineList.length} active online · ${memberCount} total workspace member${memberCount === 1 ? "" : "s"}`}
            >
              {onlineUsers.length}
              {onlineList.length}
            </span>
          </div>
          <button className="outline-button" onClick={onSettings}>⚙</button>
          <button className="primary-button small-button" onClick={persistFile}>
            {saved ? "Saved" : "Save changes"} <span>⌘S</span>
          </button>
        </div>
      </div>
      <div className="editor-toolbar">
        <div className="file-tabs">
          {visibleFiles.map((file) => (
            <button
              key={file.id || file.name}
              className={activeFile.name === file.name ? "selected" : ""}
              onClick={() => selectFile(file)}
            >
              <span className="file-icon">{file.icon || "<>"}</span>
              {file.name}
              {activeFile.name === file.name && (
                <span
                  className="close-file"
                  onClick={(event) => {
                    event.stopPropagation()
                    removeFile(file)
                  }}
                >
                  ×
                </span>
              )}
            </button>
          ))}
          <button className="new-file" onClick={addFile}>+</button>
        </div>
        <div className="editor-controls">
          <span className="live-label"><span className="status-dot" /> MergeSpace Live</span>
          <span className="live-label">
            <span
              className="status-dot"
              style={{ backgroundColor: socketConnected ? "#5bc38b" : "#eab308" }}
            />
            {socketConnected ? "MergeSpace Live (Synced)" : "Connecting..."}
          </span>
          {otherCollaborators.length > 0 && (
            <span className="live-collaborators">
              {otherCollaborators.map((u) => u.name).join(", ")} active
            </span>
          )}
          <button className="preview-toggle" onClick={() => setPreviewOpen(!previewOpen)}>
            <span className={previewOpen ? "toggle-on" : "toggle-off"} /> {previewOpen ? "Hide preview" : "Show preview"}
          </button>
          <button className="icon-button" onClick={renameFile}>•••</button>
        </div>
      </div>
      <div className={`editor-layout ${previewOpen ? "with-preview" : "full-editor"}`}>
        <div className="editor-pane">
          <div className="editor-title">
            <span className={`language-dot ${activeFile.language}`} />
            {activeFile.name}
            <span className="editor-title-status">{saved ? "Saved just now" : "Unsaved changes"}</span>
          </div>
          <Editor
            key={activeFile.id || activeFile.name}
            height="100%"
            language={activeFile.language}
            defaultValue={content}
            defaultValue=""
            theme="vs-dark"
            onMount={(editor, monaco) => {
              editorRef.current = editor
              bindEditor(editor)

              // Bind Yjs MonacoBinding as soon as editor mounts
              if (ydocRef.current && providerRef.current) {
                const ytext = ydocRef.current.getText("monaco")
                if (bindingRef.current) {
                  bindingRef.current.destroy()
                }
                bindingRef.current = new MonacoBinding(
                  ytext,
                  editor.getModel(),
                  new Set([editor]),
                  providerRef.current.awareness
                )
              }

              if (monaco?.KeyMod && monaco?.KeyCode) {
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                  persistFile()
                })
              }
            }}
            onChange={(value) => {
              if (isRemoteApplyingRef.current) return
              const nextContent = value || ""
              // Only update the ref — do NOT call setContent() here.
              // setContent would re-render and feed the new value back into Monaco
              // via the value prop, resetting the cursor on every keystroke.
              contentRef.current = nextContent
              setSaved(false)
              broadcastChange(nextContent)
            }}
            onCursorPositionChanged={(event) => publishCursor(event.editor)}
            options={{
              readOnly: false,
              minimap: { enabled: false },
              fontSize: 14,
              padding: { top: 18 },
              smoothScrolling: true,
              fontFamily: "'IBM Plex Mono', monospace"
            }}
          />
        </div>
        {remoteCursors.filter((cursor) => cursor.fileId === activeFile.id && cursor.userId !== currentUser?.id).map((cursor) => (
          <span
            key={cursor.userId}
            className={`remote-cursor-label ${cursor.color || "coral"}`}
            style={{ top: `${Math.max(0, cursor.lineNumber - 1) * 21 + 42}px` }}
          >
            {cursor.name || "Collaborator"}
          </span>
        ))}
        {previewOpen && (
          <LivePreview files={visibleFiles} />
          <LivePreview files={previewFiles} />
        )}
      </div>
      <div className="workspace-footer">
        <span>⌘S or Save button to persist</span>
        <span>Connected to MergeSpace room <b>workspace:{workspaceId || "pending"}</b></span>
        <span>
          <span className="status-dot" /> {onlineUsers.length} active now · {memberCount} total member{memberCount === 1 ? "" : "s"}
          <span className="status-dot" style={{ backgroundColor: socketConnected ? "#5bc38b" : "#eab308" }} />
          {onlineList.length} active now · {memberCount} total member{memberCount === 1 ? "" : "s"}
        </span>
      </div>
    </main>
  )
}

*/

function WorkspaceEditor({ workspace, workspaceId, currentUser, activeFile, setActiveFile, previewOpen, setPreviewOpen, saved, setSaved, bindEditor, onlineUsers, setOnlineUsers, onSettings }) {
  const [workspaceFiles, setWorkspaceFiles] = useState([])
  const [memberCount, setMemberCount] = useState(0)
  const [isOwner, setIsOwner] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const editorRef = useRef(null)
  const bindingRef = useRef(null)
  const providerRef = useRef(null)
  const ydocRef = useRef(null)
  const saveTimersRef = useRef(new Map())
  const activeFileRef = useRef(activeFile)

  useEffect(() => { activeFileRef.current = activeFile }, [activeFile])

  const refreshMembers = useCallback(() => {
    if (!workspaceId) return
    listMembers(workspaceId).then((members) => {
      setMemberCount(members.length)
      setIsOwner(members.some((member) => member.user_id === currentUser?.id && member.role === "owner"))
    }).catch(() => undefined)
  }, [workspaceId, currentUser?.id])

  useEffect(() => {
    let mounted = true
    listFiles(workspaceId).then((nextFiles) => {
      if (!mounted || !nextFiles.length) return
      setWorkspaceFiles(nextFiles)
      setActiveFile((current) => nextFiles.find((file) => file.id === current?.id) || nextFiles[0])
    }).catch(() => undefined)
    refreshMembers()
    // Membership is stored in InsForge. Polling is deliberately modest and makes
    // removals visible even when an older deployment has not enabled its trigger.
    const interval = window.setInterval(refreshMembers, 15000)
    window.addEventListener("focus", refreshMembers)
    return () => { mounted = false; window.clearInterval(interval); window.removeEventListener("focus", refreshMembers) }
  }, [workspaceId, setActiveFile, refreshMembers])

  // File list events are separate from the existing character-level Yjs sync.
  // They only keep tabs consistent when an owner creates or deletes a file.
  useEffect(() => {
    if (!workspaceId || !currentUser?.id) return undefined
    let disposed = false
    let unsubscribe = () => undefined
    subscribeToWorkspace(workspaceId, {
      onFileCreated: (file) => {
        if (!file?.id || disposed) return
        setWorkspaceFiles((current) => current.some((item) => item.id === file.id) ? current : [...current, file])
      },
      onFileDeleted: ({ id }) => {
        if (!id || disposed) return
        setWorkspaceFiles((current) => {
          const remaining = current.filter((file) => file.id !== id)
          if (activeFileRef.current?.id === id) setActiveFile(remaining[0] || files[0])
          return remaining
        })
      },
    }).then((cleanup) => { if (disposed) cleanup(); else unsubscribe = cleanup }).catch(() => undefined)
    return () => { disposed = true; unsubscribe() }
  }, [workspaceId, currentUser?.id, setActiveFile])

  const scheduleSave = useCallback((file, content) => {
    if (!file?.id) return
    window.clearTimeout(saveTimersRef.current.get(file.id))
    const timer = window.setTimeout(async () => {
      try {
        await saveFile({ ...file, content })
        setWorkspaceFiles((current) => current.map((item) => item.id === file.id ? { ...item, content } : item))
        setSaved(true)
      } catch { setSaved(false) }
    }, 700)
    saveTimersRef.current.set(file.id, timer)
  }, [setSaved])

  // Presence uses the same Socket.IO server as Yjs, but it is intentionally a
  // separate room. A Yjs awareness client is not a reliable member counter.
  useEffect(() => {
    if (!workspaceId || !currentUser?.id) return undefined
    const socket = io(getSocketUrl(), { transports: ["websocket", "polling"] })
    const user = { userId: currentUser.id, name: currentUser.name || "You", color: currentUser.color || "#ff6b4a", initials: currentUser.initials || "ME" }
    const join = () => socket.emit("join-workspace", { workspaceId, user })
    socket.on("connect", join)
    socket.on("presence-update", (users) => setOnlineUsers?.(Array.isArray(users) ? users : []))
    return () => {
      socket.emit("leave-workspace")
      socket.disconnect()
      setOnlineUsers?.([])
    }
  }, [workspaceId, currentUser?.id, currentUser?.name, currentUser?.color, currentUser?.initials, setOnlineUsers])

  useEffect(() => {
    if (!workspaceId || !activeFile?.id) return undefined
    const file = activeFile
    const ydoc = new Y.Doc()
    // Register sync handlers before opening the socket. With autoConnect, a
    // fast local connection can complete its handshake before `onSync` exists.
    const provider = new SocketIOProvider(getSocketUrl(), `workspace-${workspaceId}-file-${file.id}`, ydoc, { autoConnect: false })
    const ytext = ydoc.getText("monaco")
    ydocRef.current = ydoc
    providerRef.current = provider
    provider.on("status", ({ status }) => setSocketConnected(status === "connected"))
    let binding = null
    const attachBinding = () => {
      if (binding || providerRef.current !== provider) return
      const editor = editorRef.current
      const model = editor?.getModel?.()
      if (!model || model.isDisposed?.()) return
      bindingRef.current?.destroy()
      binding = new MonacoBinding(ytext, model, new Set([editor]), provider.awareness)
      bindingRef.current = binding
    }
    const seedKey = `workspace-${workspaceId}-file-${file.id}`
    const onSync = (synced) => {
      if (!synced) return
      if (!ytext.length && !seededYjsRooms.has(seedKey)) {
        seededYjsRooms.add(seedKey)
        // Do this only after the server sync: the shared Yjs document wins when
        // another collaborator has already created it.
        const initialContent = file.content || ""
        if (initialContent) ytext.insert(0, initialContent)
      }
      // Do not bind an empty, not-yet-synchronized Y.Text to Monaco. That
      // was erasing the visible file while switching/adding/removing tabs.
      attachBinding()
    }
    provider.on("sync", onSync)
    provider.awareness.setLocalStateField("user", { id: currentUser?.id, name: currentUser?.name || "You", color: "#ff6b4a" })
    const onChange = (_event, transaction) => {
      const content = ytext.toString()
      // Preview tracks both local typing and remote Yjs edits immediately.
      setWorkspaceFiles((current) => current.map((item) => item.id === file.id ? { ...item, content } : item))
      if (!transaction.local) return
      setSaved(false)
      scheduleSave(file, content)
    }
    ytext.observe(onChange)
    provider.connect()
    return () => {
      ytext.unobserve(onChange)
      provider.off("sync", onSync)
      // Do not let an old file's delayed cleanup clear a newer binding.
      binding?.destroy()
      if (bindingRef.current === binding) bindingRef.current = null
      provider.destroy(); ydoc.destroy()
      if (providerRef.current === provider) { providerRef.current = null; ydocRef.current = null }
    }
  // `file` is intentionally captured at selection time. Including the whole
  // activeFile object would recreate the CRDT whenever an autosave updates it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, activeFile?.id, currentUser?.id, currentUser?.name, scheduleSave, setSaved])

  useEffect(() => () => {
    for (const timer of saveTimersRef.current.values()) window.clearTimeout(timer)
    saveTimersRef.current.clear()
  }, [])

  const visibleFiles = workspaceFiles.length ? workspaceFiles : files
  const persistNow = () => {
    const file = activeFileRef.current
    if (!file?.id || !editorRef.current || editorRef.current.getModel()?.isDisposed?.()) return
    window.clearTimeout(saveTimersRef.current.get(file.id))
    const content = editorRef.current.getValue()
    saveFile({ ...file, content }).then((savedFile) => {
      setWorkspaceFiles((current) => current.map((item) => item.id === file.id ? savedFile : item))
      setSaved(true)
    }).catch(() => setSaved(false))
  }
  const selectFile = (file) => {
    // Save the currently mounted model before React disposes it for the next
    // tab. This also protects edits made immediately before add/delete.
    const current = activeFileRef.current
    const content = editorRef.current?.getModel?.()?.isDisposed?.() ? null : editorRef.current?.getValue?.()
    if (current?.id && content !== null && content !== undefined) {
      setWorkspaceFiles((items) => items.map((item) => item.id === current.id ? { ...item, content } : item))
      scheduleSave(current, content)
    }
    setActiveFile(file)
    setSaved(true)
  }
  const addFile = async () => {
    if (!isOwner) return
    const name = window.prompt("File name", "index.html")?.trim()
    if (!name || !workspaceId) return
    const language = /\.css$/i.test(name) ? "css" : /\.(js|mjs)$/i.test(name) ? "javascript" : "html"
    try {
      const file = await createFile({ workspace_id: workspaceId, name, language, content: language === "html" ? HTML_BOILERPLATE : "" })
      setWorkspaceFiles((current) => [...current, file])
      selectFile(file)
      publishFileCreated(workspaceId, file).catch(() => undefined)
    } catch {
      setSaved(false)
    }
  }
  const removeFile = async (file) => {
    if (!isOwner || !file?.id || !window.confirm(`Delete ${file.name}?`)) return
    try {
      await deleteFile(file.id)
      setWorkspaceFiles((current) => {
        const remaining = current.filter((item) => item.id !== file.id)
        if (activeFileRef.current?.id === file.id) setActiveFile(remaining[0] || files[0])
        return remaining
      })
      publishFileDeleted(workspaceId, file.id).catch(() => undefined)
    } catch {
      setSaved(false)
    }
  }
  return <main className="workspace-page">
    <div className="workspace-header"><div><button className="breadcrumb">Workspaces</button><span> / </span><strong>{workspace}</strong><p className="muted">A shared, conflict-free coding session.</p></div><div className="workspace-actions"><span className="presence-more" title={`${memberCount} workspace members`}>{onlineUsers.length}</span><button className="outline-button" onClick={onSettings}>⚙</button><button className="primary-button small-button" onClick={persistNow}>{saved ? "Saved" : "Save changes"}</button></div></div>
    <div className="editor-toolbar"><div className="file-tabs">{visibleFiles.map((file) => <button key={file.id || file.name} className={activeFile?.id === file.id ? "selected" : ""} onClick={() => selectFile(file)}><span className="file-icon">{file.icon || "<>"}</span>{file.name}{isOwner && <span className="close-file" role="button" aria-label={`Delete ${file.name}`} onClick={(event) => { event.stopPropagation(); removeFile(file) }}>×</span>}</button>)}{isOwner && <button className="new-file" aria-label="Create file" onClick={addFile}>+</button>}</div><div className="editor-controls"><span className="live-label"><span className="status-dot" style={{ backgroundColor: socketConnected ? "#5bc38b" : "#eab308" }} />{socketConnected ? "Live synced" : "Connecting…"}</span><button className="preview-toggle" onClick={() => setPreviewOpen(!previewOpen)}>{previewOpen ? "Hide preview" : "Show preview"}</button></div></div>
    <div className={`editor-layout ${previewOpen ? "with-preview" : "full-editor"}`}><div className="editor-pane"><div className="editor-title">{activeFile?.name}<span className="editor-title-status">{saved ? "Saved" : "Unsaved changes"}</span></div><Editor key={activeFile?.id || activeFile?.name} height="100%" language={activeFile?.language} defaultValue="" theme="vs-dark" onMount={(editor, monaco) => { editorRef.current = editor; bindEditor(editor); configureEditorCompletions(monaco); editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, persistNow) }} onChange={(value) => { const current = activeFileRef.current; if (!current?.id) return; const content = value || ""; setWorkspaceFiles((items) => items.map((item) => item.id === current.id ? { ...item, content } : item)); setSaved(false); scheduleSave(current, content) }} options={{ minimap: { enabled: false },fontSize: 14, padding: { top: 18 }, smoothScrolling: true, quickSuggestions: { other: true, comments: false, strings: true }, suggestOnTriggerCharacters: true, tabCompletion: "on" }} /></div>{previewOpen && <LivePreview files={visibleFiles} />}</div>
    <div className="workspace-footer"><span>Edits sync live with Yjs CRDT</span><span>{onlineUsers.length} active now · {memberCount} total members</span></div>
  </main>
}

function Settings({ workspace, workspaceId, setWorkspace, user, onBack, onInvite, onUpdated }) {
  const [name, setName] = useState(workspace)
  const [description, setDescription] = useState("A quiet place for loud ideas.")
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [notice, setNotice] = useState("")
  const isOwner = members.some((member) => member.user_id === user?.id && member.role === "owner")

  useEffect(() => {
    if (!workspaceId) return undefined
    let mounted = true
    const refresh = () => Promise.all([listMembers(workspaceId), listInvitations(workspaceId)]).then(([nextMembers, nextInvitations]) => {
      if (!mounted) return
      setMembers(nextMembers)
      setInvitations(nextInvitations)
    }).catch((error) => mounted && setNotice(error.message))
    refresh()
    const interval = window.setInterval(refresh, 15000)
    window.addEventListener("focus", refresh)
    return () => { mounted = false; window.clearInterval(interval); window.removeEventListener("focus", refresh) }
  }, [workspaceId])

  const saveDetails = async () => {
    const updated = await updateWorkspace(workspaceId, { name: name.trim(), description })
    setWorkspace(updated.name)
    onUpdated(updated)
    setNotice("Workspace details saved")
  }

  const changeRole = async (memberId, role) => {
    if (!isOwner) return
    const updated = await updateMemberRole(memberId, role)
    setMembers((current) => current.map((member) => member.id === updated.id ? { ...member, role: updated.role } : member))
  }

  const remove = async (memberId) => {
    if (!isOwner) return
    await removeMember(memberId)
    setMembers((current) => current.filter((member) => member.id !== memberId))
  }

  return <main className="content settings-page"><button className="breadcrumb" onClick={onBack}>← Back to workspace</button><div className="settings-heading"><p className="kicker">WORKSPACE SETTINGS</p><h1>{workspace}</h1><p className="muted">{isOwner ? "Manage your space, people, and permissions." : "Editors can change files; workspace administration is owner-only."}</p></div><div className="settings-layout"><nav className="settings-nav"><button className="selected">General</button><button>Members <em>{members.length}</em></button><button>Invitations <em>{invitations.length}</em></button><button>Danger zone</button></nav><section className="settings-form">{notice && <p className="auth-error">{notice}</p>}<div className="form-section"><h2>Workspace details</h2><p className="muted">This is how your workspace appears to members.</p><label>Workspace name<input value={name} disabled={!isOwner} onChange={(event) => setName(event.target.value)} /></label><label>Workspace description<textarea value={description} disabled={!isOwner} onChange={(event) => setDescription(event.target.value)} /></label>{isOwner && <button className="primary-button" onClick={saveDetails}>Save changes <span>↗</span></button>}</div><div className="form-section members-section"><div className="section-heading"><div><h2>Members</h2><p className="muted">People with access to this workspace.</p></div>{isOwner && <button className="outline-button" onClick={onInvite}>+ Invite</button>}</div>{members.map((member) => <div className="member-row" key={member.id}><span className={`avatar ${member.role === "owner" ? "coral" : "mint"}`}>{initials(member.profile?.name || member.user_id)}</span><span><strong>{member.profile?.name || "Workspace member"}</strong><small>{member.profile?.id || member.user_id}</small></span><select className={`role role-${member.role}`} value={member.role} disabled={!isOwner || member.user_id === user?.id} onChange={(event) => changeRole(member.id, event.target.value)}><option value="owner">Owner</option><option value="editor">Editor</option></select>{isOwner && member.user_id !== user?.id && <button className="icon-button" onClick={() => remove(member.id)} aria-label="Remove member">×</button>}</div>)}</div>{isOwner && <div className="form-section"><div className="section-heading"><div><h2>Pending invitations</h2><p className="muted">Invitations waiting for a response.</p></div><button className="outline-button" onClick={onInvite}>+ Invite</button></div>{invitations.length ? invitations.map((invitation) => <div className="member-row" key={invitation.id}><span className="avatar small blue">@</span><span><strong>{invitation.email}</strong><small>{invitation.role} · {invitation.status}</small></span></div>) : <p className="muted">No pending invitations.</p>}</div>}</section></div></main>
}
function InviteUser({ workspace, onBack, onInvite }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("editor")
  const [error, setError] = useState("")
  const submit = async (event) => {
    event.preventDefault()
    try { await onInvite({ email, role }) } catch (inviteError) { setError(inviteError.message) }
  }
  return <main className="content settings-page"><button className="breadcrumb" onClick={onBack}>← Back to settings</button><div className="settings-heading"><p className="kicker">INVITE USER</p><h1>Bring someone in.</h1><p className="muted">Invite a collaborator to {workspace}.</p></div><form className="settings-form form-section" onSubmit={submit}><h2>Invite by email</h2><p className="muted">They'll receive an invitation with a secure link to join.</p>{error && <p className="auth-error">{error}</p>}<label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="collaborator@example.com" /></label><label>Workspace role<select value={role} onChange={(event) => setRole(event.target.value)}><option value="editor">Editor - can edit files</option><option value="owner">Owner - can manage the workspace</option></select></label><button className="primary-button" type="submit">Send invitation <span>↗</span></button></form></main>
}
function Profile({ user, onSave, onBack }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name || "")
  const [error, setError] = useState("")
  const save = async () => {
    const nextName = name.trim()
    if (!nextName) { setError("Display name cannot be empty."); return }
    try { setError(""); await onSave({ name: nextName, color: makeColor(nextName) }); setEditing(false) }
    catch (saveError) { setError(saveError.message || "Could not save your profile.") }
  }
  return <main className="content profile-page"><button className="breadcrumb" onClick={onBack}>← Back to overview</button><div className="profile-card"><span className={`avatar profile-avatar ${user?.color}`}>{user?.initials}</span><p className="kicker">YOUR PROFILE</p>{editing ? <label className="profile-edit-label">Display name<input value={name} onChange={(event) => setName(event.target.value)} /></label> : <h1>{user?.name}</h1>}<p className="muted">{user?.email}</p>{error && <p className="auth-error">{error}</p>}{editing ? <button className="primary-button" onClick={save}>Save profile <span>↗</span></button> : <button className="outline-button" onClick={() => setEditing(true)}>Edit profile</button>}<div className="profile-stats"><span><strong>1</strong><small>Workspaces</small></span><span><strong>0</strong><small>Files created</small></span><span><strong>1</strong><small>Collaborators</small></span></div></div></main> }

export default App
