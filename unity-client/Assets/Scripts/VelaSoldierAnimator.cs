using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;

[RequireComponent(typeof(Animator))]
public sealed class VelaSoldierAnimator : MonoBehaviour
{
    public AnimationClip IdleClip;
    public AnimationClip RunClip;
    public AnimationClip ShootClip;

    private Animator animator;
    private PlayableGraph graph;
    private AnimationClipPlayable currentPlayable;
    private string currentState;
    private float shootTimer;
    private float jumpTimer;
    private bool dying;
    private Quaternion baseRotation;
    private Vector3 basePosition;

    private void Awake()
    {
        animator = GetComponent<Animator>();
        animator.applyRootMotion = false;
        baseRotation = transform.localRotation;
        basePosition = transform.localPosition;
        PlayLoop(IdleClip, "idle", 1f);
    }

    private void OnDestroy()
    {
        if (graph.IsValid())
        {
            graph.Destroy();
        }
    }

    private void Update()
    {
        if (dying)
        {
            transform.localRotation = Quaternion.Slerp(transform.localRotation, baseRotation * Quaternion.Euler(90f, 0f, 0f), 6f * Time.deltaTime);
            return;
        }

        if (jumpTimer > 0f)
        {
            jumpTimer -= Time.deltaTime;
            float progress = 1f - Mathf.Clamp01(jumpTimer / 0.55f);
            float height = Mathf.Sin(progress * Mathf.PI) * 0.38f;
            transform.localPosition = basePosition + new Vector3(0f, height, 0f);
            if (jumpTimer <= 0f)
            {
                transform.localPosition = basePosition;
            }
        }

        if (shootTimer > 0f)
        {
            shootTimer -= Time.deltaTime;
        }
    }

    public void SetMovement(float moveAmount, bool running)
    {
        if (dying || shootTimer > 0f || jumpTimer > 0f)
        {
            return;
        }

        if (moveAmount > 0.01f)
        {
            PlayLoop(RunClip, running ? "running" : "walking", running ? 1f : 0.55f);
        }
        else
        {
            PlayLoop(IdleClip, "idle", 1f);
        }
    }

    public void Shoot()
    {
        if (dying || ShootClip == null)
        {
            return;
        }

        shootTimer = Mathf.Max(0.25f, ShootClip.length);
        PlayOnce(ShootClip, "shooting", 1f);
    }

    public void Jump()
    {
        if (dying)
        {
            return;
        }

        jumpTimer = 0.55f;
        PlayLoop(RunClip != null ? RunClip : IdleClip, "jumping", 0.8f);
    }

    public void Die()
    {
        dying = true;
        PlayLoop(IdleClip, "dying", 0.25f);
    }

    private void PlayLoop(AnimationClip clip, string state, float speed)
    {
        if (currentState == state || clip == null)
        {
            return;
        }

        PlayClip(clip, state, speed, true);
    }

    private void PlayOnce(AnimationClip clip, string state, float speed)
    {
        if (clip == null)
        {
            return;
        }

        PlayClip(clip, state, speed, false);
    }

    private void PlayClip(AnimationClip clip, string state, float speed, bool loop)
    {
        if (graph.IsValid())
        {
            graph.Destroy();
        }

        graph = PlayableGraph.Create("VelaSoldierAnimation");
        AnimationPlayableOutput output = AnimationPlayableOutput.Create(graph, "Animation", animator);
        currentPlayable = AnimationClipPlayable.Create(graph, clip);
        currentPlayable.SetSpeed(speed);
        currentPlayable.SetDuration(clip.length);
        currentPlayable.SetTime(0f);
        currentPlayable.SetPropagateSetTime(true);
        currentPlayable.GetAnimationClip().wrapMode = loop ? WrapMode.Loop : WrapMode.Once;
        output.SetSourcePlayable(currentPlayable);
        graph.Play();
        currentState = state;
    }
}
