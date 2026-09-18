import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { YSocketIO } from "y-socket.io/dist/server"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const publicDir = path.join(__dirname, "public")
if (fs.existsSync(publicDir)) app.use(express.static(publicDir))
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
app.use((_req, res) => {
  const index = path.join(publicDir, "index.html")
  if (fs.existsSync(index)) res.sendFile(index)
  else res.status(404).send("Frontend build is missing")
})
httpServer.listen(Number(process.env.PORT) || 3000, () => console.log("Server is running on port 3000"))
