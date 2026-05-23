using UnityEngine;

public sealed class VelaBootstrap : MonoBehaviour
{
    public const float WorldSize = 3000f;
    public const float WorldRadius = WorldSize * 0.5f;

#if UNITY_EDITOR
    [UnityEditor.InitializeOnLoadMethod]
    private static void BuildEditorWorld()
    {
        UnityEditor.EditorApplication.delayCall += () =>
        {
            if (Application.isPlaying)
            {
                return;
            }

            BuildWorld();
            UnityEditor.EditorApplication.QueuePlayerLoopUpdate();
            UnityEditor.SceneView.RepaintAll();
        };
    }
#endif

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    private static void BuildWorld()
    {
        VelaGameClient existingClient = FindObjectOfType<VelaGameClient>();
        if (existingClient != null)
        {
            CreateGround();
            CreateInvisibleWalls();
            existingClient.RepairSceneReferences();
            if (existingClient.Player != null)
            {
                CreateImportedSoldier(existingClient.Player.transform);
            }

            if (existingClient.Player != null && existingClient.GameCamera != null && existingClient.TargetMarker != null)
            {
                return;
            }
        }

        RenderSettings.skybox = null;
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(0.6f, 0.7f, 0.78f);
        Camera.main?.gameObject.SetActive(false);

        CreateLight();
        CreateGround();
        CreateInvisibleWalls();

        GameObject player = CreatePlayer();
        GameObject marker = CreateTargetMarker();
        Camera camera = CreateCamera();

        VelaGameClient client = existingClient != null ? existingClient : new GameObject("VelaGameClient").AddComponent<VelaGameClient>();
        client.Player = player.GetComponent<VelaPlayerController>();
        client.GameCamera = camera;
        client.TargetMarker = marker;

        new GameObject("EnvironmentScatter").AddComponent<VelaEnvironmentScatter>();
    }

    private static void CreateLight()
    {
        GameObject lightObject = new GameObject("Sun");
        Light light = lightObject.AddComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = 2f;
        light.shadows = LightShadows.Soft;
        lightObject.transform.rotation = Quaternion.Euler(50f, -35f, 0f);
    }

    private static void CreateGround()
    {
        GameObject ground = GameObject.Find("Ground");
        if (ground == null)
        {
            ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        }

        ground.name = "Ground";
        ground.transform.localScale = new Vector3(WorldSize * 0.1f, 1f, WorldSize * 0.1f);
        ground.GetComponent<Renderer>().material = MakeMaterial(new Color(0.12f, 0.2f, 0.16f), 0.85f);
    }

    private static void CreateInvisibleWalls()
    {
        CreateInvisibleWall("North Wall", new Vector3(0f, 2.5f, WorldRadius), new Vector3(WorldSize, 5f, 2f));
        CreateInvisibleWall("South Wall", new Vector3(0f, 2.5f, -WorldRadius), new Vector3(WorldSize, 5f, 2f));
        CreateInvisibleWall("East Wall", new Vector3(WorldRadius, 2.5f, 0f), new Vector3(2f, 5f, WorldSize));
        CreateInvisibleWall("West Wall", new Vector3(-WorldRadius, 2.5f, 0f), new Vector3(2f, 5f, WorldSize));
    }

    private static void CreateInvisibleWall(string name, Vector3 position, Vector3 scale)
    {
        GameObject wall = GameObject.Find(name);
        if (wall == null)
        {
            wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
        }

        wall.name = name;
        wall.transform.position = position;
        wall.transform.localScale = scale;
        DestroyGenerated(wall.GetComponent<Renderer>());
    }

    private static GameObject CreatePlayer()
    {
        GameObject player = new GameObject("Player");
        player.transform.position = new Vector3(0f, 0.95f, 0f);
        player.AddComponent<VelaPlayerController>();

        if (CreateImportedSoldier(player.transform))
        {
            return player;
        }

        Material bodyMaterial = MakeMaterial(new Color(0.18f, 0.55f, 0.95f), 0.55f);
        Material skinMaterial = MakeMaterial(new Color(0.86f, 0.7f, 0.56f), 0.5f);

        CreateCapsulePart("Body", player.transform, new Vector3(0f, -0.1f, 0f), new Vector3(0.76f, 0.76f, 0.76f), bodyMaterial);
        CreateSpherePart("Head", player.transform, new Vector3(0f, 0.8f, 0f), new Vector3(0.56f, 0.56f, 0.56f), skinMaterial);
        CreateCapsulePart("LeftArm", player.transform, new Vector3(-0.48f, 0.05f, 0f), new Vector3(0.18f, 0.55f, 0.18f), skinMaterial);
        CreateCapsulePart("RightArm", player.transform, new Vector3(0.48f, 0.05f, 0f), new Vector3(0.18f, 0.55f, 0.18f), skinMaterial);
        CreateCapsulePart("LeftLeg", player.transform, new Vector3(-0.18f, -0.75f, 0f), new Vector3(0.18f, 0.65f, 0.18f), skinMaterial);
        CreateCapsulePart("RightLeg", player.transform, new Vector3(0.18f, -0.75f, 0f), new Vector3(0.18f, 0.65f, 0.18f), skinMaterial);

        GameObject facing = GameObject.CreatePrimitive(PrimitiveType.Cube);
        facing.name = "FacingMarker";
        facing.transform.SetParent(player.transform, false);
        facing.transform.localPosition = new Vector3(0f, -0.75f, 0.43f);
        facing.transform.localScale = new Vector3(0.08f, 0.08f, 0.5f);
        facing.GetComponent<Renderer>().material = skinMaterial;

        return player;
    }

