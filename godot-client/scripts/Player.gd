extends CharacterBody3D

signal input_changed(input: Dictionary)

@export var speed := 5.0
@export var turn_speed := 10.0

var last_input := Vector2.ZERO

func _physics_process(delta: float) -> void:
	var input_vector := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var direction := Vector3(input_vector.x, 0.0, input_vector.y)

	velocity.x = direction.x * speed
	velocity.z = direction.z * speed
	move_and_slide()

	if direction.length() > 0.01:
		var target_yaw := atan2(direction.x, direction.z)
		rotation.y = lerp_angle(rotation.y, target_yaw, turn_speed * delta)

	if input_vector != last_input:
		last_input = input_vector
		input_changed.emit({
			"moveX": input_vector.x,
			"moveY": input_vector.y,
		})
