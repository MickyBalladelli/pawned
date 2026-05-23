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
    void ZoomCamera(float Value);
    void SendInputToServer();
    void UpdateMovementAnimation();

    UPROPERTY(VisibleAnywhere)
    class USpringArmComponent* SpringArm;

    UPROPERTY(VisibleAnywhere)
    class UCameraComponent* Camera;

    UPROPERTY(VisibleAnywhere)
    class UStaticMeshComponent* BodyMesh;

    UPROPERTY(VisibleAnywhere)
    class UStaticMeshComponent* HeadMesh;

    UPROPERTY(VisibleAnywhere)
    class UStaticMeshComponent* DirectionMesh;

    UPROPERTY(VisibleAnywhere)
    class UPointLightComponent* HeroLight;

    UPROPERTY()
    class UAnimSequence* IdleAnimation;

    UPROPERTY()
    class UAnimSequence* RunAnimation;

    UPROPERTY()
    class UAnimSequence* ActiveAnimation;

    float ForwardInput = 0.0f;
    float RightInput = 0.0f;
    float SendAccumulator = 0.0f;
    float MinCameraDistance = 220.0f;
    float MaxCameraDistance = 1800.0f;
    float ZoomStep = 120.0f;
};
