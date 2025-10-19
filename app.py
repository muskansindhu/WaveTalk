from flask import Flask, render_template, request, session, redirect, url_for
from flask_socketio import join_room, leave_room, send, SocketIO
import random
import string
from utils import get_current_datetime
from aiortc import RTCPeerConnection, MediaStreamTrack

app = Flask(__name__)
app.config["SECRET_KEY"] = "secret!"
socketio = SocketIO(app, async_mode="eventlet")
peer_connection = RTCPeerConnection()
rooms = {}

@app.route("/", methods=["POST", "GET"])
def home():
    session.clear()

    if request.method == "POST":
        request_type = request.form.get("request-type")
        username = request.form.get("name")

        if request_type == "join-room":
            room = request.form.get("room-code")
        elif request_type == "create-room":
            room = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
            rooms[room] = {"members": 0, "messages": []}
        else:
            return redirect(url_for("home"))

        session["room"] = room
        session["username"] = username
        return redirect(url_for("room"))

    return render_template("home.html")

@app.route("/room", methods=["GET"])
def room():
    room = session.get("room")
    username = session.get("username")
    if room is None or username is None or room not in rooms:
        return redirect(url_for("home"))
    return render_template("room.html", room=room, username=username, messages=rooms[room]["messages"])

@socketio.on("connect")
def connect():
    room = session.get("room")
    username = session.get("username")
    if not room or not username:
        return
    if room not in rooms:
        leave_room(room)
        return

    join_room(room)
    rooms[room]["members"] += 1
    print(f"{username} joined room {room}")
    socketio.emit("new-user", {"username": username}, room=room, skip_sid=request.sid)

@socketio.on("message")
def handle_message(data):
    room = data.get("room")
    name = data.get("name")
    message = data.get("data")

    if not room or not name or not message:
        return

    if room in rooms:
        rooms[room]["messages"].append({"name": name, "message": message})

    print(f"[{room}] {name}: {message}")
    socketio.emit("message", {"name": name, "data": message}, room=room)

@socketio.on("join-room")
def handle_join(data):
    room = data.get("room")
    username = data.get("username")

    if not room or not username:
        return

    join_room(room)
    if room not in rooms:
        rooms[room] = {"members": 0, "messages": []}
    rooms[room]["members"] += 1

    print(f"{username} joined room {room}")
    socketio.emit("new-user", {"username": username}, room=room, skip_sid=request.sid)

@socketio.on("offer")
def handle_offer(data):
    room = data.get("room")
    offer = data.get("offer")
    sender = session.get("username")
    socketio.emit("offer", {"from": sender, "offer": offer}, room=room, skip_sid=request.sid)

@socketio.on("answer")
def handle_answer(data):
    room = data.get("room")
    answer = data.get("answer")
    sender = session.get("username")
    socketio.emit("answer", {"from": sender, "answer": answer}, room=room, skip_sid=request.sid)

@socketio.on("ice-candidate")
def handle_ice_candidate(data):
    room = data.get("room")
    candidate = data.get("candidate")
    sender = session.get("username")
    socketio.emit("ice-candidate", {"from": sender, "candidate": candidate}, room=room, skip_sid=request.sid)

@socketio.on("disconnect")
def handle_disconnect():
    room = session.get("room")
    username = session.get("username")

    leave_room(room)
    print(f"{username} left room {room}")

    if room in rooms:
        rooms[room]["members"] -= 1
        if rooms[room]["members"] <= 0:
            del rooms[room]

    socketio.emit("user-left", {"username": username}, room=room)

if __name__ == "__main__":
    socketio.run(app, debug=True)
