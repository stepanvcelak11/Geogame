import * as THREE from 'three';

/**
 * Čelovka/baterka na kameře. Světlo existuje od startu s nulovou intenzitou,
 * takže zapnutí nevyvolá rekompilaci shaderů (na mobilu by to škublo).
 */
export class Flashlight {
  private readonly light = new THREE.SpotLight(0xfff2dc, 0, 40, 0.42, 0.6, 1.3);
  on = false;

  constructor(camera: THREE.Camera) {
    this.light.position.set(0.22, -0.12, 0.05);
    this.light.target.position.set(0.05, -0.25, -6);
    camera.add(this.light, this.light.target);
  }

  toggle(): boolean {
    this.on = !this.on;
    this.light.intensity = this.on ? 70 : 0;
    return this.on;
  }
}
