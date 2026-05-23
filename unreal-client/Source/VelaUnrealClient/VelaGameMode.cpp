#include "VelaGameMode.h"

#include "Components/LightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/SkyLight.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/World.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "VelaHeroCharacter.h"

AVelaGameMode::AVelaGameMode()
{
    DefaultPawnClass = AVelaHeroCharacter::StaticClass();
}

void AVelaGameMode::BeginPlay()
{
    Super::BeginPlay();

    UWorld* World = GetWorld();
    if (!World)
    {
        return;
    }

    UStaticMesh* CubeMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
    UStaticMesh* ConeMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cone.Cone"));
    UStaticMesh* CylinderMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    UStaticMesh* SphereMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    UStaticMesh* PlaneMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Plane.Plane"));

    if (!CubeMesh || !ConeMesh || !CylinderMesh || !SphereMesh || !PlaneMesh)
    {
        return;
    }

    constexpr float WorldHalfSize = 9500.0f;

    if (ADirectionalLight* Sun = World->SpawnActor<ADirectionalLight>(FVector(0.0f, 0.0f, 5000.0f), FRotator(-45.0f, -35.0f, 0.0f)))
    {
        Sun->GetLightComponent()->SetMobility(EComponentMobility::Movable);
        Sun->GetLightComponent()->Intensity = 8.0f;
    }

    if (ASkyLight* SkyLight = World->SpawnActor<ASkyLight>(FVector::ZeroVector, FRotator::ZeroRotator))
    {
        SkyLight->GetLightComponent()->SetMobility(EComponentMobility::Movable);
        SkyLight->GetLightComponent()->Intensity = 1.5f;
    }

    SpawnMeshActor(CubeMesh, FVector(0.0f, 0.0f, -110.0f), FRotator::ZeroRotator, FVector(190.0f, 190.0f, 0.12f), true, FLinearColor(0.18f, 0.32f, 0.14f));

    SpawnMeshActor(PlaneMesh, FVector(-2800.0f, 2600.0f, -92.0f), FRotator::ZeroRotator, FVector(28.0f, 18.0f, 1.0f), false, FLinearColor(0.08f, 0.22f, 0.38f));
    SpawnMeshActor(PlaneMesh, FVector(-4800.0f, -3600.0f, -90.0f), FRotator::ZeroRotator, FVector(18.0f, 12.0f, 1.0f), false, FLinearColor(0.06f, 0.18f, 0.32f));

    const FVector HillLocations[] = {
        FVector(-6200.0f, -5200.0f, -120.0f),
        FVector(-4600.0f, 4800.0f, -120.0f),
        FVector(3600.0f, 5200.0f, -120.0f),
        FVector(6200.0f, -3200.0f, -120.0f),
        FVector(1800.0f, -6100.0f, -120.0f),
        FVector(-1200.0f, 6800.0f, -120.0f)
    };

    for (int32 Index = 0; Index < UE_ARRAY_COUNT(HillLocations); ++Index)
    {
        const float Height = 2.0f + static_cast<float>(Index % 3);
        SpawnMeshActor(SphereMesh, HillLocations[Index], FRotator::ZeroRotator, FVector(16.0f + Index, 11.0f + Index * 0.7f, Height), true, FLinearColor(0.16f, 0.27f, 0.13f));
    }

    FRandomStream NatureRandom(71237);

    for (int32 Index = 0; Index < 260; ++Index)
    {
        FVector Location(NatureRandom.FRandRange(-8200.0f, 8200.0f), NatureRandom.FRandRange(-8200.0f, 8200.0f), -80.0f);
        if (!IsClearSpawnLocation(Location))
        {
            continue;
        }

        const float Scale = NatureRandom.FRandRange(0.75f, 1.75f);
        const float Rotation = NatureRandom.FRandRange(0.0f, 360.0f);
        const int32 TreeType = NatureRandom.RandRange(0, 9);
        if (TreeType < 4)
        {
            SpawnPineTree(CylinderMesh, ConeMesh, Location, Scale, Rotation);
        }
        else if (TreeType < 8)
        {
            SpawnBroadleafTree(CylinderMesh, SphereMesh, Location, Scale, Rotation);
        }
        else
        {
            SpawnPalmTree(CylinderMesh, ConeMesh, Location, Scale, Rotation);
        }
    }

    for (int32 Index = 0; Index < 420; ++Index)
    {
        FVector Location(NatureRandom.FRandRange(-8600.0f, 8600.0f), NatureRandom.FRandRange(-8600.0f, 8600.0f), -70.0f);
        if (!IsClearSpawnLocation(Location))
        {
            continue;
        }

        const float Scale = NatureRandom.FRandRange(0.55f, 1.45f);
        const float Rotation = NatureRandom.FRandRange(0.0f, 360.0f);
        const int32 ItemType = NatureRandom.RandRange(0, 9);
        if (ItemType < 3)
        {
            SpawnBush(SphereMesh, Location, Scale);
        }
        else if (ItemType < 5)
        {
            SpawnRock(SphereMesh, Location, Scale);
        }
        else
        {
            SpawnGrassClump(ConeMesh, Location, Scale, Rotation);
        }
    }

    const float WallThickness = 0.5f;
    const float WallHeight = 8.0f;
    SpawnMeshActor(CubeMesh, FVector(0.0f, -WorldHalfSize, 290.0f), FRotator::ZeroRotator, FVector(WorldHalfSize / 50.0f, WallThickness, WallHeight), true, FLinearColor(0.18f, 0.18f, 0.18f));
    SpawnMeshActor(CubeMesh, FVector(0.0f, WorldHalfSize, 290.0f), FRotator::ZeroRotator, FVector(WorldHalfSize / 50.0f, WallThickness, WallHeight), true, FLinearColor(0.18f, 0.18f, 0.18f));
    SpawnMeshActor(CubeMesh, FVector(-WorldHalfSize, 0.0f, 290.0f), FRotator::ZeroRotator, FVector(WallThickness, WorldHalfSize / 50.0f, WallHeight), true, FLinearColor(0.18f, 0.18f, 0.18f));
    SpawnMeshActor(CubeMesh, FVector(WorldHalfSize, 0.0f, 290.0f), FRotator::ZeroRotator, FVector(WallThickness, WorldHalfSize / 50.0f, WallHeight), true, FLinearColor(0.18f, 0.18f, 0.18f));
}

