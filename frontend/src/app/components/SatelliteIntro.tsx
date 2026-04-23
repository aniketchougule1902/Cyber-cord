'use client'

import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Crosshair, Target, ShieldAlert, Cpu, Satellite, Flame, Skull } from 'lucide-react'

interface SatelliteIntroProps {
  onComplete: () => void
}

// 4K Ultra-realistic cinematic assets
const EARTH_IMG =
  'https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?q=100&w=3840&auto=format&fit=crop'
const CITY_GRID_IMG =
  'https://images.unsplash.com/photo-1519501025264-65ba15a82390?q=100&w=3840&auto=format&fit=crop'
const SERVER_CORE_IMG =
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=100&w=3840&auto=format&fit=crop'

const useRandomData = () => {
  const [hex, setHex] = useState('00000000')
  const [coords, setCoords] = useState('00.000, 00.000')
  useEffect(() => {
    const intervalId = setInterval(() => {
      setHex(
        Math.random().toString(16).substring(2, 10).toUpperCase() +
          Math.random().toString(16).substring(2, 6).toUpperCase(),
      )
      const lat = (Math.random() * 180 - 90).toFixed(4)
      const lon = (Math.random() * 360 - 180).toFixed(4)
      setCoords(
        `${Math.abs(parseFloat(lat))} ${parseFloat(lat) >= 0 ? 'N' : 'S'}, ${Math.abs(parseFloat(lon))} ${parseFloat(lon) >= 0 ? 'E' : 'W'}`,
      )
    }, 30)
    return () => clearInterval(intervalId)
  }, [])
  return { hex, coords }
}

// Hex digit columns rain effect
const HexRain = () => {
  const columns = Array.from({ length: 24 }, (_, i) => i)
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
      {columns.map((col) => (
        <motion.div
          key={col}
          className="absolute top-0 font-mono text-green-400 text-xs leading-4 select-none"
          style={{ left: `${(col / 24) * 100}%` }}
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: '200%', opacity: [0, 1, 0.7, 0] }}
          transition={{
            duration: 2.5 + Math.random() * 3,
            delay: Math.random() * 4,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          {Array.from({ length: 20 }, () =>
            Math.floor(Math.random() * 16).toString(16).toUpperCase(),
          ).join('\n')}
        </motion.div>
      ))}
    </div>
  )
}

// Scanline overlay
const Scanlines = () => (
  <div
    className="absolute inset-0 pointer-events-none z-10"
    style={{
      background:
        'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
    }}
  />
)

// Vignette
const Vignette = () => (
  <div
    className="absolute inset-0 pointer-events-none z-10"
    style={{
      background:
        'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%)',
    }}
  />
)

// HUD corner brackets
const HudCorners = ({ color = '#00ffcc' }: { color?: string }) => (
  <>
    <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 pointer-events-none z-30" style={{ borderColor: color }} />
    <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 pointer-events-none z-30" style={{ borderColor: color }} />
    <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 pointer-events-none z-30" style={{ borderColor: color }} />
    <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 pointer-events-none z-30" style={{ borderColor: color }} />
  </>
)

// Crosshair reticle
const Reticle = ({ active }: { active: boolean }) => (
  <motion.div
    className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
    initial={{ opacity: 0 }}
    animate={{ opacity: active ? 1 : 0 }}
  >
    <motion.div
      animate={active ? { rotate: 360 } : {}}
      transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
    >
      <Crosshair
        className="text-red-500"
        style={{ width: 120, height: 120, filter: 'drop-shadow(0 0 12px #ff2200)' }}
      />
    </motion.div>
    {active && (
      <>
        {/* pulsing ring */}
        <motion.div
          className="absolute rounded-full border-2 border-red-500/60"
          initial={{ width: 80, height: 80, opacity: 1 }}
          animate={{ width: 200, height: 200, opacity: 0 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute text-red-400 font-mono text-xs tracking-widest"
          style={{ top: '55%', textShadow: '0 0 8px #ff0000' }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.4, repeat: Infinity }}
        >
          TARGET LOCKED
        </motion.div>
      </>
    )}
  </motion.div>
)

// Laser beam effect
const LaserBeam = ({ active }: { active: boolean }) => (
  <AnimatePresence>
    {active && (
      <motion.div
        className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* horizontal beam */}
        <motion.div
          className="absolute h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent"
          style={{ width: '100%', boxShadow: '0 0 20px 4px #ff2200' }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: [0, 1, 0.8] }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
        {/* vertical beam */}
        <motion.div
          className="absolute w-0.5 bg-gradient-to-b from-transparent via-red-500 to-transparent"
          style={{ height: '100%', boxShadow: '0 0 20px 4px #ff2200' }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: [0, 1, 0.8] }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
        />
      </motion.div>
    )}
  </AnimatePresence>
)

