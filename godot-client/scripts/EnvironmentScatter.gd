extends Node3D

@export var seed: int = 7241
@export var radius: float = 27.0
@export var player_clear_radius: float = 4.0
@export var tree_count: int = 42
@export var rock_count: int = 34
@export var plant_count: int = 90

const TREE_SCENES: Array[String] = [
	"res://assets/nature/stylized_nature_megakit/CommonTree_1.gltf",
	"res://assets/nature/stylized_nature_megakit/CommonTree_3.gltf",
	"res://assets/nature/stylized_nature_megakit/CommonTree_5.gltf",
	"res://assets/nature/stylized_nature_megakit/Pine_1.gltf",
	"res://assets/nature/stylized_nature_megakit/Pine_3.gltf",
	"res://assets/nature/stylized_nature_megakit/TwistedTree_2.gltf",
]

const ROCK_SCENES: Array[String] = [
	"res://assets/nature/stylized_nature_megakit/Pebble_Round_1.gltf",
	"res://assets/nature/stylized_nature_megakit/Pebble_Round_4.gltf",
	"res://assets/nature/stylized_nature_megakit/Pebble_Square_2.gltf",
	"res://assets/nature/stylized_nature_megakit/Rock_Medium_1.gltf",
	"res://assets/nature/stylized_nature_megakit/Rock_Medium_2.gltf",
	"res://assets/nature/stylized_nature_megakit/Rock_Medium_3.gltf",
]

const PLANT_SCENES: Array[String] = [
	"res://assets/nature/stylized_nature_megakit/Bush_Common.gltf",
	"res://assets/nature/stylized_nature_megakit/Bush_Common_Flowers.gltf",
	"res://assets/nature/stylized_nature_megakit/Clover_1.gltf",
	"res://assets/nature/stylized_nature_megakit/Clover_2.gltf",
	"res://assets/nature/stylized_nature_megakit/Fern_1.gltf",
	"res://assets/nature/stylized_nature_megakit/Flower_3_Group.gltf",
	"res://assets/nature/stylized_nature_megakit/Flower_4_Group.gltf",
	"res://assets/nature/stylized_nature_megakit/Grass_Common_Short.gltf",
	"res://assets/nature/stylized_nature_megakit/Grass_Common_Tall.gltf",
	"res://assets/nature/stylized_nature_megakit/Grass_Wispy_Tall.gltf",
	"res://assets/nature/stylized_nature_megakit/Mushroom_Common.gltf",
	"res://assets/nature/stylized_nature_megakit/Plant_1.gltf",
	"res://assets/nature/stylized_nature_megakit/Plant_1_Big.gltf",
	"res://assets/nature/stylized_nature_megakit/Plant_7_Big.gltf",
]

var rng: RandomNumberGenerator = RandomNumberGenerator.new()
var packed_scene_cache: Dictionary = {}

func _ready() -> void:
	rng.seed = seed
	_scatter(TREE_SCENES, tree_count, Vector2(0.65, 1.05), true)
	_scatter(ROCK_SCENES, rock_count, Vector2(0.75, 1.45), false)
	_scatter(PLANT_SCENES, plant_count, Vector2(0.75, 1.55), false)

func _scatter(scene_paths: Array[String], count: int, scale_range: Vector2, can_fade: bool) -> void:
	for index in count:
		var scene_path: String = scene_paths[rng.randi_range(0, scene_paths.size() - 1)]
		var packed_scene: PackedScene = _get_packed_scene(scene_path)
		if packed_scene == null:
			continue

		var instance: Node3D = packed_scene.instantiate()
		if can_fade:
			instance.add_to_group("camera_fadeable")
		instance.position = _random_ground_position()
		instance.rotation.y = rng.randf_range(0.0, TAU)
		var scale_value: float = rng.randf_range(scale_range.x, scale_range.y)
		instance.scale = Vector3.ONE * scale_value
		add_child(instance)

func _get_packed_scene(scene_path: String) -> PackedScene:
	if packed_scene_cache.has(scene_path):
		return packed_scene_cache[scene_path]

	var packed_scene: PackedScene = load(scene_path)
	packed_scene_cache[scene_path] = packed_scene
	return packed_scene

func _random_ground_position() -> Vector3:
	var position := Vector2.ZERO
	for attempt in 24:
		position = Vector2(rng.randf_range(-radius, radius), rng.randf_range(-radius, radius))
		if position.length() >= player_clear_radius and position.length() <= radius:
			break

	return Vector3(position.x, 0.0, position.y)
