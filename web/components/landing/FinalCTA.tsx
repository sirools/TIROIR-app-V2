export default function FinalCTA({ onJoin }: { onJoin: () => void }) {
  return (
    <section className="section">
      <div className="container">
        <div className="cta-final">
          <h3 className="h2" style={{color:"white"}}>Prenez soin de vos objets. Simplifiez votre quotidien.</h3>
          <p style={{opacity:.9, marginTop:8}}>Rejoignez la beta et soyez parmi les premiers à tester Tiroir.</p>
          <button className="btn btn-primary" style={{background:"white", color:"var(--orange)", marginTop:12}} onClick={onJoin}>
            Rejoindre la beta
          </button>
        </div>
      </div>
    </section>
  )
}