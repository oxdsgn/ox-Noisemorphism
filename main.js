// 마우스/터치 흔적을 처리하는 클래스
class TouchTexture {
  constructor() {
    this.size = 64;
    this.width = this.height = this.size;
    this.maxAge = 64;
    this.radius = 0.15 * this.size;
    this.speed = 1 / this.maxAge;
    this.trail = [];
    this.last = null;
    this.initTexture();
  }

  initTexture() {
    // 마우스 흔적을 저장할 캔버스 생성
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // Three.js 텍스처로 변환
    this.texture = new THREE.Texture(this.canvas);
  }

  update() {
    this.clear();
    let speed = this.speed;
    // 마우스 자취 포인트를 시간에 따라 업데이트
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const point = this.trail[i];
      let f = point.force * speed * (1 - point.age / this.maxAge);
      point.x += point.vx * f;
      point.y += point.vy * f;
      point.age++;
      if (point.age > this.maxAge) {
        this.trail.splice(i, 1);
      } else {
        this.drawPoint(point);
      }
    }
    this.texture.needsUpdate = true;
  }

  clear() {
    // 매 프레임마다 캔버스 초기화
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  addTouch(point) {
    let force = 0;
    let vx = 0;
    let vy = 0;
    const last = this.last;
    if (last) {
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (dx === 0 && dy === 0) return;
      const dd = dx * dx + dy * dy;
      let d = Math.sqrt(dd);
      vx = dx / d;
      vy = dy / d;
      // 마우스 움직임의 강도 계산
      force = Math.min(dd * 18000, 2.0);
    }
    this.last = { x: point.x, y: point.y };
    // 새로운 포인트를 trail에 추가
    this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
  }

  drawPoint(point) {
    const pos = {
      x: point.x * this.width,
      y: (1 - point.y) * this.height,
    };

    // 시간에 따른 intensity 계산 (부드러운 페이드)
    let intensity = 1;
    if (point.age < this.maxAge * 0.3) {
      intensity = Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2));
    } else {
      const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
      intensity = -t * (t - 2);
    }
    intensity *= point.force;

    const radius = this.radius;
    const c = intensity * 255;
    let color = `${c}, ${c}, ${c}`;
    // 그림자 효과로 부드러운 glow 표현
    let offset = this.size * 5;
    this.ctx.shadowOffsetX = offset;
    this.ctx.shadowOffsetY = offset;
    this.ctx.shadowBlur = radius * 1;
    this.ctx.shadowColor = `rgba(${color},${0.4 * intensity})`;

    this.ctx.beginPath();
    this.ctx.fillStyle = "rgba(255,255,255,1)";
    this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

