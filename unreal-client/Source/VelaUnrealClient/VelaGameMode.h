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
        bool bCollisionEnabled);
};
