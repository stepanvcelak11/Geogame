import * as THREE from 'three';
import type { Heightmap } from '../world/Heightmap';
import { lambert } from './materials';
import { mergeStatic } from './mergeStatic';

/** Val zeminy: zaoblený průřez vytažený podél osy z (délka len, střed v počátku). */
function moundGeometry(len: number): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  sh.moveTo(-0.5, 0);
  sh.quadraticCurveTo(-0.3, 0.36, 0, 0.38);
  sh.quadraticCurveTo(0.3, 0.36, 0.5, 0);
  sh.lineTo(-0.5, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 5 });
  g.translate(0, 0, -len / 2);
  return g;
}

/**
 * Otevřený výkop přípojky: tmavé dno s modrou trubkou PE a val vykopané zeminy vedle.
 * Po zásypu zbude jen pruh udusané hlíny.
 */
export class TrenchView {
  readonly group = new THREE.Group();
  private open = new THREE.Group();
  private filled = new THREE.Group();

  constructor(line: readonly { x: number; z: number }[], hm: Heightmap) {
    const dark = lambert(0x3b2f22, 'trenchfloor');
    const soil = lambert(0x6f5a3e, 'trenchsoil');
    const pipe = lambert(0x2e6fd1, 'pipePE');
    const packed = lambert(0x8a7556, 'trenchfilled');
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i];
      const b = line[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      const n = Math.max(1, Math.ceil(len / 0.8));
      // Po kouscích, ať pruh sedí na terénu.
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        const y = hm.heightAt(x, z);
        const seg = len / n + 0.02;
        const floor = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.03, seg), dark);
        floor.position.set(x, y + 0.012, z);
        floor.rotation.y = yaw;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, seg, 8).rotateX(Math.PI / 2), pipe);
        p.position.set(x, y + 0.045, z);
        p.rotation.y = yaw;
        // Val zeminy vpravo od výkopu.
        const ox = Math.cos(yaw) * 0.95;
        const oz = -Math.sin(yaw) * 0.95;
        const ridge = new THREE.Mesh(moundGeometry(seg + 0.25), soil);
        ridge.position.set(x + ox, hm.heightAt(x + ox, z + oz) - 0.04, z + oz);
        ridge.rotation.set(0, yaw, 0);
        ridge.scale.set(1, 1 + 0.25 * Math.sin(k * 1.7 + i), 1);
        this.open.add(floor, p, ridge);
        const f = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, seg), packed);
        f.position.set(x, y + 0.014, z);
        f.rotation.y = yaw;
        this.filled.add(f);
      }
    }
    // Stovky kousků → pár meshí.
    this.open = mergeStatic(this.open);
    this.filled = mergeStatic(this.filled);
    this.group.add(this.open, this.filled);
    this.setBuried(false);
  }

  setBuried(buried: boolean): void {
    this.open.visible = !buried;
    this.filled.visible = buried;
  }
}
