/**
 * Centrální konfigurace. Herní logika čte jen odsud, ne z renderu nebo UI.
 * Jednotky: metry, sekundy, radiány (pokud není uvedeno jinak).
 */
export const CONFIG = {
  seed: 20260924,
  world: {
    size: 512, // strana čtvercové mapy [m]
    cell: 2, // rozestup vzorků heightmapy [m] → 257 × 257 vrcholů
    plotRadius: 42, // poloměr srovnaného staveniště kolem počátku [m]
  },
  /** Posun lokálního rámce do S-JTSK (oblast kolem Prahy-západ), výšky Bpv. */
  sjtsk: { originY: 742_400, originX: 1_046_300, originH: 285 },
  player: {
    radius: 0.35,
    heightStand: 1.8,
    heightCrouch: 1.2,
    eyeStand: 1.65,
    eyeCrouch: 1.05,
    walkSpeed: 3.2,
    sprintSpeed: 6.0,
    crouchSpeed: 1.5,
    groundResponse: 12, // jak rychle se rychlost přizpůsobí vstupu na zemi [1/s]
    airResponse: 1.5,
    gravity: 9.81,
    jumpSpeed: 4.2,
    maxSlopeDeg: 40, // strmější svah už nevyšlápneš
    groundSnap: 0.35, // přilepení k terénu při sestupu [m]
    massSlowdownPerKg: 0.012,
    minLoadFactor: 0.78,
  },
  interaction: { range: 3.0 },
  look: {
    mouse: 0.0022, // rad / px
    touch: 0.0058, // rad / px
    maxPitch: (88 * Math.PI) / 180,
  },
  touch: {
    joystickRadius: 56, // px
    sprintThreshold: 0.93, // vytlačení joysticku na okraj = běh
  },
  loop: { fixedDt: 1 / 60, maxSubSteps: 5 },
} as const;
