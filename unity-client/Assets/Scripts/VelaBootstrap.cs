using UnityEngine;

public sealed class VelaBootstrap : MonoBehaviour
{
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
            existingClient.RepairSceneReferences();
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
        GameObject ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.name = "Ground";
        ground.transform.localScale = new Vector3(6f, 1f, 6f);
        ground.GetComponent<Renderer>().material = MakeMaterial(new Color(0.12f, 0.2f, 0.16f), 0.85f);
    }

    private static GameObject CreatePlayer()
    {
        GameObject player = new GameObject("Player");
        player.transform.position = new Vector3(0f, 0.95f, 0f);
        player.AddComponent<VelaPlayerController>();

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