// 메인 그라디언트 배경 그래픽
class GradientBackground {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.mesh = null;
    this.uniforms = {
      uTime: { value: 0 },
      uResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      // 웜톤 색상 팔레트
      uColor1: { value: new THREE.Vector3(1.0, 0.5, 0.2) },
      uColor2: { value: new THREE.Vector3(1.0, 0.3, 0.4) },
      // 보라/마젠타 톤
      uColor3: { value: new THREE.Vector3(0.8, 0.3, 0.8) },
      uColor4: { value: new THREE.Vector3(0.9, 0.2, 0.6) },
      // 시안/블루 톤
      uColor5: { value: new THREE.Vector3(0.2, 0.9, 0.9) },
      uColor6: { value: new THREE.Vector3(0.3, 0.7, 1.0) },
      uSpeed: { value: 1.0 },
      uIntensity: { value: 1.1 },
      uTouchTexture: { value: null },
      uGrainIntensity: { value: 0.12 },
      uZoom: { value: 1.0 },
      // 어두운 베이스 컬러
      uDarkNavy: {
        value: new THREE.Vector3(0.08, 0.08, 0.15),
      },
      uGradientSize: { value: 0.55 },
      uGradientCount: { value: 10.0 },
      uColor1Weight: { value: 1.2 },
      uColor2Weight: { value: 1.3 },
    };
  }

  init() {
    const viewSize = this.sceneManager.getViewSize();
    // 전체 화면을 덮는 평면 생성
    const geometry = new THREE.PlaneGeometry(
      viewSize.width,
      viewSize.height,
      1,
      1
    );

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vec3 pos = position.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
          vUv = uv;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        uniform vec3 uColor4;
        uniform vec3 uColor5;
        uniform vec3 uColor6;
        uniform float uSpeed;
        uniform float uIntensity;
        uniform sampler2D uTouchTexture;
        uniform float uGrainIntensity;
        uniform float uZoom;
        uniform vec3 uDarkNavy;
        uniform float uGradientSize;
        uniform float uGradientCount;
        uniform float uColor1Weight;
        uniform float uColor2Weight;

        varying vec2 vUv;

        #define PI 3.14159265359

        // 필름 그레인 효과 생성
        float grain(vec2 uv, float time) {
          vec2 grainUv = uv * uResolution * 0.25;
          float grainValue = fract(sin(dot(grainUv + time, vec2(12.9898, 78.233))) * 43758.5453);
          return grainValue * 2.0 - 1.0;
        }

        vec3 getGradientColor(vec2 uv, float time) {
          float gradientRadius = uGradientSize;

          // 여러 개의 움직이는 그라디언트 중심 정의
          vec2 center1 = vec2(
            0.5 + sin(time * uSpeed * 0.3) * 0.5,
            0.5 + cos(time * uSpeed * 0.4) * 0.5
          );
          vec2 center2 = vec2(
            0.5 + cos(time * uSpeed * 0.5) * 0.6,
            0.5 + sin(time * uSpeed * 0.35) * 0.6
          );
          vec2 center3 = vec2(
            0.5 + sin(time * uSpeed * 0.25) * 0.4,
            0.5 + cos(time * uSpeed * 0.6) * 0.5
          );
          vec2 center4 = vec2(
            0.5 + cos(time * uSpeed * 0.45) * 0.45,
            0.5 + sin(time * uSpeed * 0.3) * 0.45
          );
          vec2 center5 = vec2(
            0.5 + sin(time * uSpeed * 0.55) * 0.5,
            0.5 + cos(time * uSpeed * 0.5) * 0.4
          );
          vec2 center6 = vec2(
            0.5 + cos(time * uSpeed * 0.4) * 0.55,
            0.5 + sin(time * uSpeed * 0.6) * 0.55
          );

          vec2 center7 = vec2(
            0.5 + sin(time * uSpeed * 0.38) * 0.35,
            0.5 + cos(time * uSpeed * 0.52) * 0.48
          );
          vec2 center8 = vec2(
            0.5 + cos(time * uSpeed * 0.58) * 0.42,
            0.5 + sin(time * uSpeed * 0.48) * 0.38
          );
          vec2 center9 = vec2(
            0.5 + sin(time * uSpeed * 0.42) * 0.5,
            0.5 + cos(time * uSpeed * 0.58) * 0.35
          );
          vec2 center10 = vec2(
            0.5 + cos(time * uSpeed * 0.48) * 0.38,
            0.5 + sin(time * uSpeed * 0.65) * 0.5
          );

          float dist1 = length(uv - center1);
          float dist2 = length(uv - center2);
          float dist3 = length(uv - center3);
          float dist4 = length(uv - center4);
          float dist5 = length(uv - center5);
          float dist6 = length(uv - center6);
          float dist7 = length(uv - center7);
          float dist8 = length(uv - center8);
          float dist9 = length(uv - center9);
          float dist10 = length(uv - center10);

          // 각 중심으로부터의 영향도 계산
          float influence1 = 1.0 - smoothstep(0.0, gradientRadius, dist1);
          float influence2 = 1.0 - smoothstep(0.0, gradientRadius, dist2);
          float influence3 = 1.0 - smoothstep(0.0, gradientRadius, dist3);
          float influence4 = 1.0 - smoothstep(0.0, gradientRadius, dist4);
          float influence5 = 1.0 - smoothstep(0.0, gradientRadius, dist5);
          float influence6 = 1.0 - smoothstep(0.0, gradientRadius, dist6);
          float influence7 = 1.0 - smoothstep(0.0, gradientRadius, dist7);
          float influence8 = 1.0 - smoothstep(0.0, gradientRadius, dist8);
          float influence9 = 1.0 - smoothstep(0.0, gradientRadius, dist9);
          float influence10 = 1.0 - smoothstep(0.0, gradientRadius, dist10);

          // 회전 레이어로 깊이감 추가
          vec2 rotatedUv1 = uv - 0.5;
          float angle1 = time * uSpeed * 0.15;
          rotatedUv1 = vec2(
            rotatedUv1.x * cos(angle1) - rotatedUv1.y * sin(angle1),
            rotatedUv1.x * sin(angle1) + rotatedUv1.y * cos(angle1)
          );
          rotatedUv1 += 0.5;

          vec2 rotatedUv2 = uv - 0.5;
          float angle2 = -time * uSpeed * 0.1;
          rotatedUv2 = vec2(
            rotatedUv2.x * cos(angle2) - rotatedUv2.y * sin(angle2),
            rotatedUv2.x * sin(angle2) + rotatedUv2.y * cos(angle2)
          );
          rotatedUv2 += 0.5;

          float radialGradient1 = length(rotatedUv1 - 0.5);
          float radialGradient2 = length(rotatedUv2 - 0.5);
          float radialInfluence1 = 1.0 - smoothstep(0.0, 0.8, radialGradient1);
          float radialInfluence2 = 1.0 - smoothstep(0.0, 0.8, radialGradient2);

          // 색상을 동적으로 블렌딩
          vec3 color = vec3(0.0);
          color += uColor1 * influence1 * (0.5 + 0.5 * sin(time * uSpeed)) * uColor1Weight;
          color += uColor2 * influence2 * (0.5 + 0.5 * cos(time * uSpeed * 1.2)) * uColor2Weight;
          color += uColor3 * influence3 * (0.5 + 0.5 * sin(time * uSpeed * 0.8));
          color += uColor4 * influence4 * (0.5 + 0.5 * cos(time * uSpeed * 1.1));
          color += uColor5 * influence5 * (0.5 + 0.5 * sin(time * uSpeed * 0.9));
          color += uColor6 * influence6 * (0.5 + 0.5 * cos(time * uSpeed * 1.3));
          color += uColor1 * influence7 * (0.5 + 0.5 * sin(time * uSpeed * 1.1)) * 0.8;
          color += uColor2 * influence8 * (0.5 + 0.5 * cos(time * uSpeed * 0.95)) * 0.7;
          color += uColor3 * influence9 * (0.5 + 0.5 * sin(time * uSpeed * 1.2)) * 0.8;
          color += uColor4 * influence10 * (0.5 + 0.5 * cos(time * uSpeed * 1.4)) * 0.7;

          color += mix(uColor1, uColor3, radialInfluence1) * 0.4;
          color += mix(uColor2, uColor5, radialInfluence2) * 0.4;

          color = color * uIntensity;
          color = clamp(color, vec3(0.0), vec3(1.0));

          return color;
        }

        void main() {
          vec2 uv = vUv;

          // 터치 텍스처에서 왜곡 정보 추출
          vec4 touchTex = texture2D(uTouchTexture, uv);
          float vx = -(touchTex.r * 2.0 - 1.0);
          float vy = -(touchTex.g * 2.0 - 1.0);
          float intensity = touchTex.b;
          
          // 마우스 움직임에 따른 왜곡 적용
          uv.x += vx * 0.65 * intensity;
          uv.y += vy * 0.65 * intensity;

          // 물결 효과 추가
          vec2 center = vec2(0.5);
          float dist = length(uv - center);
          float ripple = sin(dist * 16.0 - uTime * 2.3) * 0.035 * intensity;
          float wave = sin(dist * 12.0 - uTime * 1.8) * 0.028 * intensity;
          uv += vec2(ripple + wave);

          // 그라디언트 색 계산
          vec3 color = getGradientColor(uv, uTime);

          // 필름 그레인 노이즈 추가
          float grainValue = grain(uv, uTime);
          color += grainValue * uGrainIntensity;

          // 색상 포화도 강화
          float brightness = length(color) / sqrt(3.0);
          color = normalize(color + vec3(brightness * 0.08)) * brightness;

          color = clamp(color, vec3(0.0), vec3(1.0));

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.z = 0;
    this.sceneManager.scene.add(this.mesh);
  }

  update(delta) {
    if (this.uniforms.uTime) {
      // 매 프레임 시간 업데이트
      this.uniforms.uTime.value += delta;
    }
  }

  onResize(width, height) {
    const viewSize = this.sceneManager.getViewSize();
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.PlaneGeometry(
        viewSize.width,
        viewSize.height,
        1,
        1
      );
    }
    if (this.uniforms.uResolution) {
      // 화면 해상도 업데이트
      this.uniforms.uResolution.value.set(width, height);
    }
  }
}

