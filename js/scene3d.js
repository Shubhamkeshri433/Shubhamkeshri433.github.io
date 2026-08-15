/**
 * Three.js 3D Interactive Background & Scroll Choreography
 * Crimson Obsidian Theme - Shubham Keshri Portfolio
 */

class Scene3DManager {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // 3D Objects
    this.coreGroup = null;
    this.innerMesh = null;
    this.outerWireframe = null;
    this.orbitRings = [];
    this.particleSystem = null;
    this.floatingNodes = [];
    this.customModel = null;

    // Mouse & Scroll State
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetMouseX = 0;
    this.targetMouseY = 0;

    this.scrollProgress = 0;
    this.targetScrollProgress = 0;

    this.isInitialized = false;

    this.init();
  }

  init() {
    // 1. Scene setup with deep obsidian & crimson fog
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x07070a, 0.022);

    // 2. Camera setup
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 18);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

    // 4. Lighting (Crimson & Obsidian)
    this.setupLights();

    // 5. Procedural 3D Elements
    this.createDataCore();
    this.createParticleConstellation();
    this.createOrbitRings();
    this.createFloatingNodes();

    // 6. Optional GLTF Loader hook
    this.checkForCustomModel();

    // 7. Event listeners
    this.setupEventListeners();

    this.isInitialized = true;
    this.animate();
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Crimson key light
    this.keyLight = new THREE.PointLight(0xff2a4b, 3.5, 55);
    this.keyLight.position.set(12, 10, 10);
    this.scene.add(this.keyLight);

    // Dark ruby fill light
    this.fillLight = new THREE.PointLight(0x8b0000, 3, 50);
    this.fillLight.position.set(-12, -8, 8);
    this.scene.add(this.fillLight);

    // White / Ice accent light
    this.accentLight = new THREE.PointLight(0xffffff, 1.5, 40);
    this.accentLight.position.set(0, -12, 10);
    this.scene.add(this.accentLight);

    // Directional overhead light
    const dirLight = new THREE.DirectionalLight(0xff4455, 0.8);
    dirLight.position.set(0, 20, 10);
    this.scene.add(dirLight);
  }

  createDataCore() {
    this.coreGroup = new THREE.Group();

    // Outer crystalline wireframe in crimson
    const outerGeo = new THREE.IcosahedronGeometry(3.2, 2);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0xff2a4b,
      wireframe: true,
      emissive: 0x440008,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.9,
      transparent: true,
      opacity: 0.65
    });
    this.outerWireframe = new THREE.Mesh(outerGeo, outerMat);
    this.coreGroup.add(this.outerWireframe);

    // Inner smooth geometric core
    const innerGeo = new THREE.TorusKnotGeometry(1.6, 0.45, 128, 32);
    const innerMat = new THREE.MeshPhysicalMaterial({
      color: 0x8b0000,
      emissive: 0x330004,
      emissiveIntensity: 0.6,
      roughness: 0.15,
      metalness: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      wireframe: false
    });
    this.innerMesh = new THREE.Mesh(innerGeo, innerMat);
    this.coreGroup.add(this.innerMesh);

    // Subtle inner glowing orb
    const glowGeo = new THREE.SphereGeometry(1.1, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff2a4b,
      transparent: true,
      opacity: 0.35,
      wireframe: false
    });
    this.glowOrb = new THREE.Mesh(glowGeo, glowMat);
    this.coreGroup.add(this.glowOrb);

    this.scene.add(this.coreGroup);
  }

  createParticleConstellation() {
    const particleCount = 1200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorCrimson = new THREE.Color(0xff2a4b);
    const colorDarkRuby = new THREE.Color(0x8b0000);
    const colorWhite = new THREE.Color(0xffffff);

    for (let i = 0; i < particleCount; i++) {
      const radius = 8 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 45;

      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * radius;

      let col = Math.random() > 0.6 ? colorCrimson : (Math.random() > 0.4 ? colorDarkRuby : colorWhite);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom circular soft particle texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,42,75,0.7)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      map: texture,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
  }

  createOrbitRings() {
    this.orbitGroup = new THREE.Group();

    const ringRadii = [4.8, 6.2, 7.8];
    const ringColors = [0xff2a4b, 0x8b0000, 0xff4455];

    ringRadii.forEach((r, idx) => {
      const ringGeo = new THREE.RingGeometry(r, r + 0.04, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ringColors[idx],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35 - idx * 0.08
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2 + (idx * 0.3);
      ringMesh.rotation.y = idx * 0.4;
      this.orbitRings.push(ringMesh);
      this.orbitGroup.add(ringMesh);
    });

    this.scene.add(this.orbitGroup);
  }

  createFloatingNodes() {
    this.nodeGroup = new THREE.Group();
    const nodeCount = 18;
    const boxGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff2a4b,
      wireframe: true,
      roughness: 0.3,
      metalness: 0.9,
      emissive: 0xff2a4b,
      emissiveIntensity: 0.3
    });

    for (let i = 0; i < nodeCount; i++) {
      const mesh = new THREE.Mesh(boxGeo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 35,
        (Math.random() - 0.5) * 15
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      mesh.userData = {
        rotSpeedX: (Math.random() - 0.5) * 0.02,
        rotSpeedY: (Math.random() - 0.5) * 0.02,
        floatSpeed: 0.5 + Math.random() * 1.5,
        initialY: mesh.position.y
      };
      this.floatingNodes.push(mesh);
      this.nodeGroup.add(mesh);
    }

    this.scene.add(this.nodeGroup);
  }

  checkForCustomModel() {
    if (typeof THREE.GLTFLoader !== 'undefined') {
      const loader = new THREE.GLTFLoader();
      loader.load(
        'assets/models/avatar.glb',
        (gltf) => {
          this.customModel = gltf.scene;
          this.customModel.scale.set(2, 2, 2);
          this.customModel.position.set(0, 0, 0);
          this.scene.add(this.customModel);
          if (this.coreGroup) {
            this.coreGroup.position.set(3, 0, -2);
            this.coreGroup.scale.set(0.6, 0.6, 0.6);
          }
        },
        undefined,
        () => {}
      );
    }
  }

  setupEventListeners() {
    window.addEventListener('mousemove', (e) => {
      this.targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      this.targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    window.addEventListener('scroll', () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        this.targetScrollProgress = window.scrollY / totalScroll;
      }
    });

    window.addEventListener('resize', () => {
      if (!this.renderer || !this.camera) return;
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const elapsedTime = this.clock.getElapsedTime();

    this.mouseX += (this.targetMouseX - this.mouseX) * 0.05;
    this.mouseY += (this.targetMouseY - this.mouseY) * 0.05;
    this.scrollProgress += (this.targetScrollProgress - this.scrollProgress) * 0.08;

    if (this.coreGroup) {
      this.coreGroup.rotation.y = elapsedTime * 0.22;
      this.coreGroup.rotation.x = Math.sin(elapsedTime * 0.2) * 0.15;
    }
    if (this.innerMesh) {
      this.innerMesh.rotation.x = elapsedTime * 0.35;
      this.innerMesh.rotation.z = elapsedTime * 0.25;
    }
    if (this.outerWireframe) {
      this.outerWireframe.rotation.y = -elapsedTime * 0.15;
    }

    this.orbitRings.forEach((ring, idx) => {
      ring.rotation.z = elapsedTime * (0.15 + idx * 0.08);
      ring.rotation.x = Math.PI / 2 + Math.sin(elapsedTime * 0.3 + idx) * 0.1;
    });

    this.floatingNodes.forEach((node) => {
      node.rotation.x += node.userData.rotSpeedX;
      node.rotation.y += node.userData.rotSpeedY;
      node.position.y = node.userData.initialY + Math.sin(elapsedTime * node.userData.floatSpeed) * 0.8;
    });

    if (this.particleSystem) {
      this.particleSystem.rotation.y = elapsedTime * 0.03;
      this.particleSystem.rotation.x = Math.sin(elapsedTime * 0.02) * 0.04;
    }

    if (this.keyLight) {
      this.keyLight.position.x = Math.sin(elapsedTime * 0.8) * 12 + this.mouseX * 3;
      this.keyLight.position.y = Math.cos(elapsedTime * 0.7) * 12 - this.mouseY * 3;
    }
    if (this.fillLight) {
      this.fillLight.position.x = -Math.sin(elapsedTime * 0.6) * 12;
      this.fillLight.position.z = Math.cos(elapsedTime * 0.5) * 10;
    }

    this.updateCameraScrollChoreography(elapsedTime);
    this.renderer.render(this.scene, this.camera);
  }

  updateCameraScrollChoreography(elapsedTime) {
    const sp = this.scrollProgress;

    let targetCamX = this.mouseX * 1.5;
    let targetCamY = -this.mouseY * 1.2;
    let targetCamZ = 18;
    let targetCoreX = 3.5;
    let targetCoreY = 0.5;
    let targetCoreScale = 1;

    if (sp < 0.20) {
      // Hero
      const localP = sp / 0.20;
      targetCamX = this.mouseX * 2;
      targetCamY = -this.mouseY * 1.5;
      targetCamZ = 18 - localP * 2;
      targetCoreX = 3.5;
      targetCoreY = 0;
      targetCoreScale = 1;
    } else if (sp < 0.50) {
      // Selected Projects
      const localP = (sp - 0.20) / 0.30;
      targetCamX = -3.0 * localP + this.mouseX * 1.5;
      targetCamY = -2.0 * localP - this.mouseY * 1.2;
      targetCamZ = 16 - localP * 2;
      targetCoreX = -3.5 * localP;
      targetCoreY = 1.0 * localP;
      targetCoreScale = 0.9;
    } else if (sp < 0.80) {
      // 3-Column Blocks (Education, Skills, Process)
      const localP = (sp - 0.50) / 0.30;
      targetCamX = 2.5 * localP + this.mouseX * 1.5;
      targetCamY = 1.5 * localP - this.mouseY * 1.2;
      targetCamZ = 15 + localP * 2;
      targetCoreX = 2.5;
      targetCoreY = -1.5;
      targetCoreScale = 0.8;
    } else {
      // Contact & Footer
      const localP = (sp - 0.80) / 0.20;
      targetCamX = this.mouseX * 1.0;
      targetCamY = 3.5 * localP - this.mouseY * 0.8;
      targetCamZ = 13 - localP * 2;
      targetCoreX = 0;
      targetCoreY = -1.0;
      targetCoreScale = 0.9;
    }

    this.camera.position.x += (targetCamX - this.camera.position.x) * 0.08;
    this.camera.position.y += (targetCamY - this.camera.position.y) * 0.08;
    this.camera.position.z += (targetCamZ - this.camera.position.z) * 0.08;

    if (this.coreGroup) {
      this.coreGroup.position.x += (targetCoreX - this.coreGroup.position.x) * 0.08;
      this.coreGroup.position.y += (targetCoreY - this.coreGroup.position.y) * 0.08;
      const curScale = this.coreGroup.scale.x;
      const newScale = curScale + (targetCoreScale - curScale) * 0.08;
      this.coreGroup.scale.set(newScale, newScale, newScale);
    }

    this.camera.lookAt(0, 0, 0);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof THREE !== 'undefined') {
    window.scene3D = new Scene3DManager('webgl-canvas');
  }
});