    private static bool CreateImportedSoldier(Transform parent)
    {
#if UNITY_EDITOR
        if (parent.Find("Soldier") != null)
        {
            Transform existingSoldier = parent.Find("Soldier");
            existingSoldier.localRotation = Quaternion.Euler(0f, 180f, 0f);
            ConfigureSoldierAnimator(existingSoldier.gameObject);
            DestroyFallbackPlayerParts(parent);
            return true;
        }

        const string SoldierPath = "Assets/LowPolySoldiers_demo/models/Soldier_demo.FBX";
        GameObject soldierAsset = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>(SoldierPath);
        if (soldierAsset == null)
        {
            return false;
        }

        GameObject soldier = Object.Instantiate(soldierAsset, parent);
        soldier.name = "Soldier";
        soldier.transform.localPosition = new Vector3(0f, -0.95f, 0f);
        soldier.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
        soldier.transform.localScale = Vector3.one;
        ConfigureSoldierAnimator(soldier);
        DestroyFallbackPlayerParts(parent);
        return true;
#else
        return false;
#endif
    }

    private static void ConfigureSoldierAnimator(GameObject soldier)
    {
#if UNITY_EDITOR
        VelaSoldierAnimator soldierAnimator = soldier.GetComponent<VelaSoldierAnimator>();
        if (soldierAnimator == null)
        {
            soldierAnimator = soldier.AddComponent<VelaSoldierAnimator>();
        }

        soldierAnimator.IdleClip = LoadAnimationClip("Assets/LowPolySoldiers_demo/animation/demo_combat_idle.FBX");
        soldierAnimator.RunClip = LoadAnimationClip("Assets/LowPolySoldiers_demo/animation/demo_combat_run.FBX");
        soldierAnimator.ShootClip = LoadAnimationClip("Assets/LowPolySoldiers_demo/animation/demo_combat_shoot.FBX");
#endif
    }

    private static AnimationClip LoadAnimationClip(string path)
    {
#if UNITY_EDITOR
        foreach (Object asset in UnityEditor.AssetDatabase.LoadAllAssetsAtPath(path))
        {
            if (asset is AnimationClip clip && !clip.name.StartsWith("__preview__"))
            {
                return clip;
            }
        }
#endif
        return null;
    }

    private static void DestroyFallbackPlayerParts(Transform parent)
    {
        string[] fallbackPartNames = { "Body", "Head", "LeftArm", "RightArm", "LeftLeg", "RightLeg", "FacingMarker" };
        foreach (string partName in fallbackPartNames)
        {
            Transform part = parent.Find(partName);
            if (part != null)
            {
                DestroyGenerated(part.gameObject);
            }
        }
    }

    private static GameObject CreateTargetMarker()
    {
        GameObject marker = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        marker.name = "TargetMarker";
        marker.transform.localScale = new Vector3(0.45f, 0.02f, 0.45f);
        marker.GetComponent<Renderer>().material = MakeMaterial(new Color(0.95f, 0.78f, 0.22f), 0.45f);
        marker.SetActive(false);
        return marker;
    }

    private static Camera CreateCamera()
    {
        GameObject cameraObject = new GameObject("Main Camera");
        cameraObject.tag = "MainCamera";
        Camera camera = cameraObject.AddComponent<Camera>();
        camera.fieldOfView = 55f;
        camera.farClipPlane = 3600f;
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = new Color(0.047f, 0.071f, 0.09f);
        return camera;
    }

    private static void CreateCapsulePart(string name, Transform parent, Vector3 position, Vector3 scale, Material material)
    {
        GameObject part = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        part.name = name;
        part.transform.SetParent(parent, false);
        part.transform.localPosition = position;
        part.transform.localScale = scale;
        part.GetComponent<Renderer>().material = material;
        DestroyGenerated(part.GetComponent<Collider>());
    }

    private static void CreateSpherePart(string name, Transform parent, Vector3 position, Vector3 scale, Material material)
    {
        GameObject part = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        part.name = name;
        part.transform.SetParent(parent, false);
        part.transform.localPosition = position;
        part.transform.localScale = scale;
        part.GetComponent<Renderer>().material = material;
        DestroyGenerated(part.GetComponent<Collider>());
    }

    public static Material MakeMaterial(Color color, float smoothness)
    {
        Material material = new Material(Shader.Find("Standard"));
        material.color = color;
        material.SetFloat("_Glossiness", 1f - smoothness);
        return material;
    }

    public static void DestroyGenerated(Object generatedObject)
    {
        if (generatedObject == null)
        {
            return;
        }

        if (Application.isPlaying)
        {
            Object.Destroy(generatedObject);
        }
        else
        {
            Object.DestroyImmediate(generatedObject);
        }
    }
}
