'use client'

import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'

const INTRO_DURATION_SECONDS = 10.5

interface SatelliteIntroProps {
  onComplete: () => void
}

export default function SatelliteIntro({ onComplete }: SatelliteIntroProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

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

    // ─── Stars ───────────────────────────────────────────────────────────────
    const starCount = 6000
    const starPositions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 600 + Math.random() * 400
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      starPositions[i * 3 + 2] = r * Math.cos(phi)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.4, sizeAttenuation: true })
    scene.add(new THREE.Points(starGeo, starMat))

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
    scene.add(satGroup)
    const orbitRadius = earthRadius + 12
    const orbitTilt = 0.4

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

    const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    const easeOut = (t: number) => 1 - (1 - t) * (1 - t)
    const lerp3 = (a: THREE.Vector3, b: THREE.Vector3, t: number) => new THREE.Vector3().lerpVectors(a, b, t)

    const animate = () => {
      animationId = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)
      elapsed = Math.min(elapsed + dt, totalDuration + 1)
      const t = elapsed

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

      // Blink light
      blinkMat.opacity = Math.sin(t * 4) > 0 ? 1 : 0

      if (t < 2.5) {
        // Phase 0: Wide space view
        earthMesh.visible = true
        satGroup.visible = true
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
        }
        const camP = easeInOut(Math.min(pt, 1))
        camera.position.lerpVectors(new THREE.Vector3(0, 0, 55), lerp3(satGroup.position, impactPoint, 0.3).multiplyScalar(1.5).add(new THREE.Vector3(0, 5, 15)), camP)
        camera.lookAt(lerp3(new THREE.Vector3(0, 0, 0), impactPoint, camP))
      } else if (t < 6.5) {
        // Phase 2: Through clouds, approaching surface
        const pt = (t - 4.5) / 2.0
        beamMat.opacity = Math.max(0, 1 - pt * 2)
        beamGlowMat.opacity = beamMat.opacity * 0.4
        const camP = easeOut(pt)
        camera.position.lerpVectors(
          new THREE.Vector3(impactPoint.x * 1.5, impactPoint.y * 1.5, impactPoint.z * 1.5 + 15),
          new THREE.Vector3(impactPoint.x * 0.3 + 5, impactPoint.y * 0.3 + 5, 45),
          camP
        )
        camera.lookAt(lerp3(impactPoint, new THREE.Vector3(0, 0, 0), camP * 0.5))
      } else if (t < 8.0) {
        // Phase 3: Reveal building
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
        const pt = (t - 8.0) / 1.5
        earthMesh.visible = pt < 0.5
        satGroup.visible = false
        const camP = easeInOut(pt)
        camera.position.lerpVectors(new THREE.Vector3(0, 15, 25), new THREE.Vector3(0, 2, 12), camP)
        camera.lookAt(new THREE.Vector3(0, 5, 20))
      } else if (t < INTRO_DURATION_SECONDS) {
        // Phase 5: Computer lab → screen zoom
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
      </div>
    </div>
  )
}
