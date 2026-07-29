// Le panorama bento seul, sans la partie rédactionnelle.
//
// Sert à travailler la séquence isolément — la version en production est
// en tête de /concept, suivie de la documentation détaillée.
import Head from 'next/head'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import BentoPanorama from '../components/concept/BentoPanorama'

export default function ConceptBento() {
  return (
    <>
      <Head>
        <title>Concept — panorama</title>
        <meta name="robots" content="noindex" />
        <meta
          name="description"
          content="Le fonctionnement de Tiroir, panneau par panneau : capture, analyse, volume, cycle de vie, valeur, partage."
        />
      </Head>

      <HeaderTiroirWeb />
      <main>
        <BentoPanorama />
      </main>
      <FooterTiroirWeb />
    </>
  )
}
