from flask import Flask, render_template, request, session, redirect, url_for, jsonify
from flask_socketio import join_room, leave_room, send, SocketIO
import random
import string
from utils import get_current_datetime


app = Flask(__name__)
app.config["SECRET_KEY"] = "secret!"
socketio = SocketIO(app)

rooms={}

@app.route("/", methods=["POST", "GET"])
def home():
    session.clear()

    if request.method == "POST":
        request_type = request.form.get("request-type")
        username = request.form.get("name")

        if request_type == "join-room":
            room = request.form.get("room-code")

        if request_type == "create-room":
            room = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
            rooms[room] = {"members":0, "messages":[]}

        session["room"] = room
        session["username"] = username
        return redirect(url_for("room"))

    return render_template("home.html")
            

@app.route("/room", methods=["GET"])
def room():
    room = session.get("room")
    username = session.get("username")
    if room is None or session.get("username") is None or room not in rooms:
        return redirect(url_for('home'))
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
    send({"name": username, "message": "has entered the room",  "datetime": get_current_datetime()}, to=room)
    rooms[room]["members"] += 1
    print(f"{username} joined room {room}")


@socketio.on("message")
def message(data):
    room = session.get("room")
    if room not in rooms:
        return 
    
    content = {
        "name": session.get("username"),
        "message": data["data"],
        "datetime": get_current_datetime()
    }
    send(content, to=room)
    rooms[room]["messages"].append(content)
    print(f"{session.get('username')} said: {data['data']}")



@socketio.on("disconnect")
def disconnect():
    room = session.get("room")
    username = session.get("username")
    leave_room(room)

    if room in rooms:
        rooms[room]["members"] -= 1
        if rooms[room]["members"] <= 0:
            del rooms[room]
    send({"name": username, "message": "has left the room", "datetime": get_current_datetime()}, to=room)
    print(f"{username} left room {room}")


if __name__ == "__main__":
    socketio.run(app, debug=True)
