/* KARLCON Studio — Season 3: the Concept Room.
   A bright design room instead of the dark news set: a polished concrete floor, white panelled walls,
   and the season's full-size roof-light mock-up on a low platform in the middle, where the hosts can
   walk up to it. Around the walls: the story screen, the glazing-bar system on a profile board
   (the sections from the reference sheets), the glass tint samples (all twelve, labelled), a
   workbench, and the Atlas globe. The hosts stand (no desk) and move between marks.
   Same interface as buildStudio (set.js), plus: marks, touchMark(), cams (shot tuning for this room). */
import * as THREE from 'three';
import { buildScreen, buildGlobe, buildDust, drawMark, canvasTex, box, cyl, mat } from './set.js';
import { BUILDERS_S3, TINTS } from './skylights.js';

const RED = 0xD0231A;
const M = {
  wall: new THREE.MeshStandardMaterial({ color: 0xE9E7E2, roughness: 0.85 }),
  seam: new THREE.MeshStandardMaterial({ color: 0xD2CFC9, roughness: 0.9 }),
  oak: new THREE.MeshStandardMaterial({ color: 0xB0875A, roughness: 0.6 }),
  plinth: new THREE.MeshStandardMaterial({ color: 0x2E3035, roughness: 0.55, metalness: 0.2 }),
  board: new THREE.MeshStandardMaterial({ color: 0x24262A, roughness: 0.7 }),
  alu: new THREE.MeshStandardMaterial({ color: 0xC4C8CD, roughness: 0.28, metalness: 0.9 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0x9A9DA2, roughness: 0.9, emissive: 0x4A4D52 }),
  glow: new THREE.MeshBasicMaterial({ color: 0xD9DEE3 }),
  deck: new THREE.MeshStandardMaterial({ color: 0x5E6166, roughness: 0.85 }),
  deckSide: new THREE.MeshStandardMaterial({ color: 0xD8D5CF, roughness: 0.9 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x55595F, roughness: 0.4, metalness: 0.8 })
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* a painted sign on a plane */
function sign(w, h, px, draw) {
  const { tex } = canvasTex(Math.round(w * px), Math.round(h * px), draw);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, transparent: true }));
}

/* the back wall: white panels, an oak slat feature behind the platform, the room's name */
function backWall() {
  const G = new THREE.Group();
  const w = box(20, 6.5, 0.2, M.wall, 0, 3.25, 0); G.add(w);
  for (let x = -9; x <= 9; x += 1.5) G.add(box(0.02, 6.5, 0.02, M.seam, x, 3.25, 0.11));
  G.add(box(20, 0.02, 0.02, M.seam, 0, 2.4, 0.11));
  for (let i = 0; i < 26; i++) G.add(box(0.07, 4.2, 0.05, M.oak, -2.6 + i * 0.2, 2.1, 0.14));   // oak slats
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 0.03), new THREE.MeshBasicMaterial({ color: 0xFFE4BF })); strip.position.set(0, 4.25, 0.17); G.add(strip);
  const name = sign(4.6, 0.9, 400, (g, W, H) => {
    g.clearRect(0, 0, W, H); drawMark(g, 10, 10, H - 20, '#D0231A');
    g.fillStyle = '#1B1D21'; g.font = `800 ${H * 0.42}px Montserrat, sans-serif`; g.fillText('CONCEPT ROOM', H + 10, H * 0.55);
    g.fillStyle = '#6B6F76'; g.font = `600 ${H * 0.17}px "IBM Plex Mono", monospace`; g.fillText('KARLCON LUMEN BUILDS · ELITE RETREATS', H + 14, H * 0.86);
  });
  name.position.set(-5.9, 4.9, 0.12); G.add(name);
  G.add(box(20, 0.08, 0.03, new THREE.MeshStandardMaterial({ color: RED, roughness: 0.4 }), 0, 0.9, 0.12));   // a red datum line
  return G;
}

