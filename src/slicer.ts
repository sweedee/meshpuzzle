import * as THREE from 'three';

export interface SlicedPiece {
  /** Piece geometry, re-centered on the cell center. */
  geometry: THREE.BufferGeometry;
  /** Integer grid coordinates of the cell. */
  cell: THREE.Vector3;
  /** Cell center in the source geometry's coordinate space (= solved position). */
  center: THREE.Vector3;
}

export interface SliceResult {
  pieces: SlicedPiece[];
  /** Bounding box of the source geometry that the grid was fitted to. */
  box: THREE.Box3;
  cellSize: THREE.Vector3;
  dims: THREE.Vector3;
}

type Axis = 'x' | 'y' | 'z';

/**
 * Sutherland–Hodgman clip of a convex-or-concave polygon against a single
 * axis-aligned half-space (axis >= limit when keepAbove, else axis <= limit).
 */
function clipAxis(poly: THREE.Vector3[], axis: Axis, limit: number, keepAbove: boolean): THREE.Vector3[] {
  if (poly.length === 0) return poly;
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const nxt = poly[(i + 1) % poly.length];
    const curIn = keepAbove ? cur[axis] >= limit : cur[axis] <= limit;
    const nxtIn = keepAbove ? nxt[axis] >= limit : nxt[axis] <= limit;
    if (curIn) out.push(cur);
    if (curIn !== nxtIn) {
      const t = (limit - cur[axis]) / (nxt[axis] - cur[axis]);
      out.push(cur.clone().lerp(nxt, t));
    }
  }
  return out;
}

function clipTriangleToBox(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, min: THREE.Vector3, max: THREE.Vector3): THREE.Vector3[] {
  let poly: THREE.Vector3[] = [a, b, c];
  for (const axis of ['x', 'y', 'z'] as Axis[]) {
    poly = clipAxis(poly, axis, min[axis], true);
    poly = clipAxis(poly, axis, max[axis], false);
    if (poly.length < 3) return [];
  }
  return poly;
}

/**
 * Slices an arbitrary triangle mesh into pieces along a regular grid fitted to
 * its bounding box. Works on any triangle soup — no manifold requirements.
 * Resulting pieces are open shells (cut faces are not capped).
 */
export function sliceGeometry(source: THREE.BufferGeometry, dims: THREE.Vector3): SliceResult {
  const geo = source.index ? source.toNonIndexed() : source;
  const pos = geo.getAttribute('position');

  const box = new THREE.Box3().setFromBufferAttribute(pos as THREE.BufferAttribute);
  // Pad slightly so boundary vertices land strictly inside the grid.
  box.expandByScalar(box.getSize(new THREE.Vector3()).length() * 1e-4);
  const size = box.getSize(new THREE.Vector3());
  const cellSize = new THREE.Vector3(size.x / dims.x, size.y / dims.y, size.z / dims.z);

  const buckets = new Map<string, number[]>();

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const cellMin = new THREE.Vector3();
  const cellMax = new THREE.Vector3();

  const cellIndex = (v: number, axis: Axis) =>
    THREE.MathUtils.clamp(Math.floor((v - box.min[axis]) / cellSize[axis]), 0, dims[axis] - 1);

  for (let t = 0; t < pos.count; t += 3) {
    a.fromBufferAttribute(pos as THREE.BufferAttribute, t);
    b.fromBufferAttribute(pos as THREE.BufferAttribute, t + 1);
    c.fromBufferAttribute(pos as THREE.BufferAttribute, t + 2);

    // Range of cells the triangle's bounding box overlaps.
    const i0 = cellIndex(Math.min(a.x, b.x, c.x), 'x');
    const i1 = cellIndex(Math.max(a.x, b.x, c.x), 'x');
    const j0 = cellIndex(Math.min(a.y, b.y, c.y), 'y');
    const j1 = cellIndex(Math.max(a.y, b.y, c.y), 'y');
    const k0 = cellIndex(Math.min(a.z, b.z, c.z), 'z');
    const k1 = cellIndex(Math.max(a.z, b.z, c.z), 'z');

    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        for (let k = k0; k <= k1; k++) {
          cellMin.set(
            box.min.x + i * cellSize.x,
            box.min.y + j * cellSize.y,
            box.min.z + k * cellSize.z
          );
          cellMax.copy(cellMin).add(cellSize);
          const poly = clipTriangleToBox(a, b, c, cellMin, cellMax);
          if (poly.length < 3) continue;

          const key = `${i},${j},${k}`;
          let bucket = buckets.get(key);
          if (!bucket) {
            bucket = [];
            buckets.set(key, bucket);
          }
          // Fan-triangulate the clipped polygon.
          for (let n = 1; n < poly.length - 1; n++) {
            bucket.push(
              poly[0].x, poly[0].y, poly[0].z,
              poly[n].x, poly[n].y, poly[n].z,
              poly[n + 1].x, poly[n + 1].y, poly[n + 1].z
            );
          }
        }
      }
    }
  }

  // Pieces with less surface than this are invisible slivers — drop them so
  // the player isn't asked to place something they can barely see.
  const minArea = cellSize.x * cellSize.y * 0.002;
  const pieces: SlicedPiece[] = [];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();

  for (const [key, verts] of buckets) {
    let area = 0;
    for (let v = 0; v < verts.length; v += 9) {
      a.set(verts[v], verts[v + 1], verts[v + 2]);
      b.set(verts[v + 3], verts[v + 4], verts[v + 5]);
      c.set(verts[v + 6], verts[v + 7], verts[v + 8]);
      area += e1.subVectors(b, a).cross(e2.subVectors(c, a)).length() * 0.5;
    }
    if (area < minArea) continue;

    const [i, j, k] = key.split(',').map(Number);
    const center = new THREE.Vector3(
      box.min.x + (i + 0.5) * cellSize.x,
      box.min.y + (j + 0.5) * cellSize.y,
      box.min.z + (k + 0.5) * cellSize.z
    );

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.computeVertexNormals();

    pieces.push({ geometry, cell: new THREE.Vector3(i, j, k), center });
  }

  return { pieces, box, cellSize, dims: dims.clone() };
}
