using System;
using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public sealed class VelaPlayerController : MonoBehaviour
{
    public event Action<Vector2> InputChanged;

    [SerializeField] private float speed = 5f;
    [SerializeField] private float turnSpeed = 10f;
    [SerializeField] private float targetStopDistance = 0.12f;

    private CharacterController controller;
    private Vector2 lastInput;
    private Vector3 moveTarget;
    private bool hasMoveTarget;
    private float lookTargetYaw;
    private bool hasLookTarget;
    private float walkTime;

    public bool HasMoveTarget => hasMoveTarget;

    private void Awake()
    {
        controller = GetComponent<CharacterController>();
    }

    private void Update()
    {
        float moveX = GetAxis(KeyCode.A, KeyCode.D);
        float moveY = GetAxis(KeyCode.W, KeyCode.S);
        Vector2 input = Vector2.ClampMagnitude(new Vector2(moveX, moveY), 1f);
        Vector3 direction = new Vector3(input.x, 0f, input.y);

        if (input.magnitude > 0.01f)
        {
            hasMoveTarget = false;
        }
        else if (hasMoveTarget)
        {
            Vector3 targetDirection = moveTarget - transform.position;
            targetDirection.y = 0f;
            float distance = targetDirection.magnitude;
            if (distance <= targetStopDistance)
            {
                hasMoveTarget = false;
                direction = Vector3.zero;
            }
            else
            {
                direction = targetDirection.normalized;
            }
        }

        controller.SimpleMove(direction * speed);

        if (direction.magnitude > 0.01f)
        {
            float targetYaw = Mathf.Atan2(direction.x, direction.z) * Mathf.Rad2Deg;
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.Euler(0f, targetYaw, 0f), turnSpeed * Time.deltaTime);
            hasLookTarget = false;
        }
        else if (hasLookTarget)
        {
            Quaternion targetRotation = Quaternion.Euler(0f, lookTargetYaw, 0f);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, turnSpeed * Time.deltaTime);
            if (Quaternion.Angle(transform.rotation, targetRotation) < 0.5f)
            {
                hasLookTarget = false;
            }
        }

        if ((input - lastInput).sqrMagnitude > 0.0001f)
        {
            lastInput = input;
            InputChanged?.Invoke(input);
        }

        UpdateWalkAnimation(direction.magnitude);
    }

    public void SetMoveTarget(Vector3 target)
    {
        moveTarget = target;
        hasMoveTarget = true;
    }

    public void ClearMoveTarget()
    {
        hasMoveTarget = false;
    }

    public void LookAtGroundPosition(Vector3 target)
    {
        Vector3 direction = target - transform.position;
        direction.y = 0f;
        if (direction.magnitude <= 0.01f)
        {
            return;
        }

        lookTargetYaw = Mathf.Atan2(direction.x, direction.z) * Mathf.Rad2Deg;
        hasLookTarget = true;
    }

    private void UpdateWalkAnimation(float moveAmount)
    {
        Transform leftArm = transform.Find("LeftArm");
        Transform rightArm = transform.Find("RightArm");
        Transform leftLeg = transform.Find("LeftLeg");
        Transform rightLeg = transform.Find("RightLeg");
        Transform body = transform.Find("Body");
        Transform head = transform.Find("Head");

        if (moveAmount > 0.01f)
        {
            walkTime += Time.deltaTime * 9f;
        }
        else
        {
            walkTime = Mathf.Lerp(walkTime, 0f, 10f * Time.deltaTime);
        }

        float swing = Mathf.Sin(walkTime) * 32f * Mathf.Clamp01(moveAmount);
        if (leftArm != null) leftArm.localRotation = Quaternion.Euler(swing, 0f, 0f);
        if (rightArm != null) rightArm.localRotation = Quaternion.Euler(-swing, 0f, 0f);
        if (leftLeg != null) leftLeg.localRotation = Quaternion.Euler(-swing, 0f, 0f);
        if (rightLeg != null) rightLeg.localRotation = Quaternion.Euler(swing, 0f, 0f);

        float bob = Mathf.Sin(walkTime * 2f) * 0.04f * Mathf.Clamp01(moveAmount);
        if (body != null) body.localPosition = new Vector3(0f, -0.1f + bob, 0f);
        if (head != null) head.localPosition = new Vector3(0f, 0.8f + bob, 0f);
    }

    private static float GetAxis(KeyCode negative, KeyCode positive)
    {
        float value = 0f;
        if (Input.GetKey(negative)) value -= 1f;
        if (Input.GetKey(positive)) value += 1f;
        return value;
    }
}