/* the glazing-bar system, piece by piece, on a dark board: sections and short lengths */
function profileBoard() {
  const G = new THREE.Group();
  G.add(box(3.2, 2.2, 0.06, M.board, 0, 1.75, 0));
  const title = sign(3.0, 0.3, 300, (g, W, H) => { g.fillStyle = '#FFFFFF'; g.font = `800 ${H * 0.5}px Montserrat, sans-serif`; g.fillText('THE GLAZING-BAR SYSTEM', 8, H * 0.7); });
  title.position.set(0, 2.66, 0.04); G.add(title);
  const items = [
    ['1000', 'SILL BASE', (o) => { o.add(box(0.1, 0.03, 0.4, M.alu, 0, 0, 0)); o.add(box(0.02, 0.06, 0.4, M.alu, 0.04, 0.03, 0)); }],
    ['1001', 'RAFTER BASE', (o) => { o.add(box(0.06, 0.08, 0.4, M.alu, 0, 0, 0)); o.add(box(0.1, 0.012, 0.4, M.alu, 0, 0.04, 0)); }],
    ['TAPE', 'GLAZING TAPE', (o) => { for (const x of [-0.035, 0.035]) o.add(box(0.025, 0.006, 0.4, new THREE.MeshStandardMaterial({ color: 0x16171A }), x, 0.045, 0)); }],
    ['4009', 'PRESSURE BAR', (o) => { o.add(box(0.07, 0.014, 0.4, M.alu, 0, 0, 0)); }],
    ['4008', 'SNAP CAP', (o) => { const g = new THREE.CylinderGeometry(0.045, 0.045, 0.4, 20, 1, false, 0, Math.PI); g.rotateX(Math.PI / 2); g.rotateZ(Math.PI / 2); const m = new THREE.Mesh(g, M.alu); m.scale.y = 0.5; o.add(m); }],
    ['3919', 'PERIMETER CAP', (o) => { o.add(box(0.08, 0.015, 0.4, M.alu, 0, 0.03, 0)); o.add(box(0.015, 0.07, 0.4, M.alu, 0.04, 0, 0)); }]
  ];
  items.forEach(([code, label, make], i) => {
    const x = -1.2 + (i % 3) * 1.2, y = i < 3 ? 2.05 : 1.2;
    const piece = new THREE.Group(); make(piece); piece.rotation.set(-Math.PI / 2 + 0.35, 0.5, 0); piece.position.set(x, y, 0.2); G.add(piece);
    piece.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    const l = sign(1.0, 0.2, 300, (g, W, H) => { g.fillStyle = '#E8453B'; g.font = `700 ${H * 0.42}px "IBM Plex Mono", monospace`; g.fillText(code, 6, H * 0.45); g.fillStyle = '#FFFFFF'; g.font = `600 ${H * 0.34}px Inter, sans-serif`; g.fillText(label, 6, H * 0.88); });
    l.position.set(x, y - 0.33, 0.04); G.add(l);
  });
  return G;
}

/* the twelve glass tints, clamped on posts, labelled as on the sample sheet */
function tintWall() {
  const G = new THREE.Group(), names = Object.keys(TINTS);
  G.add(box(4.3, 0.1, 0.5, M.plinth, 0, 0.05, 0));
  names.forEach((n, i) => {
    const col = i % 6, row = Math.floor(i / 6), x = -1.8 + col * 0.72, y = row ? 0.75 : 1.65;
    const c = new THREE.Color(TINTS[n]), dark = c.getHSL({}).l < 0.4;
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.012), new THREE.MeshPhysicalMaterial({ color: TINTS[n], roughness: 0.05, transparent: true, opacity: dark ? 0.8 : n === 'Ultra Clear' ? 0.25 : 0.55, clearcoat: 1, envMapIntensity: 1.8 }));
    pane.position.set(x, y + 0.2, 0); G.add(pane);
    G.add(box(0.06, 0.06, 0.04, M.alu, x, y - 0.12, 0));                         // the clamp
    G.add(cyl(0.012, 0.012, y - 0.12, M.steel, x, (y - 0.12) / 2, -0.03, 8));
    const l = sign(0.66, 0.1, 400, (g, W, H) => { g.fillStyle = '#1B1D21'; g.font = `600 ${H * 0.6}px Inter, sans-serif`; g.textAlign = 'center'; g.fillText(n, W / 2, H * 0.75); });
    l.position.set(x, y - 0.2, 0.03); G.add(l);
  });
  const t = sign(3.6, 0.28, 300, (g, W, H) => { g.fillStyle = '#1B1D21'; g.font = `800 ${H * 0.55}px Montserrat, sans-serif`; g.fillText('GLASS TINTS', 4, H * 0.72); });
  t.position.set(0, 2.55, 0); G.add(t);
  return G;
}

function workbench() {
  const G = new THREE.Group();
  G.add(box(2.4, 0.06, 0.8, M.oak, 0, 0.92, 0));
  for (const [x, z] of [[-1.1, -0.34], [1.1, -0.34], [-1.1, 0.34], [1.1, 0.34]]) G.add(box(0.06, 0.9, 0.06, M.steel, x, 0.45, z));
  G.add(box(0.9, 0.04, 0.4, M.alu, -0.5, 0.97, 0.05));                              // offcuts
  G.add(box(0.6, 0.03, 0.08, M.alu, 0.4, 0.965, -0.2));
  const laptop = box(0.36, 0.02, 0.25, M.board, 0.75, 0.96, 0.1); G.add(laptop);
  const lid = box(0.36, 0.24, 0.015, M.board, 0.75, 1.08, -0.02); lid.rotation.x = -0.25; G.add(lid);
  const cas = box(0.46, 0.14, 0.32, new THREE.MeshStandardMaterial({ color: RED, roughness: 0.5 }), -0.4, 1.02, -0.2); G.add(cas);
  return G;
}

