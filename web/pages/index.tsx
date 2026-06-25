import { useState } from "react"
import Head from "next/head"

import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import Hero from "../components/landing/Hero"
// import Features from "../components/landing/Features"
import UseCases from "../components/landing/UseCases"
import Testimonials from "../components/landing/Testimonials"
import Principles from "../components/landing/Principles"
import FinalCTA from "../components/landing/FinalCTA"
import BetaSignupForm from '../components/BetaSignupForm'
import KeyFeatures from '../components/landing/KeyFeatures'

import Image from 'next/image'

const features = [
  {
    id: 'inventory',
    kicker: 'Un inventaire visuel',
    title: "Ajoutez vos objets en un instant",
    description: "Photo, nom, collection : tout est rapide et clair.",
    image: { src: '/screens/add-quick.png', alt: 'Écran ajout rapide' },
    align: 'right',
  },
  {
    id: 'collections',
    kicker: 'Collections & lieux',
    title: "Classez comme dans la vraie vie",
    description: "Par tiroir, pièce ou thème — en plus simple.",
    image: { src: '/screens/collections.png', alt: 'Écran collections' },
    align: 'left',
  },
  {
    id: 'statuses',
    kicker: 'Statuts intelligents',
    title: "À vendre, prêté, à réparer…",
    description: "Un suivi clair de vos objets au quotidien.",
    image: { src: '/screens/object-detail.png', alt: 'Détail objet' },
    align: 'right',
  },
  {
    id: 'sharing',
    kicker: 'Partage sécurisé',
    title: "Un lien, avec ou sans mot de passe",
    description: "Envoyez une sélection d’objets à un proche.",
    image: { src: '/screens/share-link.png', alt: 'Création de partage' },
    align: 'left',
  },
  {
    id: 'search',
    kicker: 'Recherche instantanée',
    title: "Retrouvez tout, très vite",
    description: "Filtres intelligents, mots-clés, statuts et plus.",
    image: { src: '/screens/search.png', alt: 'Recherche' },
    align: 'right',
  },
]


export default function Landing() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Head>
        <title>Tiroir — L’outil idéal pour votre stock</title>
        <meta name="description" content="Votre mémoire augmentée pour vos objets." />
      </Head>

      
      <HeaderTiroirWeb onJoin={() => setOpen(true)} />

      <main>
        <Hero onJoin={() => setOpen(true)} />
        <section className="section why">
          <div className="container grid-2">
            <div>
              <h2 className="h2">Pourquoi Tiroir ?</h2>
              <ul className="p" style={{ marginTop: 8 }}>
                <li>On oublie ce qu’on a déjà</li>
                <li>On ne sait plus où c’est rangé</li>
                <li>On perd du temps à chercher</li>
                <li>On ne retrouve pas ce qu’on a prêté</li>
                <li>On se perd dans la quantité</li>
                <li>On peine à se souvenir de tout</li>
                <li>On communique mal ce qu’on a</li>
              </ul>
              <p className="p" style={{ marginTop: 8 }}>
                Tiroir vous libère de cette charge mentale, et devient le compagnon digital de vos affaires.
              </p>
            </div>

            <div className="why-illu">
              <Image
                src="/screens/tiroir-user-zen.png"
                alt="Illustration Tiroir utilisateur zen"
                width={800}
                height={480}
                sizes="(max-width: 900px) 90vw, 480px"
                style={{ width: '100%', height: 'auto', objectFit: 'contain', borderRadius: 16 }}
                priority
              />
            </div>
          </div>

          <style jsx>{`
            .why :global(.grid-2) {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
              align-items: center;
            }
            .why-illu {
              max-width: 520px;
              width: 100%;
              margin: 0 auto;
              overflow: hidden; /* évite tout débordement */
              border-radius: 16px;
            }

            @media (max-width: 900px) {
              .why :global(.grid-2) {
                grid-template-columns: 1fr;  /* pile verticale */
                gap: 16px;
              }
              .why-illu {
                max-width: min(520px, 92vw); /* reste dans l’écran */
              }
            }
          `}</style>
        </section>

        {/* <Features /> */}
        {/* <KeyFeatures plateColor="#F6EDE0" features={features} /> */}
        {/* Ancre pour le lien "Fonctionnalités" du footer */}
        <div id="features">
          <KeyFeatures plateColor="#F6EDE0" features={features} />
        </div>
        <UseCases />
        <Testimonials />
        <Principles />
        <FinalCTA onJoin={() => setOpen(true)} />
      </main>

      <footer className="footer">
        <div className="container" style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <div style={{width:28, height:28, background:"var(--orange)", borderRadius:8}} />
            <span>© {new Date().getFullYear()} Tiroir</span>
          </div>
          <div style={{display:"flex", gap:12}}>
            <a href="mailto:hello@tiroir.com">Contact</a>
            <a href="#features">Fonctionnalités</a>
          </div>
        </div>
      </footer>

      {/* Modale simple pour l’email (optionnel) */}
      {open && (
        <div onClick={() => setOpen(false)} style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"grid", placeItems:"center", zIndex:50}}>
          <div onClick={(e)=>e.stopPropagation()} className="card" style={{padding:16, width:"min(480px, 92vw)"}}>
            <button onClick={()=>setOpen(false)} style={{float:"right"}}>✕</button>
            <h3 className="h2" style={{fontSize:22}}>Rejoindre la beta</h3>

            {/* ⬇️ remplace l'ancien <form …> par ceci */}
            <BetaSignupForm endpoint="/api/waitlist" redirectOnSuccess />

            <p className="p" style={{fontSize:12, marginTop:8}}>
              Pas de spam. Un seul email pour l’accès.
            </p>
          </div>
        </div>
      )}
    </>
  )
}