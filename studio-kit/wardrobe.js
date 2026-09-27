/* KARLCON Studio — wardrobe: the black KARLCON Elite Retreats hoodie.
   Turns a presenter's top (the avatar's `outfit_top` mesh) into the hoodie from the merch shoot:
   the shirt texture is re-dyed black, keeping its folds and shading, the gold Elite Retreats logo goes
   small on the left chest, a kangaroo pocket is printed on the front, and a hood and drawstrings are
   added round the neck, fixed to the chest bone so they move with the body.
   Used from KC_HOSTS: `outfit: 'hoodie'`. */
import * as THREE from 'three';

const loadImage = (url) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });

/** where the chest sits in the avatar's shirt texture (fractions of its size); the AvatarSDK
    long-sleeve layout by default. x runs from the wearer's right to left across the front. */
const LAYOUT = { chest: [0.68, 0.59], logoW: 0.105, pocket: [0.505, 0.8, 0.735, 0.915], oldPrint: [0.49, 0.56, 0.72, 0.7] };

/** the shirt's dominant colour: the median of each channel */
function baseColour(p) {
  const ch = [[], [], []];
  for (let i = 0; i < p.length; i += 64) for (let k = 0; k < 3; k++) ch[k].push(p[i + k]);
  return ch.map((a) => a.sort((x, y) => x - y)[a.length >> 1]);
}

export async function dressHoodie(host, { logo = '/img/brand/elite-retreats-logo.png', layout = LAYOUT } = {}) {
  let top = null;
  host.model.traverse((n) => { if (n.isMesh && /outfit_top|top|shirt|hoodie/i.test(n.name) && !top) top = n; });
  if (!top?.material?.map?.image) return false;
  const src = top.material.map, img = src.image, W = img.width, H = img.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  // re-dye: every pixel becomes black cotton, lit by the original's own light and shade
  const d = g.getImageData(0, 0, W, H), p = d.data;
  let sum = 0, n = 0;
  for (let i = 0; i < p.length; i += 4) { const l = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]; if (l > 20) { sum += l; n++; } }
  const mean = sum / Math.max(1, n);
  // the old print (anything not the shirt's own colour) is dyed flat, so it doesn't show through
  const [br, bg, bb] = baseColour(p);
  for (let i = 0; i < p.length; i += 4) {
    const dist = Math.abs(p[i] - br) + Math.abs(p[i + 1] - bg) + Math.abs(p[i + 2] - bb), cloth = Math.max(0, 1 - dist / 70);
    const l = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2], k = Math.min(1.6, Math.max(0.35, l / mean)) * cloth + (1 - cloth);
    p[i] = 24 * k; p[i + 1] = 25 * k; p[i + 2] = 29 * k;
  }
  g.putImageData(d, 0, 0);
  // kangaroo pocket: a slightly raised panel with a stitched edge
  const [x0, y0, x1, y1] = layout.pocket.map((v, i) => v * (i % 2 ? H : W)), inset = (x1 - x0) * 0.16;
  g.fillStyle = 'rgba(255,255,255,0.035)'; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = Math.max(2, W / 400);
  g.beginPath(); g.moveTo(x0 + inset, y0); g.lineTo(x1 - inset, y0); g.lineTo(x1, y1); g.lineTo(x0, y1); g.closePath(); g.fill(); g.stroke();
  g.setLineDash([W / 200, W / 300]); g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.beginPath(); g.moveTo(x0 + inset + 6, y0 + 6); g.lineTo(x1 - inset - 6, y0 + 6); g.stroke(); g.setLineDash([]);
  // the logo, small, on the left chest
  try {
    const lg = await loadImage(logo), lw = layout.logoW * W, lh = lw * lg.height / lg.width;
    g.drawImage(lg, layout.chest[0] * W - lw / 2, layout.chest[1] * H - lh / 2, lw, lh);
  } catch (e) { /* no logo file: plain hoodie */ }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = src.flipY; tex.wrapS = src.wrapS; tex.wrapT = src.wrapT; tex.anisotropy = 8;
  const m = top.material.clone(); m.map = tex; m.roughness = 0.92; m.metalness = 0;
  // the old print is embossed in the normal map too: flatten that patch
  const nm = m.normalMap?.image;
  if (nm && layout.oldPrint) {
    const nc = document.createElement('canvas'); nc.width = nm.width; nc.height = nm.height; const ng = nc.getContext('2d'); ng.drawImage(nm, 0, 0);
    const [a0, b0, a1, b1] = layout.oldPrint, x = a0 * nc.width, y = b0 * nc.height, w = (a1 - a0) * nc.width, h = (b1 - b0) * nc.height;
    ng.filter = `blur(${Math.round(nc.width / 200)}px)`; ng.fillStyle = 'rgb(128,128,255)'; ng.fillRect(x, y, w, h); ng.filter = 'none';
    const nt = new THREE.CanvasTexture(nc); nt.flipY = m.normalMap.flipY; nt.wrapS = m.normalMap.wrapS; nt.wrapT = m.normalMap.wrapT; nt.colorSpace = THREE.NoColorSpace; m.normalMap = nt;
  }
  m.needsUpdate = true; top.material = m;
  addHood(host);
  return true;
}