class App {
  constructor() {
    // Three.js 렌더러 초기화
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
      depth: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setAnimationLoop(null);
    document.body.appendChild(this.renderer.domElement);
    this.renderer.domElement.id = "webGLApp";

    // 카메라 설정
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );
    this.camera.position.z = 50;
    
    // 씬 설정
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a15);
    this.clock = new THREE.Clock();

    // 배경과 터치 텍스처 초기화
    this.touchTexture = new TouchTexture();
    this.gradientBackground = new GradientBackground(this);
    this.gradientBackground.uniforms.uTouchTexture.value =
      this.touchTexture.texture;

    this.init();
  }

  init() {
    // 백그라운드 초기화
    this.gradientBackground.init();

    // 첫 렌더
    this.render();

    // 애니메이션 루프 시작
    this.tick();

    // 이벤트 리스너 등록
    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("mousemove", (ev) => this.onMouseMove(ev));
    window.addEventListener("touchmove", (ev) => this.onTouchMove(ev));

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.render();
      }
    });

    // 탭 비활성 상태에서 돌아왔을 때 렌더 깨우기
    const wakeUpAnimation = () => {
      this.render();
      window.removeEventListener("click", wakeUpAnimation);
      window.removeEventListener("touchstart", wakeUpAnimation);
      window.removeEventListener("mousemove", wakeUpAnimation);
    };
    window.addEventListener("click", wakeUpAnimation, { once: true });
    window.addEventListener("touchstart", wakeUpAnimation, { once: true });
    window.addEventListener("mousemove", wakeUpAnimation, { once: true });
  }

  onTouchMove(ev) {
    // 터치 이벤트를 마우스 이벤트로 변환
    const touch = ev.touches[0];
    this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  }

  onMouseMove(ev) {
    // 마우스 위치를 정규화 (0~1 범위)
    this.mouse = {
      x: ev.clientX / window.innerWidth,
      y: 1 - ev.clientY / window.innerHeight,
    };
    this.touchTexture.addTouch(this.mouse);
  }

  getViewSize() {
    // 카메라에 따른 실제 렌더링 영역 크기 계산
    const fovInRadians = (this.camera.fov * Math.PI) / 180;
    const height = Math.abs(
      this.camera.position.z * Math.tan(fovInRadians / 2) * 2
    );
    return { width: height * this.camera.aspect, height };
  }

  update(delta) {
    // 각 프레임마다 상태 업데이트
    this.touchTexture.update();
    this.gradientBackground.update(delta);
  }

  render() {
    const delta = this.clock.getDelta();
    const clampedDelta = Math.min(delta, 0.1);
    this.renderer.render(this.scene, this.camera);
    this.update(clampedDelta);
  }

  tick() {
    // requestAnimationFrame으로 루프 구성
    this.render();
    requestAnimationFrame(() => this.tick());
  }

  onResize() {
    // 화면 크기 변경 시 처리
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.gradientBackground.onResize(window.innerWidth, window.innerHeight);
  }
}

