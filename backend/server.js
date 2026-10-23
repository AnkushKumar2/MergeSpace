import express from "express"
import compression from "compression"
import { createServer } from "http"
import { Server } from "socket.io"
import { YSocketIO } from "y-socket.io/dist/server"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const publicDir = path.join(__dirname, "public")

app.disable("x-powered-by")
// The app runs behind a hosting proxy that terminates TLS; trust its forwarded headers.
app.set("trust proxy", 1)

// Force HTTPS: if the proxy says the visitor used plain http, send them to https.
// /health is exempt so platform health checks keep working. Local development has no
// forwarded header, so nothing is redirected there.
app.use((req, res, next) => {
  if (req.path !== "/health" && req.headers["x-forwarded-proto"] === "http") {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`)
  }
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  res.setHeader("X-Frame-Options", "SAMEORIGIN")
  res.setHeader("Permissions-Policy", "camera=(), geolocation=()")
  next()
})

// gzip/brotli-style compression for HTML, CSS, JS and JSON (the JS bundle is ~2.9 MB raw).
app.use(compression())

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        // Vite fingerprints these file names, so they can be cached for a year.
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
      } else if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache")
      } else {
        res.setHeader("Cache-Control", "public, max-age=86400")
      }
    }
  }))
}

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } })
// Persist each CRDT room so reconnecting, switching files, or restarting the
// container does not recreate an empty room that clients seed a second time.
new YSocketIO(io, { levelPersistenceDir: process.env.YJS_DATA_DIR || path.join(__dirname, ".yjs") }).initialize()

const presence = new Map()
io.on("connection", (socket) => {
  let workspaceId = null
  const broadcast = () => io.to(`presence:${workspaceId}`).emit("presence-update", Array.from(presence.get(workspaceId)?.values() || []))
  socket.on("join-workspace", ({ workspaceId: id, user }) => {
    if (!id || !user) return
    if (workspaceId && workspaceId !== id) leave()
    workspaceId = id; socket.join(`presence:${id}`)
    if (!presence.has(id)) presence.set(id, new Map())
    presence.get(id).set(socket.id, user); broadcast()
  })
  const leave = () => {
    if (!workspaceId) return
    presence.get(workspaceId)?.delete(socket.id); broadcast()
    if (!presence.get(workspaceId)?.size) presence.delete(workspaceId)
    workspaceId = null
  }
  socket.on("leave-workspace", leave)
  socket.on("disconnect", leave)
})
app.get("/health", (_req, res) => res.status(200).json({ message: "ok", success: true }))

// Pages the single-page app knows. Anything else answers with a real 404 status
// (the app shows its "page not found" screen), so search engines do not index junk URLs.
const KNOWN_PAGES = new Set(["/", "/index.html", "/privacy", "/terms"])
app.use((req, res) => {
  const index = path.join(publicDir, "index.html")
  if (!fs.existsSync(index)) return res.status(404).send("Frontend build is missing")
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(404).type("text/plain").send("Not found")
  const pagePath = req.path.replace(/\/+$/, "") || "/"
  // A missing file (robots.txt, an old /assets/*.js, ...) is a plain 404, not the app.
  if (path.extname(pagePath)) return res.status(404).type("text/plain").send("Not found")
  res.status(KNOWN_PAGES.has(pagePath) ? 200 : 404).set("Cache-Control", "no-cache").sendFile(index)
})
httpServer.listen(Number(process.env.PORT) || 3000, () => console.log(`Server is running on port ${Number(process.env.PORT) || 3000}`))
