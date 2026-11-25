import express from "express";
import http from "http";
import { Server } from "socket.io";
import { randomBytes } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();
const TTL = 15 * 60 * 1000;

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true }));

function makeCode() { return randomBytes(16).toString("hex"); }
function cleanExpired() {
  const now = Date.now();
  for (const [code, room] of rooms) if (room.expires < now) rooms.delete(code);
}
setInterval(cleanExpired, 60_000).unref();

io.on("connection", socket => {
  socket.on("create-room", ack => {
    cleanExpired();
    const code = makeCode();
    rooms.set(code, { owner: socket.id, viewer: null, expires: Date.now() + TTL });
    socket.join(code);
    ack?.({ ok: true, code, expiresInSeconds: TTL / 1000 });
  });

  socket.on("join-room", ({ code, role }, ack) => {
    cleanExpired();
    const room = rooms.get(code);
    if (!room || !["owner", "viewer"].includes(role)) {
      ack?.({ ok: false, error: "This link is invalid or has expired. Ask for a new link." });
      return;
    }
    if (role === "owner") {
      if (room.owner !== socket.id && io.sockets.sockets.has(room.owner)) {
        ack?.({ ok: false, error: "The camera owner is already connected." });
        return;
      }
      room.owner = socket.id;
    } else {
      if (room.viewer && io.sockets.sockets.has(room.viewer)) {
        ack?.({ ok: false, error: "A viewer is already connected." });
        return;
      }
      room.viewer = socket.id;
    }
    socket.join(code);
    ack?.({ ok: true });
    if (role === "viewer") io.to(room.owner).emit("viewer-ready");
    if (role === "owner" && room.viewer) socket.emit("viewer-ready");
  });

  for (const event of ["offer", "answer", "ice-candidate", "sharing-stopped"]) {
    socket.on(event, ({ code, data }) => {
      const room = rooms.get(code);
      if (!room) return;
      const target = socket.id === room.owner ? room.viewer : room.owner;
      if (target) io.to(target).emit(event, { data });
      if (event === "sharing-stopped") {
        rooms.delete(code);
        io.to(code).emit("session-ended");
      }
    });
  }

  socket.on("disconnect", () => {
    for (const [code, room] of rooms) {
      if (room.owner === socket.id) {
        if (room.viewer) io.to(room.viewer).emit("session-ended");
        rooms.delete(code);
      } else if (room.viewer === socket.id) {
        room.viewer = null;
        io.to(room.owner).emit("viewer-left");
      }
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Consent camera app listening on ${port}`));
