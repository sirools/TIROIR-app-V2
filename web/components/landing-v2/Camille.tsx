import { useRef } from 'react'
import { Armchair, Lamp, Lock, MapPin, Search, Sun } from 'lucide-react'
import { COPY } from './copy'
import { Ph, rank } from './Ph'
import { useActiveStep } from './useMotion'
import s from './v2.module.css'

const t = COPY.camille
const ICONS = [Armchair, Lamp, Sun]

/**
 * Mini-scénario en trois écrans : retrouvé, valorisé, partagé. Chaque
 * étape porte son propre visuel (lisible sans JS) ; la barre collante en
 * haut suit le scroll (CSS) et nomme l'étape en cours (IntersectionObserver).
 */
export default function Camille() {
  const steps = useRef<HTMLOListElement>(null)
  const active = useActiveStep(steps)

  return (
    <section className={s.cam} data-active={active} aria-labelledby="v2-cam-title">
      <div className={`${s.wrap} ${s.camIntro}`}>
        <div className={s.sectionHead} data-rv="">
          <p className={s.eyebrow}><Ph>{t.eyebrow}</Ph></p>
          <h2 id="v2-cam-title" className={s.h2}><Ph>{t.title}</Ph></h2>
          <p className={s.lead}><Ph>{t.sub}</Ph></p>
        </div>
      </div>

      <div className={s.rail} aria-hidden="true">
        <div className={s.wrap}>
          <ol className={s.railLabels}>
            {t.steps.map(st => <li key={st.label}>{st.label}</li>)}
          </ol>
          <div className={s.railTrack}><div className={s.railFill} /></div>
        </div>
      </div>

      <ol ref={steps} className={`${s.wrap} ${s.camSteps}`}>
        {t.steps.map((st, i) => (
          <li key={st.label} className={s.camStep} data-step="">
            <div data-rv="">
              <div className={s.camNum}>0{i + 1} · {st.label.toUpperCase()}</div>
              <h3 className={s.camTitle}><Ph>{st.title}</Ph></h3>
              <p className={s.lead}><Ph>{st.text}</Ph></p>
            </div>
            <div className={s.ui} data-rv="" style={rank(1)} aria-hidden="true">
              {i === 0 && <Found />}
              {i === 1 && <Valued />}
              {i === 2 && <Shared />}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Item({ i, right }: { i: number; right?: React.ReactNode }) {
  const it = t.items[i]
  const Icon = ICONS[i]
  return (
    <li className={`${s.item} ${i === 0 ? s.itemHit : ''}`} data-rv="" style={rank(i + 2)}>
      <span className={s.thumb}><Icon size={22} /></span>
      <span>
        <div className={s.itemName}>{it.name}</div>
        <div className={s.itemPlace}><MapPin size={12} />{it.place}</div>
      </span>
      {right}
    </li>
  )
}

function Found() {
  return (
    <>
      <div className={s.search}><Search size={18} />{t.search}<span className={s.caret} /></div>
      <ul className={s.items}>
        <Item i={0} right={<span className={`${s.pill} ${s.pillGhost}`}>Trouvé</span>} />
      </ul>
    </>
  )
}

function Valued() {
  return (
    <>
      <ul className={s.items}>
        {t.items.map((it, i) => (
          <Item key={it.name} i={i} right={<span className={s.pill}>{it.value}</span>} />
        ))}
      </ul>
      <div className={s.total} data-rv="" style={rank(5)}><span>{t.total}</span></div>
    </>
  )
}

function Shared() {
  return (
    <div style={{ display: 'grid' }}>
      <p className={s.shareTitle}>{t.share.title}</p>
      <div className={s.shareThumbs}>
        {ICONS.map((Icon, i) => <span key={i} className={s.thumb}><Icon size={26} /></span>)}
      </div>
      <div className={s.link} data-rv="" style={rank(2)}>
        <Lock size={15} />{t.share.link}<em>{t.share.private}</em>
      </div>
      <p className={s.seen}>{t.share.seen}</p>
      <div className={s.bubble} data-rv="" style={rank(4)}>{t.share.reply}</div>
    </div>
  )
}
