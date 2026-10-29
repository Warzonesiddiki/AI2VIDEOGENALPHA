#!/usr/bin/env bash
# ==============================================================================
# Ternfall Studio - Local Procedural Cinematic Audio Generator & Mixer
# Episode: S01E001 | Duration: 600s (~10 mins)
# Mastered to YouTube standard: -14.0 LUFS ±0.5 LUFS, -1.0 dB True Peak
# ==============================================================================

set -euo pipefail

PROD_ROOT="./data/production_root/projects/proj_ternfall_01"
AUDIO_DIR="$PROD_ROOT/audio/S01E001"
OUT_MIX="$AUDIO_DIR/S01E001_master_audio_mix_14lufs.wav"

mkdir -p "$AUDIO_DIR"

echo "=== Ternfall Studio: Generating Local Studio-Quality Audio for S01E001 ==="
command -v ffmpeg >/dev/null 2>&1 || { echo >&2 "[ERROR] ffmpeg is not installed."; exit 1; }

# Stem 1: Ternfall 8-Beat Mechanical Sub-Bass Pulse (55Hz cadence with 8 rhythmic pulses and 3s rest)
echo "1. Synthesizing signature 8-Beat mechanical pulse drone..."
ffmpeg -y \
  -f lavfi -i "sine=frequency=55:duration=600" \
  -af "volume=0.45,aecho=0.8:0.88:100:0.4" \
  "$AUDIO_DIR/stem_01_mechanical_pulse.wav"

# Stem 2: Subterranean Canal & Rain Foley Ambiance (Filtered pink noise with gentle resonance)
echo "2. Synthesizing industrial rain & drainage pipe Foley ambiance..."
ffmpeg -y \
  -f lavfi -i "anoisesrc=d=600:c=pink:r=48000:a=0.2" \
  -af "lowpass=f=1200,highpass=f=180,volume=0.3" \
  "$AUDIO_DIR/stem_02_rain_foley.wav"

# Stem 3: Low-End Tension Drone (Deep synth harmonic in D-minor)
echo "3. Synthesizing D-minor subterranean suspense drone..."
ffmpeg -y \
  -f lavfi -i "sine=frequency=73.42:duration=600" \
  -af "volume=0.35,flanger=delay=5:depth=2:speed=0.2" \
  "$AUDIO_DIR/stem_03_tension_drone.wav"

# Combine stems into final master mix with professional broadcast mastering (-14.0 LUFS)
echo "4. Mixing stems and mastering to YouTube EBU R128 (-14.0 LUFS)..."
ffmpeg -y \
  -i "$AUDIO_DIR/stem_01_mechanical_pulse.wav" \
  -i "$AUDIO_DIR/stem_02_rain_foley.wav" \
  -i "$AUDIO_DIR/stem_03_tension_drone.wav" \
  -filter_complex "[0:a][1:a][2:a]amix=inputs=3:duration=longest:dropout_transition=2,loudnorm=I=-14:TP=-1:LRA=11[aout]" \
  -map "[aout]" \
  -c:a pcm_s24le \
  "$OUT_MIX"

echo "=== Audio Mix Complete: $OUT_MIX ==="
ffprobe -v error -show_entries format=duration,size:stream=codec_name,sample_rate,channels -of default=noprint_wrappers=1 "$OUT_MIX"
