import * as THREE from 'three';
import type { Vec3 } from '../core/math';

/** Barva z hexu jako sRGB složky – shader je zapisuje přímo, aby horizont seděl s barvou mlhy. */
const srgb = (hex: number): THREE.Vector3 => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);

/** Přechodová obloha se sluncem. Jeden draw call, jde s kamerou. */
export class Sky {
  private readonly mesh: THREE.Mesh;

  constructor(scene: THREE.Scene, radius: number, horizonHex: number, sunDir: Vec3) {
    const d = new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z).normalize();
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        horizon: { value: srgb(horizonHex) },
        zenith: { value: srgb(0x5d8fc2) },
        sunDir: { value: d },
        sunColor: { value: srgb(0xfff1d0) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww * vec4(1.0, 1.0, 0.9999, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 horizon;
        uniform vec3 zenith;
        uniform vec3 sunDir;
        uniform vec3 sunColor;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(horizon, zenith, pow(h, 0.5));
          float s = max(dot(d, sunDir), 0.0);
          col += sunColor * (pow(s, 1200.0) * 1.4 + pow(s, 14.0) * 0.16);
          gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 12), mat);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  follow(p: Vec3): void {
    this.mesh.position.set(p.x, p.y, p.z);
  }

  /** Barvy oblohy a slunce podle denní doby. */
  setDaylight(d: { sunDir: Vec3; sunColor: number; horizon: number; zenith: number }): void {
    const u = (this.mesh.material as THREE.ShaderMaterial).uniforms;
    u.horizon.value.copy(srgb(d.horizon));
    u.zenith.value.copy(srgb(d.zenith));
    u.sunDir.value.set(d.sunDir.x, d.sunDir.y, d.sunDir.z).normalize();
    u.sunColor.value.copy(srgb(d.sunColor));
  }
}
