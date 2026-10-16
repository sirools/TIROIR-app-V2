// components/share/SuggestionsToggle.tsx — réglage du propriétaire, sur la
// page de son propre partage : autoriser ou non les suggestions pour cette
// collection. Désactivé par défaut ; le partage reste alors en lecture seule.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  collectionId: string
  collectionName: string
  enabled: boolean
  onChange: (enabled: boolean) => void
}

export default function SuggestionsToggle({ collectionId, collectionName, enabled, onChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    const next = !enabled
    setBusy(true); setError(null)
    const { error: rpcErr } = await supabase.rpc('set_collection_suggestions', {
      p_collection_id: collectionId,
      p_enabled: next,
    })
    setBusy(false)
    if (rpcErr) { setError('Le réglage n’a pas pu être enregistré. Réessaie.'); return }
    onChange(next)
  }

  return (
    <div className="box">
      <div className="text">
        <p className="title">Suggestions {enabled ? 'autorisées' : 'désactivées'}</p>
        <p className="sub">
          {enabled
            ? <>Les destinataires de ce lien peuvent te suggérer des objets pour « {collectionName} ».</>
            : <>Ce partage est en lecture seule. Active les suggestions pour que ses destinataires te proposent des objets pour « {collectionName} ».</>}
        </p>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Autoriser les suggestions"
        className={`switch ${enabled ? 'on' : ''}`}
        onClick={toggle}
        disabled={busy}
      >
        <span className="knob" />
      </button>
      <style jsx>{`
        .box {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          background: #fff; border: 1px solid var(--border); border-radius: 16px;
          padding: 14px 18px; margin-bottom: 20px;
        }
        .title { font-size: 14px; font-weight: 700; color: var(--ink); margin: 0; }
        .sub { font-size: 13px; color: var(--muted); margin: 2px 0 0; line-height: 1.45; }
        .error { color: #C0392B; font-size: 13px; font-weight: 600; margin: 6px 0 0; }
        .switch {
          position: relative; flex-shrink: 0; width: 46px; height: 28px; border-radius: 999px;
          border: 0; background: #D9D1C7; cursor: pointer; transition: background 0.15s;
        }
        .switch.on { background: #F26900; }
        .switch:disabled { opacity: 0.6; cursor: default; }
        .knob {
          position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%;
          background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.15s;
        }
        .switch.on .knob { transform: translateX(18px); }
      `}</style>
    </div>
  )
}
