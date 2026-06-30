import { useEffect, useRef, useState } from 'react'

/* ─── Objects to scan ─────────────────────────────────────────── */
const OBJECTS = [
  { emoji: '👟', name: 'Nike Air Max 90', cat: 'Chaussures', val: '85 €' },
  { emoji: '🧥', name: 'Veste en cuir noir', cat: 'Vetements', val: '120 €' },
  { emoji: '📸', name: 'Leica M6 argentique', cat: 'Photo', val: '1 200 €' },
  { emoji: '⌚', name: 'Seiko Presage', cat: 'Montres', val: '280 €' },
  { emoji: '🎸', name: 'Fender Stratocaster', cat: 'Musique', val: '650 €' },
  { emoji: '📚', name: 'Romans 1950-1980', cat: 'Livres', val: '40 €' },
]

/* ─── Layout positions (right panel, 6 slots in 2 cols) ─────────  */
const SLOTS = [
  { x: 20,  y: 18 },
  { x: 20,  y: 42 },
  { x: 20,  y: 66 },
  { x: 58,  y: 18 },
  { x: 58,  y: 42 },
  { x: 58,  y: 66 },
]

type ItemState = 'hidden' | 'appearing' | 'scanning' | 'filling' | 'done'

interface Item {
  idx: number
  state: ItemState
  fieldsDone: number   // 0-3
}

/* ─── Typewriter line ────────────────────────────────────────────── */
function TypeLine({ text, active }: { text: string; active: boolean }) {
  const [t, setT] = useState('')
  useEffect(() => {
    if (!active) { setT(''); return }
    let i = 0
    const iv = setInterval(() => { i++; setT(text.slice(0, i)); if (i >= text.length) clearInterval(iv) }, 36)
    return () => clearInterval(iv)
  }, [text, active])
  return <>{t}<span style={{ opacity: active && t.length < text.length ? 1 : 0 }}>|</span></>
}

