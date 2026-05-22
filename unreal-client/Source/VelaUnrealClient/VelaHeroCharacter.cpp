#include "VelaHeroCharacter.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "UObject/ConstructorHelpers.h"
#include "VelaGameInstance.h"

AVelaHeroCharacter::AVelaHeroCharacter()
{
    PrimaryActorTick.bCanEverTick = true;

    GetCapsuleComponent()->InitCapsuleSize(42.0f, 96.0f);
    GetCharacterMovement()->MaxWalkSpeed = 520.0f;
    GetCharacterMovement()->bOrientRotationToMovement = true;
    GetCharacterMovement()->RotationRate = FRotator(0.0f, 540.0f, 0.0f);
    bUseControllerRotationYaw = false;

    BodyMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("BodyMesh"));
    BodyMesh->SetupAttachment(RootComponent);
    BodyMesh->SetRelativeLocation(FVector(0.0f, 0.0f, -96.0f));
    BodyMesh->SetRelativeScale3D(FVector(0.75f, 0.75f, 1.85f));
    BodyMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

    static ConstructorHelpers::FObjectFinder<UStaticMesh> BodyAsset(TEXT("/Engine/BasicShapes/Capsule.Capsule"));
    if (BodyAsset.Succeeded())
    {
        BodyMesh->SetStaticMesh(BodyAsset.Object);
    }

    SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("SpringArm"));
    SpringArm->SetupAttachment(RootComponent);
    SpringArm->TargetArmLength = 360.0f;
    SpringArm->SocketOffset = FVector(0.0f, 0.0f, 75.0f);
    SpringArm->SetRelativeRotation(FRotator(-18.0f, 0.0f, 0.0f));
    SpringArm->bUsePawnControlRotation = true;
    SpringArm->bEnableCameraLag = true;
    SpringArm->CameraLagSpeed = 12.0f;

    Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
    Camera->SetupAttachment(SpringArm, USpringArmComponent::SocketName);
    Camera->bUsePawnControlRotation = false;
}

void AVelaHeroCharacter::BeginPlay()
{
    Super::BeginPlay();

    UE_LOG(LogTemp, Display, TEXT("Vela hero spawned"));

    if (UVelaGameInstance* VelaGameInstance = GetGameInstance<UVelaGameInstance>())
    {
        VelaGameInstance->ConnectToGameServer();
    }
}

void AVelaHeroCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    SendAccumulator += DeltaSeconds;
    if (SendAccumulator >= 0.05f)
    {
        SendAccumulator = 0.0f;
        SendInputToServer();
    }
}

void AVelaHeroCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    PlayerInputComponent->BindAxis(TEXT("MoveForward"), this, &AVelaHeroCharacter::MoveForward);
    PlayerInputComponent->BindAxis(TEXT("MoveRight"), this, &AVelaHeroCharacter::MoveRight);
    PlayerInputComponent->BindAxis(TEXT("Turn"), this, &APawn::AddControllerYawInput);
    PlayerInputComponent->BindAxis(TEXT("LookUp"), this, &APawn::AddControllerPitchInput);
}

void AVelaHeroCharacter::MoveForward(float Value)
{
    ForwardInput = Value;

    if (Controller && FMath::Abs(Value) > KINDA_SMALL_NUMBER)
    {
        const FRotator YawRotation(0.0f, Controller->GetControlRotation().Yaw, 0.0f);
        const FVector Direction = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
        AddMovementInput(Direction, Value);
    }
}

void AVelaHeroCharacter::MoveRight(float Value)
{
    RightInput = Value;

    if (Controller && FMath::Abs(Value) > KINDA_SMALL_NUMBER)
    {
        const FRotator YawRotation(0.0f, Controller->GetControlRotation().Yaw, 0.0f);
        const FVector Direction = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);
        AddMovementInput(Direction, Value);
    }
}

void AVelaHeroCharacter::SendInputToServer()
{
    if (UVelaGameInstance* VelaGameInstance = GetGameInstance<UVelaGameInstance>())
    {
        VelaGameInstance->SendMovementInput(RightInput, ForwardInput);
    }
}
