using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Net.WebSockets;
using UnityEngine;

public sealed class VelaGameClient : MonoBehaviour
{
    private const string ServerUrl = "ws://127.0.0.1:4100/play";

    public VelaPlayerController Player;
    public Camera GameCamera;
    public GameObject TargetMarker;

    private ClientWebSocket socket;
    private CancellationTokenSource cancellation;
    private string statusText = "Starting Vela world...";
    private float reconnectTimer;
    private float cameraDistance = 10.7f;
    private bool rightMouseDown;
    private bool leftMouseDown;
    private bool leftMouseDragging;
    private float leftMouseHoldTime;
    private Vector3 leftMouseDownPosition;

    private void Awake()
    {
        RepairSceneReferences();
    }

    private void Start()
    {
        RepairSceneReferences();
        if (Player == null)
        {
            statusText = "Missing player";
            enabled = false;
            return;
        }

        Player.InputChanged += OnPlayerInputChanged;
        _ = ConnectToServer();
    }

    private void Update()
    {
        RepairSceneReferences();
        if (Player == null || GameCamera == null || TargetMarker == null)
        {
            return;
        }

        UpdateMouseInput();
        UpdateHeldMouseMovement();
        UpdateCamera();

        if (TargetMarker.activeSelf && !Player.HasMoveTarget)
        {
            TargetMarker.SetActive(false);
        }

        if ((socket == null || socket.State == WebSocketState.Closed || socket.State == WebSocketState.Aborted) && reconnectTimer <= 0f)
        {
            _ = ConnectToServer();
        }

        reconnectTimer -= Time.deltaTime;
    }

    private void OnDestroy()
    {
        cancellation?.Cancel();
        socket?.Dispose();
    }

    public void RepairSceneReferences()
    {
        if (Player == null)
        {
            Player = FindObjectOfType<VelaPlayerController>();
        }

        if (GameCamera == null)
        {
            GameCamera = Camera.main;
            if (GameCamera == null)
            {
                GameObject cameraObject = GameObject.Find("Main Camera");
                if (cameraObject != null)
                {
                    GameCamera = cameraObject.GetComponent<Camera>();
                }
            }
        }

        if (TargetMarker == null)
        {
            TargetMarker = GameObject.Find("TargetMarker");
        }
    }

    private async Task ConnectToServer()
    {
        reconnectTimer = 3f;
        statusText = "Connecting to Vela world...";
        cancellation?.Cancel();
        cancellation = new CancellationTokenSource();
        socket?.Dispose();
        socket = new ClientWebSocket();

        try
        {
            string token = Environment.GetEnvironmentVariable("VELA_GAME_TOKEN");
            string url = string.IsNullOrEmpty(token) ? ServerUrl : $"{ServerUrl}?token={Uri.EscapeDataString(token)}";
            await socket.ConnectAsync(new Uri(url), cancellation.Token);
            statusText = "Connected to Vela world";
            _ = ReadMessages(cancellation.Token);
        }
        catch
        {
            statusText = "Offline. Exploring locally";
        }
    }

    private async Task ReadMessages(CancellationToken token)
    {
        byte[] buffer = new byte[8192];

        while (!token.IsCancellationRequested && socket != null && socket.State == WebSocketState.Open)
        {
            try
            {
                WebSocketReceiveResult result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), token);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    statusText = "Disconnected. Exploring locally";
                    return;
                }