// White flash fill
const FlashOverlay = ({ active }: { active: boolean }) => (
  <AnimatePresence>
    {active && (
      <motion.div
        className="absolute inset-0 bg-white z-40 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.6, 0] }}
        transition={{ duration: 0.5, times: [0, 0.1, 0.4, 1] }}
        exit={{ opacity: 0 }}
      />
    )}
  </AnimatePresence>
)

// Status ticker at bottom
const StatusTicker = ({ lines }: { lines: string[] }) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [lines])
  return (
    <div
      ref={ref}
      className="absolute bottom-16 left-4 z-30 max-w-xs max-h-32 overflow-hidden pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {lines.map((line, i) => (
          <motion.p
            key={i}
            className="font-mono text-xs text-green-400/90 leading-relaxed"
            style={{ textShadow: '0 0 4px rgba(0,255,100,0.5)' }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            {line}
            {i === lines.length - 1 && (
              <motion.span
                className="ml-0.5 inline-block w-1.5 h-3 bg-green-400/80 align-middle"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            )}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  )
}

// Cinematic phase timing (ms)
const PHASE_1_DELAY = 1600   // Earth orbit
const PHASE_2_DELAY = 3400   // Target lock + laser
const PHASE_3_DELAY = 3800   // Flash + wildfire dive
const PHASE_4_DELAY = 6200   // Server core smash
const PHASE_5_DELAY = 7800   // Access granted HUD
const COMPLETE_DELAY = 8800  // Trigger onComplete

