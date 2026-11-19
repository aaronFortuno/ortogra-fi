"""Build the original, wordless playground layer with Blender's Python and aud."""
import wave
from pathlib import Path

import aud
import numpy as np

root = Path(__file__).resolve().parents[1]
rate = 32000
rng = np.random.default_rng(613)
mix = np.zeros(17 * rate)


def place(seconds, signal, level):
    start = round(seconds * rate)
    count = min(len(signal), len(mix) - start)
    if count > 0:
        mix[start:start + count] += signal[:count] * level


def call(seconds, pitch, duration, formants, level):
    """Breathy vowels with a falling contour, heard as overlapping distant calls."""
    t = np.arange(round(duration * rate)) / rate
    u = t / duration
    envelope = np.sin(np.pi * u) ** 1.4
    vibrato = .013 * np.sin(2 * np.pi * (4.7 * t + rng.random()))
    f0 = pitch * (1 + .13 * np.sin(np.pi * u) - .15 * u + vibrato)
    phase = 2 * np.pi * np.cumsum(f0) / rate
    tone = np.zeros_like(t)
    for harmonic in range(1, 22):
        hz = harmonic * f0
        weight = sum(gain * np.exp(-.5 * ((hz - f) / width) ** 2)
                     for f, width, gain in formants)
        tone += np.sin(harmonic * phase) * (.12 + weight) / harmonic ** .95
    tone += .022 * rng.standard_normal(t.size)
    signal = tone * envelope
    place(seconds, signal, level)
    place(seconds + .082, signal, level * .14)


vowels = [[(780, 135, 1.6), (1430, 220, .95), (2750, 300, .45)],
          [(540, 110, 1.6), (2150, 210, 1), (3020, 240, .40)],
          [(420, 100, 1.6), (1000, 160, 1.15), (2460, 240, .42)]]
for speaker, start in enumerate([1.2, 2.3, 4.1, 6.8, 9.2, 11.8, 13.8]):
    for voice in range(3):
        onset = start + rng.uniform(0, .85)
        pitch = rng.uniform(235, 385)
        for _ in range(rng.integers(2, 6)):
            duration = rng.uniform(.13, .43)
            call(onset, pitch * rng.uniform(.91, 1.10), duration,
                 vowels[(speaker + voice) % len(vowels)], rng.uniform(.12, .34))
            onset += duration + rng.uniform(.035, .21)

# A rubber ball on paving, with a short reflected slap from the school wall.
for start in [2.4, 8.45, 12.85]:
    for delay, level in [(0, .17), (.59, .12), (1.04, .075)]:
        t = np.arange(round(.19 * rate)) / rate
        thump = np.sin(2 * np.pi * (95*t + 3.4*(1-np.exp(-t*18)))) * np.exp(-t*32)
        slap = rng.standard_normal(t.size) * np.exp(-t*110) * .46
        signal = (1 - np.exp(-t*1200)) * (thump + slap)
        place(start + delay, signal, level)
        place(start + delay + .104, signal, level * .18)

# Attenuate close-mic bass and distant high frequencies before the window filter.
hz = np.fft.rfftfreq(len(mix), 1 / rate)
mix = np.fft.irfft(np.fft.rfft(mix) * (1 - np.exp(-(hz/100)**2)) / (1 + (hz/3400)**4))
mix *= min(10**(-31/20)/np.sqrt(np.mean(mix**2)), .39/max(abs(mix)))
scratch = root / 'tmp/desk/playground-source.wav'
scratch.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(scratch), 'wb') as wav:
    wav.setparams((1, 2, rate, 0, 'NONE', ''))
    wav.writeframes((mix * 32767).astype('<i2').tobytes())
target = root / 'assets/desk/audio/playground.mp3'
aud.Sound.file(str(scratch)).write(str(target), rate, aud.CHANNELS_MONO, aud.FORMAT_S16,
                                   aud.CONTAINER_MP3, aud.CODEC_MP3, 64000, 16384)
print(target, target.stat().st_size)
