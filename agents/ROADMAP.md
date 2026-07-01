# Roadmap Tiroir V2 — Document de référence agents

## Produit
App mobile iOS d'inventaire personnel.
Flux principal : Photo → IA analyse → fiche proposée → utilisateur valide → objet privé retrouvable.
Pas de marketplace, partage, prêt, vente, collaboration, stats.

## Phase 1 — Produit complet
- [x] ~~1.1 Déployer Edge Function `chat-turn` (Alice) — appel Claude Vision, passage draft uploading→pending~~
- [x] ~~1.2 Brancher `SupabaseAssistantService` dans l'app (Bob) — remplacer MockAssistantService~~
- [x] ~~1.3 Écran édition objet (Bob) — modifier titre, description, collection, emplacement~~
- [x] ~~1.4 Gestion collections (Bob) — renommer, supprimer, voir les objets d'une collection~~
- [ ] 1.5 Profil utilisateur — changer prénom, mot de passe oublié / magic link
- [x] ~~1.6 Affichage photos dans les fiches (Bob) — grille images signées sur fiche objet~~

## Phase 1.5 — UX & design livrés hors roadmap initiale
- [x] ~~Refonte écran détail objet — hero image, résumé IA, metric cards~~
- [x] ~~Édition inline sur la fiche — collection, statut, description, attributs, emplacement en briques~~
- [x] ~~Navbar redesign — pill flottante, icônes custom dessinées en View~~
- [x] ~~Fix alignement vertical icônes navbar~~
- [x] ~~Collections — picker emoji + couleur pastel (liste + détail)~~
- [x] ~~Persistance icône collection — cache module-level, mise à jour optimiste cross-screen~~

## Phase 2 — Fonctionnalités prioritaires
- [ ] 2.1 **Page recherche** — afficher par défaut les 10 derniers objets ajoutés + bouton "Charger plus" ; recherche full-text existante conservée
- [ ] 2.2 **Page ajout objet** — redesign par agent IA senior UI designer : flow affordant, illustré, potentiellement animé (à spécifier)
- [ ] 2.3 **Vue grille — contrôle de densité** — module de contrôle du nombre de cartes par ligne (1 / 2 / 3), persisté en préférence utilisateur
- [ ] 2.4 **Sélection multiple + export CSV** — mode de sélection sur la liste/grille, export des champs clés (titre, collection, statut, emplacement, attributs)

## Phase 3 — Qualité & robustesse
- [ ] 3.1 États de réseau — mode offline graceful, retry automatique, timeout
- [ ] 3.2 Onboarding premier lancement — écran de bienvenue si aucun objet
- [ ] 3.3 Design pass global — cohérence spacing/radius/typo sur tous les écrans
- [ ] 3.4 Test sur device physique iOS — signaler tout comportement différent du simulateur

## Phase 4 — App Store
- [ ] 4.1 Icône et splash screen définitifs
- [ ] 4.2 Privacy Policy hébergée
- [ ] 4.3 Build EAS production : `eas build --platform ios --profile production`
- [ ] 4.4 Screenshots App Store (6.7", 5.5")
- [ ] 4.5 Soumission App Store Connect

## Contraintes techniques immuables
- TypeScript strict — `npx tsc --noEmit` doit passer avant toute livraison
- Jamais de `service_role` dans le client mobile
- Routes Expo Router : forme courte (`/capture`, `/objects/[id]`)
- Upload iOS : expo-file-system/legacy + base64 → Uint8Array
- Upload Web : `fetch(uri).blob()`
- Design tokens dans `mobile/src/components/ui/tokens.ts` — ne pas surcharger inline

## Phase 5 — Expérience agentique vocale (version avancée — à planifier)
> Analyse technique complète rédigée par Alice (2026-06-25). À NE PAS implémenter avant d'avoir un prototype design validé.
- [ ] 5.0 Agent design : maquettes haute fidélité de l'expérience conversationnelle (écran chat, bulles, cards inline, états micro)
- [ ] 5.1 Agent motion : prototype interactif animé du flux complet (home → "Dicter" → conversation → résultat)
- [ ] 5.2 Migration `010_create_object_rpc.sql` — RPC `create_object` SECURITY DEFINER
- [ ] 5.3 Edge Function `transcribe` — proxy Whisper OpenAI (audio M4A → texte)
- [ ] 5.4 Edge Function `converse` — orchestrateur Claude tool use (search / create / patch)
- [ ] 5.5 Service + hook `useConversation` + `useVoiceInput` côté mobile
- [ ] 5.6 Écran `(app)/chat.tsx` + CTA "Dicter à la voix" sur la home

