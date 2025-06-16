function loadForm(roomType) {
  let formContentDiv = document.getElementById("room-form");
  if (roomType == "join-room") {
    formContentDiv.innerHTML = `<form method="post">
        <input type="hidden" value="join-room" id="request-type" name="request-type">
        <input type="text" id="name" name="name" placeholder="Enter Name">
        <input type="text" id="room-code" name="room-code" placeholder="Enter Room Code">
        <button type="submit">Join</button>
        </form>`;
  } else if (roomType == "create-room") {
    formContentDiv.innerHTML = `<form method="post">
        <input type="hidden" value="create-room" id="request-type" name="request-type">
        <input type="text" id="name" name="name" placeholder="Enter Name">
        <button type="submit">Create</button>
        </form>`;
  }
}

var socketio = io();

function sendMessage() {
  const message = document.getElementById("message");
  if (message.value == "") return;
  socketio.emit("message", { data: message.value });
  message.value = "";
}

function createMessage(name, message, datetime) {
  const content = `
    <div>
        <span>
            <strong>${name}</strong>: ${message} 
        </span>
        <span class="muted"> ${datetime} </span>
    </div>
    `;
  messages.innerHTML += content;
}

socketio.on("message", (data) => {
  createMessage(data.name, data.message, data.datetime);
});

const peer = new RTCPeerConnection({
  iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
});

window.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("/room")) return;

  const localVideo = document.querySelector("#local-video");
  const remoteVideo = document.querySelector("#remote-video");
  const username = document.getElementById("username").textContent;
  const room = document.getElementById("room").textContent;
  const peers = {};
  let localStream;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localVideo.srcObject = localStream;
    localVideo.muted = true;

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });
    peers["remote"] = peer;

    localStream
      .getTracks()
      .forEach((track) => peer.addTrack(track, localStream));

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socketio.emit("ice-candidate", { candidate: event.candidate });
      }
    };

    peer.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socketio.emit("call", { offer });
  } catch (e) {
    console.error("Media error:", e);
  }

  socketio.on("new-peer-offer", async ({ peer: remoteUser, offer }) => {
    if (remoteUser === username) return;

    const remotePeer = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });
    peers["remote"] = remotePeer;

    localStream
      .getTracks()
      .forEach((track) => remotePeer.addTrack(track, localStream));

    remotePeer.onicecandidate = (event) => {
      if (event.candidate) {
        socketio.emit("ice-candidate", { candidate: event.candidate });
      }
    };

    remotePeer.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };

    await remotePeer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await remotePeer.createAnswer();
    await remotePeer.setLocalDescription(answer);
    socketio.emit("answer", { to: remoteUser, answer });
  });

  socketio.on("peer-answer", async ({ answer }) => {
    const remotePeer = peers["remote"];
    if (!remotePeer) return;
    await remotePeer.setRemoteDescription(new RTCSessionDescription(answer));
  });

  socketio.on("ice-candidate", async ({ candidate }) => {
    const remotePeer = peers["remote"];
    if (remotePeer && candidate) {
      try {
        await remotePeer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding received ICE candidate", err);
      }
    }
  });
});
