#include "VelaGameInstance.h"

#include "Async/Async.h"
#include "Json.h"
#include "JsonUtilities.h"
#include "Modules/ModuleManager.h"
#include "WebSocketsModule.h"

void UVelaGameInstance::Init()
{
    Super::Init();

    if (!FModuleManager::Get().IsModuleLoaded("WebSockets"))
    {
        FModuleManager::Get().LoadModule("WebSockets");
    }

    UE_LOG(LogTemp, Display, TEXT("Vela game instance ready"));
    ConnectToGameServer();
}

void UVelaGameInstance::Shutdown()
{
    DisconnectFromGameServer();
    Super::Shutdown();
}

void UVelaGameInstance::ConnectToGameServer()
{
    if (Socket.IsValid() && Socket->IsConnected())
    {
        return;
    }

    const FString ServerUrl = GetServerUrl();
    UE_LOG(LogTemp, Display, TEXT("Connecting to Vela game server: %s"), *ServerUrl);

    Socket = FWebSocketsModule::Get().CreateWebSocket(ServerUrl);

    Socket->OnConnected().AddLambda([this]()
    {
        UE_LOG(LogTemp, Display, TEXT("Connected to Vela game server"));
        BroadcastConnectionState(TEXT("Connected"));
    });

    Socket->OnConnectionError().AddLambda([this](const FString& Error)
    {
        UE_LOG(LogTemp, Warning, TEXT("Vela game server connection failed: %s"), *Error);
        BroadcastConnectionState(TEXT("Offline"));
    });

    Socket->OnClosed().AddLambda([this](int32 StatusCode, const FString& Reason, bool bWasClean)
    {
        UE_LOG(LogTemp, Log, TEXT("Vela game server closed: %d %s clean=%s"), StatusCode, *Reason, bWasClean ? TEXT("true") : TEXT("false"));
        BroadcastConnectionState(TEXT("Disconnected"));
    });

    Socket->OnMessage().AddLambda([](const FString& Message)
    {
        UE_LOG(LogTemp, Verbose, TEXT("Vela game server message: %s"), *Message);
    });

    Socket->Connect();
    BroadcastConnectionState(TEXT("Connecting"));
}

void UVelaGameInstance::DisconnectFromGameServer()
{
    if (Socket.IsValid())
    {
        Socket->Close();
        Socket.Reset();
    }
}

void UVelaGameInstance::SendMovementInput(float MoveX, float MoveY)
{
    const FVector2D CurrentInput(MoveX, MoveY);

    if (CurrentInput.Equals(LastSentInput, 0.001f))
    {
        return;
    }

    LastSentInput = CurrentInput;

    if (!IsConnected())
    {
        return;
    }

    const TSharedRef<FJsonObject> Input = MakeShared<FJsonObject>();
    Input->SetNumberField(TEXT("moveX"), MoveX);
    Input->SetNumberField(TEXT("moveY"), MoveY);

    const TSharedRef<FJsonObject> Payload = MakeShared<FJsonObject>();
    Payload->SetStringField(TEXT("type"), TEXT("input"));
    Payload->SetObjectField(TEXT("input"), Input);

    SendJson(Payload);
}

bool UVelaGameInstance::IsConnected() const
{
    return Socket.IsValid() && Socket->IsConnected();
}

FString UVelaGameInstance::GetServerUrl() const
{
    FString Url = TEXT("ws://127.0.0.1:4100/play");

    if (FParse::Value(FCommandLine::Get(), TEXT("VelaServer="), Url))
    {
        return Url;
    }

    return Url;
}

void UVelaGameInstance::BroadcastConnectionState(const FString& State)
{
    if (IsInGameThread())
    {
        OnConnectionStateChanged.Broadcast(State);
        return;
    }

    TWeakObjectPtr<UVelaGameInstance> WeakThis(this);
    AsyncTask(ENamedThreads::GameThread, [WeakThis, State]()
    {
        if (UVelaGameInstance* GameInstance = WeakThis.Get())
        {
            GameInstance->OnConnectionStateChanged.Broadcast(State);
        }
    });
}

void UVelaGameInstance::SendJson(const TSharedRef<FJsonObject>& Payload)
{
    FString Output;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Output);
    FJsonSerializer::Serialize(Payload, Writer);
    Socket->Send(Output);
}
