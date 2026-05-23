#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "VelaGameMode.generated.h"

UCLASS()
class VELAUNREALCLIENT_API AVelaGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AVelaGameMode();

protected:
    virtual void BeginPlay() override;

private:
    class AStaticMeshActor* SpawnMeshActor(
        class UStaticMesh* Mesh,
        const FVector& Location,
        const FRotator& Rotation,
        const FVector& Scale,
        bool bCollisionEnabled,
        const FLinearColor& Color = FLinearColor::White);

    void SpawnPineTree(class UStaticMesh* CylinderMesh, class UStaticMesh* ConeMesh, const FVector& Location, float Scale, float Rotation);
    void SpawnBroadleafTree(class UStaticMesh* CylinderMesh, class UStaticMesh* SphereMesh, const FVector& Location, float Scale, float Rotation);
    void SpawnPalmTree(class UStaticMesh* CylinderMesh, class UStaticMesh* ConeMesh, const FVector& Location, float Scale, float Rotation);
    void SpawnBush(class UStaticMesh* SphereMesh, const FVector& Location, float Scale);
    void SpawnRock(class UStaticMesh* SphereMesh, const FVector& Location, float Scale);
    void SpawnGrassClump(class UStaticMesh* ConeMesh, const FVector& Location, float Scale, float Rotation);
    bool IsClearSpawnLocation(const FVector& Location) const;
};
