from flask import Flask, render_template, request, session, redirect, url_for
from flask_socketio import join_room, leave_room, send, SocketIO
import random
import string

app = Flask(__name__)
app.config["SECRET_KEY"] = "secret!" 
socketio = SocketIO(app)

@app.route("/")
def home():
    return render_template("home.html")

@app.route("/join-room", methods=["POST"])
def join_room():
    if request.method == "POST":
        name = request.form.get("name")
        room_code = request.form.get("room-code")
    return redirect(url_for('room', name=name, room_code=room_code))

@app.route("/create-room", methods=["POST"])
def create_room():
    if request.method == "POST":
        name = request.form.get("name")
        room_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return redirect(url_for('room', name=name, room_code=room_code))

@app.route("/room", methods=["GET"])
def room():
    name = request.args.get('name')
    room_code = request.args.get('room_code')
    return render_template("room.html", name=name, room_code=room_code)


if __name__ =="__main__":
    socketio.run(app, debug=True)