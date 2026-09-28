// components/share/MyTiroirPicker.tsx — choisir des objets de SON propre
// Tiroir pour les proposer sur le partage de quelqu'un d'autre.
//
// Lu avec la session du visiteur : la RLS ne renvoie que ses objets, ses
// images et ses photos. Rien n'est partagé tant qu'il n'a pas validé.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface MyObject {
  id: string
  title: string
  coverUrl: string | null
}

interface Props {
  selected: Set<string>
  onToggle: (id: string) => void
}

export default function MyTiroirPicker({ selected, onToggle }: Props) {
  const [objects, setObjects] = useState<MyObject[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('AUTH')
        const { data: rows, error: objErr } = await supabase
          .from('objects')
          .select('id, title')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(300)
        if (objErr) throw objErr
        const ids = (rows ?? []).map(r => r.id)
        const covers = new Map<string, string>()
        if (ids.length) {
          const { data: imgs } = await supabase
            .from('object_images')
            .select('object_id, storage_path')
            .in('object_id', ids)
            .eq('is_cover', true)
          const paths = (imgs ?? []).map(i => i.storage_path)
          if (paths.length) {
            const { data: signed } = await supabase.storage.from('object-images').createSignedUrls(paths, 3600)
            const byPath = new Map((signed ?? []).filter(s => s.signedUrl).map(s => [s.path, s.signedUrl]))
            for (const i of imgs ?? []) {
              const url = byPath.get(i.storage_path)
              if (url) covers.set(i.object_id, url)
            }
          }
        }
        if (!cancelled) setObjects((rows ?? []).map(r => ({ id: r.id, title: r.title, coverUrl: covers.get(r.id) ?? null })))
      } catch {
        if (!cancelled) setError('Impossible de charger ton Tiroir. Réessaie plus tard.')
      }
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (objects ?? []).filter(o => !q || o.title.toLowerCase().includes(q))
  }, [objects, query])

  return (
    <div className="picker">
      {objects === null && !error && <p className="muted">Chargement de ton Tiroir…</p>}
      {error && <p className="error">{error}</p>}
      {objects && objects.length === 0 && (
        <p className="muted">Ton Tiroir est vide pour l’instant. Ajoute un objet à la main avec l’onglet « Nouvel objet ».</p>
      )}
      {objects && objects.length > 0 && (
        <>
          <input
            className="search"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={objects.length > 1 ? `Chercher parmi tes ${objects.length} objets` : 'Chercher dans ton Tiroir'}
          />
          <ul className="list" role="listbox" aria-multiselectable="true">
            {filtered.map(o => {
              const on = selected.has(o.id)
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`row ${on ? 'on' : ''}`}
                    onClick={() => onToggle(o.id)}
                  >
                    {o.coverUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img className="thumb" src={o.coverUrl} alt="" />
                      : <span className="thumb placeholder" aria-hidden>📦</span>}
                    <span className="name">{o.title}</span>
                    <span className={`check ${on ? 'checked' : ''}`} aria-hidden>{on ? '✓' : ''}</span>
                  </button>
                </li>
              )
            })}
            {filtered.length === 0 && <li className="muted">Aucun objet ne correspond.</li>}
          </ul>
        </>
      )}
      <style jsx>{`
        .picker { display: flex; flex-direction: column; gap: 10px; min-height: 120px; }
        .muted { font-size: 13px; color: #6B6158; margin: 8px 0; }
        .error { font-size: 13px; color: #C0392B; font-weight: 600; margin: 8px 0; }
        .search {
          padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.12);
          font-size: 14px; font-family: inherit;
        }
        .list { list-style: none; margin: 0; padding: 0; max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
        .row {
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 6px 8px; border-radius: 12px; border: 1.5px solid #EDE7DF;
          background: #fff; cursor: pointer; text-align: left; font-family: inherit;
        }
        .row.on { border-color: #F26900; background: #FFF6EE; }
        .thumb { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
        .placeholder { display: grid; place-items: center; background: #F0EBE3; font-size: 18px; }
        .name { flex: 1; font-size: 14px; font-weight: 600; color: #1A1612; }
        .check {
          width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid #D9D1C7;
          display: grid; place-items: center; font-size: 13px; color: #fff; flex-shrink: 0;
        }
        .check.checked { background: #F26900; border-color: #F26900; }
      `}</style>
    </div>
  )
}
