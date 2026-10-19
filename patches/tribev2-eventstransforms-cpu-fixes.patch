This patch documents changes applied to the local tribev2 installation at
tribev2/tribev2/eventstransforms.py (gitignored as a third-party library).
The changes fix two issues that prevent TRIBEv2 text pathway from working on
CPU with PyTorch 2.6.

=== Change 1: Use base whisperx model on CPU ===

Original code selected "large-v3" whisperx model unconditionally. On CPU,
large-v3 takes >10 minutes per short audio clip, making smoke tests infeasible.

Fix: Use "base" model on CPU (transcribes in seconds with native word-level
timestamps). Use "large-v3" only on CUDA where it is fast.

Also: MPS is mapped to CPU before the model selection, since TRIBEv2 stalls
on MPS (per research in 01-RESEARCH.md).

Lines changed in _get_transcript_from_audio:

- device = "cuda" if torch.cuda.is_available() else "cpu"
- whisper_model = "large-v3"
- compute_type = "float16" if device == "cuda" else "int8"
+ device = "cuda" if torch.cuda.is_available() else "cpu"
+ # Use a smaller model on CPU for reasonable performance.
+ # large-v3 is too slow for CPU inference (>10 min per short clip).
+ # base model transcribes in seconds and is sufficient for pipeline
+ # smoke tests. MPS is excluded because TRIBEv2 stalls on MPS.
+ if device == "mps":
+     device = "cpu"
+ whisper_model = "large-v3" if device == "cuda" else "base"
+ compute_type = "float16" if device == "cuda" else "int8"

=== Change 2: Skip --align_model on CPU (PyTorch 2.6 incompatibility) ===

Original code always passed --align_model WAV2VEC2_ASR_LARGE_LV60K_960H to
whisperx, triggering pyannote model loading via torch.load. PyTorch 2.6
changed weights_only default to True, and omegaconf.listconfig.ListConfig is
not in the safe globals allowlist, causing UnpicklingError.

Fix: Only pass --align_model on CUDA + English. The base whisperx model
produces native word-level timestamps without needing alignment.

Lines changed in cmd construction:

-     "--align_model",
-     "WAV2VEC2_ASR_LARGE_LV60K_960H",
+     # On CPU, skip the pyannote alignment model (incompatible
+     # with PyTorch 2.6 weights_only=True). The base whisperx
+     # model already outputs word-level timestamps natively.
+     *(["--align_model", "WAV2VEC2_ASR_LARGE_LV60K_960H"] if device == "cuda" and language == "english" else []),

=== Change 3: Use silero VAD on CPU (PyTorch 2.6 incompatibility) ===

Even with --align_model removed, whisperx still loads the pyannote VAD
checkpoint unconditionally. That checkpoint pickles an
omegaconf.listconfig.ListConfig, which PyTorch 2.6's weights_only=True
rejects with the same UnpicklingError as the alignment model.

Fix: Pass --vad_method silero on non-CUDA devices. Silero VAD ships as a
plain torch.jit archive and does not trigger the weights_only allowlist.
The installed whisperx supports --vad_method ∈ {pyannote, silero}.

Lines changed in cmd construction (appended after the --align_model block):

+     # On non-CUDA devices, swap the default pyannote VAD for
+     # silero. Pyannote VAD also hits the PyTorch 2.6
+     # weights_only=True rejection on omegaconf.listconfig.ListConfig;
+     # silero VAD uses a plain torch.jit archive and loads cleanly.
+     *(["--vad_method", "silero"] if device != "cuda" else []),

=== Verification ===

After Changes 1 & 2, the whisperx base model successfully transcribed
a 4-second test audio clip to 10 word events with timestamps. The TSV cache
at model_cache/tribev2.demo_utils.TextToEvents.get_events,0/.../audio.tsv
confirms successful transcription.

Change 3 is required to get past the VAD load step before transcription
runs. With all three changes applied, the text pathway reaches
Llama-3.2-3B feature extraction (gated HuggingFace model, requires
HF_TOKEN + accepted terms).

