#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "VelaHeroCharacter.generated.h"

UCLASS()
class VELAUNREALCLIENT_API AVelaHeroCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    AVelaHeroCharacter();

    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

protected:
    virtual void BeginPlay() override;

private:
    void MoveForward(float Value);
    void MoveRight(float Value);
    void SendInputToServer();

    UPROPERTY(VisibleAnywhere)
    class USpringArmComponent* SpringArm;

    UPROPERTY(VisibleAnywhere)
    class UCameraComponent* Camera;

    UPROPERTY(VisibleAnywhere)
    class UStaticMeshComponent* BodyMesh;

    float ForwardInput = 0.0f;
    float RightInput = 0.0f;
    float SendAccumulator = 0.0f;
};
