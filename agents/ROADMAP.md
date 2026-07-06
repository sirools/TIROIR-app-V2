# Roadmap Tiroir V2/V3 — Document de référence agents

## Produit
App mobile iOS d'inventaire personnel, photo-first et IA-native.
Flux principal : Photo -> IA analyse -> fiche proposée -> utilisateur valide -> objet privé retrouvable, partageable et exportable.

Positionnement en évolution :
- Court terme : inventaire personnel intelligent, utile et rassurant.
- Moyen terme : inventaire actionnable pour particuliers sérieux, collectionneurs, assurance, maison, dressing, créatifs.
- Long terme : couche de capture/structuration des objets physiques pour usages Pro/B2B, sans devenir ERP.

Garde-fou produit : chaque nouvelle fonctionnalité doit servir au moins une intention claire : **capturer, retrouver, décider, transmettre, exporter**.

## État produit actuel — 2026-07-06
Tiroir supporte déjà un socle nettement plus avancé que le MVP initial :

- Auth : login, register, mot de passe oublié.
- Capture IA : draft photo, upload, Edge Function `chat-turn`, analyse Claude Vision, fiche proposée.
- Objets : création, détail riche, édition inline, statut, emplacement, attributs, valeur, assurance.
- Collections : liste, détail, icône/couleur, rangement.
- Recherche : page recherche + RPC full-text/fuzzy.
- Photos : bucket privé, images signées, retouche photo IA premium.
- Documents : documents associés aux objets.
- Valeur / assurance : estimation IA, valeur utilisateur, champs assurance.
- Partage : liens publics, mot de passe, expiration, export CSV.
- Premium : RevenueCat, paywall, quotas free/premium, assistant premium.
- Admin : dashboard, quotas, coûts IA, simulation économique, premières hypothèses business.

Manques critiques à garder visibles :
- Onboarding orienté usage/persona.
- Export PDF propre pour assurance, famille, client, studio.
- Sélections temporaires actionnables.
- Templates métier légers.
- Vue `À traiter`.
- Observabilité usage/coûts IA réelle.
- Durcissement sécurité des partages.
- Packaging clair Free / Premium / Pro / Entreprise.

## Phase 1 — Produit complet
- [x] ~~1.1 Déployer Edge Function `chat-turn` (Alice) — appel Claude Vision, passage draft uploading->pending~~
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
- [ ] 2.2 **Page ajout objet** — redesign par agent IA senior UI designer : flow affordant, illustré, potentiellement animé
- [ ] 2.3 **Vue grille — contrôle de densité** — nombre de cartes par ligne (1 / 2 / 3), persisté en préférence utilisateur
- [x] ~~2.4 **Sélection multiple + export CSV** — mode de sélection, export des champs clés~~

## Phase 2.5 — Valeur rapide avant V3
Objectif : ajouter de la valeur perceptible et monétisable sans lancer un gros chantier B2B.

- [ ] 2.5.1 **Export PDF objet / collection** — PDF propre pour assurance, famille, vente, client ou inventaire personnel.
- [ ] 2.5.2 **Sélections temporaires** — liste d'objets avec objectif : vendre, assurer, montrer, traiter, transmettre.
- [ ] 2.5.3 **Onboarding par usage** — maison, dressing, collection, assurance, studio, commerce/pro.
- [ ] 2.5.4 **Templates de champs légers** — livre, cave, dressing, matériel, objet de valeur, studio.
- [ ] 2.5.5 **Vue `À traiter`** — objets sans photo, sans valeur, sans document, à vendre, à estimer, à vérifier.
- [ ] 2.5.6 **Paywall contextualisé** — upsell au moment du besoin : export, retouche, estimation, documents, quota.
- [ ] 2.5.7 **Sécurité partage V2** — tokens longs, cookies signés HMAC, rate limit verify/export, policy `share_links` moins ouverte.

## Phase 3 — Qualité & robustesse
- [ ] 3.1 États de réseau — mode offline graceful, retry automatique, timeout.
- [ ] 3.2 Onboarding premier lancement — écran de bienvenue si aucun objet.
- [ ] 3.3 Design pass global — cohérence spacing/radius/typo sur tous les écrans.
- [ ] 3.4 Test sur device physique iOS — signaler tout comportement différent du simulateur.
- [ ] 3.5 Observabilité usage réel — events structurés : feature, plan, coût estimé, erreurs, activation, conversion.
- [ ] 3.6 Tracking coûts IA réel — tokens/usage/cost par Edge Function quand possible.
- [ ] 3.7 Alertes admin — coût IA, storage, taux erreur Edge Functions, quotas dépassés.

## Phase 4 — App Store
- [ ] 4.1 Icône et splash screen définitifs.
- [ ] 4.2 Privacy Policy hébergée.
- [ ] 4.3 Build EAS production : `eas build --platform ios --profile production`.
- [ ] 4.4 Screenshots App Store (6.7", 5.5").
- [ ] 4.5 Soumission App Store Connect.

