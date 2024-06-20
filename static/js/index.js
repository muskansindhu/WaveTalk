function loadForm(roomType){
    let formContentDiv = document.getElementById("room-form")
    if (roomType == "join-room"){
        formContentDiv.innerHTML = `<form action="/join-room" method="post">
        <input type="text" id="name" name="name" placeholder="Enter Name">
        <input type="text" id="room-code" name="room-code" placeholder="Enter Room Code">
        <button type="submit">Join</button>
        </form>`;
    }
    else if (roomType == "create-room"){
        formContentDiv.innerHTML = `<form action="/create-room" method="post">
        <input type="text" id="name" name="name" placeholder="Enter Name">
        <button type="submit">Create</button>
        </form>`;
    }
}
