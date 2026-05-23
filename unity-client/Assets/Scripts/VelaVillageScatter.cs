using UnityEngine;

[ExecuteAlways]
public sealed class VelaVillageScatter : MonoBehaviour
{
    private const int Seed = 3917;
    private const int VillageCount = 14;
    private const int HousesPerVillageMin = 5;
    private const int HousesPerVillageMax = 12;
    private const float VillageRadius = 28f;
    private const float MinDistanceFromCenter = 70f;

    private System.Random random;

    private void OnEnable()
    {
        int desiredMinimum = VillageCount * HousesPerVillageMin;
        if (transform.childCount >= desiredMinimum)
        {
            return;
        }

        ClearGeneratedChildren();
        random = new System.Random(Seed);
        ScatterVillages();
    }

    private void ScatterVillages()
    {
        for (int villageIndex = 0; villageIndex < VillageCount; villageIndex++)
        {
            Vector3 villageCenter = RandomGroundPosition();
            int houseCount = RandomRange(HousesPerVillageMin, HousesPerVillageMax + 1);

            for (int houseIndex = 0; houseIndex < houseCount; houseIndex++)
            {
                Vector2 offset = RandomInsideCircle(VillageRadius);
                Vector3 position = villageCenter + new Vector3(offset.x, 0f, offset.y);
                CreateHouse(position, RandomRange(0f, 360f), RandomRange(0.85f, 1.25f));
            }
        }
    }

    private void CreateHouse(Vector3 position, float yaw, float scale)
    {
        GameObject house = new GameObject("Village House");
        house.transform.SetParent(transform, false);
        house.transform.position = position;
        house.transform.rotation = Quaternion.Euler(0f, yaw, 0f);
        house.transform.localScale = Vector3.one * scale;

        Material wallMaterial = VelaBootstrap.MakeMaterial(new Color(0.54f, 0.43f, 0.32f), 0.75f);
        Material roofMaterial = VelaBootstrap.MakeMaterial(new Color(0.38f, 0.08f, 0.06f), 0.8f);
        Material doorMaterial = VelaBootstrap.MakeMaterial(new Color(0.18f, 0.11f, 0.07f), 0.7f);

        GameObject body = GameObject.CreatePrimitive(PrimitiveType.Cube);
        body.name = "Body";
        body.transform.SetParent(house.transform, false);
        body.transform.localPosition = new Vector3(0f, 1.2f, 0f);
        body.transform.localScale = new Vector3(RandomRange(5.5f, 8.5f), 2.4f, RandomRange(5f, 7.5f));
        body.GetComponent<Renderer>().material = wallMaterial;
        VelaBootstrap.DestroyGenerated(body.GetComponent<Collider>());

        GameObject roof = GameObject.CreatePrimitive(PrimitiveType.Cube);
        roof.name = "Roof";
        roof.transform.SetParent(house.transform, false);
        roof.transform.localPosition = new Vector3(0f, 2.75f, 0f);
        roof.transform.localRotation = Quaternion.Euler(0f, 45f, 0f);
        roof.transform.localScale = new Vector3(body.transform.localScale.x * 0.85f, 0.9f, body.transform.localScale.z * 0.85f);
        roof.GetComponent<Renderer>().material = roofMaterial;
        VelaBootstrap.DestroyGenerated(roof.GetComponent<Collider>());

        GameObject door = GameObject.CreatePrimitive(PrimitiveType.Cube);
        door.name = "Door";
        door.transform.SetParent(house.transform, false);
        door.transform.localPosition = new Vector3(0f, 0.75f, body.transform.localScale.z * -0.5f - 0.03f);
        door.transform.localScale = new Vector3(1.1f, 1.5f, 0.08f);
        door.GetComponent<Renderer>().material = doorMaterial;
        VelaBootstrap.DestroyGenerated(door.GetComponent<Collider>());
    }

    private Vector3 RandomGroundPosition()
    {
        for (int attempt = 0; attempt < 100; attempt++)
        {
            Vector2 position = new Vector2(RandomRange(-VelaBootstrap.WorldRadius * 0.85f, VelaBootstrap.WorldRadius * 0.85f), RandomRange(-VelaBootstrap.WorldRadius * 0.85f, VelaBootstrap.WorldRadius * 0.85f));
            if (position.magnitude > MinDistanceFromCenter)
            {
                return new Vector3(position.x, 0f, position.y);
            }
        }

        return new Vector3(MinDistanceFromCenter, 0f, MinDistanceFromCenter);
    }

    private Vector2 RandomInsideCircle(float radius)
    {
        float angle = RandomRange(0f, Mathf.PI * 2f);
        float distance = Mathf.Sqrt(RandomRange(0f, 1f)) * radius;
        return new Vector2(Mathf.Cos(angle) * distance, Mathf.Sin(angle) * distance);
    }

    private int RandomRange(int min, int max)
    {
        return random.Next(min, max);
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