## Contraintes techniques immuables
- TypeScript strict — `npx tsc --noEmit` doit passer avant toute livraison.
- Jamais de `service_role` dans le client mobile.
- Routes Expo Router : forme courte (`/capture`, `/objects/[id]`).
- Upload iOS : expo-file-system/legacy + base64 -> Uint8Array.
- Upload Web : `fetch(uri).blob()`.
- Design tokens dans `mobile/src/components/ui/tokens.ts` — ne pas surcharger inline.

## Phase 5 — Expérience agentique vocale
> Analyse technique complète rédigée par Alice (2026-06-25). À NE PAS implémenter avant d'avoir un prototype design validé.

- [ ] 5.0 Agent design : maquettes haute fidélité de l'expérience conversationnelle.
- [ ] 5.1 Agent motion : prototype interactif animé du flux complet.
- [ ] 5.2 Migration `010_create_object_rpc.sql` — RPC `create_object` SECURITY DEFINER.
- [ ] 5.3 Edge Function `transcribe` — proxy Whisper OpenAI.
- [ ] 5.4 Edge Function `converse` — orchestrateur Claude tool use.
- [ ] 5.5 Service + hook `useConversation` + `useVoiceInput` côté mobile.
- [ ] 5.6 Écran `(app)/chat.tsx` + CTA "Dicter à la voix" sur la home.

## Roadmap V3 — Inventaire actionnable et packaging business
> Direction issue des réflexions produit/business du 2026-07-06. À utiliser pour prioriser après stabilisation V2/App Store.

### V3.0 — Inventaire actionnable
Objectif : transformer l'inventaire d'une base d'objets en outil utile pour décider, partager et transmettre.

- [ ] Onboarding par usage/persona.
- [ ] Sélections temporaires avec objectif.
- [ ] Export PDF propre objet / collection / sélection.
- [ ] Vue `À traiter`.
- [ ] Templates de champs légers.
- [ ] Assistant inventaire limité à recherche, filtres, synthèses et exports.
- [ ] Rapport assurance / collection en première version.

### V3.1 — Premium plus évident
Objectif : rendre l'abonnement B2C compréhensible et désirable sans complexifier l'app.

- [ ] Documents/factures mieux valorisés dans la fiche objet.
- [ ] Estimation valeur plus visible et explicable.
- [ ] Retouche photo mieux intégrée au workflow objet.
- [ ] Quotas lisibles dans profil/capture/paywall.
- [ ] Paywall contextualisé par action.
- [ ] Bundles premium : assurance, famille, collection, dressing.

### V3.2 — Pro léger
Objectif : tester la monétisation 19-49 EUR/mois pour indépendants, créatifs, petits commerces et pros avec stock visuel.

- [ ] Templates métier : studio, livres, cave, matériel, objets à vendre.
- [ ] Champs personnalisés par collection ou sélection.
- [ ] Exports CSV/PDF avancés.
- [ ] Partage client plus propre.
- [ ] Google Sheets / Airtable manuel ou semi-auto.
- [ ] Mode catalogue simple.
- [ ] Premières métriques par usage : objets créés, exports, partages, temps gagné estimé.

### V3.3 — B2B / Studio / Entreprise
Objectif : préparer la plateforme pour équipes, intégrations et workflows métier seulement après preuve d'intérêt Pro.

- [ ] Workspaces / espaces partagés.
- [ ] Membres et rôles simples.
- [ ] Audit log.
- [ ] Webhooks.
- [ ] API privée.
- [ ] Connecteurs métier : Sheets, Airtable, Shopify/WooCommerce/Prestashop selon traction.
- [ ] Volumes custom et quotas par plan.
- [ ] Support/onboarding B2B.

## Packaging business cible
À garder comme hypothèse, pas comme vérité figée.

- **Free** : découverte, objets/analyses/photos limités, recherche simple.
- **Premium B2C — 6,99 EUR/mois** : inventaire personnel sérieux, objets/photos/IA plus confortables, documents, estimation, retouche, exports.
- **Pro — 19-29 EUR/mois** : templates métier, exports avancés, champs personnalisés, partage client, quotas élevés.
- **Studio / Business — 49-99 EUR/mois** : petites équipes, espaces, exports brandés, connecteurs simples.
- **Entreprise / API — 149+ EUR/mois** : intégrations, API/webhooks, volumes custom, support, sécurité contractuelle.

## Personas payeurs à investiguer
Prioriser des profils digital natives, 28-45 ans, indépendants/dirigeants/responsables opérationnels, déjà équipés d'outils comme Notion, Airtable, Google Drive, Sheets, Shopify, Instagram.

Profils prioritaires :
- Créatif-organisateur : styliste, décorateur, set designer, photographe, costumier, DA indépendant.
- Petit commerçant digitalisé : libraire d'occasion, brocanteur, concept store, épicerie fine, créateur avec stock.
- Chef de petite structure matérielle : atelier, studio, location, artisan, restaurant côté cave/matériel.
- Particulier patrimonial premium : collection, assurance, succession, maison familiale.

