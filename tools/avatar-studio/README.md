# Down & Distance Avatar Studio

Local, reusable orchestration for a presenter video. It keeps four concerns separate:

1. audio normalization;
2. talking-presenter generation;
3. temporally consistent video matting;
4. 1920×1080 studio composition.

It does not implement the broader Three and Out broadcast system.

## Current feasibility audit

Audited August 30, 2026:

- macOS 15.3.2 on an Apple M4 MacBook Air;
- 16 GB unified memory and an 8-core integrated Metal GPU;
- no NVIDIA GPU or CUDA;
- Python 3.13.3;
- ffmpeg not installed;
- ComfyUI and InfiniteTalk not detected;
- approximately 1 GB disk space free at audit time.

The official [MeiGen-AI InfiniteTalk](https://github.com/MeiGen-AI/InfiniteTalk) setup uses Python 3.10, CUDA 12.1 PyTorch, xformers, flash-attn, and the Wan2.1 I2V 14B base model. That stack is not compatible with this Apple-Silicon machine as documented. The 14B base alone implies many tens of gigabytes of model storage before the audio encoder and InfiniteTalk weights. The repository code/model license is Apache-2.0; verify every transitive model's license before commercial use.

No models were downloaded and no packages were installed during this phase.

## Input quality finding

The current reference image contains two people, including a child. Do not run an avatar model against it. Replace it with a solo photo that is:

- front-facing and waist-up;
- evenly lit, without harsh face shadows;
- neutral or gently smiling;
- unobstructed around face, hair, shoulders, and arms;
- framed against a simple background;
- preferably at least 1024 pixels tall.

The current studio image is a useful background, but the desk is baked into it. Create a separate transparent `desk-foreground.png` containing only the desk/front edge to place the presenter convincingly behind it.

## Structure

```text
tools/avatar-studio/
  config/presenter.json
  input/                         # ignored private inputs
  cache/                         # ignored reusable preprocessing
  output/raw-avatar/
  output/transparent-avatar/
  output/composite/
  scripts/
```

Personal inputs, generated output, model weights, vendor checkouts, temporary data, and cache contents are ignored by Git. The existing `public/images/video/tyler_*` files are also ignored.

## Commands

Audit without installing anything:

```bash
npm run avatar:audit
```

Run the complete pipeline after engines are installed:

```bash
npm run avatar:test
```

Override narration or studio directly:

```bash
python3 tools/avatar-studio/scripts/render_test.py \
  --presenter main-presenter \
  --audio /absolute/path/to/narration.m4a \
  --studio /absolute/path/to/studio-background.png
```

The test truncates narration to 12 seconds by default.

## Presenter configuration

Edit `config/presenter.json` once. Placement uses a bottom-center anchor: `x` is the presenter center, `y` is the bottom edge, and `scale` is applied before overlay. The configuration also reserves brightness, contrast, saturation, shadow, crop mode, frame rate, and motion preset fields for a stable presenter identity across episodes.

Future narration changes do not require placement changes. Processed references, face metadata, segmentation, and engine embeddings belong under ignored `cache/<presenter-id>/` when the selected engine exposes them.

## Supported NVIDIA path: InfiniteTalk

Use the official repository on a separate NVIDIA CUDA machine. Follow its pinned Python 3.10/CUDA installation and download instructions rather than installing a similarly named package. Then provide a small wrapper through:

```bash
export INFINITETALK_RUNNER=/absolute/path/to/our-infinitetalk-wrapper
```

The wrapper contract is:

```text
runner --input-json INPUT.json --output OUTPUT.mp4
```

The generated JSON contains the reference image, normalized narration, and restrained broadcast-motion prompt. Keep the raw avatar around 480p for the proof of concept and let the compositor produce the 1080p canvas.

## Smallest practical local alternative

After freeing at least 10–15 GB, evaluate SadTalker in an isolated Python 3.10 environment using CPU or supported MPS paths. It is materially smaller than InfiniteTalk, but slower and more likely to look like a conventional talking portrait. It may not meet the desired body-motion quality. Wav2Lip is another small fallback for lip synchronization but does not create the natural broadcaster motion requested here.

Do not install either into the app's Python 3.13 environment. Keep it under ignored `vendor/` with its own environment and expose it through the same `generate_avatar.py` runner contract.

## Audio normalization

`normalize_audio.py` accepts WAV, MP3, or M4A and uses ffmpeg to produce mono, 16 kHz PCM WAV with EBU-style loudness normalization. Source audio is never overwritten.

## Transparent presenter

The intended matting engine is Robust Video Matting or an equivalent temporally consistent open-source model. Set:

```bash
export AVATAR_MATTING_RUNNER=/absolute/path/to/rvm-wrapper
```

The wrapper contract is:

```text
runner --input avatar.mp4 --output presenter-alpha.mov
```

ProRes 4444 MOV is the default interchange choice because it preserves a high-quality alpha channel for ffmpeg and a future Remotion renderer. Alpha WebM can be added for browser preview. A PNG sequence is useful for diagnostics but expensive on disk.

## Studio compositor

`composite_studio.py` creates a 1920×1080, 30 fps H.264 MP4 with this stack:

1. studio background;
2. transparent presenter;
3. optional transparent desk foreground.

Without a separate desk foreground, the compositor can place the presenter in the studio but cannot make the baked desk correctly pass in front of the body.

## Output

```text
output/raw-avatar/avatar.mp4
output/transparent-avatar/presenter-alpha.mov
output/composite/avatar-studio-test.mp4
```

## Known limitations and next step

No video was rendered because the hardware gate correctly failed: no CUDA, no ffmpeg, insufficient disk, and an unsuitable multi-person reference image. Render time and VRAM use therefore remain unmeasured.

Next: supply a solo reference image and free disk space. For the quality target, use a separate NVIDIA workstation with ample VRAM and the official InfiniteTalk stack. If keeping everything on this Mac is mandatory, run the smaller SadTalker/Wav2Lip comparison and accept a lower motion-quality ceiling.
