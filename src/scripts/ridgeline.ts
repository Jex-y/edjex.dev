import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

type Bug = {
  x: number;
  z: number;
  heading: number;
  speed: number;
  spinning: boolean;
  amp: number;
};

type Rgb = readonly [number, number, number];

const NX = 150;
const NZ = 44;
const X0 = -1.7;
const X1 = 1.7;
const SCALE_X = 2.6;
const SCALE_Y = 0.8;
const SCALE_Z = 4.2;
const PEAK_WIDTH = 0.0145;
const MAX_HEIGHT = 1.3;
const WIDE_CANVAS = 900;
const INK: Rgb = [0, 0, 0];
const BLUE: Rgb = [0.172, 0.427, 0.71];
const LABEL_FONT = "italic 12.5px 'Literata Variable', Georgia, serif";
const TAU = Math.PI * 2;

const worldX = (x: number) => x * SCALE_X;
const worldZ = (z: number) => (z - 0.5) * SCALE_Z;

const lcg = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const peak = (x: number, z: number, cx: number, cz: number, amp: number) => {
  const dx = x - cx;
  const dz = (z - cz) * 2;
  return amp * Math.exp(-(dx * dx + dz * dz) / PEAK_WIDTH);
};

/**
 * Draws the hero: a ridgeline heatmap with one peak per simulated water flea.
 * `surface` takes the WebGL scene and `labels` a 2D overlay of the same size.
 * Pointer events are read from the canvases' shared parent.
 */
