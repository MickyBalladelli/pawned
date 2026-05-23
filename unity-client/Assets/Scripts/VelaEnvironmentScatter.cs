using UnityEngine;

[ExecuteAlways]
public sealed class VelaEnvironmentScatter : MonoBehaviour
{
    private const int Seed = 7241;
    private const float Radius = 1450f;
    private const float PlayerClearRadius = 4f;
    private const int TreeCount = 4500;
    private const int RockCount = 3000;
    private const int PlantCount = 9000;

    private System.Random random;

    private void OnEnable()
    {
        int desiredChildCount = TreeCount + RockCount + PlantCount;
        if (transform.childCount == desiredChildCount)
        {
            return;
        }

        ClearGeneratedChildren();
        random = new System.Random(Seed);
        ScatterTrees();
        ScatterRocks();
        ScatterPlants();
    }

    private void ScatterTrees()
    {
        Material trunk = VelaBootstrap.MakeMaterial(new Color(0.36f, 0.24f, 0.13f), 0.7f);
        Material leaves = VelaBootstrap.MakeMaterial(new Color(0.12f, 0.42f, 0.2f), 0.8f);

        for (int index = 0; index < TreeCount; index++)
        {
            GameObject tree = new GameObject("Tree");
            tree.transform.position = RandomGroundPosition();
            tree.transform.rotation = Quaternion.Euler(0f, RandomRange(0f, 360f), 0f);
            float scale = RandomRange(0.65f, 1.05f);
            tree.transform.localScale = Vector3.one * scale;

            GameObject trunkObject = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            trunkObject.transform.SetParent(tree.transform, false);
            trunkObject.transform.localPosition = new Vector3(0f, 0.75f, 0f);
            trunkObject.transform.localScale = new Vector3(0.25f, 1.5f, 0.25f);
            trunkObject.GetComponent<Renderer>().material = trunk;
            VelaBootstrap.DestroyGenerated(trunkObject.GetComponent<Collider>());

            GameObject leavesObject = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            leavesObject.transform.SetParent(tree.transform, false);
            leavesObject.transform.localPosition = new Vector3(0f, 1.75f, 0f);
            leavesObject.transform.localScale = new Vector3(1.25f, 1.25f, 1.25f);
            leavesObject.GetComponent<Renderer>().material = leaves;
            VelaBootstrap.DestroyGenerated(leavesObject.GetComponent<Collider>());
        }
    }

    private void ScatterRocks()
    {
        Material rock = VelaBootstrap.MakeMaterial(new Color(0.42f, 0.46f, 0.43f), 0.8f);

        for (int index = 0; index < RockCount; index++)
        {
            GameObject rockObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
            rockObject.name = "Rock";
            rockObject.transform.position = RandomGroundPosition() + new Vector3(0f, 0.15f, 0f);
            rockObject.transform.rotation = Quaternion.Euler(RandomRange(-8f, 8f), RandomRange(0f, 360f), RandomRange(-8f, 8f));
            float scale = RandomRange(0.75f, 1.45f);
            rockObject.transform.localScale = new Vector3(0.7f, 0.3f, 0.5f) * scale;
            rockObject.GetComponent<Renderer>().material = rock;
            VelaBootstrap.DestroyGenerated(rockObject.GetComponent<Collider>());
        }
    }

    private void ScatterPlants()
    {
        Material plant = VelaBootstrap.MakeMaterial(new Color(0.25f, 0.62f, 0.28f), 0.9f);

        for (int index = 0; index < PlantCount; index++)
        {
            GameObject plantObject = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            plantObject.name = "Plant";
            plantObject.transform.position = RandomGroundPosition() + new Vector3(0f, 0.08f, 0f);
            plantObject.transform.rotation = Quaternion.Euler(0f, RandomRange(0f, 360f), 0f);
            float scale = RandomRange(0.75f, 1.55f);
            plantObject.transform.localScale = new Vector3(0.12f, 0.16f, 0.12f) * scale;
            plantObject.GetComponent<Renderer>().material = plant;
            VelaBootstrap.DestroyGenerated(plantObject.GetComponent<Collider>());
        }
    }

    private Vector3 RandomGroundPosition()
    {
        Vector2 position = Vector2.zero;

        for (int attempt = 0; attempt < 24; attempt++)
        {
            position = new Vector2(RandomRange(-Radius, Radius), RandomRange(-Radius, Radius));
            if (position.magnitude >= PlayerClearRadius && position.magnitude <= Radius)
            {
                break;
            }
        }

        return new Vector3(position.x, 0f, position.y);
    }

    private float RandomRange(float min, float max)
    {
        return min + (float)random.NextDouble() * (max - min);
    }

    private void ClearGeneratedChildren()
    {
        while (transform.childCount > 0)
        {
            VelaBootstrap.DestroyGenerated(transform.GetChild(0).gameObject);
        }
    }
}
