extends Node3D

const SERVER_URL: String = "ws://127.0.0.1:4100/play"

@onready var player: CharacterBody3D = $Player
@onready var camera: Camera3D = $Camera3D
@onready var status_label: Label = $Hud/StatusLabel
@onready var target_marker: MeshInstance3D = $TargetMarker

var socket: WebSocketPeer = WebSocketPeer.new()
var connected: bool = false
var reconnect_timer: float = 0.0
var latest_input: Dictionary = {"moveX": 0.0, "moveY": 0.0}
var camera_distance: float = 10.7
var right_mouse_down: bool = false

func _ready() -> void:
	player.input_changed.connect(_on_player_input_changed)
	target_marker.visible = false
	_connect_to_server()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			_move_player_to_mouse(event.position)
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			right_mouse_down = event.pressed
		elif right_mouse_down and event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			_zoom_camera(-0.8)
		elif right_mouse_down and event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			_zoom_camera(0.8)
	elif event is InputEventMouseMotion and right_mouse_down:
		_zoom_camera(event.relative.y * 0.035)

func _process(delta: float) -> void:
	socket.poll()
	_update_camera(delta)
	if target_marker.visible and not player.has_move_target:
		target_marker.visible = false
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
	var camera_offset: Vector3 = Vector3(0.0, camera_distance * 0.6, camera_distance * 0.78)
	var target_position: Vector3 = player.global_position + camera_offset
	camera.global_position = camera.global_position.lerp(target_position, 8.0 * delta)
	camera.look_at(player.global_position + Vector3(0.0, 0.7, 0.0))

func _move_player_to_mouse(mouse_position: Vector2) -> void:
	var ground_position_variant: Variant = _get_ground_position(mouse_position)
	if ground_position_variant == null:
		return

	var ground_position: Vector3 = ground_position_variant
	player.set_move_target(ground_position)
	target_marker.global_position = Vector3(ground_position.x, 0.03, ground_position.z)
	target_marker.visible = true

func _get_ground_position(mouse_position: Vector2) -> Variant:
	var ray_origin: Vector3 = camera.project_ray_origin(mouse_position)
	var ray_end: Vector3 = ray_origin + camera.project_ray_normal(mouse_position) * 1000.0
	var query := PhysicsRayQueryParameters3D.create(ray_origin, ray_end)
	query.exclude = [player.get_rid()]

	var space_state: PhysicsDirectSpaceState3D = get_world_3d().direct_space_state
	var result: Dictionary = space_state.intersect_ray(query)
	if result.is_empty():
		return null

	return result.position

func _zoom_camera(amount: float) -> void:
	camera_distance = clampf(camera_distance + amount, 5.5, 18.0)

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
