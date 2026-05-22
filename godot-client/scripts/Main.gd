extends Node3D

const SERVER_URL: String = "ws://127.0.0.1:4100/play"

@onready var player: CharacterBody3D = $Player
@onready var camera: Camera3D = $Camera3D
@onready var status_label: Label = $Hud/StatusLabel

var socket: WebSocketPeer = WebSocketPeer.new()
var connected: bool = false
var reconnect_timer: float = 0.0
var latest_input: Dictionary = {"moveX": 0.0, "moveY": 0.0}
var camera_offset: Vector3 = Vector3(0.0, 6.5, 8.5)

func _ready() -> void:
	player.input_changed.connect(_on_player_input_changed)
	_connect_to_server()

func _process(delta: float) -> void:
	socket.poll()
	_update_camera(delta)
	var state: int = socket.get_ready_state()

	if state == WebSocketPeer.STATE_OPEN:
		if not connected:
			connected = true
			status_label.text = "Connected to Vela world"
		_read_messages()
	elif state == WebSocketPeer.STATE_CLOSED:
		if connected:
			connected = false
			status_label.text = "Disconnected. Exploring locally"
		reconnect_timer -= delta
		if reconnect_timer <= 0.0:
			_connect_to_server()

func _connect_to_server() -> void:
	socket = WebSocketPeer.new()
	reconnect_timer = 3.0
	status_label.text = "Connecting to Vela world..."
	var url: String = SERVER_URL
	if OS.has_environment("VELA_GAME_TOKEN"):
		url += "?token=" + OS.get_environment("VELA_GAME_TOKEN")

	var error: Error = socket.connect_to_url(url)
	if error != OK:
		status_label.text = "Offline. Exploring locally"

func _update_camera(delta: float) -> void:
	var target_position: Vector3 = player.global_position + camera_offset
	camera.global_position = camera.global_position.lerp(target_position, 8.0 * delta)
	camera.look_at(player.global_position + Vector3(0.0, 0.7, 0.0))

func _read_messages() -> void:
	while socket.get_available_packet_count() > 0:
		var packet: String = socket.get_packet().get_string_from_utf8()
		var parsed = JSON.parse_string(packet)

		if typeof(parsed) != TYPE_DICTIONARY:
			continue

		if parsed.get("type") == "hello":
			status_label.text = "In zone: " + str(parsed.get("zoneId", "unknown"))
		elif parsed.get("type") == "error":
			status_label.text = str(parsed.get("error", "Server error"))

func _on_player_input_changed(input: Dictionary) -> void:
	latest_input = input
	if socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return

	var message: Dictionary = {
		"type": "input",
		"input": latest_input,
	}
	socket.send_text(JSON.stringify(message))
