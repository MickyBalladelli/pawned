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
var faded_occluders: Array[Node3D] = []
var original_visibility: Dictionary = {}

func _ready() -> void:
	player.input_changed.connect(_on_player_input_changed)
	target_marker.visible = false
	_connect_to_server()

func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			_move_player_to_mouse(event.position)
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			right_mouse_down = event.pressed
			if event.pressed:
				_turn_player_to_mouse(event.position)
		elif event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			_zoom_camera(-0.8)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			_zoom_camera(0.8)
	elif event is InputEventMouseMotion and right_mouse_down:
		_zoom_camera(event.relative.y * 0.035)
	elif event is InputEventPanGesture:
		_zoom_camera(event.delta.y * 0.8)
	elif event is InputEventMagnifyGesture:
		_zoom_camera((1.0 - event.factor) * 8.0)

func _process(delta: float) -> void:
	socket.poll()
	_update_camera(delta)
	_update_occluder_fade()
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

func _turn_player_to_mouse(mouse_position: Vector2) -> void:
	var ground_position_variant: Variant = _get_ground_position(mouse_position)
	if ground_position_variant == null:
		return

	player.look_at_ground_position(ground_position_variant)

func _get_ground_position(mouse_position: Vector2) -> Variant:
	var ray_origin: Vector3 = camera.project_ray_origin(mouse_position)
	var ray_direction: Vector3 = camera.project_ray_normal(mouse_position)
	if is_zero_approx(ray_direction.y):
		return null

	var distance_to_ground: float = -ray_origin.y / ray_direction.y
	if distance_to_ground < 0.0:
		return null

	return ray_origin + ray_direction * distance_to_ground

func _zoom_camera(amount: float) -> void:
	camera_distance = clampf(camera_distance + amount, 5.5, 18.0)

func _update_occluder_fade() -> void:
	var next_faded: Array[Node3D] = []
	var camera_position_2d: Vector2 = Vector2(camera.global_position.x, camera.global_position.z)
	var player_position_2d: Vector2 = Vector2(player.global_position.x, player.global_position.z)
	var camera_to_player: Vector2 = player_position_2d - camera_position_2d
	var camera_to_player_length: float = camera_to_player.length()

	if camera_to_player_length <= 0.01:
		_restore_all_occluders()
		return

	for node in get_tree().get_nodes_in_group("camera_fadeable"):
		if not node is Node3D:
			continue

		var occluder: Node3D = node
		var occluder_position_2d: Vector2 = Vector2(occluder.global_position.x, occluder.global_position.z)
		var projected_distance: float = (occluder_position_2d - camera_position_2d).dot(camera_to_player) / camera_to_player_length
		if projected_distance <= 0.0 or projected_distance >= camera_to_player_length:
			continue

		var closest_point: Vector2 = camera_position_2d + camera_to_player.normalized() * projected_distance
		var line_distance: float = occluder_position_2d.distance_to(closest_point)
		if line_distance < 1.25:
			next_faded.append(occluder)

	for occluder in faded_occluders:
		if not next_faded.has(occluder):
			_set_occluder_fade(occluder, false)

	for occluder in next_faded:
		if not faded_occluders.has(occluder):
			_set_occluder_fade(occluder, true)

	faded_occluders = next_faded

func _restore_all_occluders() -> void:
	for occluder in faded_occluders:
		_set_occluder_fade(occluder, false)
	faded_occluders.clear()

func _set_occluder_fade(occluder: Node3D, faded: bool) -> void:
	for mesh_instance in _get_mesh_instances(occluder):
		if faded:
			_hide_mesh(mesh_instance)
		else:
			_restore_mesh(mesh_instance)

func _get_mesh_instances(root: Node) -> Array[MeshInstance3D]:
	var meshes: Array[MeshInstance3D] = []
	if root is MeshInstance3D:
		meshes.append(root)

	for child in root.get_children():
		meshes.append_array(_get_mesh_instances(child))

	return meshes

func _hide_mesh(mesh_instance: MeshInstance3D) -> void:
	var instance_id: int = mesh_instance.get_instance_id()
	if not original_visibility.has(instance_id):
		original_visibility[instance_id] = mesh_instance.visible

	mesh_instance.visible = false

func _restore_mesh(mesh_instance: MeshInstance3D) -> void:
	var instance_id: int = mesh_instance.get_instance_id()
	if not original_visibility.has(instance_id):
		return

	mesh_instance.visible = original_visibility[instance_id]
	original_visibility.erase(instance_id)

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
