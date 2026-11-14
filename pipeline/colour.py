"""sRGB (D65) to CIELAB, vectorised. Mirrors app/src/engine/analysis/color.ts."""
import numpy as np

XN, YN, ZN = 0.95047, 1.0, 1.08883
M = np.array([
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041],
])


def srgb_to_lab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    xyz = lin @ M.T
    xyz = xyz / np.array([XN, YN, ZN])
    eps, kappa = 216 / 24389, 24389 / 27
    f = np.where(xyz > eps, np.cbrt(xyz), (kappa * xyz + 16) / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def hue_deg(lab):
    return (np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) + 360) % 360


def chroma(lab):
    return np.hypot(lab[..., 1], lab[..., 2])
