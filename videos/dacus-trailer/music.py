"""Scores the Dacus trailer: 128 BPM, F minor, with sound design on every cut.

Reads timeline.json (written by build.mjs) so each hit lands on its picture event.
Usage: python music.py <out.wav>
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 48000
T = json.loads((Path(__file__).parent / 'timeline.json').read_text())
B = T['beat']
S16 = B / 4
LENGTH = 15.0
N = int(SR * (LENGTH + 2.5))
rng = np.random.default_rng(11)

# Buses: drums stay dry-ish, music gets ducked by the kick, fx go wide.
drums = np.zeros((2, N))
music = np.zeros((2, N))
fx = np.zeros((2, N))
duck_env = np.zeros(N)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def secs(d):
    return np.arange(int(d * SR)) / SR


def put(bus, t, sig, pan=0.0, gain=1.0):
    i = int(round(t * SR))
    if i >= N or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    sig = sig[: N - i] * gain
    if bus.ndim == 1:
        bus[i : i + len(sig)] += sig
        return
    bus[0, i : i + len(sig)] += sig * np.cos((pan + 1) * np.pi / 4)
    bus[1, i : i + len(sig)] += sig * np.sin((pan + 1) * np.pi / 4)


def onepole_lp(x, fc):
    """Time-varying one-pole low-pass. fc may be a scalar or an array."""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * np.clip(fc, 10, SR / 2.2) / SR)
    y = np.empty_like(x)
    prev = 0.0
    for n in range(len(x)):
        prev = (1 - a[n]) * x[n] + a[n] * prev
        y[n] = prev
    return y


def fft_lp_kernel(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    taps = int(6 / (1 - a)) + 1
    k = (1 - a) * a ** np.arange(taps)
    size = 1 << int(np.ceil(np.log2(len(x) + taps)))
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(k, size), size)[: len(x)]


def hp(x, fc):
    for _ in range(2):
        x = x - fft_lp_kernel(x, fc)
    return x


# ---------- drums ----------
def kick(vel=1.0, long=False):
    t = secs(0.6 if long else 0.42)
    f = 42 + 140 * np.exp(-t / 0.03) + 30 * np.exp(-t / 0.12)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.32 if long else 0.18))
    click = hp(rng.standard_normal(len(t)), 2000) * np.exp(-t / 0.003) * 0.35
    return np.tanh((body + click) * 1.6) * vel * 0.8


def clap(vel=1.0):
    t = secs(0.35)
    noise = rng.standard_normal(len(t))
    band = hp(fft_lp_kernel(noise, 2600), 900)
    env = np.zeros_like(t)
    for off in (0, 0.011, 0.022):
        env += (t >= off) * np.exp(-np.maximum(t - off, 0) / 0.008)
    env += (t >= 0.03) * np.exp(-np.maximum(t - 0.03, 0) / 0.09) * 0.8
    return band * env * vel * 1.4


def snare(vel=1.0):
    t = secs(0.3)
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05)
    noise = hp(rng.standard_normal(len(t)), 1200) * np.exp(-t / 0.11)
    return (tone * 0.6 + noise) * vel * 0.7


def hat(vel=1.0, open_=False):
    t = secs(0.32 if open_ else 0.06)
    noise = hp(rng.standard_normal(len(t)), 7000)
    return noise * np.exp(-t / (0.12 if open_ else 0.014)) * vel * 0.5


def crash(vel=1.0, dur=2.4):
    t = secs(dur)
    noise = hp(rng.standard_normal(len(t)), 3500)
    return noise * np.exp(-t / 0.7) * vel * 0.35


# ---------- tonal ----------
def saw_stack(m, dur, cutoff, voices=7, spread=0.012, attack=0.005, release=0.08, vel=1.0):
    t = secs(dur)
    f0 = hz(m)
    out = np.zeros_like(t)
    kmax = int(min(40, 16000 / f0))
    for v in range(voices):
        det = 1 + spread * (v - (voices - 1) / 2) / ((voices - 1) / 2 or 1)
        ph = rng.uniform(0, 2 * np.pi)
        for k in range(1, kmax + 1):
            fk = f0 * det * k
            weight = (1 / k) / np.sqrt(1 + (fk / cutoff) ** 4)
            if weight < 0.002:
                break
            out += weight * np.sin(2 * np.pi * fk * t + ph * k)
    env = np.clip(t / attack, 0, 1) * np.clip((dur - t) / release, 0, 1)
    return out * env * vel / voices


def bass_note(m, dur, vel=1.0, cutoff=700):
    t = secs(dur)
    f0 = hz(m)
    saw = np.zeros_like(t)
    for k in range(1, 12):
        saw += (1 / k) / np.sqrt(1 + (f0 * k / cutoff) ** 4) * np.sin(2 * np.pi * f0 * k * t)
    sub = np.sin(2 * np.pi * f0 * t)
    env = np.clip(t / 0.004, 0, 1) * np.exp(-t / 0.35) * np.clip((dur - t) / 0.02, 0, 1)
    return (saw * 0.55 + sub * 0.8) * env * vel * 0.55


def pluck(m, vel=1.0, dur=0.45, bright=1.0):
    t = secs(dur)
    f0 = hz(m)
    out = np.zeros_like(t)
    for k in range(1, 9):
        out += (1 / k**1.1) * np.sin(2 * np.pi * f0 * k * t + k) * np.exp(-t * (7 + 5 * k / bright))
    return out * np.clip(t / 0.002, 0, 1) * vel * 0.3


def bell(m, vel=1.0, dur=1.4):
    t = secs(dur)
    f0 = hz(m)
    mod = np.sin(2 * np.pi * f0 * 3.01 * t) * 2.2 * np.exp(-t * 5)
    return np.sin(2 * np.pi * f0 * t + mod) * np.exp(-t * 2.6) * np.clip(t / 0.001, 0, 1) * vel * 0.32


def pad(notes, dur, vel=1.0, cutoff=1800):
    out = sum(saw_stack(m, dur, cutoff, voices=5, spread=0.008, attack=0.25, release=0.5) for m in notes)
    return out * vel * 0.5


def blip(m, vel=1.0):
    t = secs(0.08)
    return np.sin(2 * np.pi * hz(m) * t) * np.exp(-t / 0.02) * vel * 0.35


# ---------- fx ----------
def whoosh(dur, f_from, f_to, vel=1.0, rise=True):
    t = secs(dur)
    noise = rng.standard_normal(len(t))
    fc = np.geomspace(f_from, f_to, len(t))
    body = onepole_lp(noise, fc) - onepole_lp(noise, fc * 0.25)
    shape = (t / dur) ** 2 if rise else np.sin(np.pi * t / dur) ** 1.5
    return body * shape * vel * 1.6


def riser(dur, vel=1.0):
    t = secs(dur)
    sweep = np.sin(2 * np.pi * np.cumsum(np.geomspace(180, 2400, len(t))) / SR)
    return (sweep * 0.25 + whoosh(dur, 300, 9000, 1.0) * 0.6) * (t / dur) ** 2.2 * vel


def zip_(dur, vel=1.0):
    t = secs(dur)
    f = np.geomspace(150, 3200, len(t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-((t - dur * 0.6) / (dur * 0.35)) ** 2) * vel * 0.35


def impact(vel=1.0, sub_len=1.4):
    t = secs(sub_len)
    f = 30 + 55 * np.exp(-t / 0.25)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
    burst = hp(rng.standard_normal(len(t)), 300) * np.exp(-t / 0.06) * 0.5
    return np.tanh((boom + burst) * 1.3) * vel * 0.9


def shutter(vel=1.0):
    t = secs(0.07)
    click_a = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.004)
    click_b = hp(rng.standard_normal(len(t)), 1800) * np.exp(-np.maximum(t - 0.035, 0) / 0.006) * (t > 0.035)
    return (click_a + click_b * 0.7) * vel * 0.6


def key_click(vel=1.0):
    t = secs(0.04)
    return hp(rng.standard_normal(len(t)), 3000) * np.exp(-t / 0.005) * vel * 0.5 + np.sin(2 * np.pi * 1800 * t) * np.exp(-t / 0.008) * 0.1


def pop(vel=1.0):
    t = secs(0.12)
    f = 300 + 900 * np.exp(-t / 0.015)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.04) * vel * 0.6


# ---------- harmony on the cuts ----------
F_MIN, DB, AB, EB = (53, 56, 60, 63), (49, 53, 56, 60), (56, 60, 63, 67), (51, 55, 58, 65)
CHORDS = [  # (start, end, chord, bass root, arp tones)
    (T['storm'], T['search'], F_MIN, 41, [65, 68, 72, 75, 77]),
    (T['search'], T['depts'], DB, 37, [65, 68, 72, 73, 77]),
    (T['depts'], T['flip2'], AB, 44, [63, 67, 68, 72, 75]),
    (T['flip2'], T['cart'], EB, 39, [63, 67, 70, 74, 75]),
    (T['cart'], T['press'], F_MIN, 41, [65, 68, 72, 75, 77]),
    (T['press'], T['loyalty'], DB, 37, [65, 68, 72, 73, 77]),
    (T['loyalty'], T['tiers'], AB, 44, [63, 67, 68, 72, 75]),
    (T['tiers'], T['silence'], EB, 39, [63, 67, 70, 74, 75]),
]


def chord_at(t):
    for c in CHORDS:
        if c[0] <= t < c[1]:
            return c
    return None


def grid(t0, t1, step):
    first = np.ceil(t0 / step - 1e-6) * step
    return [round(x, 5) for x in np.arange(first, t1 - 1e-6, step)]


# ---------- 0: intro ----------
drone_t = secs(T['tot'] + 0.2)
drone = np.sin(2 * np.pi * hz(29) * drone_t) * np.clip(drone_t / 0.4, 0, 1) * 0.3
put(music, 0, drone)
put(fx, 0.0, riser(T['tot'], 0.5))
put(fx, T['line'] - 0.05, zip_(0.45, 1.0), pan=-0.2)
# Three word hits.
for t, ch, v in [(T['tot'], F_MIN, 1.0), (T['pentru'], DB, 0.9), (T['casa'], AB, 1.15)]:
    put(drums, t, kick(1.0))
    put(fx, t, impact(v * 0.8, 0.8))
    put(music, t, sum(saw_stack(m + 12, 0.22, 3200, release=0.12) for m in ch) * 0.7)
    put(duck_env, t, np.exp(-secs(0.3) / 0.09))
# Photo strobe: a shutter per photo, a snare roll and a riser into the storm.
for i in range(6):
    t = T['strobe'] + i * T['strobeStep']
    put(fx, t, shutter(1.0), pan=-0.4 + 0.16 * i)
    put(drums, t, snare(0.35 + 0.1 * i))
put(fx, T['strobe'], riser(T['storm'] - T['strobe'], 0.9))

# ---------- groove sections ----------
SECTIONS = [  # (start, end, style)
    (T['storm'], T['stormZoom'], 'full'),
    (T['search'], T['whip'], 'half'),
    (T['depts'], T['deptsOut'], 'full+stabs'),
    (T['cart'], T['iris'], 'full'),
    (T['loyalty'], T['collapse'], 'build'),
]
for start, end, style in SECTIONS:
    for t in grid(start, end, S16):
        c = chord_at(t)
        if c is None:
            continue
        step = int(round(t / S16)) % 16
        beat_pos = int(round(t / B))
        on_beat = step % 4 == 0
        progress = (t - start) / (end - start)
        # Drums
        if style == 'half':
            if on_beat and beat_pos % 4 == 2:
                put(drums, t, kick(0.95))
                put(duck_env, t, np.exp(-secs(0.35) / 0.1))
            if on_beat and beat_pos % 4 == 0:
                put(drums, t, clap(0.8), pan=0.05)
            if step % 2 == 0:
                put(drums, t, hat(0.35), pan=0.3)
        else:
            if on_beat:
                put(drums, t, kick(1.0))
                put(duck_env, t, np.exp(-secs(0.3) / 0.09))
                if beat_pos % 2 == 1:
                    put(drums, t, clap(0.9), pan=0.05)
            if step % 4 == 2:
                put(drums, t, hat(0.55, open_=True), pan=-0.25)
            put(drums, t, hat(0.28 + 0.12 * (step % 2 == 0)), pan=0.3)
        # Bass: syncopated
        if step in (0, 3, 6, 8, 10, 11, 14):
            octave = 12 if step in (6, 14) else 0
            bass_cut = 700 if style != 'build' else 300 + 400 * (1 - progress)
            put(music, t, bass_note(c[3] + octave, S16 * (2 if step in (3, 10) else 1.6), 0.9 if step % 4 == 0 else 0.7, cutoff=bass_cut))
        # Arp
        if style in ('full', 'build') or (style == 'full+stabs' and step % 2 == 0):
            note = c[4][[0, 2, 1, 3, 2, 4, 3, 1][step % 8]] + (12 if step >= 8 and style == 'build' else 0)
            bright = 1.0 if style != 'build' else 0.6 + 0.4 * (1 - progress)
            put(music, t, pluck(note, 0.55 if step % 4 else 0.8, bright=bright), pan=0.35 if step % 2 else -0.35)
        # Off-beat supersaw stabs
        if style == 'full+stabs' and step % 4 == 2:
            put(music, t, sum(saw_stack(m + 12, S16 * 1.6, 3600, release=0.04) for m in c[2]) * 0.6)
    # Pad under every section
    for c in CHORDS:
        s0, s1 = max(c[0], start), min(c[1], end)
        if s1 - s0 > 0.1:
            put(music, s0, pad(c[2], s1 - s0 + 0.3, 0.5, cutoff=1600 if style != 'half' else 900))

# ---------- picture-synced fx ----------
# Card flies at the lens, then becomes the search bar.
put(fx, T['stormZoom'], riser(T['search'] - T['stormZoom'], 1.0))
put(fx, T['search'], impact(0.6, 0.6))
put(fx, T['search'], whoosh(0.55, 4000, 400, 0.6, rise=False))
# Typing and the results dropping in.
for i in range(3):
    put(fx, T['typing'] + i * T['strobeStep'], key_click(1.0), pan=0.1 * i)
for i in range(4):
    put(fx, T['results'] + i * 0.06, blip(84 - i * 3, 0.9), pan=-0.3 + 0.2 * i)
put(fx, T['whip'] - 0.35, riser(0.35, 0.7))
put(fx, T['whip'], whoosh(0.4, 600, 9000, 1.3, rise=False))
put(drums, T['depts'], kick(1.0))
put(fx, T['depts'], crash(0.6, 1.6))
# Slat flips: a cascade of swishes.
for ft in (T['flip1'], T['flip2']):
    for i in range(5):
        put(fx, ft - 0.12 + i * 0.04, whoosh(0.16, 2500, 8000, 0.35, rise=False), pan=-0.6 + 0.3 * i)
for i in range(3):
    put(fx, T['deptsOut'] + i * 0.05, whoosh(0.22, 7000, 1200, 0.45, rise=False), pan=-0.4 + 0.4 * i)
put(drums, T['deptsOut'], snare(0.6))
put(drums, T['deptsOut'] + S16, snare(0.75))
put(fx, T['cart'], impact(0.55, 0.7))
# Price slam, button press, the chime.
put(fx, T['price'], impact(0.8, 0.6))
put(drums, T['price'], clap(1.0))
put(fx, T['press'], pop(1.0))
for i, m in enumerate([88, 93]):
    put(fx, T['added'] + i * 0.09, bell(m, 0.9, 1.2), pan=-0.2 + 0.4 * i)
put(fx, T['iris'], whoosh(T['loyalty'] - T['iris'] + 0.1, 6000, 300, 1.0, rise=True))
put(fx, T['loyalty'], impact(0.5, 0.6))
# Points counter ticks rising, the tiers, a snare roll into the collapse.
for i, t in enumerate(grid(T['points'], T['points'] + 0.8, S16 / 2)):
    put(fx, t, blip(76 + i // 2, 0.35 + 0.02 * i), pan=0.2)
for i, m in enumerate([72, 75, 80]):
    put(music, T['tiers'] + i * T['strobeStep'], sum(saw_stack(x + 12, 0.1, 4000, release=0.03) for x in (m, m + 3, m + 7)) * 0.7)
for i, t in enumerate(grid(T['tiers'] - 0.47, T['collapse'], S16 / 2)):
    put(drums, t, snare(0.25 + 0.04 * i))
put(fx, T['tiers'] - 0.47, riser(T['silence'] - T['tiers'] + 0.47, 1.0))

# ---------- the drop ----------
D = T['drop']
put(fx, D, impact(1.3, 2.4))
put(fx, D, crash(1.0, 2.8))
put(drums, D, kick(1.2, long=True))
put(duck_env, D, np.exp(-secs(0.6) / 0.2))
FINAL = (53, 56, 60, 63, 65, 68, 72)
put(music, D, sum(saw_stack(m, T['end'] - D + 0.5, 3000, voices=7, attack=0.01, release=1.2) for m in FINAL) * 0.45)
put(music, D, bass_note(29, 2.6, 1.2, cutoff=400))
for i, m in enumerate([77, 80, 84, 89]):
    put(fx, D + 0.25 + i * B / 2, bell(m, 0.7, 1.8), pan=-0.4 + 0.27 * i)
# One bar of beat after the drop, then it rings out.
for t in grid(D + B, D + B * 4, B):
    put(drums, t, kick(0.8))
    put(duck_env, t, np.exp(-secs(0.3) / 0.09))
    put(drums, t + B / 2, hat(0.4, open_=True), pan=-0.2)

# ---------- mix ----------
duck = 1 - 0.55 * np.clip(duck_env, 0, 1)
music *= duck
mix = drums * 0.9 + music * 0.75 + fx * 0.8


def reverb(x, seconds=2.2, seed=0):
    r = np.random.default_rng(seed)
    t = secs(seconds)
    ir = r.standard_normal(len(t)) * np.exp(-t / 0.45)
    ir[: int(0.015 * SR)] = 0
    ir /= np.sqrt(np.sum(ir**2))
    size = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]


send = hp(music[0] + music[1] + fx[0] + fx[1], 250) * 0.5
wet_l, wet_r = reverb(send, seed=1), reverb(send, seed=2)
scale = np.sqrt(np.mean(send**2)) / (np.sqrt(np.mean(wet_l**2)) + 1e-9)
mix[0] += wet_l * scale * 0.22
mix[1] += wet_r * scale * 0.22


def tape_stop(x, start, stop):
    """Slows the mix to a halt, like a turntable losing power."""
    a, b = int(start * SR), int(stop * SR)
    seg = x[:, a:b].copy()
    n = b - a
    pos = np.clip(np.cumsum(np.linspace(1.0, 0.0, n) ** 1.6), 0, n - 1)
    out = np.stack([np.interp(pos, np.arange(n), seg[ch]) for ch in range(2)])
    x[:, a:b] = out * np.linspace(1, 0, n) ** 0.5


# Tape stop into the silence, then a breath before the drop.
tape_stop(mix, T['collapse'] - 0.05, T['silence'])
mix[:, int(T['silence'] * SR) : int((D - 0.32) * SR)] = 0.0
put(mix, D - 0.32, riser(0.32, 0.6))

mix = mix[:, : int(LENGTH * SR)]
# Master EQ: clear the sub-rumble from the impacts, add presence.
for ch in range(2):
    mix[ch] = hp(mix[ch], 32) + hp(mix[ch], 3200) * 0.9
fade = np.ones(mix.shape[1])
fl = int(0.7 * SR)
fade[-fl:] = np.linspace(1, 0, fl) ** 1.4
mix *= fade
mix = np.tanh(mix * 1.2) / 1.2
mix /= np.max(np.abs(mix)) * 1.05
sf.write(sys.argv[1], mix.T.astype(np.float32), SR)
print('wrote', sys.argv[1])