=== Change 3 (2026-07-17): Retry flaky whisperx subprocess ===

`uvx whisperx` occasionally exits nonzero with an EMPTY stderr on a cold
invocation (observed after macOS/CommandLineTools updates while uv refreshes
the cached tool environment). A single flaky call previously failed the whole
analysis job even though an immediate retry succeeds.

Fix in _get_transcript_from_audio: run the whisperx subprocess up to 3 times
(2s pause between attempts) and include the returncode plus the stderr tail
in the error message when all attempts fail.


=== Change 4 (2026-08-14): Stop HOME=model_cache leaking into uvx ===

ROOT CAUSE of the recurring `whisperx failed (returncode=-15)` failures.

backend/ml/tribe_loader.py::_build_model sets, process-wide:

    os.environ["HOME"] = cache_folder.as_posix()          # -> <repo>/model_cache
    os.environ.setdefault("XDG_CACHE_HOME", ...)          # -> model_cache/.cache

This keeps torch/HF caches inside the workspace, but the whisperx subprocess
inherits it, and `uv` resolves its managed interpreters from
$HOME/.local/share/uv/python. With HOME=model_cache that directory does not
exist, so uv silently falls back to the Xcode CommandLineTools interpreter:

    $ uv python find                          -> ~/.local/share/uv/python/cpython-3.11.../python3.11
    $ HOME=model_cache uv python find         -> /Library/Developer/CommandLineTools/usr/bin/python3  (3.9.6)

On 3.9.6 several whisperx dependencies have no usable wheel and must be built
from sdist. Evidence found in the workspace cache:
  - model_cache/.cache/uv/archive-v0/*/lib/python3.9  (5 entries; the healthy
    user cache built python3.11)
  - model_cache/.cache/uv/builds-v0/.tmp*             (7 orphaned interrupted
    builds; uv removes these on success)
  - model_cache/.cache/uv/environments-v2/            (no entry newer than
    Jul 17 — uv never finished a usable env)
  - model_cache/.local/share/uv/tools/                (empty, so `uvx whisperx`
    can never reuse an installed tool and re-resolves every invocation)

Those source builds take tens of minutes, hold model_cache/.cache/uv/.lock,
and are killed under memory pressure, surfacing as SIGTERM (returncode=-15)
with an empty stderr. This is why failures did NOT correlate with content
length: only COLD runs pay the build cost. Runs that reuse an existing
audio.tsv sidecar skip whisperx entirely and complete in ~1 minute.

Reproduced and verified with the exact audio from a failed job
(model_cache/.../text=The-biggest-lesson-.../audio.mp3, 61s):
  - real HOME                     -> transcribed OK in 1m15s (exit 0)
  - HOME=model_cache              -> hung >6 min with zero output, holding
                                     model_cache/.cache/uv/.lock
  - real HOME + HF_HOME preserved -> transcribed OK in ~93s  (the fix)

Fix in _get_transcript_from_audio, when building the subprocess env:

    env["HOME"] = pwd.getpwuid(os.getuid()).pw_dir   # from the password
                                                     # database, so the
                                                     # clobbered env cannot
                                                     # fool us
    env.pop("XDG_CACHE_HOME", None)

HF_HOME is inherited unchanged, so whisperx model downloads still land in
model_cache. Note the silero VAD torch-hub cache moves to ~/.cache/torch as a
consequence; this matches the verified-working invocation.

Also hardened in the same function:
  - subprocess.run now passes timeout= (BRAINX_WHISPERX_TIMEOUT, default 900s)
    so a hang fails in minutes instead of consuming the 3600s job budget.
  - The retry loop no longer retries a NEGATIVE returncode. A signal death is
    not the cold-start flake Change 3 targeted, and retrying multiplied it
    across three nested layers (3 here x exca infra.retry x 2 in
    backend/core/queue.py::_run_screen_inference_with_retry = up to 12
    whisperx invocations for one screen).
  - The error message now names the signal (e.g. SIGTERM) and includes the
    stdout tail, not just stderr — stderr is empty precisely when the child is
    signalled, which is why the original message carried no diagnostics.