AStaticMeshActor* AVelaGameMode::SpawnMeshActor(
    UStaticMesh* Mesh,
    const FVector& Location,
    const FRotator& Rotation,
    const FVector& Scale,
    bool bCollisionEnabled,
    const FLinearColor& Color)
{
    UWorld* World = GetWorld();
    if (!World || !Mesh)
    {
        return nullptr;
    }

    AStaticMeshActor* Actor = World->SpawnActor<AStaticMeshActor>(Location, Rotation);
    if (!Actor)
    {
        return nullptr;
    }

    UStaticMeshComponent* MeshComponent = Actor->GetStaticMeshComponent();
    MeshComponent->SetStaticMesh(Mesh);
    MeshComponent->SetRelativeScale3D(Scale);
    MeshComponent->SetMobility(EComponentMobility::Movable);
    MeshComponent->SetCollisionEnabled(bCollisionEnabled ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
    MeshComponent->SetCollisionProfileName(bCollisionEnabled ? TEXT("BlockAll") : TEXT("NoCollision"));

    static UMaterialInterface* BaseMaterial = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
    if (BaseMaterial)
    {
        UMaterialInstanceDynamic* DynamicMaterial = UMaterialInstanceDynamic::Create(BaseMaterial, Actor);
        DynamicMaterial->SetVectorParameterValue(TEXT("Color"), Color);
        DynamicMaterial->SetVectorParameterValue(TEXT("BaseColor"), Color);
        MeshComponent->SetMaterial(0, DynamicMaterial);
    }

    return Actor;
}

void AVelaGameMode::SpawnPineTree(UStaticMesh* CylinderMesh, UStaticMesh* ConeMesh, const FVector& Location, float Scale, float Rotation)
{
    const FLinearColor TrunkColor(0.30f, 0.18f, 0.09f);
    const FLinearColor NeedleColor(0.04f, 0.22f + Scale * 0.03f, 0.09f);
    SpawnMeshActor(CylinderMesh, Location + FVector(0.0f, 0.0f, 70.0f * Scale), FRotator(0.0f, Rotation, 0.0f), FVector(0.18f * Scale, 0.18f * Scale, 1.35f * Scale), true, TrunkColor);
    SpawnMeshActor(ConeMesh, Location + FVector(0.0f, 0.0f, 190.0f * Scale), FRotator(0.0f, Rotation, 0.0f), FVector(1.05f * Scale, 1.05f * Scale, 1.25f * Scale), true, NeedleColor);
    SpawnMeshActor(ConeMesh, Location + FVector(0.0f, 0.0f, 280.0f * Scale), FRotator(0.0f, Rotation + 23.0f, 0.0f), FVector(0.82f * Scale, 0.82f * Scale, 1.05f * Scale), true, NeedleColor * 1.12f);
    SpawnMeshActor(ConeMesh, Location + FVector(0.0f, 0.0f, 355.0f * Scale), FRotator(0.0f, Rotation - 17.0f, 0.0f), FVector(0.58f * Scale, 0.58f * Scale, 0.82f * Scale), true, NeedleColor * 1.22f);
}

void AVelaGameMode::SpawnBroadleafTree(UStaticMesh* CylinderMesh, UStaticMesh* SphereMesh, const FVector& Location, float Scale, float Rotation)
{
    const FLinearColor TrunkColor(0.34f, 0.20f, 0.10f);
    const FLinearColor LeafColor(0.08f, 0.32f + Scale * 0.04f, 0.11f);
    SpawnMeshActor(CylinderMesh, Location + FVector(0.0f, 0.0f, 85.0f * Scale), FRotator(0.0f, Rotation, 0.0f), FVector(0.25f * Scale, 0.25f * Scale, 1.65f * Scale), true, TrunkColor);
    SpawnMeshActor(SphereMesh, Location + FVector(0.0f, 0.0f, 260.0f * Scale), FRotator(0.0f, Rotation, 0.0f), FVector(1.25f * Scale, 1.05f * Scale, 0.92f * Scale), true, LeafColor);
    SpawnMeshActor(SphereMesh, Location + FVector(70.0f * Scale, 35.0f * Scale, 230.0f * Scale), FRotator(0.0f, Rotation, 0.0f), FVector(0.92f * Scale, 0.78f * Scale, 0.65f * Scale), true, LeafColor * 1.15f);
    SpawnMeshActor(SphereMesh, Location + FVector(-65.0f * Scale, -40.0f * Scale, 240.0f * Scale), FRotator(0.0f, Rotation, 0.0f), FVector(0.88f * Scale, 0.76f * Scale, 0.7f * Scale), true, LeafColor * 0.9f);
}

void AVelaGameMode::SpawnPalmTree(UStaticMesh* CylinderMesh, UStaticMesh* ConeMesh, const FVector& Location, float Scale, float Rotation)
{
    const FLinearColor TrunkColor(0.42f, 0.28f, 0.13f);
    const FLinearColor LeafColor(0.05f, 0.34f, 0.16f);
    SpawnMeshActor(CylinderMesh, Location + FVector(0.0f, 0.0f, 105.0f * Scale), FRotator(0.0f, Rotation, 6.0f), FVector(0.17f * Scale, 0.17f * Scale, 2.1f * Scale), true, TrunkColor);
    for (int32 Leaf = 0; Leaf < 6; ++Leaf)
    {
        const float LeafAngle = Rotation + Leaf * 60.0f;
        const FVector Offset(FMath::Cos(FMath::DegreesToRadians(LeafAngle)) * 55.0f * Scale, FMath::Sin(FMath::DegreesToRadians(LeafAngle)) * 55.0f * Scale, 290.0f * Scale);
        SpawnMeshActor(ConeMesh, Location + Offset, FRotator(75.0f, LeafAngle, 0.0f), FVector(0.22f * Scale, 1.15f * Scale, 0.22f * Scale), false, LeafColor);
    }
}

void AVelaGameMode::SpawnBush(UStaticMesh* SphereMesh, const FVector& Location, float Scale)
{
    const FLinearColor BushColor(0.06f, 0.28f + Scale * 0.05f, 0.08f);
    SpawnMeshActor(SphereMesh, Location + FVector(0.0f, 0.0f, 10.0f), FRotator::ZeroRotator, FVector(0.55f * Scale, 0.46f * Scale, 0.28f * Scale), false, BushColor);
    SpawnMeshActor(SphereMesh, Location + FVector(35.0f * Scale, -20.0f * Scale, 15.0f), FRotator::ZeroRotator, FVector(0.35f * Scale, 0.28f * Scale, 0.22f * Scale), false, BushColor * 1.18f);
}

void AVelaGameMode::SpawnRock(UStaticMesh* SphereMesh, const FVector& Location, float Scale)
{
    const FLinearColor RockColor(0.26f, 0.25f, 0.22f);
    SpawnMeshActor(SphereMesh, Location + FVector(0.0f, 0.0f, -20.0f), FRotator(0.0f, 0.0f, 18.0f), FVector(0.48f * Scale, 0.34f * Scale, 0.22f * Scale), true, RockColor);
}

void AVelaGameMode::SpawnGrassClump(UStaticMesh* ConeMesh, const FVector& Location, float Scale, float Rotation)
{
    const FLinearColor GrassColor(0.12f, 0.42f, 0.10f);
    for (int32 Blade = 0; Blade < 4; ++Blade)
    {
        const float Angle = Rotation + Blade * 90.0f;
        const FVector Offset(FMath::Cos(FMath::DegreesToRadians(Angle)) * 12.0f * Scale, FMath::Sin(FMath::DegreesToRadians(Angle)) * 12.0f * Scale, 0.0f);
        SpawnMeshActor(ConeMesh, Location + Offset, FRotator(8.0f, Angle, 0.0f), FVector(0.10f * Scale, 0.10f * Scale, 0.34f * Scale), false, GrassColor);
    }
}

bool AVelaGameMode::IsClearSpawnLocation(const FVector& Location) const
{
    if (FMath::Abs(Location.X) < 900.0f && FMath::Abs(Location.Y) < 900.0f)
    {
        return false;
    }

    const bool bInLakeOne = Location.X > -4700.0f && Location.X < -900.0f && Location.Y > 1100.0f && Location.Y < 4100.0f;
    const bool bInLakeTwo = Location.X > -6200.0f && Location.X < -3300.0f && Location.Y > -4700.0f && Location.Y < -2500.0f;
    return !bInLakeOne && !bInLakeTwo;
}
