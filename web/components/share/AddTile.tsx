// components/share/AddTile.tsx — la tuile « + » au bout de la grille d'un
// partage qui accepte les ajouts : même gabarit qu'une carte d'objet.
export default function AddTile({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="tile" onClick={onClick}>
      <span className="plus" aria-hidden>+</span>
      <span className="label">Ajouter à la liste</span>
      <span className="sub">Un objet de ton Tiroir, ou un nouveau</span>
      <style jsx>{`
        .tile {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 6px; min-height: 220px; padding: 16px; width: 100%;
          border-radius: 16px; border: 2px dashed #F2A766; background: #FFFBF7;
          cursor: pointer; font-family: inherit; text-align: center;
          transition: background 0.15s, transform 0.15s;
        }
        .tile:hover { background: #FFF3E8; transform: translateY(-2px); }
        .plus {
          width: 56px; height: 56px; border-radius: 50%;
          display: grid; place-items: center;
          background: #F26900; color: #fff; font-size: 34px; font-weight: 400; line-height: 1;
        }
        .label { font-size: 15px; font-weight: 700; color: #1A1612; margin-top: 6px; }
        .sub { font-size: 12px; color: #6B6158; }
      `}</style>
    </button>
  )
}