// 앱 인스턴스 생성 및 시작
const app = new App();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    app.render();
  });
} else {
  setTimeout(() => app.render(), 0);
}

// 색상 조정 패널 관련 UI 이벤트
const colorAdjusterPanel = document.getElementById("colorAdjusterPanel");
const toggleAdjusterBtn = document.getElementById("toggleAdjusterBtn");
const closeAdjusterBtn = document.getElementById("closeAdjusterBtn");

// 색상 조정 패널 열기/닫기
toggleAdjusterBtn.addEventListener("click", () => {
  colorAdjusterPanel.classList.toggle("open");
  if (colorAdjusterPanel.classList.contains("open")) {
    updateColorPickersFromScheme();
    toggleAdjusterBtn.style.display = "none";
  } else {
    toggleAdjusterBtn.style.display = "block";
  }
});

closeAdjusterBtn.addEventListener("click", () => {
  colorAdjusterPanel.classList.remove("open");
  toggleAdjusterBtn.style.display = "block";
});

// RGB 값을 16진수 색상코드로 변환
function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

// 16진수 색상코드를 RGB 값으로 변환
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : null;
}

// 현재 설정된 색상으로 색상 피커 업데이트
function updateColorPickersFromScheme() {
  const uniforms = app.gradientBackground.uniforms;
  const colors = [
    uniforms.uColor1.value,
    uniforms.uColor2.value,
    uniforms.uColor3.value,
    uniforms.uColor4.value,
    uniforms.uColor5.value,
    uniforms.uColor6.value,
  ];

  colors.forEach((color, index) => {
    const picker = document.getElementById(`colorPicker${index + 1}`);
    const display = document.getElementById(`colorValue${index + 1}`);
    const hex = rgbToHex(color.x, color.y, color.z);
    picker.value = hex;
    display.value = hex.toUpperCase();
  });
}

