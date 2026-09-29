/* KARLCON Studio — things the presenters hold (season 3, the Concept Room).
   · tablet: a dark tablet with the KARLCON Lumen Builds app on screen (Luma presents from it)
   · helmet: a white site hard hat with the red KARLCON band (Karl carries it)
   Each prop is placed every frame from the hand that holds it (hosts.js _placeProps), and a hard hat
   can be tucked under the arm when the arms fold. */
import * as THREE from 'three';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function mark(g, x, y, s, color) {        // the KARLCON hexagon, simplified
  g.save(); g.translate(x, y); g.strokeStyle = color; g.lineWidth = s * 0.08; g.beginPath();
  for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; const px = Math.cos(a) * s / 2, py = Math.sin(a) * s / 2; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.closePath(); g.stroke(); g.restore();
}

/** the tablet: 29 × 20 cm, the app on screen. Local axes: +y out of the screen, +z along the long side */
export function makeTablet() {
  const G = new THREE.Group(); G.name = 'prop-tablet';
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.008, 0.255), new THREE.MeshStandardMaterial({ color: 0x1B1C1F, roughness: 0.35, metalness: 0.6 }));
  G.add(body);
  const screen = canvasTex(360, 520, (g, w, h) => {
    g.fillStyle = '#F7F6F4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#D0231A'; g.fillRect(0, 0, w, 64);
    mark(g, 34, 32, 34, '#FFFFFF');
    g.fillStyle = '#FFFFFF'; g.font = '800 26px Montserrat, sans-serif'; g.fillText('KARLCON', 62, 34); g.font = '600 13px Inter, sans-serif'; g.fillText('LUMEN BUILDS', 64, 52);
    // a project card: a roof light drawn in red lines
    g.fillStyle = '#FFFFFF'; g.fillRect(18, 84, w - 36, 250); g.strokeStyle = '#E4E1DB'; g.strokeRect(18, 84, w - 36, 250);
    g.strokeStyle = '#D0231A'; g.lineWidth = 3; g.beginPath(); g.moveTo(70, 260); g.lineTo(180, 150); g.lineTo(290, 260); g.closePath(); g.stroke();
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(70 + i * 36.6, 260); g.lineTo(180, 150 + 0 * i); g.stroke(); }
    g.strokeStyle = '#1B1D21'; g.strokeRect(62, 260, 236, 22);
    g.fillStyle = '#1B1D21'; g.font = '700 22px Montserrat, sans-serif'; g.fillText('Pyramid roof light', 30, 320);
    g.fillStyle = '#6B6F76'; g.font = '500 15px Inter, sans-serif'; g.fillText('Concept · Glazing-bar system', 30, 356);
    // tint swatches
    ['#DDEFEA', '#8C7A69', '#B58C5C', '#8E9CB0', '#7FB6E3', '#3F8F6A'].forEach((c, i) => { g.fillStyle = c; g.fillRect(30 + i * 52, 380, 40, 40); });
    g.fillStyle = '#D0231A'; g.fillRect(30, 450, w - 60, 44); g.fillStyle = '#FFFFFF'; g.font = '700 18px Inter, sans-serif'; g.fillText('View in 3D', 130, 478);
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.232), new THREE.MeshStandardMaterial({ map: screen, emissive: 0xffffff, emissiveMap: screen, emissiveIntensity: 0.55, roughness: 0.25 }));
  glass.rotation.x = -Math.PI / 2; glass.position.y = 0.0045; G.add(glass);
  G.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  G.scale.setScalar(1.15);                 // a 12.9" tablet: reads on camera
  return G;
}

/** the hard hat: a white shell with a front peak and the red KARLCON band. Local +y: the crown; +z: the peak */
export function makeHelmet() {
  const G = new THREE.Group(); G.name = 'prop-helmet';
  const white = new THREE.MeshPhysicalMaterial({ color: 0xF4F3F0, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.105, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), white);
  shell.scale.set(1, 0.9, 1.18); G.add(shell);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.24), white); ridge.position.y = 0.094; G.add(ridge);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.121, 0.01, 40, 1, false), white); brim.scale.set(1, 1, 1.2); brim.position.y = 0.004; G.add(brim);
  const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.008, 24, 1, false, -Math.PI / 2, Math.PI), white); peak.scale.set(1.2, 1, 0.8); peak.position.set(0, 0.006, 0.12); G.add(peak);
  const bandTex = canvasTex(512, 48, (g, w, h) => { g.fillStyle = '#D0231A'; g.fillRect(0, 0, w, h); g.fillStyle = '#FFFFFF'; g.font = '800 30px Montserrat, sans-serif'; g.fillText('KARLCON', 190, 35); });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.1065, 0.1085, 0.024, 40, 1, true), new THREE.MeshStandardMaterial({ map: bandTex, roughness: 0.45, side: THREE.DoubleSide }));
  band.scale.set(1, 1, 1.18); band.position.y = 0.024; band.rotation.y = Math.PI; G.add(band);
  G.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return G;
}

export const PROPS = { tablet: makeTablet, helmet: makeHelmet };
