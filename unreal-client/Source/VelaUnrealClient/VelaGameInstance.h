#pragma once

#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "IWebSocket.h"
#include "VelaGameInstance.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FVelaConnectionStateChanged, const FString&, State);

UCLASS()
class VELAUNREALCLIENT_API UVelaGameInstance : public UGameInstance
{
    GENERATED_BODY()

public:
    virtual void Init() override;
    virtual void Shutdown() override;

    UPROPERTY(BlueprintAssignable, Category = "Vela|Network")
    FVelaConnectionStateChanged OnConnectionStateChanged;

    UFUNCTION(BlueprintCallable, Category = "Vela|Network")
    void ConnectToGameServer();

    UFUNCTION(BlueprintCallable, Category = "Vela|Network")
    void DisconnectFromGameServer();

    UFUNCTION(BlueprintCallable, Category = "Vela|Network")
    void SendMovementInput(float MoveX, float MoveY);

    UFUNCTION(BlueprintCallable, Category = "Vela|Network")
    bool IsConnected() const;

private:
    void BroadcastConnectionState(const FString& State);
    FString GetServerUrl() const;
    void SendJson(const TSharedRef<FJsonObject>& Payload);

    TSharedPtr<IWebSocket> Socket;
    FVector2D LastSentInput = FVector2D::ZeroVector;
};
