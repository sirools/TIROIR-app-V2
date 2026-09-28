# Torix et Tiroir — stratégie IA, passage à l'échelle et gouvernance

> Document de référence du fondateur. Rédigé le 2026-09-28.
> Les chiffres marqués *estimé* sont des ordres de grandeur ; les chiffres
> réels sont dans la table `ai_usage` et sur le tableau de bord `/admin`.
> À relire avant chaque décision d'infrastructure IA, de recrutement ou
> d'association.

---

## 1. En une phrase

Tiroir ne peut ni ne doit se passer totalement des fournisseurs d'IA dans
les prochains mois. L'objectif est une **dépendance maîtrisée** : aucun
fournisseur indispensable, et la plupart des demandes qui ne coûtent aucun
token. **Torix est cette couche** : la voix de Tiroir, et l'aiguilleur qui
décide, pour chaque demande, si elle mérite de coûter quelque chose.

---

## 2. Gouvernance : qui possède quoi

| | Tiroir | Torix |
|---|---|---|
| Nature | Le produit : inventaire, partage, abonnements | L'IA : identité, charte, aiguillage, mémoire, et plus tard un modèle spécialisé |
| Qui le pilote | Le fondateur et deux personnes de confiance (projet de PME à trois) | **Le fondateur seul, en permanence** |
| Propriété | La société | Le fondateur (déclaration dans `web/components/torix/ownership.ts`) |

### Conséquences à organiser *avant* d'associer quelqu'un

1. **Contrat de licence Torix → Tiroir.** Si Torix appartient au fondateur
   et que la société l'utilise, il faut un contrat de licence entre le
   fondateur et la société : périmètre, durée, rémunération éventuelle,
   ce qui se passe si le fondateur quitte la société ou si la société est
   vendue. Sans ce contrat, l'usage de Torix par la société est flou, et
   c'est précisément ce qu'un associé ou un acheteur regardera.
2. **Pacte d'associés.** Il doit dire explicitement que Torix n'est pas un
   apport à la société, et qui décide de quoi entre les trois.
3. **Accès technique réservé.** Aujourd'hui, le Torix Lab est ouvert à
   *tous* les comptes `is_admin`. Dès que les associés deviendront admins
   de Tiroir, ils verront Torix. Il faut une garde propre au fondateur
   (identifiant du fondateur vérifié côté serveur), distincte du rôle
   admin, **avant** de leur donner l'accès admin.
4. **Secrets.** Les clés des fournisseurs d'IA et la configuration de Torix
   ne doivent être accessibles qu'au fondateur. Les associés gèrent Tiroir
   sans avoir la main sur Torix.

---

## 3. Ce que Tiroir consomme aujourd'hui (état au 2026-09-28)

| Fonction (Edge Function) | Modèle | Coût par appel |
|---|---|---|
| `detect-scene` — analyse de scène | Claude Haiku 4.5 ; Sonnet 5 / Opus 5 selon le forfait | 0,74 c / 4,2 c / 12,5 c (mesuré) |
| `describe-object` — fiche objet | Claude Haiku 4.5 | 0,15 c (mesuré) |
| `chat-turn` — analyse des brouillons | Claude Haiku 4.5 | ~0,2 c (*estimé*) |
| `assistant-chat` — assistant | Claude Haiku 4.5 | ~0,1 c / message (*estimé*) |
| **`estimate-value` — estimation de valeur** | **Claude Sonnet 4.6 + recherche web** | **~5 à 10 c (*estimé, non mesuré*)** |
| **`enhance-object-photo`, `scene-thumbnail` — images** | **Gemini 2.5 Flash Image** | **3,9 c / image** |

Fournisseurs : **Anthropic (Claude) et Google (Gemini)**. Ni Midjourney ni
DALL·E. Postes les plus chers : les images Gemini et l'estimation de
valeur. Garde-fous déjà en place : quotas pondérés par coût, alerte de
dépense réglable dans `/admin`.

---

## 4. Ordre de grandeur à 150 000 inscrits (*estimé*)

Hypothèses : 30 % d'actifs mensuels (45 000), dont 5 % payants.

| Profil | Usage mensuel type | Coût / personne | Total |
|---|---|---|---|
| Gratuits actifs (~42 750) | 5 scènes, 2 fiches, 1 estimation, 10 messages | ~0,12 $ | ~5 100 $ |
| Payants (~2 250) | usage soutenu, images comprises | ~1,50 $ | ~3 400 $ |
| **Total** | | | **~8 500 $/mois** |

En face : 2 250 abonnés Premium ≈ 15 700 €/mois (avant commission des
stores). Le modèle tient **si la conversion suit** ; le risque, c'est le
gratuit en masse — les quotas plafonnent le pire cas, qui sinon se
chiffrerait en dizaines de milliers de dollars par mois.

**Autre risque d'échelle, souvent oublié : les plafonds de débit** des
fournisseurs (requêtes par minute, par niveau de compte). Un lancement
réussi peut les heurter avant le budget.

---

## 5. Torix, l'aiguilleur

Chaque demande passe par Torix, qui essaie dans cet ordre — le premier
qui sait répondre gagne :

