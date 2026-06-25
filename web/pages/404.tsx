export default function NotFound() {
  return (
    <main style={{minHeight:'50vh', display:'grid', placeItems:'center', padding:'40px'}}>
      <div style={{textAlign:'center'}}>
        <h1 style={{fontSize:28, fontWeight:800}}>Page introuvable</h1>
        <p style={{color:'#666', marginTop:8}}>La ressource demandée est absente.</p>
        <a href="/" style={{display:'inline-block', marginTop:16, padding:'10px 14px', borderRadius:12, background:'#F26900', color:'#fff', fontWeight:700}}>Retour à l’accueil</a>
      </div>
    </main>
  )
}