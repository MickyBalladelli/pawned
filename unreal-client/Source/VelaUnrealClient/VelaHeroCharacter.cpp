#include "VelaHeroCharacter.h"

#include "Camera/CameraComponent.h"
#include "Animation/AnimSequence.h"
#include "Components/CapsuleComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "Engine/SkeletalMesh.h"
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

    bool bHasHumanoidMesh = false;
    static ConstructorHelpers::FObjectFinder<USkeletalMesh> HumanoidAsset(TEXT("/Game/Mannequin/Character/Mesh/SK_Mannequin.SK_Mannequin"));
    if (HumanoidAsset.Succeeded())
    {
        GetMesh()->SetSkeletalMesh(HumanoidAsset.Object);
        GetMesh()->SetRelativeLocation(FVector(0.0f, 0.0f, -96.0f));
        GetMesh()->SetRelativeRotation(FRotator(0.0f, -90.0f, 0.0f));
        GetMesh()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        GetMesh()->SetAnimationMode(EAnimationMode::AnimationSingleNode);
        bHasHumanoidMesh = true;
    }

    static ConstructorHelpers::FObjectFinder<UAnimSequence> IdleAsset(TEXT("/Game/Character/Animations/ThirdPersonIdle.ThirdPersonIdle"));
    if (IdleAsset.Succeeded())
    {
        IdleAnimation = IdleAsset.Object;
    }

    static ConstructorHelpers::FObjectFinder<UAnimSequence> RunAsset(TEXT("/Game/Character/Animations/ThirdPersonRun.ThirdPersonRun"));
    if (RunAsset.Succeeded())
    {
        RunAnimation = RunAsset.Object;
    }

    BodyMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("BodyMesh"));
    BodyMesh->SetupAttachment(RootComponent);
    BodyMesh->SetRelativeLocation(FVector(0.0f, 0.0f, -96.0f));
    BodyMesh->SetRelativeScale3D(FVector(0.75f, 0.75f, 1.85f));
    BodyMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    BodyMesh->SetHiddenInGame(bHasHumanoidMesh);

    static ConstructorHelpers::FObjectFinder<UStaticMesh> BodyAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    if (BodyAsset.Succeeded())
    {
        BodyMesh->SetStaticMesh(BodyAsset.Object);
    }

    HeadMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("HeadMesh"));
    HeadMesh->SetupAttachment(RootComponent);
    HeadMesh->SetRelativeLocation(FVector(0.0f, 0.0f, 70.0f));
    HeadMesh->SetRelativeScale3D(FVector(0.55f, 0.55f, 0.55f));
    HeadMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    HeadMesh->SetHiddenInGame(bHasHumanoidMesh);

    static ConstructorHelpers::FObjectFinder<UStaticMesh> HeadAsset(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    if (HeadAsset.Succeeded())
    {
        HeadMesh->SetStaticMesh(HeadAsset.Object);
    }

    DirectionMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("DirectionMesh"));
    DirectionMesh->SetupAttachment(RootComponent);
    DirectionMesh->SetRelativeLocation(FVector(55.0f, 0.0f, 10.0f));
    DirectionMesh->SetRelativeRotation(FRotator(0.0f, 90.0f, 0.0f));
    DirectionMesh->SetRelativeScale3D(FVector(0.35f, 0.35f, 0.55f));
    DirectionMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    DirectionMesh->SetHiddenInGame(bHasHumanoidMesh);

    static ConstructorHelpers::FObjectFinder<UStaticMesh> DirectionAsset(TEXT("/Engine/BasicShapes/Cone.Cone"));
    if (DirectionAsset.Succeeded())
    {
        DirectionMesh->SetStaticMesh(DirectionAsset.Object);
    }

    HeroLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("HeroLight"));
    HeroLight->SetupAttachment(RootComponent);
    HeroLight->SetRelativeLocation(FVector(-80.0f, 0.0f, 120.0f));
    HeroLight->Intensity = 2500.0f;
    HeroLight->AttenuationRadius = 500.0f;

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

    UpdateMovementAnimation();
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

    UpdateMovementAnimation();
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

void AVelaHeroCharacter::UpdateMovementAnimation()
{
    if (!GetMesh()->GetSkeletalMeshAsset())
    {
        return;
    }

    UAnimSequence* DesiredAnimation = GetVelocity().SizeSquared2D() > 100.0f ? RunAnimation : IdleAnimation;
    if (!DesiredAnimation || DesiredAnimation == ActiveAnimation)
    {
        return;
    }

    ActiveAnimation = DesiredAnimation;
    GetMesh()->PlayAnimation(ActiveAnimation, true);
}
