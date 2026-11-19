"""Prepare Mixkit's 'Playground with kids playing' (2266) for the desk.

Run Blender in background with --python tools/prepare-desk-playground.py --
followed by the path to the original Mixkit WAV.
"""
import hashlib
import math
import sys
from pathlib import Path

import aud
import numpy as np

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[sys.argv.index('--') + 1])
expected = 'bdc7dbab0ef5d154b60bd92d487f96205af698486377eb1aa74c48045acb7f78'
if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
    raise ValueError("Expected Mixkit's original mixkit-playground-with-kids-playing-2266.wav")

# Keep the original timing and pitch. The window adds its own low-pass at playback.
clip = (aud.Sound.file(str(source)).limit(1.5, 18.5).rechannel(aud.CHANNELS_MONO)
        .highpass(120, .707).lowpass(6400, .707).fadein(0, .55).fadeout(16.2, .8))
samples = clip.data()
rms = math.sqrt(np.mean(samples.astype(np.float64) ** 2))
gain = min(10 ** (-31 / 20) / rms, 10 ** (-12 / 20) / np.max(abs(samples)))
target = root / 'assets/desk/audio/playground-park.mp3'
clip.volume(gain).write(str(target), 32000, aud.CHANNELS_MONO, aud.FORMAT_S16,
                        aud.CONTAINER_MP3, aud.CODEC_MP3, 64000, 16384)
decoded = aud.Sound.file(str(target)).data().astype(np.float64)
print(target.name, target.stat().st_size, hashlib.sha256(target.read_bytes()).hexdigest())
print('Gain dB / decoded RMS dBFS / peak dBFS / frames', 20 * math.log10(gain),
      10 * math.log10(np.mean(decoded ** 2)), 20 * math.log10(np.max(abs(decoded))), len(decoded))
