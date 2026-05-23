extends Node3D

@export var seed: int = 7241
@export var radius: float = 27.0
@export var player_clear_radius: float = 4.0
@export var tree_count: int = 42
@export var rock_count: int = 34
@export var plant_count: int = 90

const TREE_SCENES: Array[String] = [
	"res://assets/nature/kenney_nature/tree_default.glb",
	"res://assets/nature/kenney_nature/tree_oak.glb",
	"res://assets/nature/kenney_nature/tree_pineRoundA.glb",
	"res://assets/nature/kenney_nature/tree_pineTallA.glb",
	"res://assets/nature/kenney_nature/tree_simple.glb",
	"res://assets/nature/kenney_nature/tree_tall.glb",
]

const ROCK_SCENES: Array[String] = [
	"res://assets/nature/kenney_nature/rock_largeA.glb",
	"res://assets/nature/kenney_nature/rock_largeD.glb",
	"res://assets/nature/kenney_nature/rock_smallA.glb",
	"res://assets/nature/kenney_nature/rock_smallFlatB.glb",
	"res://assets/nature/kenney_nature/rock_tallC.glb",
	"res://assets/nature/kenney_nature/stone_smallA.glb",
]

const PLANT_SCENES: Array[String] = [
	"res://assets/nature/kenney_nature/flower_purpleB.glb",
	"res://assets/nature/kenney_nature/flower_redA.glb",
	"res://assets/nature/kenney_nature/flower_yellowA.glb",
	"res://assets/nature/kenney_nature/grass_large.glb",
	"res://assets/nature/kenney_nature/grass_leafs.glb",
	"res://assets/nature/kenney_nature/mushroom_redGroup.glb",
	"res://assets/nature/kenney_nature/plant_bush.glb",
	"res://assets/nature/kenney_nature/plant_bushLarge.glb",
	"res://assets/nature/kenney_nature/plant_flatShort.glb",
]

var rng: RandomNumberGenerator = RandomNumberGenerator.new()
var packed_scene_cache: Dictionary = {}

func _ready() -> void:
	rng.seed = seed
	_scatter(TREE_SCENES, tree_count, Vector2(0.75, 1.25))
	_scatter(ROCK_SCENES, rock_count, Vector2(0.7, 1.35))
	_scatter(PLANT_SCENES, plant_count, Vector2(0.6, 1.4))

func _scatter(scene_paths: Array[String], count: int, scale_range: Vector2) -> void:
	for index in count:
		var scene_path: String = scene_paths[rng.randi_range(0, scene_paths.size() - 1)]
		var packed_scene: PackedScene = _get_packed_scene(scene_path)
		if packed_scene == null:
			continue

		var instance: Node3D = packed_scene.instantiate()
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