/* hood lying on the upper back, a rolled collar round the neck, and two drawstrings with gold tips */
function addHood(host) {
  const b = host.bones, chest = b.Spine2 || b.Spine1, neck = b.Neck; if (!chest || !neck) return;
  host.root.updateMatrixWorld(true);
  const q = host.root.getWorldQuaternion(new THREE.Quaternion());
  const N = neck.getWorldPosition(new THREE.Vector3()), C = chest.getWorldPosition(new THREE.Vector3());
  const nr = Math.max(0.065, Math.min(0.1, N.distanceTo(C) * 0.42));       // neck radius from the rig's own size
  const fabric = new THREE.MeshStandardMaterial({ color: 0x17181B, roughness: 0.95 });
  const lining = new THREE.MeshStandardMaterial({ color: 0x0E0F11, roughness: 0.95, side: THREE.DoubleSide });
  const G = new THREE.Group(); G.name = 'hoodie-hood';
  // rolled collar: most of a ring, open at the front
  const collar = new THREE.Mesh(new THREE.TorusGeometry(nr * 0.8, 0.024, 10, 40, Math.PI * 1.3), fabric);
  collar.rotation.x = Math.PI / 2; collar.rotation.z = Math.PI / 2 + Math.PI * 0.35; collar.position.set(0, -0.02, -0.005);
  G.add(collar);
  // the hood itself, down, folded on the upper back
  const hood = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), lining);
  hood.scale.set(0.15, 0.12, 0.07); hood.rotation.x = -Math.PI / 2 - 0.2; hood.position.set(0, -0.05, -(nr * 0.8 + 0.05));
  G.add(hood);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.06, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), fabric);
  shell.scale.copy(hood.scale); shell.rotation.copy(hood.rotation); shell.position.copy(hood.position); G.add(shell);
  // drawstrings from the front of the collar
  const cord = new THREE.MeshStandardMaterial({ color: 0x202125, roughness: 0.8 }), tip = new THREE.MeshStandardMaterial({ color: 0xC9A961, roughness: 0.35, metalness: 0.8 });
  for (const s of [-1, 1]) {
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.19, 6), cord); str.position.set(s * 0.032, -0.14, nr + 0.035); str.rotation.x = -0.12; G.add(str);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.022, 8), tip); t.position.set(s * 0.032, -0.245, nr + 0.048); G.add(t);
  }
  // place it at the base of the neck, facing the way the presenter faces, then fix it to the chest bone
  G.position.copy(N); G.quaternion.copy(q); G.updateMatrixWorld(true);
  G.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  chest.attach(G);                                  // G has no parent yet, so its position is already world space
}