Signal fort à chercher en entretien : la personne montre spontanément son système bricolé actuel (Photos, Notes, WhatsApp, Notion, Drive, Sheets, Airtable). Si un bricolage existe déjà, Tiroir remplace une douleur existante au lieu de créer un besoin.

## Agents spécialisés à mobiliser
Ne pas lancer ces agents pour tout coder immédiatement. Les utiliser d'abord pour cadrage, faisabilité et risques.

- **Agent produit / UX research** : personas, scripts d'entretien, signaux de craving, segmentation.
- **Agent mobile UX** : onboarding usage, sélections temporaires, export, assistant contextualisé.
- **Agent architecture Supabase** : sécurité RLS/storage/share links, workspaces, multi-tenant futur.
- **Agent IA / coûts** : tracking tokens, coût par feature, limites, retries, observabilité.
- **Agent B2B intégrations** : CSV, Google Sheets, Airtable, webhooks, Shopify/WooCommerce/Prestashop.
- **Agent pricing / packaging** : Free/Premium/Pro/Entreprise, feature gates, quotas.

## Chantiers techniques structurants
Ces chantiers préparent le passage vers Pro/B2B sans surconstruire trop tôt.

1. **Sécurité partages**
   - Tokens longs.
   - Cookies signés HMAC avec secret serveur.
   - Rate limit verify/export.
   - Réduire les accès publics directs à `share_links`.

2. **Modèle multi-offres**
   - Plan Free/Premium/Pro/Team/Enterprise.
   - Quotas par plan.
   - Tables subscription/entitlements si RevenueCat ne suffit plus.

3. **Observabilité usage/coûts**
   - Events structurés.
   - Coût IA par action.
   - Tokens et erreurs par Edge Function.
   - Dashboard admin fiable.

4. **Exports robustes**
   - PDF serveur.
   - CSV stable.
   - Exports async si gros volumes.
   - Templates de rapports.

5. **Templates / schéma dynamique**
   - Templates de champs par usage.
   - Champs personnalisés sans casser `objects.attributes`.
   - Validation simple des données exportées.

6. **Workspaces / équipes**
   - À reporter tant que le besoin Pro n'est pas confirmé.
   - Prévoir modèle `workspace`, `members`, `roles`, ownership partagé.

7. **Connecteurs**
   - D'abord CSV/Sheets.
   - Puis webhooks.
   - Puis vraies APIs selon traction.

8. **Fiabilité infra**
   - Logs Edge Functions.
   - Alertes erreurs IA.
   - Alertes storage/coûts.
   - Stratégie retry et mode dégradé.

## Boussole produit V3+ — Tiroir collaboratif et interrogeable
> Vision long terme issue des explorations produit. À garder comme direction, pas comme scope immédiat.

Tiroir peut évoluer d'un inventaire personnel vers un inventaire visuel collaboratif que l'on peut interroger naturellement. La promesse ne doit pas devenir "un chatbot dans Tiroir", mais plutôt : **Tiroir sait ce qu'il contient et on peut lui demander directement.**

Principes :
- Garder une interface visuelle, camera-first et objet-first.
- Utiliser `Demander à Tiroir...` comme couche transversale de recherche, filtre, synthèse, export et coordination.
- L'agent doit réduire la complexité, pas la masquer.
- Les actions fréquentes doivent rester visibles sans IA : capturer, retrouver, voir les objets à traiter, exporter, partager.
- Ne pas transformer Tiroir en dashboard, Trello, Notion ou outil de gestion lourd.

Exemples de demandes cibles :
- "Où est rangée la pendule dorée ?"
- "Quels objets sont à vendre ?"
- "Que faut-il vérifier ?"
- "Combien avons-nous de vases ?"
- "Prépare un export PDF pour l'assurance."
- "Résume ce Tiroir."
- "Quels objets Paul doit traiter ?"

## Chantier en cours
_Mis à jour à chaque session._

Dernier état (2026-07-06) : le socle V2 est avancé : capture IA, objets, collections, recherche, partage, export CSV, estimation valeur, documents, retouche photo IA, quotas, paywall, admin dashboard et simulation économique. La réflexion business a clarifié une trajectoire Free/Premium/Pro/Entreprise et une V3 centrée sur l'inventaire actionnable.

Prochains chantiers prioritaires recommandés :
1. Sécurité partages V2.
2. Export PDF objet/collection/sélection.
3. Onboarding par usage.
4. Sélections temporaires.
5. Templates de champs légers.
6. Observabilité usage/coûts IA.
7. Entretiens UX personas payeurs.

⚠️ **Plusieurs agents IA travaillent sur ce repo en parallèle (Claude + Codex), sans coordination automatique.** Avant de commencer une session, checke `git log --oneline -15` pour voir ce qui vient d'être fait.

Dette connue :
- `components/SharedLinkPage.tsx` référence un chemin `features/objects` obsolète.
- Certaines pages marketing peuvent encore déclencher des erreurs ESLint `react/no-unescaped-entities`.
- Ne pas implémenter la collaboration lourde avant validation du MVP individuel, des exports simples et d'une demande Pro réelle.