/* ─── Single scanned item card ───────────────────────────────────── */
function ObjectCard({ item, obj, slot }: { item: Item; obj: typeof OBJECTS[0]; slot: typeof SLOTS[0] }) {
  const show = item.state !== 'hidden'
  const scanning = item.state === 'scanning'
  const filling  = item.state === 'filling' || item.state === 'done'

  return (
    <div
      className={`obj-card ${show ? 'show' : ''} ${scanning ? 'scanning' : ''}`}
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
    >
      {/* Object icon */}
      <div className={`obj-icon ${scanning ? 'flash' : ''}`}>
        <span>{obj.emoji}</span>
        {scanning && <div className="scan-line" />}
      </div>

      {/* Data fields */}
      <div className={`obj-data ${filling ? 'show' : ''}`}>
        <div className="obj-name">
          <TypeLine text={obj.name} active={item.fieldsDone >= 1} />
        </div>
        <div className="obj-row">
          <span className="obj-cat">
            <TypeLine text={obj.cat} active={item.fieldsDone >= 2} />
          </span>
          <span className="obj-val">
            <TypeLine text={obj.val} active={item.fieldsDone >= 3} />
          </span>
        </div>
      </div>

      {item.state === 'done' && <div className="check">✓</div>}

      <style jsx>{`
        .obj-card {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 8px;
          opacity: 0;
          transform: translateY(10px) scale(0.92);
          transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.26,0.64,1);
        }
        .obj-card.show { opacity: 1; transform: translateY(0) scale(1); }

        .obj-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
          position: relative;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
          border: 1.5px solid rgba(0,0,0,0.06);
          transition: box-shadow 0.2s;
        }
        .obj-icon.flash {
          animation: iconFlash 0.5s ease-out;
        }
        @keyframes iconFlash {
          0%   { box-shadow: 0 0 0 0 rgba(249,115,22,0); }
          30%  { box-shadow: 0 0 0 8px rgba(249,115,22,0.35); border-color: #f97316; }
          100% { box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
        }
        .scan-line {
          position: absolute;
          left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #f97316, transparent);
          animation: scanMove 0.55s ease-in-out;
        }
        @keyframes scanMove {
          0%   { top: 0%; }
          100% { top: 100%; }
        }

        .obj-data {
          opacity: 0;
          transform: translateX(-4px);
          transition: opacity 0.25s ease, transform 0.25s ease;
          min-width: 120px;
        }
        .obj-data.show { opacity: 1; transform: translateX(0); }
        .obj-name {
          font-size: 12px;
          font-weight: 700;
          color: #1a1a1a;
          line-height: 1.3;
          min-height: 16px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 130px;
        }
        .obj-row {
          display: flex;
          gap: 6px;
          align-items: center;
          margin-top: 3px;
        }
        .obj-cat {
          font-size: 10px;
          color: #888;
          font-weight: 500;
          min-height: 14px;
        }
        .obj-val {
          font-size: 11px;
          color: #c0682a;
          font-weight: 700;
          min-height: 14px;
        }
        .check {
          position: absolute;
          top: -5px;
          left: 36px;
          width: 16px;
          height: 16px;
          background: #22c55e;
          border-radius: 50%;
          color: white;
          font-size: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          box-shadow: 0 1px 4px rgba(34,197,94,0.35);
          animation: popIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes popIn {
          from { transform: scale(0); }
          to   { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

/* ─── Human figure SVG ──────────────────────────────────────────── */
function Person({ flashing }: { flashing: boolean }) {
  return (
    <div className="person-wrap">
      <svg viewBox="0 0 120 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="person-svg">
        {/* Head */}
        <circle cx="60" cy="32" r="22" fill="#F5D6B8" />
        {/* Hair */}
        <path d="M38 25 Q60 5 82 25 Q80 10 60 10 Q40 10 38 25Z" fill="#4A2E1A" />
        {/* Body */}
        <rect x="30" y="54" width="60" height="70" rx="16" fill="#F0E8D6" />
        {/* Orange shirt under */}
        <rect x="34" y="60" width="52" height="60" rx="12" fill="#C0682A" opacity="0.15" />
        {/* Left arm — raised holding phone */}
        <path d="M30 70 Q10 60 8 40 Q6 28 18 26 Q22 24 26 30 L34 65Z" fill="#F5D6B8" />
        {/* Right arm — relaxed */}
        <path d="M90 70 Q110 80 112 100 Q114 114 102 116 Q96 118 90 110 L86 72Z" fill="#F5D6B8" />
        {/* Pants */}
        <rect x="30" y="118" width="26" height="60" rx="10" fill="#4A5568" />
        <rect x="64" y="118" width="26" height="60" rx="10" fill="#4A5568" />
        {/* Shoes */}
        <ellipse cx="43" cy="178" rx="18" ry="9" fill="#2D3748" />
        <ellipse cx="77" cy="178" rx="18" ry="9" fill="#2D3748" />
        {/* Phone held by left hand */}
        <g transform="translate(4, 14) rotate(-20, 18, 30)">
          <rect x="8" y="16" width="22" height="36" rx="5" fill="#1a1a1a" />
          <rect x="10" y="19" width="18" height="28" rx="3" fill={flashing ? '#fff' : '#F5F0E8'} style={{ transition: 'fill 0.1s' }} />
          <circle cx="19" cy="22" r="2" fill="#333" />
        </g>
        {/* Flash arc from phone */}
        {flashing && (
          <path
            d="M26 30 Q80 -10 200 60"
            stroke="#f97316"
            strokeWidth="2"
            strokeDasharray="6 4"
            opacity="0.7"
            fill="none"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="0.4s" repeatCount="indefinite" />
          </path>
        )}
      </svg>

      <style jsx>{`
        .person-wrap { display: flex; align-items: flex-end; justify-content: center; height: 100%; }
        .person-svg { width: 110px; height: auto; }
      `}</style>
    </div>
  )
}

/* ─── Main orchestrator ──────────────────────────────────────────── */
export default function ScanAnimation() {
  const [items, setItems] = useState<Item[]>([])
  const [flashing, setFlashing] = useState(false)
  const tRefs = useRef<ReturnType<typeof setTimeout>[]>([])

  function clear() { tRefs.current.forEach(clearTimeout); tRefs.current = [] }
  function t(fn: () => void, ms: number) { tRefs.current.push(setTimeout(fn, ms)) }

  function runLoop() {
    // Reset
    setItems([])
    setFlashing(false)

    OBJECTS.forEach((_, i) => {
      const base = i * 1400   // each object takes 1.4s slot

      // 1. Appear
      t(() => setItems(prev => {
        const next = [...prev]
        next[i] = { idx: i, state: 'appearing', fieldsDone: 0 }
        return next
      }), base)

      // 2. Flash scan
      t(() => {
        setFlashing(true)
        setItems(prev => {
          const next = [...prev]
          next[i] = { ...next[i], state: 'scanning' }
          return next
        })
      }, base + 350)

      // 3. Fields fill
      t(() => {
        setFlashing(false)
        setItems(prev => {
          const next = [...prev]
          next[i] = { ...next[i], state: 'filling', fieldsDone: 1 }
          return next
        })
      }, base + 750)

      t(() => setItems(prev => {
        const next = [...prev]; next[i] = { ...next[i], fieldsDone: 2 }; return next
      }), base + 1000)

      t(() => setItems(prev => {
        const next = [...prev]; next[i] = { ...next[i], fieldsDone: 3 }; return next
      }), base + 1200)

      // 4. Done checkmark
      t(() => setItems(prev => {
        const next = [...prev]; next[i] = { ...next[i], state: 'done' }; return next
      }), base + 1350)
    })

    // Restart loop after all + pause
    t(runLoop, OBJECTS.length * 1400 + 2200)
  }

  useEffect(() => {
    runLoop()
    return clear
  }, [])

  return (
    <div className="root">
      {/* Person on the left */}
      <div className="left">
        <Person flashing={flashing} />
        {flashing && <div className="flash-ring" />}
      </div>

      {/* Objects panel on the right */}
      <div className="right">
        {OBJECTS.map((obj, i) => {
          const item = items[i] ?? { idx: i, state: 'hidden', fieldsDone: 0 }
          return (
            <ObjectCard key={i} item={item} obj={obj} slot={SLOTS[i]} />
          )
        })}
      </div>

      <style jsx>{`
        .root {
          display: flex;
          align-items: stretch;
          width: 100%;
          max-width: 620px;
          height: 280px;
          background: #F6EDE0;
          border-radius: 28px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 24px 64px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.06);
        }
        .left {
          width: 160px;
          flex-shrink: 0;
          position: relative;
          display: flex;
          align-items: flex-end;
          padding-bottom: 0;
        }
        .flash-ring {
          position: absolute;
          top: 28px;
          left: 28px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid #f97316;
          animation: ringOut 0.5s ease-out forwards;
          pointer-events: none;
        }
        @keyframes ringOut {
          from { transform: scale(1); opacity: 0.8; }
          to   { transform: scale(5); opacity: 0; }
        }
        .right {
          flex: 1;
          position: relative;
          padding: 16px 12px;
        }
      `}</style>
    </div>
  )
}
