import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { portfolioData } from "./data/portfolioData.js";

export function createPortfolioScene(canvas, callbacks = {}) {
  const {
    onPanelChange = () => {},
    onStatusChange = () => {},
    onContactFieldFocus = () => {},
    onContactSubmit = () => {},
  } = callbacks;
  const canvasContext = canvas?.getContext("webgl2");
  if (!canvasContext) {
    document.body.classList.add("no-webgl");
    onStatusChange("3D is unavailable. Use the portfolio navigation to explore.");
    return {
      dispose() {},
      setPanel() {},
      setContactValues() {},
      resetView() {},
      toggleAmbientSound() {},
    };
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#151724");
  scene.fog = new THREE.FogExp2("#151724", 0.022);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: canvasContext,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 80);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 2.05, -0.25);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = false;
  controls.minPolarAngle = Math.PI * 0.29;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 10;
  controls.maxDistance = 23;
  controls.rotateSpeed = 0.42;
  controls.zoomSpeed = 0.52;

  function setCameraForScreen() {
    const { innerWidth, innerHeight } = window;
    camera.aspect = innerWidth / innerHeight;

    const portrait = innerWidth < 700;
    camera.fov = portrait ? 56 : 39;
    camera.updateProjectionMatrix();
    controls.target.set(0, portrait ? 2.7 : 2.65, -0.55);

    const position = portrait
      ? new THREE.Vector3(7.1, 8.15, 15.8)
      : new THREE.Vector3(7.7, 7.55, 16.1);
    camera.position.copy(position);
    camera.lookAt(controls.target);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, portrait ? 1.25 : 1.5));
    renderer.setSize(innerWidth, innerHeight, false);
    resizeHudLayers();
  }

  function material(color, roughness = 0.82, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  }

  const roomMaterials = {
    wall: material("#37323d"),
    sideWall: material("#302d38"),
    floor: material("#332931"),
    floorAlternate: material("#302831"),
    trim: material("#473d43"),
    wood: material("#704b3c"),
    woodLight: material("#966951"),
    woodEdge: material("#4c352f"),
    metal: material("#34353e", 0.46, { metalness: 0.66 }),
    darkMetal: material("#20222a", 0.38, { metalness: 0.4 }),
    fabric: material("#514b5a", 0.95),
    pillow: material("#78616a", 0.96),
    leaves: material("#567768", 0.9),
    paper: material("#c8b69e"),
    frame: material("#262833", 0.38, { metalness: 0.25 }),
  };

  const interactiveMeshes = [];
  const room = new THREE.Group();
  scene.add(room);

  function addBox(parent, x, y, z, width, height, depth, surface, options = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      surface,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    if (options.panel) {
      mesh.userData.panel = options.panel;
      mesh.userData.label = options.label;
      interactiveMeshes.push(mesh);
    }
    parent.add(mesh);
    return mesh;
  }

  function addSphere(parent, x, y, z, radius, surface, scaleY = 1) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 9),
      surface,
    );
    mesh.position.set(x, y, z);
    mesh.scale.y = scaleY;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function createCanvasTexture(draw, width = 1024, height = 640) {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = width;
    textureCanvas.height = height;
    const context = textureCanvas.getContext("2d");
    draw(context, width, height);
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  const hud = new THREE.Group();
  camera.add(hud);
  scene.add(camera);
  const hudLayers = [];
  const hudRegions = [];
  const hudSizes = { width: 1600, height: 900 };
  let panelOpen = false;
  let soundIsOn = false;
  let appPanel = "home";
  let contactValues = callbacks.contactValues ?? { name: "", email: "", message: "" };
  let previousFocus = null;
  let terminalText = "";
  let terminalTimer = null;

  function createHudLayer(draw, renderOrder = 20) {
    const texture = createCanvasTexture(draw, hudSizes.width, hudSizes.height);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    mesh.position.z = -10;
    mesh.renderOrder = renderOrder;
    hud.add(mesh);
    hudLayers.push(mesh);
    return { mesh, texture, canvas: texture.image };
  }

  function fitHudLayers() {
    const viewHeight = 20 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const viewWidth = viewHeight * camera.aspect;

    for (const mesh of hudLayers) {
      mesh.scale.set(viewWidth, viewHeight, 1);
    }
  }

  function roundedBox(context, x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  }

  function setHudBackground(context, width, height) {
    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "rgba(12,13,20,0.91)");
    gradient.addColorStop(0.37, "rgba(12,13,20,0.73)");
    gradient.addColorStop(0.58, "rgba(12,13,20,0.28)");
    gradient.addColorStop(0.78, "rgba(12,13,20,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const shade = context.createLinearGradient(0, 0, 0, height);
    shade.addColorStop(0, "rgba(10,11,17,0.82)");
    shade.addColorStop(0.1, "rgba(10,11,17,0.12)");
    shade.addColorStop(0.82, "rgba(10,11,17,0.03)");
    shade.addColorStop(1, "rgba(10,11,17,0.55)");
    context.fillStyle = shade;
    context.fillRect(0, 0, width, height);
  }

  function registerHudRegion(action, x, y, width, height) {
    hudRegions.push({ action, x, y, width, height });
  }

  function drawHomeHud(context, width, height) {
    context.clearRect(0, 0, width, height);
    setHudBackground(context, width, height);
    hudRegions.length = 0;

    const mobile = width < 760;
    const scale = height / 900;
    const margin = width * (mobile ? 0.065 : 0.052);
    const edge = height * 0.046;

    context.fillStyle = "rgba(245,233,236,0.65)";
    context.fillRect(0, edge * 2.12, width, 1.1 * scale);

    context.textBaseline = "middle";
    context.fillStyle = "#ef8eac";
    context.beginPath();
    context.arc(margin + 18 * scale, edge, 19 * scale, 0, Math.PI * 2);
    context.strokeStyle = "rgba(239,142,172,0.8)";
    context.lineWidth = 1.4 * scale;
    context.stroke();
    context.fillStyle = "#f1ebea";
    context.font = `600 ${mobile ? 12 : 15 * scale}px "Space Grotesk", sans-serif`;
    context.textAlign = "center";
    context.fillText("S", margin + 18 * scale, edge);

    context.textAlign = "left";
    context.font = `500 ${mobile ? 10 : 12 * scale}px "DM Mono", monospace`;
    context.fillStyle = "#f1ebea";
    context.fillText(portfolioData.name.toUpperCase(), margin + 47 * scale, edge - 3 * scale);
    if (!mobile) {
      context.font = `${8 * scale}px "DM Mono", monospace`;
      context.fillStyle = "#b6b0be";
      context.fillText(portfolioData.eyebrow, margin + 47 * scale, edge + 10 * scale);
    }

    const navTop = height * 0.05;
    const navSize = 11 * scale;
    const navGap = mobile ? 12 * scale : 27 * scale;
    const actions = mobile
      ? [
          ["WORK", "work", 0],
          ["ABOUT", "about", 1],
        ]
      : [
          ["PROJECTS", "work", 0],
          ["EXPERIENCE", "experience", 1],
          ["ABOUT", "about", 2],
        ];
    const contactWidth = mobile ? 68 * scale : 116 * scale;
    let cursorX = width - margin;

    context.textAlign = "right";
    context.textBaseline = "middle";
    context.font = `500 ${navSize}px "DM Sans", sans-serif`;
    context.fillStyle = "#eee7ed";
    context.strokeStyle = "rgba(239,223,227,0.52)";
    roundedBox(context, cursorX - contactWidth, navTop - 18 * scale, contactWidth, 36 * scale, 2 * scale);
    context.stroke();
    context.fillText(mobile ? "HELLO  ↗" : "SAY HELLO  ↗", cursorX - 8 * scale, navTop);
    registerHudRegion("contact", cursorX - contactWidth, navTop - 19 * scale, contactWidth, 38 * scale);
    cursorX -= contactWidth + navGap;

    for (const [label, action] of actions) {
      const actionWidth = mobile ? (action === "work" ? 34 : 38) * scale : 88 * scale;
      context.fillStyle = "#eee7ed";
      context.fillText(label, cursorX, navTop);
      registerHudRegion(action, cursorX - actionWidth, navTop - 20 * scale, actionWidth, 40 * scale);
      cursorX -= actionWidth + navGap;
    }

    const left = margin;
    const cardTop = mobile ? height * 0.25 : height * 0.235;
    const cardWidth = mobile ? width - margin * 2 : Math.min(width * 0.43, 650 * scale);
    const cardHeight = mobile ? height * 0.43 : height * 0.51;
    const pad = mobile ? 24 * scale : 37 * scale;

    roundedBox(context, left, cardTop, cardWidth, cardHeight, 7 * scale);
    context.fillStyle = "rgba(15,15,23,0.43)";
    context.fill();
    context.strokeStyle = "rgba(239,223,227,0.19)";
    context.lineWidth = 1 * scale;
    context.stroke();

    const introX = left + pad;
    const labelY = cardTop + (mobile ? 39 : 48) * scale;
    context.beginPath();
    context.arc(introX + 4 * scale, labelY, 4 * scale, 0, Math.PI * 2);
    context.fillStyle = "#a9d3a0";
    context.fill();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#d2cbd2";
    context.font = `500 ${(mobile ? 10 : 11) * scale}px "DM Mono", monospace`;
    context.fillText(portfolioData.role, introX + 19 * scale, labelY);

    const titleSize = (mobile ? 39 : 68) * scale;
    context.font = `500 ${titleSize}px "Space Grotesk", sans-serif`;
    context.fillStyle = "#f5efee";
    context.fillText(portfolioData.hero.title, introX, cardTop + (mobile ? 116 : 146) * scale);
    context.fillText(portfolioData.hero.secondLine, introX, cardTop + (mobile ? 180 : 230) * scale);
    const secondLine = context.measureText(portfolioData.hero.secondLine).width + 12 * scale;
    context.fillStyle = "#ef8eac";
    context.font = `400 ${titleSize}px "Space Grotesk", sans-serif`;
    context.fillText(portfolioData.hero.highlight, introX + secondLine, cardTop + (mobile ? 180 : 230) * scale);

    const descriptionY = cardTop + (mobile ? 229 : 289) * scale;
    context.fillStyle = "#cfc8d1";
    context.font = `400 ${(mobile ? 11 : 14) * scale}px "DM Sans", sans-serif`;
    const description = mobile
      ? portfolioData.hero.mobileDescription
      : portfolioData.hero.description;
    context.fillText(description[0], introX, descriptionY);
    context.fillText(description[1], introX, descriptionY + 24 * scale);

    const buttonX = introX;
    const buttonY = cardTop + (mobile ? 272 : 363) * scale;
    const buttonWidth = 145 * scale;
    const buttonHeight = 42 * scale;
    context.fillStyle = "#ef8eac";
    roundedBox(context, buttonX, buttonY, buttonWidth, buttonHeight, 2 * scale);
    context.fill();
    context.font = `600 ${12 * scale}px "DM Sans", sans-serif`;
    context.fillStyle = "#201821";
    context.fillText(portfolioData.hero.callToAction, buttonX + 14 * scale, buttonY + buttonHeight / 2);
    context.textAlign = "right";
    context.fillText("↗", buttonX + buttonWidth - 13 * scale, buttonY + buttonHeight / 2);
    context.textAlign = "left";
    registerHudRegion("work", buttonX, buttonY, buttonWidth, buttonHeight);

    context.fillStyle = "#e7dfe6";
    context.font = `400 ${9 * scale}px "DM Mono", monospace`;
    const hintY = height - 24 * scale;
    context.fillText(`~ ${portfolioData.name.split(" ")[0].toUpperCase()}@DESK $ OPEN CONSOLE`, margin, hintY - 24 * scale);
    registerHudRegion("terminal", margin, hintY - 44 * scale, 220 * scale, 34 * scale);
    if (!mobile) {
      context.textAlign = "right";
      context.fillStyle = "#d6d0db";
      context.fillText("DRAG TO LOOK AROUND  ·  CLICK OBJECTS TO EXPLORE", width - margin, hintY);
    }
    context.textAlign = "left";

    const controlY = height - 66 * scale;
    drawHudControl(context, width - margin - 202 * scale, controlY, 67 * scale, "MUSIC");
    registerHudRegion("music", width - margin - 202 * scale, controlY - 17 * scale, 68 * scale, 35 * scale);
    drawHudControl(context, width - margin - 125 * scale, controlY, 43 * scale, "⌂");
    registerHudRegion("reset", width - margin - 125 * scale, controlY - 17 * scale, 46 * scale, 35 * scale);
    drawHudControl(context, width - margin - 62 * scale, controlY, 62 * scale, soundIsOn ? "♫  ON" : "♫  OFF");
    registerHudRegion("sound", width - margin - 62 * scale, controlY - 17 * scale, 63 * scale, 35 * scale);
  }

  function drawHudControl(context, x, y, width, label) {
    context.fillStyle = "rgba(20,20,29,0.68)";
    roundedBox(context, x, y - 17, width, 35, 2);
    context.fill();
    context.strokeStyle = "rgba(239,223,227,0.4)";
    context.lineWidth = 1;
    context.stroke();
    context.font = '12px "DM Mono", monospace';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#eee7ed";
    context.fillText(label, x + width / 2, y);
    context.textAlign = "left";
  }

  function drawPanelHud(context, width, height) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(7,8,14,0.78)";
    context.fillRect(0, 0, width, height);
    hudRegions.length = 0;

    const mobile = width < 760;
    const scale = height / 900;
    const panelWidth = Math.min(width * (mobile ? 0.9 : 0.72), 910 * scale);
    const panelHeight = Math.min(height * 0.72, 660 * scale);
    const left = (width - panelWidth) / 2;
    const top = (height - panelHeight) / 2;
    const padding = (mobile ? 24 : 39) * scale;

    roundedBox(context, left, top, panelWidth, panelHeight, 5 * scale);
    context.fillStyle = "rgba(20,21,31,0.97)";
    context.fill();
    context.strokeStyle = "rgba(239,223,227,0.42)";
    context.lineWidth = 1 * scale;
    context.stroke();

    const panelCopy = {
      home: ["", ""],
      work: ["01 / PROJECTS", "A few things I've made."],
      experience: ["02 / EXPERIENCE", "What I'm learning now."],
      about: ["03 / ABOUT", portfolioData.about.title],
      contact: ["04 / CONTACT", "My inbox is open."],
      music: ["05 / LISTENING CORNER", "A little listening corner."],
      terminal: ["06 / PORTFOLIO CONSOLE", "The portfolio console."],
    }[appPanel];
    const [kicker, title] = panelCopy;
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.font = `500 ${10 * scale}px "DM Mono", monospace`;
    context.fillStyle = "#ef8eac";
    context.fillText(kicker, left + padding, top + 31 * scale);
    context.font = `500 ${(mobile ? 22 : 28) * scale}px "Space Grotesk", sans-serif`;
    context.fillStyle = "#f2eaec";
    context.fillText(title, left + padding, top + 69 * scale);
    context.strokeStyle = "rgba(244,224,226,0.15)";
    context.beginPath();
    context.moveTo(left + padding, top + 102 * scale);
    context.lineTo(left + panelWidth - padding, top + 102 * scale);
    context.stroke();

    const closeSize = 37 * scale;
    const closeX = left + panelWidth - padding - closeSize;
    const closeY = top + 19 * scale;
    context.strokeStyle = "rgba(239,223,227,0.48)";
    context.strokeRect(closeX, closeY, closeSize, closeSize);
    context.textAlign = "center";
    context.font = `400 ${25 * scale}px "DM Sans", sans-serif`;
    context.fillStyle = "#f1ebea";
    context.fillText("×", closeX + closeSize / 2, closeY + closeSize / 2);
    registerHudRegion("close", closeX, closeY, closeSize, closeSize);
    context.textAlign = "left";

    if (appPanel === "work") {
      portfolioData.projects.forEach((project, index) =>
        drawProjectCardHud(context, left, top, panelWidth, panelHeight, padding, scale, project, index),
      );
    } else if (appPanel === "experience") {
      portfolioData.experience.forEach((item, index) => {
        const cardY = top + (137 + index * 123) * scale;
        context.fillStyle = "#ef8eac";
        context.font = `500 ${9 * scale}px "DM Mono", monospace`;
        context.fillText(item.date, left + padding, cardY);
        context.fillStyle = "#f3ecee";
        context.font = `500 ${(mobile ? 14 : 18) * scale}px "Space Grotesk", sans-serif`;
        context.fillText(item.title, left + padding, cardY + 28 * scale);
        drawWrappedText(
          context,
          item.description,
          left + padding,
          cardY + 55 * scale,
          panelWidth - padding * 2,
          18 * scale,
          `400 ${(mobile ? 11 : 13) * scale}px "DM Sans", sans-serif`,
          "#cbc5cf",
        );
      });
    } else if (appPanel === "about") {
      let paragraphY = top + 151 * scale;
      context.font = `400 ${(mobile ? 12 : 14) * scale}px "DM Sans", sans-serif`;
      context.fillStyle = "#cbc5cf";
      for (const paragraph of portfolioData.about.paragraphs) {
        paragraphY = drawWrappedText(
          context,
          paragraph,
          left + padding,
          paragraphY,
          panelWidth - padding * 2,
          22 * scale,
        );
        paragraphY += 14 * scale;
      }
      context.fillStyle = "#a9d3a0";
      context.font = `500 ${10 * scale}px "DM Mono", monospace`;
      context.fillText(
        portfolioData.about.interests.join("  ·  ").toUpperCase(),
        left + padding,
        top + panelHeight - 44 * scale,
      );
    } else if (appPanel === "contact") {
      drawWrappedText(
        context,
        portfolioData.contact.introduction,
        left + padding,
        top + 137 * scale,
        panelWidth - padding * 2,
        20 * scale,
        `400 ${(mobile ? 12 : 14) * scale}px "DM Sans", sans-serif`,
        "#cbc5cf",
      );
      drawContactField(context, left + padding, top + 190 * scale, panelWidth - padding * 2, scale, "name", "YOUR NAME", contactValues.name);
      drawContactField(context, left + padding, top + 270 * scale, panelWidth - padding * 2, scale, "email", "YOUR EMAIL", contactValues.email);
      drawContactField(context, left + padding, top + 350 * scale, panelWidth - padding * 2, scale, "message", "MESSAGE", contactValues.message);
      drawActionButton(context, left + padding, top + 465 * scale, 150 * scale, 43 * scale, scale, "SEND EMAIL", "contact-submit");
      context.fillStyle = "#cbc5cf";
      context.font = `400 ${9 * scale}px "DM Mono", monospace`;
      context.fillText(portfolioData.contact.email, left + padding, top + panelHeight - 42 * scale);
      registerHudRegion("email", left + padding, top + panelHeight - 57 * scale, panelWidth - padding * 2, 26 * scale);
    } else if (appPanel === "music") {
      drawTextLines(
        context,
        portfolioData.music.description,
        left + padding,
        top + 145 * scale,
        22 * scale,
        `400 ${(mobile ? 12 : 14) * scale}px "DM Sans", sans-serif`,
        "#cbc5cf",
      );
      if (portfolioData.music.spotifyUrl) {
        drawActionButton(context, left + padding, top + 225 * scale, 230 * scale, 44 * scale, scale, "OPEN SPOTIFY  ↗", "spotify");
      } else {
        context.fillStyle = "rgba(240,230,237,0.055)";
        roundedBox(context, left + padding, top + 220 * scale, panelWidth - padding * 2, 94 * scale, 3 * scale);
        context.fill();
        context.strokeStyle = "rgba(239,223,227,0.22)";
        context.stroke();
        context.fillStyle = "#ef8eac";
        context.font = `500 ${10 * scale}px "DM Mono", monospace`;
        context.fillText("SPOTIFY  /  NOT CONNECTED", left + padding * 1.4, top + 250 * scale);
        context.fillStyle = "#c6bec8";
        context.font = `400 ${10 * scale}px "DM Sans", sans-serif`;
        context.fillText("Set music.spotifyUrl in src/data/portfolioData.js", left + padding * 1.4, top + 280 * scale);
      }
    } else if (appPanel === "terminal") {
      const terminalX = left + padding;
      const terminalY = top + 132 * scale;
      const terminalWidth = panelWidth - padding * 2;
      const terminalHeight = panelHeight - 170 * scale;
      roundedBox(context, terminalX, terminalY, terminalWidth, terminalHeight, 3 * scale);
      context.fillStyle = "rgba(8,10,15,0.96)";
      context.fill();
      context.strokeStyle = "rgba(239,223,227,0.22)";
      context.stroke();
      context.fillStyle = "#a9d3a0";
      context.font = `400 ${(mobile ? 9 : 12) * scale}px "DM Mono", monospace`;
      const lines = terminalText.split("\n");
      lines.forEach((line, index) => {
        context.fillText(line, terminalX + 17 * scale, terminalY + (29 + index * 28) * scale);
      });
      context.fillStyle = "#ef8eac";
      context.fillRect(terminalX + 17 * scale, terminalY + (38 + lines.length * 28) * scale, 8 * scale, 14 * scale);
    }

    context.fillStyle = "rgba(239,223,227,0.55)";
    context.textAlign = "center";
    context.font = `400 ${8 * scale}px "DM Mono", monospace`;
    context.fillText("ESC  /  CLICK OUTSIDE TO CLOSE", width / 2, top + panelHeight - 17 * scale);
    context.textAlign = "left";
  }

  function drawTextLines(context, lines, x, y, lineHeight, font, color) {
    context.font = font;
    context.fillStyle = color;
    lines.forEach((line, index) => {
      if (line) context.fillText(line, x, y + index * lineHeight);
    });
  }

  function drawWrappedText(context, text, x, y, maxWidth, lineHeight, font, color) {
    if (font) context.font = font;
    if (color) context.fillStyle = color;
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    lines.forEach((lineText, index) => context.fillText(lineText, x, y + index * lineHeight));
    return y + lines.length * lineHeight;
  }

  function drawContactField(context, x, y, width, scale, name, label, value) {
    context.fillStyle = "#c6bec8";
    context.font = `500 ${8 * scale}px "DM Mono", monospace`;
    context.fillText(label, x, y - 12 * scale);
    context.fillStyle = "rgba(9,10,16,0.7)";
    roundedBox(context, x, y, width, 43 * scale, 2 * scale);
    context.fill();
    context.strokeStyle = "rgba(239,223,227,0.32)";
    context.stroke();
    context.fillStyle = value ? "#f3ecee" : "#8d8792";
    context.font = `400 ${10 * scale}px "DM Mono", monospace`;
    let displayValue = value || (name === "message" ? "Click to write a message..." : "Click to enter " + name + "...");
    const textWidth = width - 24 * scale;
    const characterCapacity = Math.max(1, Math.floor(textWidth / context.measureText("M").width));
    if (displayValue.length > characterCapacity) {
      displayValue = characterCapacity > 1
        ? `…${displayValue.slice(-(characterCapacity - 1))}`
        : "…";
    }
    context.fillText(displayValue, x + 12 * scale, y + 23 * scale);
    registerHudRegion(`contact-${name}`, x, y, width, 43 * scale);
  }

  function drawActionButton(context, x, y, width, height, scale, label, action) {
    context.fillStyle = "rgba(239,142,172,0.17)";
    roundedBox(context, x, y, width, height, 2 * scale);
    context.fill();
    context.strokeStyle = "rgba(239,142,172,0.75)";
    context.stroke();
    context.font = `500 ${10 * scale}px "DM Mono", monospace`;
    context.fillStyle = "#ffd1df";
    context.textBaseline = "middle";
    context.fillText(label, x + 12 * scale, y + height / 2);
    registerHudRegion(action, x, y, width, height);
  }

  function drawProjectCardHud(context, left, top, panelWidth, panelHeight, padding, scale, project, index) {
    const mobile = panelWidth < 650 * scale;
    const cardGap = 19 * scale;
    const cardWidth = mobile ? panelWidth - padding * 2 : (panelWidth - padding * 2 - cardGap) / 2;
    const cardHeight = mobile ? 128 * scale : panelHeight - 150 * scale;
    const cardX = mobile ? left + padding : left + padding + index * (cardWidth + cardGap);
    const cardY = top + 122 * scale + (mobile ? index * (cardHeight + 10 * scale) : 0);
    const accent = project.accent;
    const title = project.title;
    const description = project.description;
    const action = `project-${index}`;

    roundedBox(context, cardX, cardY, cardWidth, cardHeight, 3 * scale);
    context.fillStyle = "rgba(240,230,237,0.055)";
    context.fill();
    context.strokeStyle = "rgba(239,223,227,0.23)";
    context.stroke();
    context.fillStyle = accent;
    context.fillRect(cardX, cardY, 3 * scale, cardHeight);
    context.textBaseline = "middle";
    context.font = `500 ${9 * scale}px "DM Mono", monospace`;
    context.fillStyle = accent;
    context.fillText(`${String(index + 1).padStart(2, "0")} / ${project.label}`, cardX + 17 * scale, cardY + 24 * scale);
    context.font = `500 ${(mobile ? 13 : 17) * scale}px "Space Grotesk", sans-serif`;
    context.fillStyle = "#f3ecee";
    context.fillText(title, cardX + 17 * scale, cardY + 51 * scale);
    drawTextLines(
      context,
      description,
      cardX + 17 * scale,
      cardY + 77 * scale,
      17 * scale,
      `400 ${(mobile ? 10 : 11) * scale}px "DM Sans", sans-serif`,
      "#c6bec8",
    );
    context.fillStyle = "#f1e6ed";
    context.font = `500 ${9 * scale}px "DM Mono", monospace`;
    context.fillText("OPEN PROJECT  ↗", cardX + 17 * scale, cardY + cardHeight - 19 * scale);
    registerHudRegion(action, cardX, cardY, cardWidth, cardHeight);

    if (mobile && project.note) {
      context.fillStyle = "#b5aeb9";
      context.font = `400 ${6 * scale}px "DM Sans", sans-serif`;
      context.fillText("Independent of Garena · claims unverified", cardX + 17 * scale, cardY + cardHeight + 8 * scale);
    }
  }

  const homeHud = createHudLayer(drawHomeHud, 20);
  const panelHud = createHudLayer(drawPanelHud, 21);
  panelHud.mesh.visible = false;

  function resizeHudLayers() {
    const portrait = window.innerWidth < 700;
    hudSizes.width = portrait
      ? Math.max(360, Math.round(900 * (window.innerWidth / window.innerHeight)))
      : 1600;
    hudSizes.height = 900;
    for (const layer of [homeHud, panelHud]) {
      layer.canvas.width = hudSizes.width;
      layer.canvas.height = hudSizes.height;
      layer.texture.needsUpdate = true;
    }
    if (panelOpen) {
      drawPanelHud(panelHud.canvas.getContext("2d"), hudSizes.width, hudSizes.height);
    } else {
      drawHomeHud(homeHud.canvas.getContext("2d"), hudSizes.width, hudSizes.height);
    }
    homeHud.texture.needsUpdate = true;
    panelHud.texture.needsUpdate = true;
    panelHud.mesh.visible = panelOpen;
    fitHudLayers();
  }

  resizeHudLayers();

  function createScreenTexture() {
    return createCanvasTexture((context, width, height) => {
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#111722");
      gradient.addColorStop(0.7, "#1b1725");
      gradient.addColorStop(1, "#322032");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      context.fillStyle = "#ef8eac";
      context.font = "500 19px monospace";
      context.fillText(portfolioData.eyebrow, 48, 56);

      context.fillStyle = "#f4efed";
      context.font = "600 58px Arial";
      context.fillText(portfolioData.name, 44, 166);

      context.fillStyle = "#bdb5c4";
      context.font = "24px Arial";
      context.fillText(portfolioData.shortRole, 49, 211);

      context.fillStyle = "#a9d3a0";
      context.font = "18px monospace";
      context.fillText("> learning by building", 50, 280);

      for (const [index, project] of portfolioData.projects.entries()) {
        const card = {
          x: 46 + index * 474,
          title: project.title.toUpperCase(),
          label: project.label,
          accent: project.accent,
        };
        context.fillStyle = "rgba(245,232,236,0.075)";
        context.fillRect(card.x, 340, 445, 197);
        context.strokeStyle = "rgba(239,223,227,0.22)";
        context.strokeRect(card.x, 340, 445, 197);
        context.fillStyle = card.accent;
        context.fillRect(card.x, 340, 445, 3);
        context.fillStyle = "#a9a1af";
        context.font = "15px monospace";
        context.fillText(card.label, card.x + 21, 377);
        context.fillStyle = "#f3ecee";
        context.font = "600 28px Arial";
        context.fillText(card.title, card.x + 21, 423);
        context.fillStyle = "#c5bdc5";
        context.font = "16px Arial";
        context.fillText("CLICK TO TAKE A LOOK  ↗", card.x + 21, 491);
      }

      context.fillStyle = "rgba(239,223,227,0.5)";
      context.font = "14px monospace";
      context.fillText("PORTFOLIO.EXE", width - 190, 610);
      context.fillStyle = "#ef8eac";
      context.fillRect(48, height - 38, 13, 17);
    });
  }

  function createPosterTexture() {
    return createCanvasTexture((context, width, height) => {
      context.fillStyle = "#242533";
      context.fillRect(0, 0, width, height);
      context.strokeStyle = "rgba(239,142,172,0.65)";
      context.strokeRect(18, 18, width - 36, height - 36);
      context.fillStyle = "#ef8eac";
      context.font = "20px monospace";
      context.fillText("THIS IS A WORK IN PROGRESS", 48, 72);
      context.fillStyle = "#f4eeeb";
      context.font = "500 57px Arial";
      context.fillText("stay", 46, 182);
      context.fillText("curious.", 46, 247);
      context.fillStyle = "#a9d3a0";
      context.font = "19px monospace";
      context.fillText("BUILD · LEARN · REPEAT", 50, 318);
      context.beginPath();
      context.arc(width - 85, height - 90, 42, 0, Math.PI * 2);
      context.fillStyle = "rgba(239,142,172,0.8)";
      context.fill();
      context.fillStyle = "#242533";
      context.font = "46px Arial";
      context.fillText("✳", width - 110, height - 75);
    }, 500, 400);
  }

  function createBookCover(title, stripeColor) {
    return createCanvasTexture((context, width, height) => {
      context.fillStyle = "#342d3b";
      context.fillRect(0, 0, width, height);
      context.fillStyle = stripeColor;
      context.fillRect(0, 0, 21, height);
      context.fillStyle = "#f4eaea";
      context.font = "600 55px Arial";
      context.fillText(title, 56, 170);
      context.fillStyle = "#c4b6c3";
      context.font = "24px monospace";
      context.fillText("IDEAS & EXPERIMENTS", 57, 220);
      context.fillStyle = "#b9d59e";
      context.font = "32px Georgia";
      context.fillText("S. R.", 57, 420);
    }, 320, 470);
  }

  function addWindowAndCity() {
    addBox(room, 0, 3.86, -5.76, 12.2, 7.7, 0.25, roomMaterials.wall);

    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 3.3),
      material("#242c43", 1, { emissive: "#161b2d", emissiveIntensity: 0.75 }),
    );
    sky.position.set(0, 4.32, -5.59);
    room.add(sky);

    const sunset = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 32),
      new THREE.MeshBasicMaterial({ color: "#e6a77e" }),
    );
    sunset.position.set(-1.9, 4.88, -5.55);
    room.add(sunset);

    const windowFrame = material("#675452", 0.58);
    addBox(room, 0, 5.99, -5.48, 7.54, 0.13, 0.18, windowFrame);
    addBox(room, 0, 2.65, -5.48, 7.54, 0.13, 0.18, windowFrame);
    addBox(room, -3.72, 4.32, -5.48, 0.13, 3.36, 0.18, windowFrame);
    addBox(room, 3.72, 4.32, -5.48, 0.13, 3.36, 0.18, windowFrame);
    addBox(room, 0, 4.32, -5.43, 0.085, 3.22, 0.21, windowFrame);
    addBox(room, 0, 3.92, -5.43, 7.35, 0.075, 0.21, windowFrame);

    for (let i = 0; i < 22; i += 1) {
      const x = -3.4 + i * 0.32;
      const y = 3.04 + ((i * 29) % 11) * 0.24;
      const width = 0.2 + ((i * 17) % 5) * 0.06;
      const height = Math.min(2.48, y - 2.72);
      addBox(
        room,
        x,
        2.68 + height / 2,
        -5.53,
        width,
        height,
        0.09,
        material(i % 4 === 0 ? "#424056" : i % 3 === 0 ? "#34364b" : "#2c3041"),
        { castShadow: false, receiveShadow: false },
      );

      const rows = Math.max(1, Math.floor(height / 0.34));
      for (let row = 0; row < rows; row += 1) {
        const lit = (i * 7 + row * 3) % 5 === 0 || (i + row * 2) % 7 === 0;
        if (!lit) continue;
        const light = new THREE.Mesh(
          new THREE.PlaneGeometry(0.045, 0.07),
          new THREE.MeshBasicMaterial({
            color: row % 2 === 0 ? "#f1c28c" : "#e6a5aa",
            transparent: true,
            opacity: 0.8,
          }),
        );
        light.position.set(x + ((i % 2) * 0.03), 2.95 + row * 0.31, -5.465);
        room.add(light);
      }
    }

    const stars = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ color: "#efe8e4", size: 0.026, sizeAttenuation: true }),
    );
    const starPositions = [];
    for (let i = 0; i < 65; i += 1) {
      starPositions.push(-3.4 + ((i * 31) % 680) / 100, 4.08 + ((i * 17) % 130) / 100, -5.51);
    }
    stars.geometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    room.add(stars);

    addBox(room, 0, 2.48, -5.34, 7.8, 0.14, 0.26, roomMaterials.woodLight);
    const curtain = material("#71505c");
    addBox(room, -4.03, 4.27, -5.31, 0.46, 3.62, 0.33, curtain);
    addBox(room, 4.03, 4.27, -5.31, 0.46, 3.62, 0.33, curtain);

    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(1.34, 1.66),
      new THREE.MeshBasicMaterial({ map: createPosterTexture() }),
    );
    poster.position.set(-4.55, 4.24, -5.59);
    poster.userData.panel = "about";
    poster.userData.label = "about me";
    interactiveMeshes.push(poster);
    room.add(poster);
    addBox(room, -4.55, 4.24, -5.67, 1.45, 1.77, 0.09, roomMaterials.frame, {
      panel: "about",
      label: "about me",
    });
  }

  function addFloorAndBed() {
    addBox(room, 0, -0.13, -0.85, 12.2, 0.26, 9.8, roomMaterials.floor);
    addBox(room, 0, 0.025, -0.85, 12.1, 0.035, 9.7, roomMaterials.floorAlternate, {
      castShadow: false,
    });

    for (let x = -5.5; x < 5.5; x += 1.2) {
      addBox(room, x, 0.047, -0.45, 0.018, 0.008, 10.3, roomMaterials.woodEdge, {
        castShadow: false,
        receiveShadow: false,
      });
    }

    addBox(room, -4.25, 0.42, 0.05, 2.6, 0.68, 4.5, roomMaterials.fabric);
    addBox(room, -4.25, 0.97, -0.5, 2.52, 0.45, 3.05, roomMaterials.pillow);
    addBox(room, -4.25, 1.08, -1.55, 2.33, 0.19, 1.1, material("#d2bdb4"));
    addBox(room, -4.25, 0.79, 1.65, 2.9, 0.11, 0.16, roomMaterials.wood);

    for (const x of [-5.28, -3.22]) {
      for (const z of [-1.67, 1.83]) {
        addBox(room, x, 0.12, z, 0.13, 0.24, 0.13, roomMaterials.woodEdge);
      }
    }
  }

  function addDeskAndComputer() {
    addBox(room, 0, 1.48, -1.67, 6.4, 0.19, 2.18, roomMaterials.woodLight);
    addBox(room, 0, 1.585, -1.67, 6.46, 0.045, 2.2, roomMaterials.wood);

    for (const x of [-2.72, 2.72]) {
      for (const z of [-2.45, -0.89]) {
        addBox(room, x, 0.76, z, 0.15, 1.44, 0.15, roomMaterials.metal);
      }
      addBox(room, x, 0.18, -1.67, 0.62, 0.09, 1.92, roomMaterials.woodEdge);
    }
    addBox(room, 0, 0.96, -0.94, 5.3, 0.09, 0.16, roomMaterials.woodEdge);

    addBox(room, 0.16, 1.78, -2.26, 1.55, 0.3, 1.38, roomMaterials.darkMetal);
    addBox(room, 0.16, 1.96, -2.23, 1.56, 0.07, 1.34, roomMaterials.metal);

    const monitor = new THREE.Group();
    room.add(monitor);
    addBox(monitor, 0, 2.82, -3.02, 3.28, 1.95, 0.19, roomMaterials.frame);

    const screenTexture = createScreenTexture();
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(3.1, 1.77),
      new THREE.MeshBasicMaterial({ map: screenTexture }),
    );
    screen.position.set(0, 2.84, -2.91);
    monitor.add(screen);
    addBox(monitor, 0, 1.82, -3.005, 0.14, 0.16, 0.16, roomMaterials.metal);
    addBox(monitor, 0, 1.735, -2.985, 0.86, 0.085, 0.5, roomMaterials.darkMetal);
    addBox(monitor, 0, 2.82, -2.895, 3.14, 1.82, 0.08, material("#ffffff", 1, {
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }), { panel: "work", label: "projects" });

    addBox(room, -0.34, 1.61, -0.95, 2.75, 0.025, 0.46, roomMaterials.fabric, {
      castShadow: false,
    });

    for (let i = 0; i < 34; i += 1) {
      addBox(
        room,
        -1.58 + i * 0.076,
        1.628,
        -0.97,
        0.025,
        0.008,
        0.28,
        material(i % 4 === 0 ? "#e58faa" : "#aaa7b0", 0.9),
        { castShadow: false },
      );
    }

    const notebook = addBox(
      room,
      -2.12,
      1.67,
      -1.93,
      0.95,
      0.065,
      1.13,
      roomMaterials.paper,
      { panel: "about", label: "about me" },
    );
    notebook.rotation.y = 0.12;

    for (let i = 0; i < 5; i += 1) {
      addBox(
        room,
        -2.12,
        1.707,
        -2.34 + i * 0.14,
        0.58,
        0.007,
        0.014,
        material("#958575"),
        { castShadow: false },
      ).rotation.y = 0.12;
    }
  }

  function addChair() {
    const chair = new THREE.Group();
    chair.position.set(0.32, 0, 1.02);
    room.add(chair);

    addBox(chair, 0, 0.86, 0, 1.17, 0.21, 1.05, roomMaterials.fabric);
    addBox(chair, 0, 1.52, 0.45, 1.1, 1.15, 0.19, roomMaterials.fabric);
    addBox(chair, 0, 1.53, 0.348, 0.89, 0.89, 0.05, roomMaterials.pillow);
    addBox(chair, -0.69, 1.05, 0, 0.12, 0.15, 0.77, roomMaterials.metal);
    addBox(chair, 0.69, 1.05, 0, 0.12, 0.15, 0.77, roomMaterials.metal);
    addBox(chair, 0, 0.43, 0, 0.13, 0.73, 0.13, roomMaterials.metal);
    addBox(chair, 0, 0.075, 0, 0.86, 0.09, 0.13, roomMaterials.metal);

    for (const x of [-0.38, 0.38]) {
      const leg = addBox(chair, x, 0.065, 0.19, 0.12, 0.07, 0.78, roomMaterials.metal);
      leg.rotation.y = x < 0 ? -0.42 : 0.42;
    }
  }

  function addPlant(x, z, scale = 1, height = 1.61) {
    const plant = new THREE.Group();
    plant.position.set(x, height, z);
    plant.scale.setScalar(scale);
    room.add(plant);

    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.14, 0.36, 10),
      material("#b77661"),
    );
    pot.position.y = 0.18;
    pot.castShadow = true;
    plant.add(pot);

    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.025, 10),
      material("#493b36"),
    );
    soil.position.y = 0.37;
    plant.add(soil);

    const stemMaterial = material("#687d63");
    for (let i = 0; i < 5; i += 1) {
      const height = 0.5 + (i % 3) * 0.13;
      const stem = addBox(
        plant,
        Math.cos(i * 1.26) * 0.09,
        0.58 + height / 2,
        Math.sin(i * 1.26) * 0.08,
        0.025,
        height,
        0.025,
        stemMaterial,
        { castShadow: false },
      );
      stem.rotation.z = Math.cos(i * 1.26) * 0.28;
      const leaf = addSphere(
        plant,
        Math.cos(i * 1.26) * 0.23,
        0.81 + height * 0.42,
        Math.sin(i * 1.26) * 0.12,
        0.13,
        roomMaterials.leaves,
        0.48,
      );
      leaf.rotation.z = Math.cos(i * 1.26) * 0.45;
    }
  }

  function addDeskLamp() {
    const lamp = new THREE.Group();
    lamp.position.set(-2.67, 1.61, -2.3);
    room.add(lamp);

    const gold = material("#b08a62", 0.4, { metalness: 0.62 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.075, 20), gold);
    base.position.y = 0.07;
    base.castShadow = true;
    lamp.add(base);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.85, 10), gold);
    stem.position.set(0, 0.49, 0);
    stem.rotation.z = -0.12;
    lamp.add(stem);

    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.36, 0.39, 18, 1, true),
      material("#ba9674", 0.6, { side: THREE.DoubleSide }),
    );
    shade.position.set(-0.09, 0.95, 0.03);
    shade.rotation.z = Math.PI;
    lamp.add(shade);
    addSphere(
      lamp,
      -0.09,
      0.75,
      0.03,
      0.11,
      new THREE.MeshStandardMaterial({
        color: "#ffd19a",
        emissive: "#ffac5c",
        emissiveIntensity: 2,
      }),
    );

    const bulb = new THREE.PointLight("#ffca8c", 12, 5, 1.7);
    bulb.position.set(-0.16, 0.8, 0.08);
    bulb.castShadow = true;
    lamp.add(bulb);

    addBox(lamp, 0, 0.1, 0, 0.65, 0.09, 0.65, roomMaterials.metal, {
      panel: "contact",
      label: "contact",
    });
  }

  function addBooksAndShelves() {
    addBox(room, -5.64, 2.68, -1.25, 0.34, 0.1, 2.75, roomMaterials.woodLight);
    addBox(room, -5.64, 4.14, -1.25, 0.34, 0.1, 2.75, roomMaterials.woodLight);
    addBox(room, -5.72, 3.51, -1.3, 0.28, 1.72, 0.14, roomMaterials.woodEdge);
    addBox(room, -5.72, 4.86, -1.3, 0.28, 1.42, 0.14, roomMaterials.woodEdge);

    const covers = [
      ["WEB", "#cb858d"],
      ["JS", "#c5aa71"],
      ["CSS", "#718daf"],
      ["IDEAS", "#a683b0"],
    ];

    covers.forEach(([title, color], index) => {
      const cover = material("#453548", 0.94, {
        map: createBookCover(title, color),
      });
      const book = addBox(
        room,
        -5.37,
        3.03,
        -2.16 + index * 0.43,
        0.52,
        0.72 + (index % 2) * 0.08,
        0.37,
        cover,
      );
      book.rotation.z = (index % 2 === 0 ? -1 : 1) * 0.035;
    });

    for (let i = 0; i < 3; i += 1) {
      const book = addBox(
        room,
        -5.35,
        4.22 + i * 0.06,
        -1.9 + i * 0.39,
        0.49,
        0.12,
        0.33,
        material(["#72778d", "#a47274", "#8a9c79"][i]),
      );
      book.rotation.x = -0.04;
    }
  }

  function drawCurrentHud() {
    const layer = panelOpen ? panelHud : homeHud;
    const draw = panelOpen ? drawPanelHud : drawHomeHud;
    draw(layer.canvas.getContext("2d"), hudSizes.width, hudSizes.height);
    layer.texture.needsUpdate = true;
  }

  function startTerminal() {
    if (terminalTimer !== null) window.clearInterval(terminalTimer);
    terminalText = "";
    const transcript = [
      `~ sagar@desk $ whoami\n${portfolioData.name} — ${portfolioData.shortRole}`,
      `\n\n~ sagar@desk $ projects --list\n${portfolioData.projects.map((project) => `• ${project.title}`).join("\n")}`,
      "\n\n~ sagar@desk $",
    ].join("");
    let position = 0;
    terminalTimer = window.setInterval(() => {
      position = Math.min(position + 3, transcript.length);
      terminalText = transcript.slice(0, position);
      drawCurrentHud();
      if (position === transcript.length) {
        window.clearInterval(terminalTimer);
        terminalTimer = null;
      }
    }, 24);
  }

  function openPanel(name, notify = true) {
    const panelTitles = {
      work: "A few things I've made.",
      experience: "What I'm learning now.",
      about: portfolioData.about.title,
      contact: "My inbox is open.",
      music: "A little listening corner.",
      terminal: "The portfolio console.",
    };
    const title = panelTitles[name];
    if (!title) return;
    if (panelOpen && appPanel === name) return;

    if (!panelOpen) previousFocus = document.activeElement;
    appPanel = name;
    panelOpen = true;
    panelHud.mesh.visible = true;
    drawCurrentHud();
    onStatusChange(`${title} Use the 3D panel, or press Escape to close.`);
    if (notify) onPanelChange(name);
    if (name === "terminal") startTerminal();
    else if (terminalTimer !== null) {
      window.clearInterval(terminalTimer);
      terminalTimer = null;
    }
  }

  function closePanel(notify = true) {
    if (!panelOpen) return;
    panelOpen = false;
    panelHud.mesh.visible = false;
    homeHud.mesh.visible = true;
    if (terminalTimer !== null) {
      window.clearInterval(terminalTimer);
      terminalTimer = null;
    }
    drawCurrentHud();
    onStatusChange("Portfolio panel closed. Drag the 3D room to look around.");
    if (notify) onPanelChange(null);
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }

  function openProject(index) {
    const project = portfolioData.projects[index];
    if (project?.url) window.open(project.url, "_blank", "noopener,noreferrer");
  }

  function handleHudAction(action) {
    if (action === "close" || action === "dismiss") {
      closePanel();
    } else if (["work", "experience", "about", "contact", "music", "terminal"].includes(action)) {
      openPanel(action);
    } else if (action.startsWith("project-")) {
      openProject(Number(action.slice("project-".length)));
    } else if (action.startsWith("contact-")) {
      const field = action.slice("contact-".length);
      if (["name", "email", "message"].includes(field)) onContactFieldFocus(field);
      else if (field === "submit") onContactSubmit();
    } else if (action === "email") {
      window.location.href = `mailto:${portfolioData.contact.email}`;
    } else if (action === "spotify") {
      if (!portfolioData.music.spotifyUrl) {
        onStatusChange("Add a public Spotify URL to music.spotifyUrl in src/data/portfolioData.js.");
      } else {
        let spotifyUrl;
        try {
          spotifyUrl = new URL(portfolioData.music.spotifyUrl);
        } catch {
          onStatusChange("The Spotify link must be a valid public open.spotify.com URL.");
          return;
        }
        if (spotifyUrl.protocol !== "https:" || spotifyUrl.hostname !== "open.spotify.com") {
          onStatusChange("The Spotify link must be a public open.spotify.com URL.");
        } else {
          window.open(spotifyUrl.href, "_blank", "noopener,noreferrer");
        }
      }
    } else if (action === "reset") {
      controls.reset();
      setCameraForScreen();
      onStatusChange("Room view reset.");
    } else if (action === "sound") {
      void toggleAmbientSound();
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") closePanel();
    if (event.key === "Home") {
      closePanel();
      controls.reset();
      setCameraForScreen();
    }
  }

  document.addEventListener("keydown", handleKeyDown);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointerStart = new THREE.Vector2();
  let pointerDown = false;

  function findInteractiveObject(event) {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(interactiveMeshes, false)[0]?.object ?? null;
  }

  const handlePointerDown = (event) => {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    pointerStart.set(event.clientX, event.clientY);
    pointerDown = true;
  };

  const handlePointerUp = (event) => {
    if (!pointerDown) return;
    pointerDown = false;
    const distance = Math.hypot(
      event.clientX - pointerStart.x,
      event.clientY - pointerStart.y,
    );
    if (distance > 9) return;

    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * hudSizes.width;
    const y = (event.clientY - bounds.top) / bounds.height * hudSizes.height;
    const region = [...hudRegions].reverse().find(
      (candidate) =>
        x >= candidate.x &&
        x <= candidate.x + candidate.width &&
        y >= candidate.y &&
        y <= candidate.y + candidate.height,
    );
    if (region) {
      handleHudAction(region.action);
      return;
    }
    if (panelOpen) {
      handleHudAction("dismiss");
      return;
    }

    const hit = findInteractiveObject(event);
    if (hit?.userData.panel) openPanel(hit.userData.panel);
  };

  const handlePointerMove = (event) => {
    if (pointerDown) return;
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * hudSizes.width;
    const y = (event.clientY - bounds.top) / bounds.height * hudSizes.height;
    const uiHit = hudRegions.some(
      (region) =>
        x >= region.x &&
        x <= region.x + region.width &&
        y >= region.y &&
        y <= region.y + region.height,
    );
    const objectHit = !panelOpen && findInteractiveObject(event);
    canvas.style.cursor = uiHit || objectHit ? "pointer" : "grab";
  };

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointermove", handlePointerMove);

  let audioContext = null;
  let ambienceGain = null;
  let ambience = [];
  async function toggleAmbientSound() {
    if (!audioContext) {
      const AudioContextConstructor =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) {
        onStatusChange("Ambient sound is not available in this browser.");
        return;
      }
      audioContext = new AudioContextConstructor();
      ambienceGain = audioContext.createGain();
      ambienceGain.gain.value = 0;
      ambienceGain.connect(audioContext.destination);

      ambience = [110, 164.81].map((frequency) => {
        const oscillator = audioContext.createOscillator();
        const volume = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        volume.gain.value = frequency === 110 ? 0.032 : 0.018;
        oscillator.connect(volume);
        volume.connect(ambienceGain);
        oscillator.start();
        return oscillator;
      });
    }

    if (audioContext.state === "suspended") await audioContext.resume();
    soundIsOn = !soundIsOn;
    ambienceGain.gain.cancelScheduledValues(audioContext.currentTime);
    ambienceGain.gain.setTargetAtTime(soundIsOn ? 0.28 : 0, audioContext.currentTime, 0.4);
    onStatusChange(`Ambient sound ${soundIsOn ? "on" : "off"}.`);
    drawCurrentHud();
  }

  scene.add(new THREE.HemisphereLight("#a6b6db", "#47333b", 2.15));

  const moonlight = new THREE.DirectionalLight("#abc0ed", 2.5);
  moonlight.position.set(-3.5, 8, 3);
  moonlight.castShadow = true;
  moonlight.shadow.mapSize.set(1024, 1024);
  moonlight.shadow.camera.left = -9;
  moonlight.shadow.camera.right = 9;
  moonlight.shadow.camera.top = 10;
  moonlight.shadow.camera.bottom = -5;
  moonlight.shadow.bias = -0.001;
  scene.add(moonlight);

  const sunsetLight = new THREE.PointLight("#edac89", 16, 12, 2);
  sunsetLight.position.set(-1.8, 4.8, -4.65);
  scene.add(sunsetLight);

  const screenGlow = new THREE.PointLight("#c19bc6", 8, 5.5, 2);
  screenGlow.position.set(0.2, 2.85, -2.25);
  scene.add(screenGlow);

  addWindowAndCity();
  addFloorAndBed();
  addDeskAndComputer();
  addChair();
  addPlant(2.63, -0.93, 0.92);
  addPlant(-5.28, -0.95, 1.1, 0.05);
  addDeskLamp();
  addBooksAndShelves();

  setCameraForScreen();
  controls.saveState();
  window.addEventListener("resize", setCameraForScreen);
  controls.update();

  const timer = new THREE.Timer();
  timer.connect(document);
  function render() {
    timer.update();
    const elapsed = timer.getElapsed();
    controls.update();
    sunsetLight.intensity = 15.6 + Math.sin(elapsed * 0.4) * 0.35;
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(render);

  function resetView() {
    controls.reset();
    setCameraForScreen();
    onStatusChange("Room view reset.");
  }

  function setPanel(name) {
    if (name) openPanel(name, false);
    else closePanel(false);
  }

  function setContactValues(values) {
    contactValues = values;
    if (panelOpen && appPanel === "contact") drawCurrentHud();
  }

  function dispose() {
    renderer.setAnimationLoop(null);
    timer.dispose();
    controls.dispose();
    window.removeEventListener("resize", setCameraForScreen);
    document.removeEventListener("keydown", handleKeyDown);
    canvas.removeEventListener("pointerdown", handlePointerDown);
    canvas.removeEventListener("pointerup", handlePointerUp);
    canvas.removeEventListener("pointermove", handlePointerMove);
    if (terminalTimer !== null) window.clearInterval(terminalTimer);
    ambience.forEach((oscillator) => oscillator.stop());
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close();
    }
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      for (const objectMaterial of objectMaterials) {
        if (!objectMaterial) continue;
        materials.add(objectMaterial);
        if (objectMaterial.map) textures.add(objectMaterial.map);
      }
    });
    textures.forEach((texture) => texture.dispose());
    materials.forEach((objectMaterial) => objectMaterial.dispose());
    geometries.forEach((geometry) => geometry.dispose());
    renderer.dispose();
  }

  return {
    dispose,
    setPanel,
    setContactValues,
    resetView,
    toggleAmbientSound,
  };
}
