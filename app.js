const socket = io();
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const mode = params.get("mode");
const code = params.get("room");
let pc = null, stream = null;

function show(id) { $(id).classList.remove("hidden"); }
function hide(id) { $(id).classList.add("hidden"); }
function status(id, msg) { $(id).textContent = msg; }
function makePeer() {
  pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  pc.onicecandidate = e => {
    if (e.candidate) socket.emit("ice-candidate", { code, data: e.candidate });
  };
  return pc;
}

if (mode === "share" && code) {
  hide("home"); show("share");
} else if (mode === "watch" && code) {
  hide("home"); show("watch");
  socket.emit("join-room", { code, role: "viewer" }, result => {
    if (!result?.ok) status("watchStatus", result?.error || "Could not join session.");
  });
}

$("createBtn").onclick = () => {
  $("createBtn").disabled = true;
  socket.emit("create-room", result => {
    $("createBtn").disabled = false;
    if (!result?.ok) return alert("Could not create a link. Please try again.");
    const share = `${location.origin}/?mode=share&room=${result.code}`;
    const watch = `${location.origin}/?mode=watch&room=${result.code}`;
    $("shareUrl").value = share;
    $("watchLink").href = watch;
    show("created");
  });
};
$("copyBtn").onclick = async () => {
  try { await navigator.clipboard.writeText($("shareUrl").value); $("copyBtn").textContent = "Copied"; }
  catch { $("shareUrl").select(); document.execCommand("copy"); $("copyBtn").textContent = "Copied"; }
};

socket.on("viewer-ready", async () => {
  if (!stream || !pc) return;
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { code, data: offer });
    status("shareStatus", "Secure connection is being established…");
  } catch { status("shareStatus", "Could not establish the connection."); }
});

$("startBtn").onclick = async () => {
  $("startBtn").disabled = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    $("localVideo").srcObject = stream; show("localVideo");
    makePeer();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    socket.emit("join-room", { code, role: "owner" }, result => {
      if (!result?.ok) {
        status("shareStatus", result?.error || "Could not start sharing.");
        stream.getTracks().forEach(t => t.stop()); stream = null;
        $("startBtn").disabled = false; return;
      }
      status("shareStatus", "Camera is on. Live video is being shared. Press Stop sharing to end.");
      show("stopBtn");
      hide("startBtn");
    });
  } catch (err) {
    status("shareStatus", err.name === "NotAllowedError" ? "Camera permission was denied." : "Could not access the camera. Check browser permissions and use HTTPS.");
    $("startBtn").disabled = false;
  }
};

socket.on("offer", async ({ data }) => {
  if (mode !== "watch") return;
  try {
    makePeer();
    pc.ontrack = e => {
      $("remoteVideo").srcObject = e.streams[0];
      status("watchStatus", "Connected. Live camera is streaming.");
    };
    await pc.setRemoteDescription(data);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { code, data: answer });
  } catch { status("watchStatus", "Connection failed. Ask the camera owner to try again."); }
});
socket.on("answer", async ({ data }) => {
  if (pc) try { await pc.setRemoteDescription(data); } catch {}
});
socket.on("ice-candidate", async ({ data }) => {
  if (pc) try { await pc.addIceCandidate(data); } catch {}
});
socket.on("viewer-left", () => status("shareStatus", "The viewer disconnected. Your camera is still on; press Stop sharing to end."));
socket.on("session-ended", () => {
  status("watchStatus", "The camera owner ended the session.");
  if (pc) pc.close(); pc = null;
  if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
});
$("stopBtn").onclick = () => {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  if (pc) pc.close(); pc = null;
  socket.emit("sharing-stopped", { code, data: null });
  hide("localVideo"); hide("stopBtn"); show("startBtn");
  $("startBtn").disabled = false;
  status("shareStatus", "You stopped sharing.");
};
window.addEventListener("beforeunload", () => {
  if (stream) stream.getTracks().forEach(t => t.stop());
});