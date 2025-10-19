function loadForm(roomType) {
  const formContentDiv = document.getElementById("room-form");
  const tiles = document.getElementById("tile-section");

  let formHTML = "";

  if (roomType === "join-room") {
    formHTML = `
      <form method="post" class="styled-form">
        <input type="hidden" value="join-room" name="request-type">
        <input type="text" name="name" placeholder="Your Name" required />
        <input type="text" name="room-code" placeholder="Room Code" required />
        <button type="submit">Join Room</button>
      </form>
    `;
  } else {
    formHTML = `
      <form method="post" class="styled-form">
        <input type="hidden" value="create-room" name="request-type">
        <input type="text" name="name" placeholder="Your Name" required />
        <button type="submit">Create Room</button>
      </form>
    `;
  }

  tiles.style.display = "none";
  formContentDiv.classList.remove("hidden");
  formContentDiv.innerHTML = formHTML;
  setTimeout(() => {
    formContentDiv.classList.add("show");
  }, 10);
}

function toggleChat() {
  const chatSidebar = document.getElementById("chat-sidebar");
  chatSidebar.classList.toggle("active");

  if (chatSidebar.classList.contains("active")) {
    document.body.classList.add("chat-open");
  } else {
    document.body.classList.remove("chat-open");
  }
}

function copyRoomCode() {
  const code = document.getElementById("room-code-text").textContent;
  navigator.clipboard.writeText(code);
  const btn = document.getElementById("copy-room-code");
  btn.textContent = "✅";
  setTimeout(() => (btn.textContent = "📋"), 1200);
}

function openForm(mode) {
  const tiles = document.getElementById("tile-section");
  const formWrapper = document.getElementById("form-wrapper");

  tiles.classList.add("fade-out");
  setTimeout(() => {
    tiles.style.display = "none";
    formWrapper.classList.remove("hidden");
    formWrapper.classList.add("fade-in");
    switchMode(mode);
  }, 300);

  const dynamicForm = document.getElementById("dynamic-form");
  dynamicForm.onsubmit = handleFormSubmit;
}

function handleFormSubmit(event) {
  event.preventDefault();

  const formType = document.getElementById("formType").value;
  const name = document.getElementById("name").value.trim();
  const roomCodeInput = document.getElementById("room-code");
  const roomCode = roomCodeInput && roomCodeInput.value.trim();

  if (!name) {
    alert("Please enter your name.");
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("request-type", formType);

  if (formType === "join-room") {
    if (!roomCode) {
      alert("Please enter a room code to join.");
      return;
    }
    formData.append("room-code", roomCode);
  }

  fetch("/", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (response.redirected) {
        window.location.href = response.url;
      } else {
        return response.text().then((text) => {
          console.error("Unexpected response:", text);
          alert("Error joining/creating room.");
        });
      }
    })
    .catch((err) => {
      console.error("Submission error:", err);
      alert("Something went wrong. Please try again.");
    });
}

