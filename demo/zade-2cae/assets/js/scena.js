/* ZADE v5: il visore 3D delle basculanti.
   Three.js r170 (MIT, assets/js/three.module.min.js, licenza in three-LICENSE.txt), caricato solo dopo
   il primo disegno della pagina. Un solo renderer WebGL, nel palco del visore. Si disegna solo quando
   qualcosa cambia (scelta, trascinamento, apertura), mai a vuoto; niente post-processing, niente ombre
   in tempo reale. Tutta la geometria e' procedurale (scatole, estrusioni), le texture sono disegnate su canvas. */
import * as THREE from "./three.module.min.js";

const W = 2.5, H = 2.15;              // vano: 250 x 215 cm
const WD = W - 0.04, HD = H - 0.03;   // anta
const Z_ANTA = -0.11;                 // l'anta sta dietro il telaio

/* ---------- Texture disegnate su canvas (nessun file da scaricare) ---------- */
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvasTex(w, h, draw, srgb) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function noiseField(n, seed, blur) {
  const r = rnd(seed), a = new Float32Array(n * n);
  for (let i = 0; i < a.length; i++) a[i] = r();
  for (let k = 0; k < blur; k++) {
    const b = new Float32Array(a.length);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += a[((y + dy + n) % n) * n + ((x + dx + n) % n)];
      b[y * n + x] = s / 9;
    }
    a.set(b);
  }
  return a;
}
function normalTex(n, seed, blur, strength) {
  const f = noiseField(n, seed, blur);
  return canvasTex(n, n, (g) => {
    const img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = (f[y * n + (x + 1) % n] - f[y * n + (x - 1 + n) % n]) * strength;
      const dy = (f[((y + 1) % n) * n + x] - f[((y - 1 + n) % n) * n + x]) * strength;
      const l = Math.hypot(dx, dy, 1), k = (y * n + x) * 4;
      img.data[k] = (-dx / l * .5 + .5) * 255; img.data[k + 1] = (dy / l * .5 + .5) * 255; img.data[k + 2] = (1 / l * .5 + .5) * 255; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}
function plasterTex() { // muro chiaro con grana fine e appena un'ombra vicino al vano
  return canvasTex(512, 512, (g, w, h) => {
    const f = noiseField(128, 7, 2), r = rnd(3);
    g.fillStyle = "#e9ebeb"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const v = (f[y * 128 + x] - .5) * 14;
      g.fillStyle = `rgba(${v > 0 ? "255,255,255" : "60,66,70"},${Math.abs(v) / 160})`; g.fillRect(x * 4, y * 4, 4, 4);
    }
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(70,76,80,${r() * .08})`; g.fillRect(r() * w, r() * h, 1.2, 1.2); }
  }, true);
}
function concreteTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const f = noiseField(128, 11, 3), r = rnd(5);
    g.fillStyle = "#c9cccd"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const v = (f[y * 128 + x] - .5) * 40;
      g.fillStyle = `rgba(${v > 0 ? "250,250,250" : "70,74,77"},${Math.abs(v) / 90})`; g.fillRect(x * 4, y * 4, 4, 4);
    }
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(60,62,64,${r() * .12})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
  }, true);
}
function woodTex(base, dark, seed) { // venatura per legno e simil legno
  return canvasTex(512, 512, (g, w, h) => {
    const r = rnd(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const x0 = r() * w, amp = 2 + r() * 8, fr = .006 + r() * .01, lw = .5 + r() * 2.4;
      g.strokeStyle = dark; g.globalAlpha = .06 + r() * .16; g.lineWidth = lw; g.beginPath();
      for (let y = 0; y <= h; y += 8) { const x = x0 + Math.sin(y * fr + i) * amp; y ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
  }, true);
}
function brushedTex() { // acciaio spazzolato: righe orizzontali sottili
  return canvasTex(256, 256, (g, w, h) => {
    const r = rnd(21);
    g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) { const v = 110 + r() * 60; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, w, 1); }
  });
}

/* ---------- Ambiente: piccola stanza con pannelli luminosi, cotta una volta sola ---------- */
function makeEnvironment(renderer) {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), new THREE.MeshBasicMaterial({ color: 0x8e9498, side: THREE.BackSide }));
  room.position.y = 4; s.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: 0x9a9d9f }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1; s.add(floor);
  const panel = (w, h, x, y, z, ry, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * .98) }));
    m.position.set(x, y, z); m.lookAt(0, 1.5, 0); if (ry) m.rotation.z = ry; s.add(m);
  };
  panel(9, 2.2, -2, 8.5, 5, 0, 7);     // finestrone alto
  panel(3, 6, -9.5, 4, -2, 0, 4.2);    // lucernario a sinistra
  panel(2.4, 5, 9.5, 3.5, 3, 0, 2.6);  // controluce a destra
  panel(14, 0.5, 0, 1.2, 9.6, 0, 3);   // riga bassa davanti: il riflesso che scorre sulle doghe
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.035);
  pm.dispose();
  s.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt.texture;
}

/* ---------- Finiture e modelli ---------- */
const PAINT_N = { t: null };
function paintMat(hex, opts = {}) {
  if (!PAINT_N.t) { PAINT_N.t = normalTex(128, 31, 1, 1.4); PAINT_N.t.repeat.set(6, 6); }
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hex), metalness: opts.metal ?? 0.3, roughness: opts.rough ?? 0.4,
    clearcoat: opts.coat ?? 0.35, clearcoatRoughness: opts.coatRough ?? 0.32,
    normalMap: PAINT_N.t, normalScale: new THREE.Vector2(0.12, 0.12)
  });
}
const WOOD_CACHE = {};
function woodMat(hex, kind) {
  const k = hex + kind;
  if (!WOOD_CACHE[k]) {
    const c = new THREE.Color(hex), d = c.clone().multiplyScalar(0.45);
    WOOD_CACHE[k] = woodTex("#" + c.getHexString(), "#" + d.getHexString(), kind === "metal" ? 4 : 9);
  }
  const t = WOOD_CACHE[k].clone(); t.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial({
    map: t, color: 0xffffff, metalness: kind === "metal" ? 0.2 : 0, roughness: kind === "metal" ? 0.5 : 0.62,
    clearcoat: kind === "metal" ? 0.3 : 0.12, clearcoatRoughness: 0.4
  });
}

export function avvia() {
  if (!window.WebGLRenderingContext) throw new Error("no webgl");
  const isPhone = window.matchMedia("(max-width: 860px)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isPhone ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0xe6e8e9, 1);
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe6e8e9);
  scene.environment = makeEnvironment(renderer);
  scene.environmentIntensity = 1.15;
  const camera = new THREE.PerspectiveCamera(30, 1.6, 0.1, 60);

  const sun = new THREE.DirectionalLight(0xfff4e6, 2.4); sun.position.set(-3.5, 6, 5); scene.add(sun);
  const fill = new THREE.HemisphereLight(0xf2f4f5, 0x9a9c9d, 0.9); scene.add(fill);

  /* ---- muro, vano, telaio, pavimento, interno ---- */
  const plaster = plasterTex(); plaster.repeat.set(3, 1.6);
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-9, -0.001); wallShape.lineTo(9, -0.001); wallShape.lineTo(9, 7); wallShape.lineTo(-9, 7); wallShape.lineTo(-9, -0.001);
  const hole = new THREE.Path();
  hole.moveTo(-W / 2 - 0.07, 0); hole.lineTo(-W / 2 - 0.07, H + 0.07); hole.lineTo(W / 2 + 0.07, H + 0.07); hole.lineTo(W / 2 + 0.07, 0); hole.lineTo(-W / 2 - 0.07, 0);
  wallShape.holes.push(hole);
  const wallGeo = new THREE.ShapeGeometry(wallShape);
  { // uv in metri per la grana del muro
    const p = wallGeo.attributes.position, uv = wallGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 6, p.getY(i) / 6);
  }
  const wallMat = new THREE.MeshStandardMaterial({ map: plaster, color: 0xffffff, roughness: 0.95, metalness: 0, envMapIntensity: 0.6 });
  const wall = new THREE.Mesh(wallGeo, wallMat); scene.add(wall);
  // spalle del vano (lo spessore del muro), un filo piu' scure
  const reveal = new THREE.MeshStandardMaterial({ color: 0xc9cdcf, roughness: 0.95, envMapIntensity: 0.4 });
  const depth = 0.3;
  [[-W / 2 - 0.07 - 0.0, 0], [W / 2 + 0.07, 0]].forEach(([x]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.001, H + 0.07, depth), reveal); m.position.set(x, (H + 0.07) / 2, -depth / 2); scene.add(m);
  });
  const lint = new THREE.Mesh(new THREE.BoxGeometry(W + 0.14, 0.001, depth), reveal); lint.position.set(0, H + 0.07, -depth / 2); scene.add(lint);

  const steelMap = brushedTex(); steelMap.repeat.set(1, 4);
  const steel = new THREE.MeshStandardMaterial({ color: 0xb8bdc1, metalness: 1, roughness: 0.34, roughnessMap: steelMap, envMapIntensity: 1.1 });
  const frameMat = paintMat("#383e42", { rough: 0.5 });
  const telaio = new THREE.Group(); scene.add(telaio);
  const tp = 0.07, td = 0.13;
  // il telaio riempie tutta la luce tra muro e anta: nessuna fessura verso l'interno
  const jw = 0.105;
  const jambL = new THREE.Mesh(new THREE.BoxGeometry(jw, H + 0.07, td), frameMat); jambL.position.set(-W / 2 - 0.07 + jw / 2, (H + 0.07) / 2, -td / 2 - 0.01);
  const jambR = jambL.clone(); jambR.position.x *= -1;
  const head = new THREE.Mesh(new THREE.BoxGeometry(W + 0.14, jw, td), frameMat); head.position.set(0, H + 0.07 - jw / 2, -td / 2 - 0.01);
  telaio.add(jambL, jambR, head);
  const soglia = new THREE.Mesh(new THREE.BoxGeometry(W + 0.14, 0.012, 0.34), steel); soglia.position.set(0, 0.006, -0.1); scene.add(soglia);

  const concrete = concreteTex(); concrete.repeat.set(4, 3);
  const floorMat = new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.92, metalness: 0, envMapIntensity: 0.5 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 4.5); scene.add(floor);

  // dentro il garage: il vano vuoto, intonaco grigio in penombra e pavimento in cemento, nessuna immagine
  const inside = new THREE.Group(); scene.add(inside);
  const inWall = plasterTex(); inWall.repeat.set(1.4, 1);
  const inMat = new THREE.MeshStandardMaterial({ map: inWall, color: 0x7f8488, roughness: 0.95, side: THREE.BackSide, envMapIntensity: 0.3 });
  const room = new THREE.Mesh(new THREE.BoxGeometry(W + 0.9, H + 0.5, 3.2), inMat); room.position.set(0, (H + 0.5) / 2 - 0.002, -1.75); inside.add(room);
  const inFloor = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.9, 3.2), new THREE.MeshStandardMaterial({ map: concrete, color: 0xa7abad, roughness: 0.9, envMapIntensity: 0.4 }));
  inFloor.rotation.x = -Math.PI / 2; inFloor.position.set(0, 0.001, -1.75); inside.add(inFloor);
  const glow = new THREE.PointLight(0xfff1e0, 0, 7, 1.4); glow.position.set(0, 2.2, -1.6); scene.add(glow);

  const aoTex = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(30,33,36,.55)"); gr.addColorStop(0.35, "rgba(30,33,36,.16)"); gr.addColorStop(1, "rgba(30,33,36,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const sx = g.createLinearGradient(0, 0, w, 0); sx.addColorStop(0, "rgba(0,0,0,0)"); sx.addColorStop(0.18, "rgba(0,0,0,1)"); sx.addColorStop(0.82, "rgba(0,0,0,1)"); sx.addColorStop(1, "rgba(0,0,0,0)");
    g.globalCompositeOperation = "destination-in"; g.fillStyle = sx; g.fillRect(0, 0, w, h);
  });
  const aoTexW = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(30,33,36,.55)"); gr.addColorStop(0.35, "rgba(30,33,36,.16)"); gr.addColorStop(1, "rgba(30,33,36,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  aoTexW.wrapS = aoTexW.wrapT = THREE.ClampToEdgeWrapping;
  aoTex.wrapS = aoTex.wrapT = THREE.ClampToEdgeWrapping;
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.4, 0.9), new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, toneMapped: false }));
  ao.rotation.x = -Math.PI / 2; ao.position.set(0, 0.002, 0.45); scene.add(ao);
  const aoW = new THREE.Mesh(new THREE.PlaneGeometry(18, 0.6), new THREE.MeshBasicMaterial({ map: aoTexW, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.5 }));
  aoW.rotation.z = Math.PI; aoW.position.set(0, 0.3, 0.002); scene.add(aoW);

  /* ---- l'anta: perno sul bordo alto, costruita per modello ---- */
  const pivot = new THREE.Group(); pivot.position.set(0, H, Z_ANTA); scene.add(pivot);
  let leaf = null;
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe2e4, metalness: 1, roughness: 0.16 });
  const darkGap = new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.8 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x1e2428, metalness: 0.1, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.6 });

  function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
  function instanced(geo, mat, list) {
    const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
    list.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    return im;
  }
  function maniglia(g, x, y, z) {
    g.add(box(0.045, 0.19, 0.012, chrome, x, y, z + 0.006));
    const lev = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.13, 16), chrome); lev.rotation.z = Math.PI / 2; lev.position.set(x - 0.055, y + 0.05, z + 0.05); g.add(lev);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 16), chrome); col.rotation.x = Math.PI / 2; col.position.set(x, y + 0.05, z + 0.03); g.add(col);
    const cil = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.02, 16), chrome); cil.rotation.x = Math.PI / 2; cil.position.set(x, y - 0.06, z + 0.016); g.add(cil);
  }
  function pedonaleTaglio(g, x0, x1, top, z) { // il taglio della porta pedonale: fughe scure sottili
    const t = 0.008, yb = -HD + 0.02, hgt = top - yb;
    g.add(box(t, hgt, 0.004, darkGap, x0, yb + hgt / 2, z), box(t, hgt, 0.004, darkGap, x1, yb + hgt / 2, z), box(x1 - x0, t, 0.004, darkGap, (x0 + x1) / 2, top, z));
  }

  function slatGeo(w, h, legno) { // doga con i bordi smussati: ogni spigolo prende la luce
    const b = Math.min(0.006, h * 0.08), sh = new THREE.Shape();
    sh.moveTo(-w / 2 + b, -h / 2 + b); sh.lineTo(w / 2 - b, -h / 2 + b); sh.lineTo(w / 2 - b, h / 2 - b); sh.lineTo(-w / 2 + b, h / 2 - b); sh.lineTo(-w / 2 + b, -h / 2 + b);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.006, bevelSize: b, bevelSegments: 3, curveSegments: 1 });
    geo.translate(0, 0, -0.01);
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) / w + 0.5) * (legno ? 3 : 1), (pos.getY(i) / h + 0.5) * (legno ? 0.25 : 1));
    return geo;
  }
  function bugna(w, h, mat, x, y, z) { // pannello sagomato: bisello largo, come una bugna stampata
    const s = 0.035, sh = new THREE.Shape();
    sh.moveTo(-w / 2 + s, -h / 2 + s); sh.lineTo(w / 2 - s, -h / 2 + s); sh.lineTo(w / 2 - s, h / 2 - s); sh.lineTo(-w / 2 + s, h / 2 - s); sh.lineTo(-w / 2 + s, -h / 2 + s);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.016, bevelSize: s, bevelSegments: 3, curveSegments: 1 });
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m;
  }

  function buildLeaf(st) {
    const g = new THREE.Group();
    const fin = st.fin || {};
    const legno = !!fin.legno;
    const mat = legno ? woodMat(fin.c, st.model === "legno" ? "wood" : "metal")
      : fin.metal ? new THREE.MeshStandardMaterial({ color: fin.c, metalness: 1, roughness: 0.38, roughnessMap: steelMap, envMapIntensity: 1.1 })
      : st.model === "energy" ? paintMat(fin.c, { metal: 0, rough: 0.78, coat: 0, coatRough: 1 })
      : st.model === "style" ? paintMat(fin.c, { metal: 0.1, rough: 0.28, coat: 1, coatRough: 0.08 })
      : paintMat(fin.c);
    const plateMat = legno ? paintMat(new THREE.Color(fin.c).multiplyScalar(0.55), { rough: 0.6 }) : paintMat(new THREE.Color(fin.c).multiplyScalar(0.62), { rough: 0.55, coat: 0.1 });
    const zf = 0.0; // faccia della lamiera
    const ped = st.ped && st.model !== "libera";
    const px0 = -0.12, px1 = 0.74, ptop = -HD + 1.98;

    if (st.model !== "libera") g.add(box(WD, HD, 0.03, plateMat, 0, -HD / 2, -0.015));
    // cornice perimetrale dell'anta
    const cf = 0.045, cz = 0.012;
    const frameM = st.model === "libera" ? mat : mat;
    g.add(box(WD, cf, 0.04, frameM, 0, -cf / 2, cz), box(WD, cf, 0.04, frameM, 0, -HD + cf / 2, cz), box(cf, HD, 0.04, frameM, -WD / 2 + cf / 2, -HD / 2, cz), box(cf, HD, 0.04, frameM, WD / 2 - cf / 2, -HD / 2, cz));
    const iw = WD - 2 * cf, ih = HD - 2 * cf;

    if (st.model === "doghe" || st.model === "simil") {
      const pitch = st.model === "doghe" ? 0.15 : 0.2, n = Math.floor(ih / pitch), gap = 0.012, list = [];
      for (let i = 0; i < n; i++) list.push([0, -cf - pitch / 2 - i * pitch - (ih - n * pitch) / 2, zf + 0.006]);
      const geo = slatGeo(iw - 0.01, pitch - gap, legno);
      g.add(instanced(geo, mat, list));
    } else if (st.model === "standard") {
      g.add(box(iw, ih, 0.012, mat, 0, -HD / 2, zf));
      const list = [], step = 0.075;
      for (let x = -iw / 2 + step / 2; x < iw / 2; x += step) list.push([x, -HD / 2, zf + 0.009]);
      g.add(instanced(new THREE.BoxGeometry(0.016, ih - 0.02, 0.008), mat, list));
    } else if (st.model === "energy") {
      const n = 3, gw = 0.014, pw = (iw - gw * (n - 1)) / n;
      for (let i = 0; i < n; i++) g.add(box(pw, ih, 0.022, mat, -iw / 2 + pw / 2 + i * (pw + gw), -HD / 2, zf + 0.005));
    } else if (st.model === "style") {
      g.add(box(iw, ih, 0.014, mat, 0, -HD / 2, zf));
      const cols = 3, rows = 2, mx = 0.07, cw = (iw - mx * (cols + 1)) / cols, rh = [ih * 0.36, ih * 0.5];
      let y = -cf - mx;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = -iw / 2 + mx + cw / 2 + c * (cw + mx);
          g.add(bugna(cw, rh[r], mat, x, y - rh[r] / 2, zf + 0.008));
        }
        y -= rh[r] + mx;
      }
    } else if (st.model === "legno") {
      const pw = 0.125, n = Math.floor(iw / pw), list = [];
      const winH = 0.3, winTop = -cf - 0.12;
      for (let i = 0; i < n; i++) list.push([-iw / 2 + pw / 2 + i * pw + (iw - n * pw) / 2, -HD / 2, zf + 0.008]);
      const geo = new THREE.BoxGeometry(pw - 0.008, ih, 0.026);
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.3, uv.getY(i) * 2.2);
      g.add(instanced(geo, mat, list));
      // fila di finestrature in alto
      const nw = 4, ww = (iw - 0.1 * (nw + 1)) / nw;
      for (let i = 0; i < nw; i++) {
        const x = -iw / 2 + 0.1 + ww / 2 + i * (ww + 0.1);
        g.add(box(ww + 0.05, winH + 0.05, 0.03, plateMat, x, winTop - winH / 2, zf + 0.026));
        g.add(box(ww, winH, 0.01, glass, x, winTop - winH / 2, zf + 0.042));
      }
    } else if (st.model === "grecato") {
      // lamiera grecata: profilo trapezio, estruso in verticale
      const period = 0.18, top = 0.05, rise = 0.035, d = 0.03, sh = new THREE.Shape();
      const n = Math.floor(iw / period);
      sh.moveTo(-iw / 2, 0);
      for (let i = 0; i < n; i++) {
        const x = -iw / 2 + i * period + (iw - n * period) / 2;
        sh.lineTo(x + (period - top) / 2 - rise, 0); sh.lineTo(x + (period - top) / 2, d); sh.lineTo(x + (period + top) / 2, d); sh.lineTo(x + (period + top) / 2 + rise, 0);
      }
      sh.lineTo(iw / 2, 0); sh.lineTo(iw / 2, -0.004); sh.lineTo(-iw / 2, -0.004); sh.lineTo(-iw / 2, 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: ih, bevelEnabled: false, curveSegments: 1 });
      geo.rotateX(Math.PI / 2); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat); m.position.set(0, -cf, zf - 0.006); g.add(m);
    } else if (st.model === "libera") {
      // telaio nudo: tubolari orizzontali e montanti, pronto per il rivestimento
      [0.33, 0.66].forEach((k) => g.add(box(iw, 0.04, 0.04, mat, 0, -cf - ih * k, cz)));
      g.add(box(0.04, ih, 0.04, mat, 0, -HD / 2, cz));
      const diag = box(Math.hypot(iw / 2, ih * 0.33), 0.03, 0.03, mat, -iw / 4, -cf - ih * 0.165, cz);
      diag.rotation.z = Math.atan2(ih * 0.33, iw / 2); g.add(diag);
    }

    const front = st.model === "style" ? 0.04 : st.model === "grecato" ? 0.03 : st.model === "legno" ? 0.024 : 0.02;
    if (ped) {
      pedonaleTaglio(g, px0, px1, ptop, front);
      maniglia(g, px1 - 0.09, -HD + 1.02, front);
    } else if (st.model !== "libera") {
      maniglia(g, 0, -HD + 1.0, front);
    }
    return g;
  }

  function disposeTree(o) {
    o.traverse((m) => {
      if (m.geometry) m.geometry.dispose();
      if (m.material && m.material !== chrome && m.material !== darkGap && m.material !== glass) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); }
    });
  }
  let builtKey = "";
  function ensureLeaf(st) {
    const key = st.model + "|" + (st.fin && st.fin.id) + "|" + st.ped;
    if (key === builtKey) return;
    if (leaf) { pivot.remove(leaf); disposeTree(leaf); }
    leaf = buildLeaf(st); pivot.add(leaf); builtKey = key;
  }

  /* ---- movimento della basculante: l'alto scorre indietro nelle guide, il basso esce e sale ---- */
  function setLift(t) {
    t = Math.max(0, Math.min(1, t));
    const th = t * Math.PI / 2;
    pivot.rotation.x = -th;
    pivot.position.set(0, H - 0.06 * t, Z_ANTA - HD * 0.5 * (1 - Math.cos(th)));
    glow.intensity = 3.5 * t;
  }

  /* ---- stato del visore ---- */
  const vis = { model: "doghe", fin: { id: "7016", c: "#383e42" }, ped: true, lift: 0, liftTo: 0, az: 0.3, el: 0.04, azTo: 0.3, elTo: 0.04 };
  let host = null;
  const tgt = new THREE.Vector3();

  function fitDist(aspect, w, h) {
    const v = THREE.MathUtils.degToRad(camera.fov) / 2;
    return Math.max((h / 2) / Math.tan(v), (w / 2) / (Math.tan(v) * aspect));
  }
  function place() {
    const aspect = camera.aspect;
      setLift(vis.lift);
      const d = fitDist(aspect, W + (aspect < 1 ? 0.5 : 1.1), H + 0.7);
      tgt.set(0, 1.1, 0);
      const az = vis.az, el = vis.el;
      camera.position.set(Math.sin(az) * d, 1.05 + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
      camera.lookAt(tgt);
      scene.environmentRotation.y = -0.4 + az * 0.8;
      sun.position.set(-3.5, 6, 5);
  }

  /* ---- disegno on-demand ---- */
  let lastRead = 0, queued = false, running = true, lastT = 0, frames = 0, rowY = -1, rowData = null, rowRect = null, wantRow = -1;
  function ask() { if (!queued && running && host) { queued = true; requestAnimationFrame(frame); } }
  function frame(now) {
    queued = false;
    if (!host) return;
    let again = false;
    {
      const k = reduce ? 1 : 0.14;
      const step = (a, b) => (Math.abs(b - a) < 0.0006 ? b : a + (b - a) * k);
      const nl = step(vis.lift, vis.liftTo), na = step(vis.az, vis.azTo), ne = step(vis.el, vis.elTo);
      again = nl !== vis.liftTo || na !== vis.azTo || ne !== vis.elTo;
      vis.lift = nl; vis.az = na; vis.el = ne;
      if (pendingSwap && vis.lift > 0.16) { ensureLeaf(vis); pendingSwap = false; vis.liftTo = vis.keepOpen ? 1 : 0; again = true; }
    }
    place();
    renderer.render(scene, camera);
    frames++;
    if (wantRow >= 0) readRow();
    if (again) ask();
  }
  let pendingSwap = false;

  /* ---- tono della barra sopra il 3D: si legge una riga di pixel subito dopo il disegno ---- */
  function readRow() {
    const r = canvas.getBoundingClientRect();
    if (wantRow < r.top || wantRow > r.bottom) { rowData = null; wantRow = -1; return; }
    const gl = renderer.getContext(), pr = renderer.getPixelRatio();
    const wpx = Math.max(1, Math.floor(r.width * pr)), y = Math.floor((r.bottom - wantRow) * pr);
    const buf = new Uint8Array(wpx * 4);
    gl.readPixels(0, Math.min(canvas.height - 1, Math.max(0, y)), wpx, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    rowData = buf; rowY = wantRow; rowRect = { left: r.left, width: r.width, top: r.top }; wantRow = -1;
  }
  function lumAt(x, y) {
    const r = canvas.getBoundingClientRect();
    if (!host || y < r.top || y > r.bottom) return -1;
    // la lettura dei pixel ferma la GPU un istante: al massimo una ogni 160 ms, e solo se la scena si e' spostata
    const stale = !rowData || Math.abs(rowY - y) > 1.5 || Math.abs(rowRect.top - r.top) > 6;
    if (stale && performance.now() - lastRead > 160) { wantRow = y; lastRead = performance.now(); ask(); }
    if (!rowData) return -1;
    const n = rowData.length / 4, i = Math.max(0, Math.min(n - 1, Math.floor((x - r.left) / r.width * n))) * 4;
    return (0.2126 * rowData[i] + 0.7152 * rowData[i + 1] + 0.0722 * rowData[i + 2]) / 255;
  }

  /* ---- dove sta il canvas ---- */
  let ro = null;
  function resize() {
    if (!host) return;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    rowData = null;
    ask();
  }
  function attach(el) {
    if (host === el) return;
    host = el;
    ensureLeaf(vis);
    el.insertBefore(canvas, el.firstChild);
    if (ro) ro.disconnect();
    ro = new ResizeObserver(resize); ro.observe(el);
    const w = el.clientWidth, h = el.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    place(); renderer.render(scene, camera); frames++;
    el.classList.add("is-3d");
  }
  document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) ask(); });

  /* ---- trascinare per girare intorno (solo nel visore) ---- */
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, az: vis.azTo, el: vis.elTo, id: e.pointerId, moved: false };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) < 6) return;
    drag.moved = true;
    const w = canvas.clientWidth || 1;
    vis.azTo = Math.max(-0.75, Math.min(0.75, drag.az - dx / w * 1.6));
    if (e.pointerType === "mouse") vis.elTo = Math.max(-0.05, Math.min(0.22, drag.el + dy / w * 0.6));
    ask();
  }, { passive: true });
  const end = () => { drag = null; };
  window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);

  return {
    canvas, renderer,
    get frames() { return frames; },
    attach,
    visore(st) {
      const changedLeaf = st.model !== vis.model || (st.fin && st.fin.id) !== (vis.fin && vis.fin.id) || st.ped !== vis.ped;
      Object.assign(vis, { model: st.model, fin: st.fin, ped: st.ped });
      if (!host) return;
      if (changedLeaf) {
        if (reduce || st.model === undefined) { ensureLeaf(vis); }
        else if (st.instant) { ensureLeaf(vis); }
        else { pendingSwap = true; vis.keepOpen = vis.liftTo > 0.5; vis.liftTo = 0.22; if (vis.keepOpen) { ensureLeaf(vis); pendingSwap = false; vis.liftTo = 1; } }
      }
      ask();
    },
    apri(open) { vis.liftTo = open ? 1 : 0; ask(); },
    giraDi(da) { vis.azTo = Math.max(-0.75, Math.min(0.75, vis.azTo + da)); ask(); },
    lumAt,
    ask
  };
}
