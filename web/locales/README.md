# Textes du site — langues et ton

## Langues

Les langues de Tiroir sont **fr, en, es, de et pt**. Le site en sert quatre :
fr (référence, sans préfixe), en, es, de. Le portugais n'existe que dans
l'app pour l'instant ; le jour où le site l'ouvre, il suit la même règle de
ton. Liste dans `lib/localeRouting.ts` (`LOCALES`) et `next.config.js`
(`i18n.locales`) : les deux doivent rester identiques.

## Ton : tu ou vous

Règle décidée par le fondateur (2026-11-08) :

- **Tutoiement** pour tout ce qui s'adresse au grand public, c'est-à-dire
  l'offre gratuite : la landing, le compte, les partages, les erreurs.
- **Vouvoiement** pour tout ce qui concerne **Premium, Pro et Business** :
  les cartes de ces formules, leurs boutons, leurs conditions
  d'abonnement et de résiliation.

Elle s'applique à chaque langue qui distingue les deux : français (tu /
vous), espagnol (tú / usted), allemand (du / Sie), portugais (tu ou você /
o senhor). L'anglais n'a qu'une forme.

En cas de doute, la question est : ce texte parle-t-il d'une formule
payante (Premium, Pro, Business) ? Oui → vous. Non → tu.

| Texte | Ton |
| --- | --- |
| `layout` (en-tête, pied de page) | tu |
| `home` : meta, hero, photo, pros, everyone, value, faq, final | tu |
| `home.pricing` : titre, `sub` (passer à la formule supérieure), `plans.free` | tu |
| `home.pricing` : `plans.premium`, `plans.pro`, `plans.business` | vous |
| `pricing` : meta, titre, sous-titre, `free`, `credits` (sans abonnement), `final` | tu |
| `pricing` : `premium`, `pro`, `business`, `note` (prix des formules), FAQ « Puis-je résilier ? » | vous |
| `pricing` : les autres questions de la FAQ (actions IA, quota, partenaires) | tu |
| `errors` | tu |
| `share` (pages ouvertes par les destinataires d'un partage) | tu |
| `account` (connexion, inscription, mot de passe, profil, mes partages, désinscription) | tu |
| `about` | tu |
| `messages` (messagerie privée : contacter le vendeur, boîte de réception, fil, e-mails) | tu |
| Pages juridiques (`components/legal/`) | vous, documents contractuels qui couvrent aussi les formules payantes |

Cas tranchés par le fondateur (2026-11-08) :

- « Pour les créatifs et les pros » (`home.pros`) parle de métiers, pas
  de la formule Pro : tu.
- `home.pricing.sub` (« Passe à la formule supérieure… ») : tu, pour que
  la section Tarifs de la landing garde un seul ton.
- La page À propos : tu.
- Les pages juridiques : vous.

## Modifier un texte

Le français fait référence : en, es, de suivent exactement sa structure
(type `Copy`, `ShareCopy`…). Un texte qui change de ton change dans toutes
les langues qui distinguent tu et vous.