## Boussole produit V3+ — Tiroir collaboratif et interrogeable
> Vision long terme issue des explorations produit du 2026-07-01. À garder comme direction, pas comme scope MVP.

Tiroir peut évoluer d'un inventaire personnel vers un inventaire visuel collaboratif que l'on peut interroger naturellement. La promesse ne doit pas devenir "un chatbot dans Tiroir", mais plutôt : **Tiroir sait ce qu'il contient et on peut lui demander directement.**

### Principe UX central
- Garder une interface visuelle, camera-first et objet-first.
- Utiliser `Demander à Tiroir...` comme couche transversale de recherche, filtre, synthèse, export et coordination.
- L'agent doit réduire la complexité, pas la masquer.
- Les actions fréquentes doivent rester visibles sans IA : capturer, retrouver, voir les objets à traiter, exporter, partager.
- Ne pas transformer Tiroir en dashboard, Trello, Notion ou outil de gestion lourd.

### Formule produit à préserver
Camera + inventaire visuel + couche intelligente `Demander à Tiroir...`.

Exemples de demandes cibles :
- "Où est rangée la pendule dorée ?"
- "Quels objets sont à vendre ?"
- "Que faut-il vérifier ?"
- "Combien avons-nous de vases ?"
- "Prépare un export PDF pour l'assurance."
- "Résume ce Tiroir."
- "Quels objets Paul doit traiter ?"

### Parallèle Tricount à retenir
Tricount simplifie une situation collective confuse en trois actions : ajouter une dépense, voir qui doit quoi, régler.

L'équivalent Tiroir collaboratif doit rester aussi simple :
- Ajouter un objet.
- Décider quoi en faire.
- Suivre ce qui reste à traiter.

Ne pas construire "Tricount + Trello + Notion pour objets". La bonne direction est plutôt : **le Tricount des objets partagés : chacun ajoute, tout le monde voit, on décide sans se perdre.**

### Étapes à suivre, version MVP-compatible
- [ ] Garder une home visuelle simple : grille d'objets, statuts visibles, bouton capture.
- [ ] Ajouter progressivement un input `Demander à Tiroir...` limité à la recherche naturelle et aux filtres simples.
- [ ] Structurer les fiches objets autour de photo, titre, description, tags/statuts, emplacement, notes.
- [ ] Créer une vue `À traiter` simple, regroupée par statuts : à vendre, à estimer, fragile, à vérifier.
- [ ] Prévoir un premier export propre : PDF ou lien web partageable, même non éditable au départ.
- [ ] Reporter la collaboration temps réel, les assignations, commentaires, rôles et permissions avancées après validation de l'usage individuel.

### Garde-fou
Chaque nouvelle fonctionnalité doit répondre à une des trois intentions : capturer, décider, transmettre. Sinon elle sort du scope.

## Chantier en cours
_Mis à jour à chaque session._
Dernier état (2026-07-01) : Phase 1 complète + refonte UX/design majeure livrée (détail objet, navbar, collections, flow capture). Exploration produit V3+ ajoutée : Tiroir collaboratif, camera-first, avec couche `Demander à Tiroir...`.
Prochains chantiers prioritaires : 2.1 page recherche → 2.2 redesign ajout objet ✓ → 2.3 contrôle grille → 2.4 sélection multiple CSV.

⚠️ **Plusieurs agents IA travaillent sur ce repo en parallèle (Claude + Codex), sans coordination automatique.** Avant de commencer une session, checke `git log --oneline -15` pour voir ce qui vient d'être fait. État connu au 2026-07-01 :
- Sélection multiple + export CSV (2.4) : fonctionnel côté web (`web/pages/api/shares/[token]/export.csv.ts`) et mobile (`SharePanel.tsx`, `collections/[id].tsx` — toggle tout sélectionner/désélectionner ajouté).
- Protection par mot de passe des partages publics (`web/pages/s/[token]*`) : corrigée et vérifiée (elle était décorative avant, cf. `web/pages/api/shares/[token]/verify.ts`). L'export CSV respecte maintenant aussi ce mot de passe (cookie signé partagé, plus de blocage 403 systématique).
- Dette connue, non liée aux chantiers ci-dessus : `components/SharedLinkPage.tsx` référence un chemin `features/objects` obsolète (erreurs tsc), ESLint `react/no-unescaped-entities` sur les pages marketing. Ne pas confondre avec une régression du jour.
Phase 5 / V3+ : en attente de prototype design validé. Ne pas implémenter la collaboration lourde avant validation du MVP individuel et des exports simples.