// 색상 피커 입력 이벤트 처리
for (let i = 1; i <= 6; i++) {
  const picker = document.getElementById(`colorPicker${i}`);
  const display = document.getElementById(`colorValue${i}`);

  picker.addEventListener("input", (e) => {
    const hex = e.target.value;
    const rgb = hexToRgb(hex);

    if (rgb) {
      const uniforms = app.gradientBackground.uniforms;
      const colorUniform = uniforms[`uColor${i}`];

      if (colorUniform) {
        // 셰이더의 색상 값 업데이트
        colorUniform.value.set(rgb.r, rgb.g, rgb.b);
        display.value = hex.toUpperCase();
      }
    }
  });
}

// 색상 복사 버튼
document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const colorIndex = e.target.dataset.copy;
    const display = document.getElementById(`colorValue${colorIndex}`);
    const text = display.value;

    // 클립보드에 복사
    navigator.clipboard.writeText(text).then(() => {
      e.target.textContent = "Copied!";
      e.target.classList.add("copied");
      setTimeout(() => {
        e.target.textContent = "Copy";
        e.target.classList.remove("copied");
      }, 2000);
    });
  });
});

// 전체 색상 내보내기
const exportAllBtn = document.getElementById("exportAllBtn");
exportAllBtn.addEventListener("click", () => {
  const colors = [];
  for (let i = 1; i <= 6; i++) {
    const display = document.getElementById(`colorValue${i}`);
    colors.push(display.value);
  }

  // 텍스트 포맷으로 색상 정보 정렬
  const exportText = `Color Scheme:\n${colors
    .map((c, i) => `Color ${i + 1}: ${c}`)
    .join("\n")}\n\nHex Array: [${colors.map((c) => `"${c}"`).join(", ")}]`;

  navigator.clipboard.writeText(exportText).then(() => {
    exportAllBtn.textContent = "Copied!";
    exportAllBtn.style.background = "rgba(76, 175, 80, 0.3)";
    exportAllBtn.style.borderColor = "rgba(76, 175, 80, 0.5)";
    setTimeout(() => {
      exportAllBtn.textContent = "Export All Colors";
      exportAllBtn.style.background = "";
      exportAllBtn.style.borderColor = "";
    }, 2000);
  });
});

// 커스텀 커서
const cursor = document.getElementById("customCursor");
let mouseX = 0;
let mouseY = 0;
let cursorX = 0;
let cursorY = 0;

document.addEventListener("mousemove", (e) => {
  // 마우스 위치 추적
  mouseX = e.clientX;
  mouseY = e.clientY;
});

let isCursorAnimating = false;
function animateCursor() {
  if (!isCursorAnimating) return;
  cursorX = mouseX;
  cursorY = mouseY;

  // 커서 위치 업데이트
  cursor.style.left = cursorX + "px";
  cursor.style.top = cursorY + "px";

  requestAnimationFrame(animateCursor);
}
