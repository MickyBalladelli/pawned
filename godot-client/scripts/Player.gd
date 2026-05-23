extends CharacterBody3D

signal input_changed(input: Dictionary)

@export var speed: float = 5.0
@export var turn_speed: float = 10.0
@export var target_stop_distance: float = 0.12

var last_input: Vector2 = Vector2.ZERO
var move_target: Vector3 = Vector3.ZERO
var has_move_target: bool = false
var walk_time: float = 0.0
var current_model_animation: String = ""
var look_target_yaw: float = 0.0
var has_look_target: bool = false

@onready var body: MeshInstance3D = $Body
@onready var head: MeshInstance3D = $Head
@onready var left_arm: MeshInstance3D = $LeftArm
@onready var right_arm: MeshInstance3D = $RightArm
@onready var left_leg: MeshInstance3D = $LeftLeg
@onready var right_leg: MeshInstance3D = $RightLeg
@onready var model_animation_player: AnimationPlayer = $Knight/AnimationPlayer

func _ready() -> void:
	_setup_model_animation("Idle")
	_setup_model_animation("Running_A")
	_play_model_animation("Idle")

func _physics_process(delta: float) -> void:
	var input_vector: Vector2 = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var direction: Vector3 = Vector3(input_vector.x, 0.0, input_vector.y)

	if input_vector.length() > 0.01:
		has_move_target = false
	elif has_move_target:
		var target_direction: Vector3 = move_target - global_position
		target_direction.y = 0.0
		var distance: float = target_direction.length()
		if distance <= target_stop_distance:
			has_move_target = false
			direction = Vector3.ZERO
		else:
			direction = target_direction.normalized()

	velocity.x = direction.x * speed
	velocity.z = direction.z * speed
	move_and_slide()

	if direction.length() > 0.01:
		var target_yaw: float = atan2(direction.x, direction.z)
		rotation.y = lerp_angle(rotation.y, target_yaw, turn_speed * delta)
		has_look_target = false
	elif has_look_target:
		rotation.y = lerp_angle(rotation.y, look_target_yaw, turn_speed * delta)
		if absf(angle_difference(rotation.y, look_target_yaw)) < 0.01:
			has_look_target = false

	if input_vector != last_input:
		last_input = input_vector
		input_changed.emit({
			"moveX": input_vector.x,
			"moveY": input_vector.y,
		})

	_update_walk_animation(delta, direction.length())

func set_move_target(target: Vector3) -> void:
	move_target = target
	has_move_target = true

func clear_move_target() -> void:
	has_move_target = false

func look_at_ground_position(target: Vector3) -> void:
	var direction: Vector3 = target - global_position
	direction.y = 0.0
	if direction.length() <= 0.01:
		return

	look_target_yaw = atan2(direction.x, direction.z)
	has_look_target = true

func _update_walk_animation(delta: float, move_amount: float) -> void:
	if model_animation_player:
		if move_amount > 0.01:
			_play_model_animation("Running_A")
			model_animation_player.speed_scale = clampf(move_amount, 0.6, 1.0)
		else:
			_play_model_animation("Idle")
			model_animation_player.speed_scale = 1.0
		return

	if move_amount > 0.01:
		walk_time += delta * 9.0
	else:
		walk_time = lerpf(walk_time, 0.0, 10.0 * delta)

	var swing: float = sin(walk_time) * 0.55 * clampf(move_amount, 0.0, 1.0)
	left_arm.rotation.x = swing
	right_arm.rotation.x = -swing
	left_leg.rotation.x = -swing
	right_leg.rotation.x = swing
	body.position.y = sin(walk_time * 2.0) * 0.04 * clampf(move_amount, 0.0, 1.0)
	head.position.y = 0.9 + body.position.y

func _setup_model_animation(animation_name: String) -> void:
	if not model_animation_player.has_animation(animation_name):
		return

	var animation: Animation = model_animation_player.get_animation(animation_name)
	animation.loop_mode = Animation.LOOP_LINEAR

func _play_model_animation(animation_name: String) -> void:
	if current_model_animation == animation_name:
		return
	if not model_animation_player.has_animation(animation_name):
		return

	current_model_animation = animation_name
	model_animation_player.play(animation_name, 0.15)