                string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                HandleServerMessage(message);
            }
            catch
            {
                statusText = "Disconnected. Exploring locally";
                return;
            }
        }
    }

    private void HandleServerMessage(string message)
    {
        if (message.Contains("\"type\":\"hello\"") || message.Contains("\"type\": \"hello\""))
        {
            string zoneId = ExtractJsonString(message, "zoneId");
            statusText = string.IsNullOrEmpty(zoneId) ? "Connected to Vela world" : $"In zone: {zoneId}";
        }
        else if (message.Contains("\"type\":\"error\"") || message.Contains("\"type\": \"error\""))
        {
            string error = ExtractJsonString(message, "error");
            statusText = string.IsNullOrEmpty(error) ? "Server error" : error;
        }
    }

    private async void OnPlayerInputChanged(Vector2 input)
    {
        if (socket == null || socket.State != WebSocketState.Open)
        {
            return;
        }

        string message = FormattableString.Invariant($"{{\"type\":\"input\",\"input\":{{\"moveX\":{input.x:0.###},\"moveY\":{input.y:0.###}}}}}");
        byte[] bytes = Encoding.UTF8.GetBytes(message);

        try
        {
            await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, cancellation.Token);
        }
        catch
        {
            statusText = "Disconnected. Exploring locally";
        }
    }

    private void UpdateMouseInput()
    {
        if (Input.GetMouseButtonDown(0))
        {
            leftMouseDown = true;
            leftMouseDragging = false;
            leftMouseHoldTime = 0f;
            leftMouseDownPosition = Input.mousePosition;
            MovePlayerToMouse(Input.mousePosition);
        }
        else if (Input.GetMouseButtonUp(0))
        {
            if (leftMouseDragging)
            {
                Player.ClearMoveTarget();
                TargetMarker.SetActive(false);
            }
            else
            {
                MovePlayerToMouse(Input.mousePosition);
            }

            leftMouseDown = false;
            leftMouseDragging = false;
            leftMouseHoldTime = 0f;
        }

        if (Input.GetMouseButtonDown(1))
        {
            rightMouseDown = true;
            TurnPlayerToMouse(Input.mousePosition);
            Player.GetComponentInChildren<VelaSoldierAnimator>()?.Shoot();
        }
        else if (Input.GetMouseButtonUp(1))
        {
            rightMouseDown = false;
        }

        if (rightMouseDown)
        {
            ZoomCamera(-Input.GetAxis("Mouse Y") * 0.8f);
        }

        ZoomCamera(-Input.mouseScrollDelta.y * 0.8f);
    }

    private void UpdateHeldMouseMovement()
    {
        if (!leftMouseDown)
        {
            return;
        }

        leftMouseHoldTime += Time.deltaTime;
        if (leftMouseHoldTime > 0.12f && (Input.mousePosition - leftMouseDownPosition).sqrMagnitude > 16f)
        {
            leftMouseDragging = true;
            MovePlayerToMouse(Input.mousePosition);
        }
    }

    private void UpdateCamera()
    {
        Vector3 offset = new Vector3(0f, cameraDistance * 0.6f, cameraDistance * 0.78f);
        Vector3 targetPosition = Player.transform.position + offset;
        GameCamera.transform.position = Vector3.Lerp(GameCamera.transform.position, targetPosition, 8f * Time.deltaTime);
        GameCamera.transform.LookAt(Player.transform.position + new Vector3(0f, 0.7f, 0f));
    }

    private void MovePlayerToMouse(Vector3 mousePosition)
    {
        if (!TryGetGroundPosition(mousePosition, out Vector3 groundPosition))
        {
            return;
        }

        Player.SetMoveTarget(groundPosition);
        TargetMarker.transform.position = new Vector3(groundPosition.x, 0.03f, groundPosition.z);
        TargetMarker.SetActive(true);
    }

    private void TurnPlayerToMouse(Vector3 mousePosition)
    {
        if (TryGetGroundPosition(mousePosition, out Vector3 groundPosition))
        {
            Player.LookAtGroundPosition(groundPosition);
        }
    }

    private bool TryGetGroundPosition(Vector3 mousePosition, out Vector3 groundPosition)
    {
        if (GameCamera == null)
        {
            groundPosition = Vector3.zero;
            return false;
        }

        Ray ray = GameCamera.ScreenPointToRay(mousePosition);
        Plane ground = new Plane(Vector3.up, Vector3.zero);
        if (ground.Raycast(ray, out float distance))
        {
            groundPosition = ray.GetPoint(distance);
            return true;
        }

        groundPosition = Vector3.zero;
        return false;
    }

    private void ZoomCamera(float amount)
    {
        cameraDistance = Mathf.Clamp(cameraDistance + amount, 5.5f, 18f);
    }

    private void OnGUI()
    {
        GUIStyle style = new GUIStyle(GUI.skin.label)
        {
            normal = { textColor = Color.white },
            fontSize = 16,
        };

        GUI.Label(new Rect(18f, 16f, 420f, 44f), statusText, style);
    }

    private static string ExtractJsonString(string json, string key)
    {
        string pattern = $"\"{key}\"";
        int keyIndex = json.IndexOf(pattern, StringComparison.Ordinal);
        if (keyIndex < 0)
        {
            return null;
        }

        int colonIndex = json.IndexOf(':', keyIndex);
        int startQuote = json.IndexOf('"', colonIndex + 1);
        int endQuote = json.IndexOf('"', startQuote + 1);
        if (colonIndex < 0 || startQuote < 0 || endQuote < 0)
        {
            return null;
        }

        return json.Substring(startQuote + 1, endQuote - startQuote - 1);
    }
}