export function buildConceptRoom(scene, renderer, { quality = 'high', Reflector = null } = {}) {
  const S = { quality, room: 'concept' };
  const high = quality === 'high' && Reflector;
  // floor: polished concrete with a faint 1 m grid
  const { tex: ft } = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#A9A7A2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) { const v = 150 + Math.random() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v - 4},0.08)`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    g.strokeStyle = 'rgba(80,80,80,0.25)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
  });
  ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(24, 18);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), new THREE.MeshPhysicalMaterial({ map: ft, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.35, transparent: !!high, opacity: high ? 0.93 : 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  if (high) { const mirror = new Reflector(new THREE.PlaneGeometry(24, 18), { textureWidth: 1024, textureHeight: 1024, color: 0x777a80, clipBias: 0.003 }); mirror.rotation.x = -Math.PI / 2; mirror.position.y = -0.004; scene.add(mirror); S.mirror = mirror; }
  // walls and ceiling
  const back = backWall(); back.position.set(0, 0, -6.6); scene.add(back);
  for (const s of [-1, 1]) { const w = box(0.2, 6.5, 14, M.wall, s * 9.5, 3.25, 0.2); scene.add(w); for (let z = -6; z <= 6; z += 1.5) scene.add(box(0.02, 6.5, 0.02, M.seam, s * 9.38, 3.25, z)); }
  const ceil = box(20, 0.2, 14, M.ceiling, 0, 7.2, 0.2); scene.add(ceil);
  const lightbox = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 3.4), M.glow); lightbox.rotation.x = Math.PI / 2; lightbox.position.set(0.2, 7.08, -2.3); scene.add(lightbox);
  for (let i = -3; i <= 3; i++) scene.add(box(0.04, 0.05, 3.5, M.steel, 0.2 + i * 1.08, 7.04, -2.3));
  // the platform the mock-up stands on
  const P = { x: 0.2, z: -2.4, y: 0.1, w: 5.6, d: 3.8 };
  const plat = box(P.w, P.y, P.d, M.plinth, P.x, P.y / 2, P.z); scene.add(plat);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(P.w + 0.04, 0.012, P.d + 0.04), new THREE.MeshBasicMaterial({ color: RED })); edge.position.set(P.x, P.y + 0.002, P.z); scene.add(edge);
  const top = new THREE.Mesh(new THREE.BoxGeometry(P.w - 0.04, 0.014, P.d - 0.04), M.plinth); top.position.set(P.x, P.y + 0.004, P.z); scene.add(top);

  // the mock-up: one per episode, made the first time it is shown, standing on a slice of flat roof
  // (membrane on top, rendered sides) sized to it, so it sits at the height a roof light is seen from
  const DECK = 0.55, deck = new THREE.Group(); scene.add(deck);
  const deckBody = box(1, DECK, 1, M.deckSide, 0, DECK / 2, 0), deckTop = box(1, 0.02, 1, M.deck, 0, DECK + 0.01, 0); deck.add(deckBody, deckTop);
  deck.position.set(P.x, P.y, P.z); deck.rotation.y = -0.32;
  const fitDeck = (b) => { const s = b.footprint.size; for (const o of [deckBody, deckTop]) { o.scale.set(s.x + 0.7, 1, s.z + 0.7); o.position.x = b.footprint.centre.x; o.position.z = b.footprint.centre.z; } };
  S.buildings = {};
  S.building = (id) => {
    if (S.buildings[id] || !BUILDERS_S3[id]) return S.buildings[id] || null;
    const b = BUILDERS_S3[id](); b.group.position.set(P.x, P.y + DECK, P.z); b.group.rotation.y = -0.32;
    b.group.visible = false; scene.add(b.group); return (S.buildings[id] = b);
  };
  S.stageIds = Object.keys(BUILDERS_S3);
  S.house = S.building(S.stageIds[0]); S.house.group.visible = true;
  S.showBuilding = (id) => {
    const b = S.building(id); if (!b) return false;
    if (b !== S.house) { S.house.group.visible = false; b.reset(); b.group.visible = true; S.house = b; }
    fitDeck(b); return true;
  };
  fitDeck(S.house);
  // where a host stands to reach the mock-up: in front of its nearest edge, facing it
  S.touchMark = () => {
    const H = S.house, fp = H.footprint, local = V(fp.centre.x, 0, fp.centre.z + fp.size.z / 2 + 0.35);   // the deck's front edge
    const w = H.group.localToWorld(local.clone()), c = H.group.localToWorld(V(fp.centre.x, 0, fp.centre.z));
    const dir = w.clone().sub(c).setY(0).normalize();
    return { pos: w.clone().addScaledVector(dir, 0.3).setY(0), rotY: Math.atan2(-dir.x, -dir.z) };
  };

  // the hosts stand on marks either side of the platform
  S.seats = [{ pos: V(-1.4, 0, 1.15), rotY: 0.3 }, { pos: V(1.4, 0, 1.15), rotY: -0.3 }];
  S.marks = {
    home0: S.seats[0], home1: S.seats[1],
    screen: { pos: V(-3.1, 0, -1.3), rotY: Math.PI * 0.8, via: V(-3.0, 0, 0.2) },
    tints: { pos: V(-4.4, 0, -4.3), rotY: Math.PI, via: V(-3.3, 0, 0.1) },
    profiles: { pos: V(3.9, 0, -2.3), rotY: -Math.PI * 0.72, via: V(3.5, 0, 0.1) }
  };
  S.desk = { height: 1.0, bottles: null };
  S.groundAt = (x, z) => (Math.abs(x - P.x) < P.w / 2 && Math.abs(z - P.z) < P.d / 2 ? P.y : 0);   // hosts step up onto the platform
  S.points = { tints: V(-4.4, 1.3, -5.7), profiles: V(5.2, 1.7, -3.6) };      // look targets     // no desk here: the hosts' hands rest at the waist

  // around the walls
  S.screen = buildScreen(); S.screen.group.position.set(-4.6, 2.3, -3.0); S.screen.group.rotation.y = 0.55; scene.add(S.screen.group);
  scene.add(cyl(0.05, 0.05, 1.4, mat.black, -4.6, 0.7, -3.02, 12));
  const board = profileBoard(); board.position.set(5.2, 0, -3.6); board.rotation.y = -0.6; scene.add(board);
  const tints = tintWall(); tints.position.set(-4.4, 0, -5.7); scene.add(tints);
  const bench = workbench(); bench.position.set(3.6, 0, -5.4); bench.rotation.y = -0.15; scene.add(bench);
  S.globe = buildGlobe(); S.globe.group.position.set(-6.2, 0, -0.4); scene.add(S.globe.group);
  S.crane = { update() {} };
  S.dust = buildDust(); scene.add(S.dust.points);

  // light: a bright, even room — the ceiling light box over the platform, a soft key on the hosts
  scene.add(new THREE.HemisphereLight(0xF4F6F8, 0x6A675F, 0.75));
  const day = new THREE.DirectionalLight(0xFFF8EE, 1.6); day.position.set(2.5, 9, 1.5); day.target.position.set(P.x, 0.5, P.z);
  day.castShadow = true; day.shadow.mapSize.set(2048, 2048); Object.assign(day.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 20 }); day.shadow.bias = -0.0004; day.shadow.normalBias = 0.02;
  scene.add(day, day.target);
  const key = new THREE.SpotLight(0xFFEEDD, 55, 30, 0.6, 0.8, 1.5); key.position.set(-3, 4.8, 6); key.target.position.set(0, 1.3, 0.8); scene.add(key, key.target);
  const fill = new THREE.SpotLight(0xE8F0FF, 25, 30, 0.7, 0.9, 1.5); fill.position.set(4, 4, 5.5); fill.target.position.set(0, 1.3, 0.8); scene.add(fill, fill.target);
  const rim = new THREE.SpotLight(0xFFFFFF, 35, 30, 0.6, 0.7, 1.4); rim.position.set(0, 5.5, -4.5); rim.target.position.set(0, 1.3, 1); scene.add(rim, rim.target);
  if (quality === 'high') { const ra = new THREE.RectAreaLight(0xFFFFFF, 3, 6.5, 3.4); ra.position.set(0.2, 6.4, -2.3); ra.lookAt(0.2, 0, -2.3); scene.add(ra); }

  // cameras tuned to this room: a closer building orbit, a detail camera that follows the assembly
  S.cams = {
    wide: (t, vert, ease) => { const k = ease(t / 9); return { pos: V(-0.7 + k * 1.1, (vert ? 2.5 : 2.6) - k * 0.5, (vert ? 7.6 : 7.8) - k * 0.5), tgt: V(0.2, vert ? 1.15 : 1.15, -1.6), fov: vert ? 62 : 42 }; },
    house: { r: [5.6, 4.6], orbit: [5.4, 4.3], y0: 1.4, yk: 1.4, y: 2.5, tgtY: 0.1 },
    roof: { r: 2.4, y: 1.3 },
    detail: () => { const b = S.house, f = b.focus || b.group.localToWorld(b.top.clone()); return f; }
  };

  S.update = (t, dt) => { S.house.update(dt); S.globe.update(t, dt); S.dust.update(dt); };
  S.aim = V(0, 1.4, 0.9);
  return S;
}
