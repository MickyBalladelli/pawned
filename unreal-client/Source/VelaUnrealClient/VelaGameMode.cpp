#include "VelaGameMode.h"

#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/World.h"
#include "UObject/ConstructorHelpers.h"
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

    static ConstructorHelpers::FObjectFinder<UStaticMesh> FloorAsset(TEXT("/Engine/BasicShapes/Cube.Cube"));
    if (!FloorAsset.Succeeded())
    {
        return;
    }

    AStaticMeshActor* Floor = World->SpawnActor<AStaticMeshActor>(FVector(0.0f, 0.0f, -105.0f), FRotator::ZeroRotator);
    if (!Floor)
    {
        return;
    }

    Floor->SetActorLabel(TEXT("VelaDebugFloor"));
    Floor->GetStaticMeshComponent()->SetStaticMesh(FloorAsset.Object);
    Floor->GetStaticMeshComponent()->SetRelativeScale3D(FVector(20.0f, 20.0f, 0.1f));
}
