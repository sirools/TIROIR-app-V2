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

## Chantier en cours
_Mis à jour à chaque session._
Dernier état (2026-06-25) : Phase 1 complète + refonte UX/design majeure livrée (détail objet, navbar, collections, flow capture).
Prochains chantiers prioritaires : 2.1 page recherche → 2.2 redesign ajout objet ✓ → 2.3 contrôle grille → 2.4 sélection multiple CSV.
Phase 5 (agentique vocal) : en attente de prototype design avant toute implémentation.
