import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type PreviewShape = 'plane' | 'box' | 'sphere' | 'cylinder';

export interface Preview3D {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  material: THREE.MeshStandardMaterial;
  setShape: (s: PreviewShape) => void;
  setHeightTexture: (tex: THREE.Texture | null) => void;
  setNormalTexture: (tex: THREE.Texture | null) => void;
  setAOTexture: (tex: THREE.Texture | null) => void;
  setRoughnessTexture: (tex: THREE.Texture | null) => void;
  setDisplacementScale: (v: number) => void;
  setTileRepeat: (n: number) => void;
  setBaseColor: (hex: string) => void;
  setRoughnessOverride: (v: number) => void;
  setMetalness: (v: number) => void;
  resize: () => void;
  dispose: () => void;
}

export function createPreview3D(canvas: HTMLCanvasElement): Preview3D {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(1.4, 1.0, 1.4);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.5;
  controls.maxDistance = 6;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x222244, 0.6);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 3, 2);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xb0c4de, 0.45);
  fill.position.set(-2, 1, -1);
  scene.add(fill);

  const material = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.85,
    metalness: 0.0,
    displacementScale: 0.12,
    side: THREE.FrontSide,
  });

  const SUBDIV = 384;
  const planeGeo = new THREE.PlaneGeometry(1, 1, SUBDIV, SUBDIV);
  planeGeo.rotateX(-Math.PI / 2);
  const boxGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8, 96, 96, 96);
  const sphereGeo = new THREE.SphereGeometry(0.5, 256, 192);
  const cylinderGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.85, 192, 192, false);

  const mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> = new THREE.Mesh(planeGeo, material);
  scene.add(mesh);

  function setShape(s: PreviewShape) {
    mesh.geometry.dispose();
    const next: THREE.BufferGeometry =
      s === 'plane' ? planeGeo.clone()
      : s === 'box' ? boxGeo.clone()
      : s === 'cylinder' ? cylinderGeo.clone()
      : sphereGeo.clone();
    mesh.geometry = next;
  }

  function setTextureWrap(tex: THREE.Texture | null, repeat: number) {
    if (!tex) return;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.needsUpdate = true;
  }

  let tileRepeat = 1;

  function setHeightTexture(tex: THREE.Texture | null) {
    setTextureWrap(tex, tileRepeat);
    material.displacementMap = tex;
    material.needsUpdate = true;
  }

  function setNormalTexture(tex: THREE.Texture | null) {
    setTextureWrap(tex, tileRepeat);
    material.normalMap = tex;
    if (tex) material.normalScale.set(1, 1);
    material.needsUpdate = true;
  }

  function setAOTexture(tex: THREE.Texture | null) {
    setTextureWrap(tex, tileRepeat);
    material.aoMap = tex;
    material.aoMapIntensity = 1.2;
    material.needsUpdate = true;
  }

  function setRoughnessTexture(tex: THREE.Texture | null) {
    setTextureWrap(tex, tileRepeat);
    material.roughnessMap = tex;
    material.needsUpdate = true;
  }

  function setDisplacementScale(v: number) {
    material.displacementScale = v;
  }

  function setTileRepeat(n: number) {
    tileRepeat = n;
    for (const tex of [material.displacementMap, material.normalMap, material.aoMap, material.roughnessMap]) {
      setTextureWrap(tex, n);
    }
  }

  function setBaseColor(hex: string) {
    material.color.set(hex);
  }

  function setRoughnessOverride(v: number) {
    // Если roughnessMap установлен, итог = map * material.roughness, поэтому это множитель.
    material.roughness = v;
  }

  function setMetalness(v: number) {
    material.metalness = v;
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  let raf = 0;
  function loop() {
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();

  function dispose() {
    cancelAnimationFrame(raf);
    controls.dispose();
    planeGeo.dispose();
    boxGeo.dispose();
    sphereGeo.dispose();
    material.dispose();
    renderer.dispose();
  }

  return {
    renderer, scene, camera, controls, material,
    setShape, setHeightTexture, setNormalTexture, setAOTexture, setRoughnessTexture,
    setDisplacementScale, setTileRepeat,
    setBaseColor, setRoughnessOverride, setMetalness,
    resize, dispose,
  };
}