// Phase configs
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
  const [phase, setPhase] = useState(0)
  const { hex, coords } = useRandomData()
  const [bootLines, setBootLines] = useState<string[]>([])
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const handleSkip = () => onCompleteRef.current()

  // Reveal boot lines progressively based on phase
  useEffect(() => {
    const count = Math.min(Math.floor((phase / 5) * BOOT_LINES.length) + phase, BOOT_LINES.length)
    setBootLines(BOOT_LINES.slice(0, count))
  }, [phase])

  // Preload heavy 4K assets
  useEffect(() => {
    ;[EARTH_IMG, CITY_GRID_IMG, SERVER_CORE_IMG].forEach((src) => {
      const img = new window.Image()
      img.src = src
    })
  }, [])

  // Cinematic phase timeline
  useEffect(() => {
    const timeline = [
      setTimeout(() => setPhase(1), PHASE_1_DELAY),
      setTimeout(() => setPhase(2), PHASE_2_DELAY),
      setTimeout(() => setPhase(3), PHASE_3_DELAY),
      setTimeout(() => setPhase(4), PHASE_4_DELAY),
      setTimeout(() => setPhase(5), PHASE_5_DELAY),
      setTimeout(() => onCompleteRef.current(), COMPLETE_DELAY),
    ]
    return () => timeline.forEach(clearTimeout)
  }, [])

  const phaseLabels = [
    'STANDBY',
    'ACQUIRING SIGNAL',
    'TARGET LOCKED — TRANSMITTING',
    'WILDFIRE DIVE',
    'INFILTRATING SERVER CORE',
    'SESSION ESTABLISHED',
  ]

  const progress = phase / 5

  return (
    <div className="fixed inset-0 z-[9999] bg-black overflow-hidden select-none font-mono">
      <Scanlines />
      <Vignette />
      <HudCorners color={phase >= 2 ? '#ff2200' : '#00ffcc'} />
      <HexRain />

      {/* ── Phase 0: Boot-up black screen ── */}
      <AnimatePresence>
        {phase === 0 && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center gap-4"
            >
              <Skull className="text-red-500" style={{ width: 64, height: 64, filter: 'drop-shadow(0 0 16px #ff0000)' }} />
              <span
                className="text-red-400 text-3xl font-bold tracking-[0.3em] uppercase"
                style={{ textShadow: '0 0 20px #ff0000, 0 0 40px #ff000066' }}
              >
                CYBERCORD
              </span>
              <span className="text-cyan-400/60 text-xs tracking-widest">AI THREAT INTELLIGENCE</span>
            </motion.div>
            <motion.div
              className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                  animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8] }}
                  transition={{ duration: 0.9, delay: i * 0.15, repeat: Infinity }}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Phase 1: Earth orbit ── */}
      <AnimatePresence>
        {phase === 1 && (
          <motion.div
            className="absolute inset-0 z-10"
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <img
              src={EARTH_IMG}
              alt="Earth from orbit"
              className="w-full h-full object-cover"
              style={{ filter: 'brightness(0.75) saturate(1.4) contrast(1.1)' }}
            />
            {/* Orbital scan ring */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <motion.div
                className="rounded-full border border-cyan-400/30"
                style={{ width: 300, height: 300, boxShadow: '0 0 40px 4px rgba(0,255,204,0.15)' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute rounded-full border border-cyan-400/15"
                style={{ width: 420, height: 420 }}
                animate={{ rotate: -360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              />
              <Satellite
                className="absolute text-cyan-400"
                style={{ width: 28, height: 28, filter: 'drop-shadow(0 0 8px #00ffcc)', transform: 'translate(148px, -10px)' }}
              />
            </motion.div>

            {/* Telemetry overlay */}
            <motion.div
              className="absolute top-20 right-6 text-right"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="text-cyan-400/70 text-xs tracking-widest mb-1">TELEMETRY</div>
              <div className="text-cyan-300 text-sm font-bold">{coords}</div>
              <div className="text-green-400/60 text-xs mt-1">UPLINK ████████ 100%</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Phase 2: Target lock + city grid ── */}
      <AnimatePresence>
        {phase === 2 && (
          <motion.div
            className="absolute inset-0 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.3 }}
          >
            <img
              src={CITY_GRID_IMG}
              alt="City grid"
              className="w-full h-full object-cover"
              style={{ filter: 'brightness(0.5) saturate(0.6) hue-rotate(160deg) contrast(1.3)' }}
            />
            {/* Teal tint overlay */}
            <div className="absolute inset-0 bg-cyan-950/40" />
            <Reticle active={true} />
            <LaserBeam active={true} />

            <motion.div
              className="absolute top-1/3 right-8 flex flex-col gap-2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              {[
                { icon: Target, label: 'TARGET ACQUIRED' },
                { icon: ShieldAlert, label: 'FIREWALL: BYPASSED' },
                { icon: Cpu, label: 'NODE: 192.168.0.1' },
              ].map(({ icon: Icon, label }) => (
                <motion.div
                  key={label}
                  className="flex items-center gap-2 text-red-400 text-xs tracking-widest"
                  style={{ textShadow: '0 0 6px #ff2200' }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  <Icon style={{ width: 14, height: 14 }} />
                  {label}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Phase 3: Flash + Wildfire Dive ── */}
      <AnimatePresence>
        {phase === 3 && (
          <>
            <FlashOverlay active={true} />
            <motion.div
              className="absolute inset-0 z-10"
              initial={{ opacity: 0, scale: 1.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <img
                src={CITY_GRID_IMG}
                alt="Dive"
                className="w-full h-full object-cover"
                style={{ filter: 'brightness(1.1) saturate(2) hue-rotate(320deg) contrast(1.5)' }}
              />
              <div className="absolute inset-0 bg-orange-950/50" />
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex flex-col items-center gap-3">
                  <Flame
                    className="text-orange-400"
                    style={{ width: 80, height: 80, filter: 'drop-shadow(0 0 24px #ff6600)' }}
                  />
                  <motion.span
                    className="text-orange-300 text-2xl font-bold tracking-[0.4em]"
                    style={{ textShadow: '0 0 20px #ff6600' }}
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.3, repeat: Infinity }}
                  >
                    WILDFIRE DIVE
                  </motion.span>
                </div>
              </motion.div>

              {/* Speed lines */}
              {Array.from({ length: 12 }, (_, i) => (
                <motion.div
                  key={i}
                  className="absolute bg-gradient-to-b from-transparent via-orange-400/30 to-transparent"
                  style={{
                    left: `${(i / 12) * 100}%`,
                    top: 0,
                    width: 1,
                    height: '100%',
                  }}
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: [0, 0.6, 0] }}
                  transition={{ duration: 0.8, delay: i * 0.05 }}
                />
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Phase 4: Server Core ── */}
      <AnimatePresence>
        {phase === 4 && (
          <motion.div
            className="absolute inset-0 z-10"
            initial={{ opacity: 0, scale: 1.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <img
              src={SERVER_CORE_IMG}
              alt="Server core"
              className="w-full h-full object-cover"
              style={{ filter: 'brightness(0.65) saturate(1.8) hue-rotate(170deg) contrast(1.3)' }}
            />
            <div className="absolute inset-0 bg-cyan-950/50" />

            {/* Glitch lines */}
            {Array.from({ length: 6 }, (_, i) => (
              <motion.div
                key={i}
                className="absolute bg-cyan-400/20"
                style={{
                  left: 0, right: 0,
                  top: `${10 + i * 14}%`,
                  height: 2,
                }}
                animate={{ scaleX: [0, 1, 0], opacity: [0, 0.8, 0], x: ['-100%', '0%', '100%'] }}
                transition={{ duration: 0.4, delay: i * 0.1, repeat: Infinity, repeatDelay: 1.5 }}
              />
            ))}

            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Cpu
                className="text-cyan-400"
                style={{ width: 72, height: 72, filter: 'drop-shadow(0 0 20px #00ffcc)' }}
              />
              <motion.span
                className="text-cyan-300 text-xl font-bold tracking-[0.3em]"
                style={{ textShadow: '0 0 16px #00ffcc' }}
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 0.4, repeat: Infinity }}
              >
                SMASHING SERVER CORE
              </motion.span>
              <div className="text-green-400/80 text-xs tracking-widest">
                {hex}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Phase 5: Access Granted HUD ── */}
      <AnimatePresence>
        {phase === 5 && (
          <motion.div
            className="absolute inset-0 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <img
              src={SERVER_CORE_IMG}
              alt="Access granted"
              className="w-full h-full object-cover"
              style={{ filter: 'brightness(0.3) saturate(1.2) hue-rotate(160deg)' }}
            />
            <div className="absolute inset-0 bg-black/60" />

            {/* Central ACCESS GRANTED badge */}
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center gap-6"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            >
              <motion.div
                className="border-2 border-green-400 px-10 py-5 flex flex-col items-center gap-3"
                style={{ boxShadow: '0 0 40px 8px rgba(0,255,100,0.3), inset 0 0 40px rgba(0,255,100,0.05)' }}
                animate={{ boxShadow: [
                  '0 0 30px 4px rgba(0,255,100,0.25)',
                  '0 0 60px 12px rgba(0,255,100,0.45)',
                  '0 0 30px 4px rgba(0,255,100,0.25)',
                ] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                <ShieldAlert
                  className="text-green-400"
                  style={{ width: 56, height: 56, filter: 'drop-shadow(0 0 12px #00ff64)' }}
                />
                <span
                  className="text-green-400 text-3xl font-bold tracking-[0.4em]"
                  style={{ textShadow: '0 0 20px #00ff64' }}
                >
                  ACCESS GRANTED
                </span>
                <span className="text-green-400/60 text-xs tracking-widest">SECURE SESSION ESTABLISHED</span>
              </motion.div>

              <motion.div
                className="text-green-400/50 text-xs tracking-widest"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              >
                LOADING ANALYST ENVIRONMENT…
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top HUD bar ── */}
      <div className="absolute top-0 inset-x-0 z-20 pointer-events-none px-4 pt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-cyan-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          <span className="text-cyan-400 font-mono text-xs tracking-widest uppercase font-bold" style={{ textShadow: '0 0 8px #00ffcc' }}>
            CYBERCORD
          </span>
          <span className="text-slate-600 font-mono text-xs">|</span>
          <span className="text-cyan-300/70 font-mono text-xs tracking-wider">{phaseLabels[phase]}</span>
        </div>
        <div className="font-mono text-xs text-cyan-400/60 tracking-wider text-right hidden sm:block">
          <div>{coords}</div>
          <div className="text-green-400/50 text-[10px]">{hex.slice(0, 8)}</div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="absolute top-8 inset-x-0 z-20 pointer-events-none px-4">
        <div className="h-px bg-slate-800">
          <motion.div
            className="h-full bg-cyan-400"
            style={{ boxShadow: '0 0 6px #00ffcc' }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* ── Boot log ── */}
      <StatusTicker lines={bootLines} />

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
