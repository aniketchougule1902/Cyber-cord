'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'

const INTRO_DURATION_SECONDS = 10.5

interface SatelliteIntroProps {
  onComplete: () => void
}

// Boot-sequence lines shown progressively in the HUD
const BOOT_LINES = [
  '> Initializing CyberCord v2.0…',
  '> Loading threat intelligence modules…',
  '> Establishing encrypted uplink…',
  '> Satellite handshake: OK',
  '> Signal acquisition: LOCKED',
  '> Decrypting geo-location feed…',
  '> OSINT engine: READY',
  '> Secure session authenticated.',
  '> Welcome, Analyst.',
]

export default function SatelliteIntro({ onComplete }: SatelliteIntroProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const [progress, setProgress] = useState(0)
  const [bootLines, setBootLines] = useState<string[]>([])
  const [phaseLabel, setPhaseLabel] = useState('STANDBY')
  const [coords, setCoords] = useState({ lat: '0.000°N', lon: '0.000°E' })

  // Derived skip handler — just call onComplete immediately
  const handleSkip = () => {
    onCompleteRef.current()
  }

  // Boot-line typewriter effect driven by progress
  useEffect(() => {
    const count = Math.floor(progress * BOOT_LINES.length)
    setBootLines(BOOT_LINES.slice(0, count))
  }, [progress])

  const init = useCallback(() => {
    const mount = mountRef.current
    if (!mount) return

    // ─── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    mount.appendChild(renderer.domElement)

    // ─── Scene ───────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000005)

    // ─── Camera ──────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.01, 5000)
    camera.position.set(0, 0, 80)
    camera.lookAt(0, 0, 0)

    // ─── Stars (two layers for parallax depth) ───────────────────────────────
    const addStarLayer = (count: number, rMin: number, rMax: number, size: number, color: number) => {
      const pos = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const r = rMin + Math.random() * (rMax - rMin)
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        pos[i * 3 + 2] = r * Math.cos(phi)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color, size, sizeAttenuation: true })))
    }
    addStarLayer(6000, 600, 1000, 0.4, 0xffffff)
    addStarLayer(2000, 200, 600, 0.25, 0xaaddff)

    // ─── Earth ───────────────────────────────────────────────────────────────
    const earthRadius = 20
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64)
    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        lightDir: { value: new THREE.Vector3(1, 0.5, 1).normalize() },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 lightDir;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;

        float hash(vec2 p) { p=fract(p*vec2(127.1,311.7)); p+=dot(p,p+19.19); return fract(p.x*p.y); }
        float noise(vec2 p) {
          vec2 i=floor(p); vec2 f=fract(p);
          float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
          vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
        }
        float fbm(vec2 p){ float v=0.,a=0.5; for(int i=0;i<5;i++){v+=a*noise(p);p*=2.1;a*=0.5;} return v; }

        void main() {
          float land = smoothstep(0.45, 0.55, fbm(vUv*8.0+0.3));
          vec3 ocean = mix(vec3(0.02,0.08,0.35), vec3(0.05,0.25,0.65), fbm(vUv*4.0));
          vec3 landColor = mix(vec3(0.15,0.40,0.10), vec3(0.40,0.32,0.18), fbm(vUv*14.0));
          vec3 color = mix(ocean, landColor, land);
          float nightFactor = 1.0 - smoothstep(-0.1, 0.3, dot(vNormal, lightDir));
          float cityLight = smoothstep(0.72, 0.74, fbm(vUv*20.0)) * land * nightFactor * 1.8;
          color += vec3(1.0, 0.85, 0.3) * cityLight;
          float diff = max(dot(vNormal, lightDir), 0.0);
          color *= (0.08 + diff * 0.92);
          vec3 viewDir = normalize(-vPosition);
          float spec = pow(max(dot(vNormal, normalize(lightDir+viewDir)), 0.0), 64.0) * (1.0-land) * 0.6;
          color += vec3(0.6,0.8,1.0)*spec;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    })
    const earthMesh = new THREE.Mesh(earthGeo, earthMat)
    scene.add(earthMesh)

    // ─── Atmosphere ──────────────────────────────────────────────────────────
    const atmosphereMat = new THREE.ShaderMaterial({
      uniforms: { lightDir: { value: new THREE.Vector3(1, 0.5, 1).normalize() } },
      vertexShader: `
        varying vec3 vNormal; varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelMatrix * vec4(position,1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 lightDir; varying vec3 vNormal; varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vPosition);
          float rim = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.5);
          float sunside = max(dot(vNormal, lightDir), 0.0);
          vec3 atmColor = mix(vec3(0.1,0.3,0.9), vec3(0.3,0.6,1.0), sunside);
          gl_FragColor = vec4(atmColor, rim * 0.7);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    })
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.08, 64, 64), atmosphereMat))

    // ─── Clouds ──────────────────────────────────────────────────────────────
    const cloudMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time; varying vec2 vUv;
        float hash(vec2 p){ p=fract(p*vec2(127.1,311.7)); p+=dot(p,p+19.19); return fract(p.x*p.y); }
        float noise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1)); vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
        float fbm(vec2 p){ float v=0.,a=0.5; for(int i=0;i<4;i++){v+=a*noise(p);p*=2.;a*=0.5;} return v;}
        void main(){ float c=fbm(vUv*6.0+vec2(time*0.01,0)); gl_FragColor=vec4(1,1,1,smoothstep(0.52,0.65,c)*0.75); }
      `,
      transparent: true,
      depthWrite: false,
    })
    const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.02, 64, 64), cloudMat)
    scene.add(cloudMesh)

    // ─── Orbit Ring ──────────────────────────────────────────────────────────
    const orbitRadius = earthRadius + 12
    const orbitTilt = 0.4
    const orbitRingGeo = new THREE.TorusGeometry(orbitRadius, 0.06, 8, 128)
    const orbitRingMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.18 })
    const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat)
    orbitRing.rotation.x = Math.PI / 2 - orbitTilt
    scene.add(orbitRing)

    // ─── Satellite ───────────────────────────────────────────────────────────
    const satGroup = new THREE.Group()
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.9, roughness: 0.2 })
    satGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), bodyMat))
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x2244aa, metalness: 0.3, roughness: 0.5, emissive: 0x112244 })
    satGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.02, 0.6), panelMat))
    const antMat = new THREE.MeshStandardMaterial({ color: 0xaaaacc, metalness: 1, roughness: 0.1 })
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 8), antMat)
    antenna.position.set(0, 0.3, 0)
    satGroup.add(antenna)
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xddddee, metalness: 0.8, roughness: 0.2, side: THREE.DoubleSide })
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), dishMat)
    dish.position.set(0, 0.55, 0)
    dish.rotation.x = Math.PI
    satGroup.add(dish)
    // Satellite glow
    const satGlowMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.25 })
    satGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), satGlowMat))
    scene.add(satGroup)

    // ─── Signal Beam ─────────────────────────────────────────────────────────
    const beamGeo = new THREE.BufferGeometry()
    beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const beamMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0 })
    const beamLine = new THREE.Line(beamGeo, beamMat)
    scene.add(beamLine)
    const beamGlowGeo = new THREE.BufferGeometry()
    beamGlowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const beamGlowMat = new THREE.LineBasicMaterial({ color: 0x44ffee, transparent: true, opacity: 0 })
    scene.add(new THREE.Line(beamGlowGeo, beamGlowMat))

    const flashMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0 })
    const flashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), flashMat)
    scene.add(flashMesh)

    // Ripple rings around impact point
    const rippleRings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; born: number }[] = []
    const addRipple = (pos: THREE.Vector3, t: number) => {
      const rMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
      const rMesh = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.18, 32), rMat)
      rMesh.position.copy(pos)
      rMesh.lookAt(0, 0, 0)
      scene.add(rMesh)
      rippleRings.push({ mesh: rMesh, mat: rMat, born: t })
    }

    // ─── High-tech Building ──────────────────────────────────────────────────
    const buildingGroup = new THREE.Group()
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x0a1a2e, metalness: 0.7, roughness: 0.3, emissive: 0x00ffcc, emissiveIntensity: 0.05 })
    const towerMesh = new THREE.Mesh(new THREE.BoxGeometry(4, 30, 4), towerMat)
    towerMesh.position.y = 15
    buildingGroup.add(towerMesh)
    for (let floor = 0; floor < 14; floor++) {
      for (let col = 0; col < 3; col++) {
        if (Math.random() > 0.3) {
          const r = Math.random()
          const winColor = r > 0.7 ? 0x00ffcc : r > 0.4 ? 0x4488ff : 0xffaa00
          const winMat = new THREE.MeshStandardMaterial({ color: winColor, emissive: winColor, emissiveIntensity: 0.8 })
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.05), winMat)
          win.position.set(-1.2 + col * 1.2, 3 + floor * 2, 2.05)
          buildingGroup.add(win)
        }
      }
    }
    const bAnt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5, 8), new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 1 }))
    bAnt.position.y = 32.5
    buildingGroup.add(bAnt)
    const blinkMat = new THREE.MeshBasicMaterial({ color: 0xff2200 })
    const blinkLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), blinkMat)
    blinkLight.position.y = 35.2
    buildingGroup.add(blinkLight)
    const surrData: [number, number][] = [[-8, 12], [8, 10], [-6, 8], [7, 14], [-10, 16], [10, 8], [-14, 6], [14, 12], [0, 7], [-4, 18]]
    surrData.forEach(([x, h]) => {
      const g = new THREE.BoxGeometry(3 + Math.random() * 2, h, 3 + Math.random() * 2)
      const m = new THREE.MeshStandardMaterial({ color: 0x050d1a, metalness: 0.5, roughness: 0.6, emissive: 0x001133, emissiveIntensity: 0.3 })
      const mesh = new THREE.Mesh(g, m)
      mesh.position.set(x + (Math.random() - 0.5) * 2, h / 2, -5 + (Math.random() - 0.5) * 4)
      buildingGroup.add(mesh)
    })
    buildingGroup.add(new THREE.PointLight(0x00ffcc, 10, 30))
    buildingGroup.visible = false
    scene.add(buildingGroup)

    // ─── Computer Screen ─────────────────────────────────────────────────────
    const screenGroup = new THREE.Group()
    screenGroup.add(new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 2.5), new THREE.MeshStandardMaterial({ color: 0x1a2840 })))
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.9 }))
    stand.position.y = 0.5
    screenGroup.add(stand)
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8, roughness: 0.2 }))
    bezel.position.y = 1.6
    screenGroup.add(bezel)
    const screenMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time; varying vec2 vUv;
        void main(){
          vec2 uv=vUv;
          vec3 col=vec3(0.01,0.03,0.08);
          float gx=step(0.98,fract(uv.x*16.)); float gy=step(0.98,fract(uv.y*10.));
          col+=vec3(0.,0.8,0.8)*max(gx,gy)*0.3;
          col=mix(col,vec3(0.04,0.07,0.14),step(uv.x,0.18));
          col=mix(col,vec3(0.03,0.06,0.12),step(0.9,uv.y));
          col+=vec3(0.,0.5,0.4)*step(0.22,uv.x)*step(uv.x,0.62)*step(0.6,uv.y)*step(uv.y,0.85)*0.4;
          col+=vec3(0.,0.3,0.7)*step(0.65,uv.x)*step(uv.x,0.97)*step(0.6,uv.y)*step(uv.y,0.85)*0.3;
          col+=sin(uv.y*200.+time*2.)*0.04;
          col+=vec3(0.,1.,0.8)*step(0.5,sin(time*3.))*step(0.22,uv.x)*step(uv.x,0.25)*step(0.5,uv.y)*step(uv.y,0.55);
          vec2 v=vUv-0.5; col*=1.-dot(v,v)*0.8;
          gl_FragColor=vec4(col,1.0);
        }
      `,
    })
    const screenMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.0, 0.01), screenMat)
    screenMesh.position.set(0, 1.6, 0.065)
    screenGroup.add(screenMesh)
    screenGroup.visible = false
    scene.add(screenGroup)

    // ─── Lights ──────────────────────────────────────────────────────────────
    const sunLight = new THREE.DirectionalLight(0xfff4e8, 2)
    sunLight.position.set(100, 50, 100)
    scene.add(sunLight)
    scene.add(new THREE.AmbientLight(0x050510, 1))

    // ─── Impact point ────────────────────────────────────────────────────────
    const impactAngle = -0.3
    const impactPoint = new THREE.Vector3(
      earthRadius * Math.cos(impactAngle) * 0.9,
      earthRadius * Math.sin(impactAngle) * 0.9,
      earthRadius * 0.1
    )

    // ─── Overlay for fade-to-black ────────────────────────────────────────────
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:10'
    mount.appendChild(overlay)

    // ─── Animation ───────────────────────────────────────────────────────────
    const totalDuration = INTRO_DURATION_SECONDS
    let elapsed = 0
    const clock = new THREE.Clock()
    let animationId = 0
    let lastRippleTime = -1

    const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    const easeOut = (t: number) => 1 - (1 - t) * (1 - t)
    const lerp3 = (a: THREE.Vector3, b: THREE.Vector3, t: number) => new THREE.Vector3().lerpVectors(a, b, t)

    const animate = () => {
      animationId = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)
      elapsed = Math.min(elapsed + dt, totalDuration + 1)
      const t = elapsed

      setProgress(Math.min(t / totalDuration, 1))

      // Update shader uniforms
      ;(earthMat.uniforms.time as { value: number }).value = t
      ;(cloudMat.uniforms.time as { value: number }).value = t
      ;(screenMat.uniforms.time as { value: number }).value = t * 60

      // Earth slow rotation
      earthMesh.rotation.y = t * 0.05
      cloudMesh.rotation.y = t * 0.06
      cloudMesh.rotation.x = t * 0.01

      // Satellite orbit
      const satAngle = t * 0.5
      satGroup.position.set(
        orbitRadius * Math.cos(satAngle),
        orbitRadius * Math.sin(orbitTilt) * Math.sin(satAngle),
        orbitRadius * Math.sin(satAngle) * Math.cos(orbitTilt)
      )
      satGroup.rotation.y = satAngle + Math.PI / 2

      // Live coords from satellite position (cosmetic)
      const DEG_PER_RAD = 180 / Math.PI
      const MAX_LAT_DEG = 90
      const CIRCLE_DEG = 360
      const satLat = (Math.sin(orbitTilt) * Math.sin(satAngle) * MAX_LAT_DEG).toFixed(3)
      const satLon = ((satAngle * DEG_PER_RAD) % CIRCLE_DEG).toFixed(3)
      setCoords({
        lat: `${Math.abs(parseFloat(satLat))}°${parseFloat(satLat) >= 0 ? 'N' : 'S'}`,
        lon: `${Math.abs(parseFloat(satLon))}°${parseFloat(satLon) >= 0 ? 'E' : 'W'}`,
      })

      // Blink light
      blinkMat.opacity = Math.sin(t * 4) > 0 ? 1 : 0

      // Update ripple rings
      for (let i = rippleRings.length - 1; i >= 0; i--) {
        const age = t - rippleRings[i].born
        const maxAge = 1.2
        if (age > maxAge) {
          scene.remove(rippleRings[i].mesh)
          rippleRings.splice(i, 1)
        } else {
          const s = 1 + age * 6
          rippleRings[i].mesh.scale.setScalar(s)
          rippleRings[i].mat.opacity = (1 - age / maxAge) * 0.7
        }
      }

      if (t < 2.5) {
        // Phase 0: Wide space view
        setPhaseLabel('ACQUIRING SIGNAL')
        earthMesh.visible = true
        satGroup.visible = true
        orbitRing.visible = true
        buildingGroup.visible = false
        screenGroup.visible = false
        beamMat.opacity = 0
        beamGlowMat.opacity = 0
        flashMat.opacity = 0
        const p = easeInOut(t / 2.5)
        camera.position.lerpVectors(new THREE.Vector3(0, 5, 80), new THREE.Vector3(0, 0, 55), p)
        camera.lookAt(0, 0, 0)
      } else if (t < 4.5) {
        // Phase 1: Beam fires
        setPhaseLabel('SIGNAL LOCKED — TRANSMITTING')
        const pt = (t - 2.5) / 2.0
        const beamProgress = easeOut(Math.min(pt, 1))
        const beamStart = satGroup.position.clone()
        const beamEnd = lerp3(beamStart, impactPoint, beamProgress)
        const pos = new Float32Array([beamStart.x, beamStart.y, beamStart.z, beamEnd.x, beamEnd.y, beamEnd.z])
        beamGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        beamGeo.attributes.position.needsUpdate = true
        beamGlowGeo.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3))
        beamGlowGeo.attributes.position.needsUpdate = true
        beamMat.opacity = Math.min(pt * 3, 1)
        beamGlowMat.opacity = beamMat.opacity * 0.4
        if (beamProgress > 0.95) {
          flashMesh.position.copy(impactPoint)
          flashMesh.scale.setScalar(1 + Math.sin((beamProgress - 0.95) * 60) * 0.5)
          flashMat.opacity = (1 - (beamProgress - 0.95) / 0.05) * 0.8
          // Spawn ripple rings periodically
          if (t - lastRippleTime > 0.25) {
            addRipple(impactPoint, t)
            lastRippleTime = t
          }
        }
        const camP = easeInOut(Math.min(pt, 1))
        camera.position.lerpVectors(new THREE.Vector3(0, 0, 55), lerp3(satGroup.position, impactPoint, 0.3).multiplyScalar(1.5).add(new THREE.Vector3(0, 5, 15)), camP)
        camera.lookAt(lerp3(new THREE.Vector3(0, 0, 0), impactPoint, camP))
      } else if (t < 6.5) {
        // Phase 2: Through clouds, approaching surface
        setPhaseLabel('DECRYPTING GEO-FEED')
        const pt = (t - 4.5) / 2.0
        beamMat.opacity = Math.max(0, 1 - pt * 2)
        beamGlowMat.opacity = beamMat.opacity * 0.4
        orbitRing.visible = false
        const camP = easeOut(pt)
        camera.position.lerpVectors(
          new THREE.Vector3(impactPoint.x * 1.5, impactPoint.y * 1.5, impactPoint.z * 1.5 + 15),
          new THREE.Vector3(impactPoint.x * 0.3 + 5, impactPoint.y * 0.3 + 5, 45),
          camP
        )
        camera.lookAt(lerp3(impactPoint, new THREE.Vector3(0, 0, 0), camP * 0.5))
      } else if (t < 8.0) {
        // Phase 3: Reveal building
        setPhaseLabel('TARGET LOCATED')
        beamMat.opacity = 0
        beamGlowMat.opacity = 0
        buildingGroup.visible = true
        buildingGroup.position.set(0, -earthRadius - 4, 35)
        const pt = (t - 6.5) / 1.5
        const camP = easeInOut(pt)
        camera.position.lerpVectors(
          new THREE.Vector3(impactPoint.x * 0.3 + 5, impactPoint.y * 0.3 + 5, 45),
          new THREE.Vector3(0, 15, 25),
          camP
        )
        camera.lookAt(new THREE.Vector3(0, 15, 30))
      } else if (t < 9.5) {
        // Phase 4: Zoom into building
        setPhaseLabel('INFILTRATING NETWORK')
        const pt = (t - 8.0) / 1.5
        earthMesh.visible = pt < 0.5
        satGroup.visible = false
        const camP = easeInOut(pt)
        camera.position.lerpVectors(new THREE.Vector3(0, 15, 25), new THREE.Vector3(0, 2, 12), camP)
        camera.lookAt(new THREE.Vector3(0, 5, 20))
      } else if (t < INTRO_DURATION_SECONDS) {
        // Phase 5: Computer lab → screen zoom
        setPhaseLabel('SESSION ESTABLISHED')
        earthMesh.visible = false
        satGroup.visible = false
        screenGroup.visible = true
        screenGroup.position.set(0, -0.5, 15)
        const pt = (t - 9.5) / 1.0
        const camP = easeOut(pt)
        camera.position.lerpVectors(new THREE.Vector3(0, 2, 12), new THREE.Vector3(0, 1.1, 16.2), camP)
        camera.lookAt(new THREE.Vector3(0, 1.6, 15))
        if (pt > 0.8) {
          overlay.style.opacity = String((pt - 0.8) / 0.2)
        }
      } else {
        // Complete
        cancelAnimationFrame(animationId)
        onCompleteRef.current()
        return
      }

      renderer.render(scene, camera)
    }

    animate()

    const onResize = () => {
      if (!mount) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      if (mount.contains(overlay)) mount.removeChild(overlay)
    }
  }, [])

  useEffect(() => {
    const cleanup = init()
    return () => { cleanup?.() }
  }, [init])

  return (
    <div ref={mountRef} className="fixed inset-0 z-50 bg-black" style={{ width: '100vw', height: '100vh' }}>

      {/* ── Scanline overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
        }}
      />

      {/* ── Top HUD bar ── */}
      <div className="absolute top-0 inset-x-0 z-20 pointer-events-none px-4 pt-3 flex items-center justify-between">
        {/* Left: brand + phase */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-400 font-mono text-xs tracking-widest uppercase font-bold" style={{ textShadow: '0 0 8px #00ffcc' }}>
              CYBERCORD
            </span>
          </div>
          <span className="text-slate-600 font-mono text-xs">|</span>
          <span className="text-cyan-300/70 font-mono text-xs tracking-wider">{phaseLabel}</span>
        </div>

        {/* Right: coordinates */}
        <div className="font-mono text-xs text-cyan-400/60 tracking-wider text-right hidden sm:block">
          <div>LAT {coords.lat}</div>
          <div>LON {coords.lon}</div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="absolute top-8 inset-x-0 z-20 pointer-events-none px-4">
        <div className="h-px bg-slate-800">
          <div
            className="h-full bg-cyan-400 transition-all duration-100"
            style={{ width: `${progress * 100}%`, boxShadow: '0 0 6px #00ffcc' }}
          />
        </div>
      </div>

      {/* ── Corner brackets (HUD frame) ── */}
      <div className="absolute inset-0 pointer-events-none z-20 p-4 hidden sm:block">
        {/* top-left */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t border-l border-cyan-500/40" />
        {/* top-right */}
        <div className="absolute top-4 right-4 w-6 h-6 border-t border-r border-cyan-500/40" />
        {/* bottom-left */}
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b border-l border-cyan-500/40" />
        {/* bottom-right */}
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b border-r border-cyan-500/40" />
      </div>

      {/* ── Left side boot log ── */}
      <div className="absolute left-4 bottom-20 z-20 pointer-events-none hidden md:block max-w-xs">
        <div className="space-y-0.5">
          {bootLines.map((line, i) => (
            <p
              key={i}
              className="font-mono text-xs text-green-400/80 leading-relaxed"
              style={{ textShadow: '0 0 4px rgba(0,255,100,0.4)' }}
            >
              {line}
              {i === bootLines.length - 1 && (
                <span className="ml-0.5 inline-block w-1.5 h-3 bg-green-400/80 animate-pulse align-middle" />
              )}
            </p>
          ))}
        </div>
      </div>

      {/* ── Bottom center status ── */}
      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2 z-20 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span
            className="text-cyan-400 text-sm font-mono tracking-widest uppercase"
            style={{ textShadow: '0 0 10px #00ffcc' }}
          >
            CyberCord — Initializing Secure Connection
          </span>
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        </div>
        {/* Dot loader */}
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="w-1 h-1 rounded-full bg-cyan-400/50"
              style={{ animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite` }}
            />
          ))}
        </div>
      </div>

      {/* ── Skip button ── */}
      <button
        onClick={handleSkip}
        className="absolute bottom-8 right-4 z-30 font-mono text-xs text-slate-500 hover:text-cyan-400 border border-slate-700 hover:border-cyan-500/50 px-3 py-1.5 rounded transition-colors"
        style={{ backdropFilter: 'blur(4px)' }}
      >
        SKIP ›
      </button>
    </div>
  )
}