export function ridgeline(
  surface: HTMLCanvasElement,
  labels: HTMLCanvasElement,
): void {
  const host = surface.parentElement;
  const labelContext = labels.getContext('2d');
  if (!host || !labelContext) return;

  const renderer = new WebGLRenderer({ canvas: surface, antialias: true });
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio());
  renderer.setClearColor(0xffffff, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  const world = new Group();
  scene.add(world);

  const random = lcg(7);
  const bugs: Bug[] = Array.from({ length: 12 }, (_, i) => ({
    x: -0.85 + random() * 1.7,
    z: 0.12 + random() * 0.76,
    heading: random() * TAU,
    speed: 0.05 + random() * 0.07,
    spinning: i === 2 || i === 7,
    amp: 0.7 + random() * 0.3,
  }));
  const pointer = { x: 0, z: 0.5, amp: 0, target: 0 };

  const heightAt = (x: number, z: number) => {
    const fromBugs = bugs.reduce(
      (sum, bug) => sum + peak(x, z, bug.x, bug.z, bug.amp),
      0,
    );
    const fromPointer =
      pointer.amp > 0.01 ? peak(x, z, pointer.x, pointer.z, pointer.amp) : 0;
    return Math.min(fromBugs + fromPointer, MAX_HEIGHT);
  };

  const vertices = new Float32Array(NX * NZ * 3);
  const heights = new Float32Array(NX * NZ);
  const indices: number[] = [];
  for (let j = 0; j < NZ - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i;
      const b = a + 1;
      const c = a + NX;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // The white surface sits just behind the lines so nearer ridges hide farther ones.
  const surfaceGeometry = new BufferGeometry();
  surfaceGeometry.setAttribute('position', new BufferAttribute(vertices, 3));
  surfaceGeometry.setIndex(indices);
  const surfaceMesh = new Mesh(
    surfaceGeometry,
    new MeshBasicMaterial({
      color: 0xffffff,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  surfaceMesh.frustumCulled = false;
  world.add(surfaceMesh);

  const segmentCount = (NX - 1) * NZ;
  const linePositions = new Float32Array(segmentCount * 6);
  const lineColours = new Float32Array(segmentCount * 6);
  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute('position', new BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute('color', new BufferAttribute(lineColours, 3));
  const lines = new LineSegments(
    lineGeometry,
    new LineBasicMaterial({ vertexColors: true }),
  );
  lines.frustumCulled = false;
  world.add(lines);

  const shade = (
    height: number,
    row: number,
    column: number,
    offset: number,
  ) => {
    const front = row / (NZ - 1);
    const u = column / (NX - 1);
    const edge = Math.min(1, Math.min(u, 1 - u) / 0.18);
    const base = (0.16 + 0.5 * front) * edge;
    const lift = Math.min(1, Math.max(0, (height - 0.05) * 1.8));
    const alpha = Math.min(1, base + lift * 0.55 * edge);
    for (let c = 0; c < 3; c++) {
      const ink = INK[c] + (BLUE[c] - INK[c]) * lift;
      lineColours[offset + c] = 1 + (ink - 1) * alpha;
    }
  };

  const rebuild = () => {
    for (let j = 0; j < NZ; j++) {
      const z = 1 - j / (NZ - 1);
      for (let i = 0; i < NX; i++) {
        const x = X0 + (X1 - X0) * (i / (NX - 1));
        const n = j * NX + i;
        const height = heightAt(x, z);
        heights[n] = height;
        vertices[n * 3] = worldX(x);
        vertices[n * 3 + 1] = height * SCALE_Y;
        vertices[n * 3 + 2] = worldZ(z);
      }
    }
    let offset = 0;
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX - 1; i++) {
        const n = j * NX + i;
        linePositions.set(vertices.subarray(n * 3, n * 3 + 6), offset);
        shade(heights[n], j, i, offset);
        shade(heights[n + 1], j, i + 1, offset + 3);
        offset += 6;
      }
    }
    surfaceGeometry.attributes.position.needsUpdate = true;
    lineGeometry.attributes.position.needsUpdate = true;
    lineGeometry.attributes.color.needsUpdate = true;
  };

  let width = 1;
  let height = 1;
  let wide = true;
  const lookAt = new Vector3();

  const placeCamera = (drift: number) => {
    if (wide) {
      camera.position.set(0.4 + drift, 2.5, 6.6);
      lookAt.set(0.55, 0.7, 0);
      world.position.set(1.15, 0, 0);
    } else {
      camera.position.set(drift * 0.5, 3.2, 8.8);
      lookAt.set(0, 0.9, 0);
      world.position.set(0, 0, 0);
    }
    camera.lookAt(lookAt);
  };

  const resize = () => {
    width = surface.clientWidth || 1;
    height = surface.clientHeight || 1;
    wide = width > WIDE_CANVAS;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const ratio = pixelRatio();
    labels.width = Math.round(width * ratio);
    labels.height = Math.round(height * ratio);
    labelContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    placeCamera(0);
  };
  resize();
  new ResizeObserver(resize).observe(surface);

  const raycaster = new Raycaster();
  const pointerNdc = new Vector2();
  const hit = new Vector3();
  const ground = new Plane(new Vector3(0, 1, 0), 0);

  host.addEventListener('pointermove', (event) => {
    const rect = surface.getBoundingClientRect();
    pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointerNdc, camera);
    if (!raycaster.ray.intersectPlane(ground, hit)) {
      pointer.target = 0;
      return;
    }
    const x = (hit.x - world.position.x) / SCALE_X;
    const z = hit.z / SCALE_Z + 0.5;
    if (Math.abs(x) > 1.4 || z < 0 || z > 1) {
      pointer.target = 0;
      return;
    }
    pointer.x = x;
    pointer.z = z;
    pointer.target = 1;
  });
  host.addEventListener('pointerleave', () => {
    pointer.target = 0;
  });

  const projected = new Vector3();
  const drawLabels = () => {
    labelContext.clearRect(0, 0, width, height);
    labelContext.font = LABEL_FONT;
    labelContext.textBaseline = 'middle';
    const labelled = wide ? [2, 7, 0, 9] : [2, 7];
    for (const index of labelled) {
      const bug = bugs[index];
      projected
        .set(worldX(bug.x), heightAt(bug.x, bug.z) * SCALE_Y, worldZ(bug.z))
        .add(world.position)
        .project(camera);
      if (projected.z > 1) continue;
      const sx = ((projected.x + 1) / 2) * width;
      const sy = ((1 - projected.y) / 2) * height;
      labelContext.strokeStyle = 'rgba(0,0,0,0.5)';
      labelContext.lineWidth = 1;
      labelContext.beginPath();
      labelContext.arc(sx, sy, 3, 0, TAU);
      labelContext.stroke();
      labelContext.beginPath();
      labelContext.moveTo(sx, sy - 5);
      labelContext.lineTo(sx, sy - 30);
      labelContext.lineTo(sx + 10, sy - 30);
      labelContext.stroke();
      labelContext.fillStyle = bug.spinning ? '#2c6db5' : '#5f5f5f';
      labelContext.fillText(
        `${((bug.x + 1) / 2).toFixed(2)}, ${bug.z.toFixed(2)}`,
        sx + 15,
        sy - 30,
      );
    }
  };

  const easePointer = (dt: number) => {
    pointer.amp += (pointer.target - pointer.amp) * Math.min(1, dt * 6);
  };

  const step = (dt: number) => {
    for (const bug of bugs) {
      bug.heading += bug.spinning ? 3.4 * dt : (random() - 0.5) * 5 * dt;
      const speed = bug.spinning ? bug.speed * 1.6 : bug.speed;
      bug.x += Math.cos(bug.heading) * speed * dt;
      bug.z += Math.sin(bug.heading) * speed * 0.5 * dt;
      if (Math.abs(bug.x) > 0.95 || bug.z < 0.1 || bug.z > 0.9) {
        bug.heading = Math.atan2(0.5 - bug.z, -bug.x);
        bug.x = Math.max(-0.95, Math.min(0.95, bug.x));
        bug.z = Math.max(0.1, Math.min(0.9, bug.z));
      }
    }
    easePointer(dt);
  };

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = performance.now();
  let last = start;
  let visible = true;
  let scheduled = false;

  const frame = (now: number) => {
    scheduled = false;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (still) {
      easePointer(dt);
    } else {
      step(dt);
      placeCamera(Math.sin((now - start) / 9000) * 0.35);
    }
    rebuild();
    renderer.render(scene, camera);
    drawLabels();
    schedule();
  };
  const schedule = () => {
    if (scheduled || !visible) return;
    scheduled = true;
    requestAnimationFrame(frame);
  };

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    last = performance.now();
    schedule();
  }).observe(host);
  document.fonts.ready.then(drawLabels);
}
