function loadForm(roomType){
    let formContentDiv = document.getElementById("room-form")
    if (roomType == "join-room"){
        formContentDiv.innerHTML = `<form method="post">
        <input type="hidden" value="join-room" id="request-type" name="request-type">
        <input type="text" id="name" name="name" placeholder="Enter Name">
        <input type="text" id="room-code" name="room-code" placeholder="Enter Room Code">
        <button type="submit">Join</button>
        </form>`;
    }
    else if (roomType == "create-room"){
        formContentDiv.innerHTML = `<form method="post">
        <input type="hidden" value="create-room" id="request-type" name="request-type">
        <input type="text" id="name" name="name" placeholder="Enter Name">
        <button type="submit">Create</button>
        </form>`;
    }
}

var socketio = io();

function sendMessage(){
    const message = document.getElementById("message")
    if (message.value == "") return;
    socketio.emit("message", { data: message.value })
    message.value=""
}

function createMessage(name, message, datetime){
    const content =`
    <div>
        <span>
            <strong>${name}</strong>: ${message} 
        </span>
        <span class="muted"> ${datetime} </span>
    </div>
    `
    messages.innerHTML += content
}

socketio.on("message", (data) =>{
    createMessage(data.name, data.message, data.datetime)
})