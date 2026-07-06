import * as THREE from 'three';
import { TeapotGeometry } from 'three/examples/jsm/geometries/TeapotGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Largest dimension of every puzzle mesh in world units. */
export const WORLD_SIZE = 7;

/**
 * Reduce a geometry to a non-indexed, position-only triangle soup — the form
 * sliceGeometry() wants, and identical attribute sets so mergeGeometries()
 * never bails out on a mismatch.
 */
function prepare(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  if (!g.index) return g;
  const out = g.toNonIndexed();
  g.dispose();
  return out;
}

/** Center the geometry and scale its largest dimension to WORLD_SIZE. */
function normalize(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  g.translate(-center.x, -center.y, -center.z);
  const s = WORLD_SIZE / Math.max(size.x, size.y, size.z);
  g.scale(s, s, s);
  return g;
}

/** prepare() every part, merge them, and dispose the intermediates. */
function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = parts.map(prepare);
  const merged = mergeGeometries(prepared);
  if (!merged) throw new Error('mergeGeometries failed: mismatched attributes');
  for (const p of prepared) p.dispose();
  return merged;
}

// ---------------------------------------------------------------------------
// Shape factories. Each returns fresh, ready-to-slice geometry: upright,
// centered, largest dimension = WORLD_SIZE.
// ---------------------------------------------------------------------------

export function makeGem(): THREE.BufferGeometry {
  return normalize(prepare(new THREE.IcosahedronGeometry(1, 1)));
}

export function makeHeart(): THREE.BufferGeometry {
  // Classic two-bezier heart. Drawn point-down in shape space, so flip it.
  const s = new THREE.Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 5,
    bevelEnabled: true,
    bevelThickness: 1,
    bevelSize: 1,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.rotateZ(Math.PI); // point the tip down
  return normalize(prepare(geo));
}

export function makeStar(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 1 : 0.45;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2; // one point straight up
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.45,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  return normalize(prepare(geo));
}

export function makeMug(): THREE.BufferGeometry {
  const wall = new THREE.CylinderGeometry(1, 1, 1.5, 28, 1, true);
  const bottom = new THREE.CircleGeometry(1, 28);
  bottom.rotateX(-Math.PI / 2);
  bottom.translate(0, -0.72, 0);
  // Half torus, rotated so the arc bulges out the +x side.
  const handle = new THREE.TorusGeometry(0.48, 0.13, 10, 20, Math.PI);
  handle.rotateZ(-Math.PI / 2);
  handle.translate(1.02, 0.05, 0);
  return normalize(mergeParts([wall, bottom, handle]));
}

export function makePawn(): THREE.BufferGeometry {
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.6, 0),
    new THREE.Vector2(0.62, 0.1),
    new THREE.Vector2(0.5, 0.22),
    new THREE.Vector2(0.3, 0.32),
    new THREE.Vector2(0.24, 0.6),
    new THREE.Vector2(0.2, 0.95),
    new THREE.Vector2(0.19, 1.14),
    new THREE.Vector2(0.36, 1.2), // collar
    new THREE.Vector2(0.36, 1.28),
    new THREE.Vector2(0.16, 1.34),
  ];
  // Ball head as a sampled arc.
  const headR = 0.32;
  const headY = 1.62;
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI;
    profile.push(new THREE.Vector2(Math.cos(a) * headR, headY + Math.sin(a) * headR));
  }
  return normalize(prepare(new THREE.LatheGeometry(profile, 24)));
}

export function makeRocket(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.CylinderGeometry(0.5, 0.5, 1.7, 20);
  parts.push(body);
  const nose = new THREE.ConeGeometry(0.5, 1.0, 20);
  nose.translate(0, 1.35, 0);
  parts.push(nose);
  const nozzle = new THREE.CylinderGeometry(0.28, 0.44, 0.35, 16);
  nozzle.translate(0, -1.0, 0);
  parts.push(nozzle);
  // Three fins around the tail.
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.55, -0.4);
  finShape.lineTo(0.55, -0.62);
  finShape.lineTo(0, -0.35);
  finShape.closePath();
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.ExtrudeGeometry(finShape, { depth: 0.08, bevelEnabled: false });
    fin.translate(0.45, -0.45, -0.04);
    fin.rotateY((i / 3) * Math.PI * 2);
    parts.push(fin);
  }
  return normalize(mergeParts(parts));
}

export function makeTeapot(tess = 7): THREE.BufferGeometry {
  return normalize(prepare(new TeapotGeometry(1, tess)));
}

export function makeVase(): THREE.BufferGeometry {
  const profile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.55, 0),
    new THREE.Vector2(0.62, 0.08),
    new THREE.Vector2(0.5, 0.35),
    new THREE.Vector2(0.62, 0.85),
    new THREE.Vector2(0.78, 1.25),
    new THREE.Vector2(0.72, 1.6),
    new THREE.Vector2(0.5, 1.9),
    new THREE.Vector2(0.32, 2.1),
    new THREE.Vector2(0.3, 2.3),
    new THREE.Vector2(0.38, 2.5),
    new THREE.Vector2(0.46, 2.6), // open flared rim
  ];
  return normalize(prepare(new THREE.LatheGeometry(profile, 26)));
}

export function makeGear(): THREE.BufferGeometry {
  const teeth = 9;
  const rRoot = 0.78;
  const rTip = 1;
  const s = new THREE.Shape();
  const step = (Math.PI * 2) / (teeth * 4);
  for (let i = 0; i < teeth * 4; i++) {
    // Pattern per tooth: root, root, tip, tip.
    const r = i % 4 < 2 ? rRoot : rTip;
    const a = i * step;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.32, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.4,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 1,
  });
  return normalize(prepare(geo));
}

export function makeKnot(): THREE.BufferGeometry {
  return normalize(prepare(new THREE.TorusKnotGeometry(1, 0.3, 110, 12)));
}

export function makeRook(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const base = new THREE.CylinderGeometry(0.8, 0.88, 0.35, 20);
  base.translate(0, 0.175, 0);
  parts.push(base);
  const body = new THREE.CylinderGeometry(0.52, 0.66, 1.7, 20);
  body.translate(0, 1.2, 0);
  parts.push(body);
  const top = new THREE.CylinderGeometry(0.72, 0.6, 0.35, 20);
  top.translate(0, 2.2, 0);
  parts.push(top);
  // Four crenellations on the rim.
  for (let i = 0; i < 4; i++) {
    const c = new THREE.BoxGeometry(0.34, 0.34, 0.3);
    c.translate(0.52, 2.53, 0);
    c.rotateY((i / 4) * Math.PI * 2 + Math.PI / 4);
    parts.push(c);
  }
  return normalize(mergeParts(parts));
}
