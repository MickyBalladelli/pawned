#include "VelaGameMode.h"

#include "Components/LightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/SkyLight.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/World.h"
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
        Sun->GetLightComponent()->Intensity = 8.0f;
    }

    if (ASkyLight* SkyLight = World->SpawnActor<ASkyLight>(FVector::ZeroVector, FRotator::ZeroRotator))
    {
        SkyLight->GetLightComponent()->Intensity = 1.5f;
    }

    SpawnMeshActor(CubeMesh, FVector(0.0f, 0.0f, -110.0f), FRotator::ZeroRotator, FVector(190.0f, 190.0f, 0.12f), true);

    SpawnMeshActor(PlaneMesh, FVector(-2800.0f, 2600.0f, -92.0f), FRotator::ZeroRotator, FVector(28.0f, 18.0f, 1.0f), false);
    SpawnMeshActor(PlaneMesh, FVector(-4800.0f, -3600.0f, -90.0f), FRotator::ZeroRotator, FVector(18.0f, 12.0f, 1.0f), false);

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
        SpawnMeshActor(SphereMesh, HillLocations[Index], FRotator::ZeroRotator, FVector(16.0f + Index, 11.0f + Index * 0.7f, Height), true);
    }

    for (int32 Index = 0; Index < 110; ++Index)
    {
        const int32 Row = Index / 11;
        const int32 Col = Index % 11;
        const float X = -7600.0f + Col * 1450.0f + (Row % 2) * 360.0f;
        const float Y = -7600.0f + Row * 1450.0f;
        if (FMath::Abs(X) < 900.0f && FMath::Abs(Y) < 900.0f)
        {
            continue;
        }

        const float TrunkHeight = 1.2f + (Index % 4) * 0.18f;
        const float CanopySize = 1.8f + (Index % 5) * 0.22f;
        SpawnMeshActor(CylinderMesh, FVector(X, Y, 20.0f), FRotator::ZeroRotator, FVector(0.25f, 0.25f, TrunkHeight), true);
        SpawnMeshActor(ConeMesh, FVector(X, Y, 175.0f + TrunkHeight * 35.0f), FRotator::ZeroRotator, FVector(CanopySize, CanopySize, CanopySize * 1.35f), true);
    }

    for (int32 Index = 0; Index < 170; ++Index)
    {
        const float Angle = Index * 137.5f;
        const float Radius = 950.0f + (Index % 17) * 430.0f;
        const float X = FMath::Cos(FMath::DegreesToRadians(Angle)) * Radius;
        const float Y = FMath::Sin(FMath::DegreesToRadians(Angle)) * Radius;

        if (FMath::Abs(X) < 600.0f && FMath::Abs(Y) < 600.0f)
        {
            continue;
        }

        SpawnMeshActor(ConeMesh, FVector(X, Y, -70.0f), FRotator::ZeroRotator, FVector(0.18f, 0.18f, 0.45f), false);
    }

    const float WallThickness = 0.5f;
    const float WallHeight = 8.0f;
    SpawnMeshActor(CubeMesh, FVector(0.0f, -WorldHalfSize, 290.0f), FRotator::ZeroRotator, FVector(WorldHalfSize / 50.0f, WallThickness, WallHeight), true);
    SpawnMeshActor(CubeMesh, FVector(0.0f, WorldHalfSize, 290.0f), FRotator::ZeroRotator, FVector(WorldHalfSize / 50.0f, WallThickness, WallHeight), true);
    SpawnMeshActor(CubeMesh, FVector(-WorldHalfSize, 0.0f, 290.0f), FRotator::ZeroRotator, FVector(WallThickness, WorldHalfSize / 50.0f, WallHeight), true);
    SpawnMeshActor(CubeMesh, FVector(WorldHalfSize, 0.0f, 290.0f), FRotator::ZeroRotator, FVector(WallThickness, WorldHalfSize / 50.0f, WallHeight), true);
}

AStaticMeshActor* AVelaGameMode::SpawnMeshActor(
    UStaticMesh* Mesh,
    const FVector& Location,
    const FRotator& Rotation,
    const FVector& Scale,
    bool bCollisionEnabled)
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
    MeshComponent->SetMobility(EComponentMobility::Static);
    MeshComponent->SetCollisionEnabled(bCollisionEnabled ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
    MeshComponent->SetCollisionProfileName(bCollisionEnabled ? TEXT("BlockAll") : TEXT("NoCollision"));

    return Actor;
}