| Niveau | Qui répond | Coût |
|---|---|---|
| 1 | **Mémoire collective** — objet déjà identifié ou estimé | 0 |
| 2 | **Le téléphone** — détourage, redimensionnement, lecture de texte | 0 |
| 3 | **Torix déterministe** — questions fréquentes, règles | 0 |
| 4 | Petit modèle (Haiku, ou modèle ouvert plus tard) | ~0,1–0,7 c |
| 5 | Gros modèle, seulement si le petit n'est pas sûr | quelques c |

Le fournisseur devient une prise interchangeable tout en bas. Ce qui
appartient au fondateur est au-dessus : l'identité, la charte, l'aiguillage
et la mémoire collective.

---

## 6. Leviers d'économie (gain / effort)

1. **Détourage sur le téléphone** (iOS le fait gratuitement) au lieu de
   Gemini à 3,9 c — Gemini réservé aux illustrations générées.
   *Probablement le plus gros gain.*
2. **Mémoire collective des estimations** : un iPhone 13, un Levi's 501, une
   Switch reviennent sans cesse. Réutiliser une estimation quelques
   semaines, sans donnée personnelle. *Gain possible 50–70 % sur le poste
   le plus cher, à mesurer.*
3. **Photos réduites avant envoi** (~1000 px) : le coût d'une image suit ses
   pixels. *À vérifier : l'app mobile réduit peut-être déjà.*
4. **Cache de consigne Anthropic** : consignes répétées facturées à 10 %.
   Prévu dans `_shared/aiUsage.ts`, pas encore activé.
5. **Traitement différé (Batch API, −50 %)** pour le non-urgent.
6. **Réponses plus courtes** : la sortie coûte 5× l'entrée ; l'analyse de
   scène autorise 8 000 tokens de réponse.
7. **Torix sans modèle** pour les questions fréquentes de l'assistant.

Objectif réaliste : **diviser la facture par 2 à 3** (~3 000–4 000 $/mois
dans le scénario ci-dessus).

---

## 7. Le rythme

Chaque phase est **conditionnée aux chiffres réels**, pas aux projections.

### Phase 0 — avant la vague (dès maintenant, ~2 semaines) : se protéger
- Demander le relèvement des plafonds de débit (Anthropic, Google).
- Vérifier les limites du forfait Supabase.
- Détourage sur le téléphone, photos réduites, cache de consigne.
- Mémoire collective des estimations.
- Mesurer le coût réel de `estimate-value`.

### Phase 1 — pendant la montée (mois 1–2) : Torix devient l'aiguilleur
- Une seule porte d'entrée IA dans le code, un adaptateur par fournisseur ;
  choix du modèle par fonction depuis `/admin`, sans redéployer ; bascule
  automatique si un fournisseur tombe.
- Torix prend la voix de l'assistant, avec sa mémoire
  (`web/components/torix/memory.ts`) et ses commandements.
- Réponses sans modèle pour les questions fréquentes.

### Phase 2 — une fois le volume là (mois 3–6) : Torix apprend
- Les corrections des utilisateurs sur leurs fiches deviennent des données
  d'entraînement — **à prévoir dans les CGU, avec consentement**.
- Tester des modèles ouverts sur les données de Tiroir pour les tâches
  simples et massives (identifier, classer).
- Héberger son propre modèle **seulement si rentable** : un GPU permanent
  coûte ~1 000–1 500 $/mois ; ne vaut que pour une tâche qui coûte déjà
  plusieurs milliers de dollars par mois en API.
- Le modèle spécialisé de Torix, affiné sur les données de Tiroir,
  appartient alors réellement au fondateur.

---

## 8. Qui contacter, et quand

| Moment | Qui | Pour quoi |
|---|---|---|
| Phase 0, maintenant | Support / commercial **Anthropic** | Relever le niveau de débit de l'API ; tarifs volume |
| Phase 0, maintenant | **Google Cloud** (Gemini) | Quotas de génération d'images |
| Phase 0, maintenant | **Supabase** | Forfait adapté à 100 000+ comptes (base, stockage, fonctions) |
| Avant d'associer quelqu'un | **Avocat en propriété intellectuelle** | Références du brevet et du copyright, contrat de licence Torix → Tiroir, clause des CGU sur les données d'entraînement |
| Avant d'associer quelqu'un | **Expert-comptable / avocat d'affaires** | Forme de la société (PME), statuts, pacte d'associés excluant Torix des apports |
| Phase 2 | Hébergeur GPU / spécialiste ML | Seulement si un poste API dépasse plusieurs milliers de dollars par mois |

---

## 9. Mises en garde

- L'hypothèse de 100 000 à 200 000 utilisateurs en un ou deux mois est
  ambitieuse : avancer de phase en phase sur les chiffres de `ai_usage`.
- Les coûts non mesurés (estimation de valeur surtout) sont les premiers à
  mesurer.
- La propriété de Torix couvre ce que le fondateur a créé (nom, identité,
  orbe, charte, code, aiguillage, mémoire, futur modèle affiné) — pas les
  modèles des fournisseurs, soumis à leurs propres conditions.