function switchMode(mode) {
  const joinTab = document.getElementById("join-tab");
  const createTab = document.getElementById("create-tab");
  const formType = document.getElementById("formType");
  const roomCodeInput = document.getElementById("room-code");
  const submitBtn = document.getElementById("form-submit");

  if (mode === "join") {
    joinTab.classList.add("active");
    createTab.classList.remove("active");
    formType.value = "join-room";
    roomCodeInput.style.display = "block";
    roomCodeInput.disabled = false;
    roomCodeInput.required = true;
    roomCodeInput.placeholder = "Enter Room Code";
    submitBtn.textContent = "Enter Meeting";
  } else {
    createTab.classList.add("active");
    joinTab.classList.remove("active");
    formType.value = "create-room";
    roomCodeInput.disabled = true;
    roomCodeInput.required = false;
    roomCodeInput.style.display = "none";
    submitBtn.textContent = "Start Meeting";
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("/room")) return;

  const localVideo = document.querySelector("#local-video");
  const remoteVideo = document.querySelector("#remote-video");
  const username = document.getElementById("username").textContent;
  const room = document.getElementById("room").textContent;
  const messages = document.getElementById("messages");
  const socketio = io();

  let localStream;
  let peerConnection = null;

  function addMessage(content) {
    const div = document.createElement("div");
    const isSelf = content.name === username;
    div.className = isSelf ? "chat-bubble self" : "chat-bubble other";
    div.textContent = content.message;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;
    localVideo.onloadedmetadata = () => {
      localVideo.play();
      updateVideoLayout();
    };
    localVideo.muted = true;
  } catch (err) {
    console.error("Camera error:", err);
    alert("Cannot access camera/microphone");
  }

  socketio.emit("join-room", { room, username });

  socketio.on("user-joined", ({ username }) => {
    console.log(`${username} joined the room`);
  });

  socketio.on("user-left", ({ username }) => {
    console.log(`${username} left the room`);
    remoteVideo.srcObject = null;
    updateVideoLayout();
  });

  socketio.on("new-user", async ({ username: remoteUser }) => {
    console.log(`${remoteUser} connected`);
    await createPeerConnection(remoteUser, true);
  });

  socketio.on("offer", async ({ from, offer }) => {
    await createPeerConnection(from, false, offer);
  });

  socketio.on("answer", async ({ from, answer }) => {
    if (peerConnection) {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    }
  });

  socketio.on("ice-candidate", async ({ from, candidate }) => {
    if (peerConnection && candidate) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    }
  });

  async function createPeerConnection(remoteUser, isInitiator, offer = null) {
    peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });

    localStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketio.emit("ice-candidate", {
          to: remoteUser,
          room,
          candidate: event.candidate,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      remoteVideo.srcObject = stream;
      remoteVideo.onloadedmetadata = () => {
        remoteVideo.play();
        remoteVideo.style.display = "block";
        updateVideoLayout();
      };
    };

    if (isInitiator) {
      const offerDesc = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offerDesc);
      socketio.emit("offer", { to: remoteUser, room, offer: offerDesc });
    } else if (offer) {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socketio.emit("answer", { to: remoteUser, room, answer });
    }
  }

  function updateVideoLayout() {
    const grid = document.querySelector(".video-grid");
    const localVideo = document.getElementById("local-video");
    const remoteVideo = document.getElementById("remote-video");

    if (remoteVideo.srcObject) {
      grid.classList.remove("single");
      grid.classList.add("dual");
      remoteVideo.style.display = "block";
      localVideo.style.display = "block";
      if (!grid.contains(remoteVideo)) grid.appendChild(remoteVideo);
      if (!grid.contains(localVideo)) grid.appendChild(localVideo);
    } else {
      grid.classList.remove("dual");
      grid.classList.add("single");
      localVideo.style.display = "block";
      remoteVideo.style.display = "none";
      if (!grid.contains(localVideo)) grid.appendChild(localVideo);
    }
  }

  function sendMessage() {
    const msgBox = document.getElementById("message");
    const text = msgBox.value.trim();
    if (!text) return;
    socketio.emit("message", { room, name: username, data: text });
    msgBox.value = "";
    msgBox.focus();
  }

  window.sendMessage = sendMessage;

  const msgBox = document.getElementById("message");
  if (msgBox) {
    msgBox.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
  }

  const leaveBtn = document.getElementById("leave-room");
  if (leaveBtn) {
    leaveBtn.addEventListener("click", () => {
      const localVideo = document.getElementById("local-video");
      if (localVideo?.srcObject) {
        localVideo.srcObject.getTracks().forEach((track) => track.stop());
      }
      window.location.href = "/";
    });
  }

  socketio.on("message", (data) => {
    addMessage({ name: data.name, message: data.data });
  });
});

function updateVideoLayout() {
  const grid = document.querySelector(".video-grid");
  const localVideo = document.getElementById("local-video");
  const remoteVideo = document.getElementById("remote-video");

  if (remoteVideo.srcObject) {
    grid.classList.remove("single");
    grid.classList.add("dual");
    grid.innerHTML = "";
    grid.appendChild(remoteVideo);
    grid.appendChild(localVideo);
  } else {
    grid.classList.remove("dual");
    grid.classList.add("single");
    grid.innerHTML = "";
    grid.appendChild(localVideo);
  }
}
