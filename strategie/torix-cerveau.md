# Un vrai cerveau pour Torix — coder la V4

> Document de décision du fondateur. Rédigé le 2026-09-29, à partir de
> `torix-et-tiroir.md` (à relire avec). Rien n'est codé : ce document dit
> ce qu'il faut trancher **avant**. Les chiffres marqués *estimé* sont des
> ordres de grandeur, à mesurer au premier essai.

---

## 1. Ce qu'on veut

Aujourd'hui, Torix est un répondeur à fiches, sans modèle : il retrouve une
réponse écrite à l'avance (`web/components/torix/knowledge.ts`), à l'écrit
ou à la voix. Il ne sait pas coder.

L'objectif : le fondateur confie à Torix une étape de la V4 (« écris le
brouillon 0004 et ses tests »), Torix la code dans le dépôt, et rend une
**pull request** à valider. Rien ne part en prod sans le fondateur.

---

## 2. Trois façons de lui donner un cerveau

| | A. Torix pilote un agent de code hébergé | B. Torix appelle l'API lui-même | C. Modèle local |
|---|---|---|---|
| Principe | Le Lab transmet la consigne à un agent de code hébergé (Claude Managed Agents : Anthropic fait tourner la boucle et un conteneur de travail par session). L'agent clone le dépôt, code, lance les tests, ouvre une PR. | Une route API de Vercel fait la boucle outil par outil (lire, écrire, tester) via l'API Claude et l'API GitHub. | Un modèle ouvert tourne sur une machine du fondateur, sans cloud. |
| Ce qu'on code | Peu : un bouton « Confier à Torix », la consigne, le suivi de la session, le lien de la PR. | Beaucoup : la boucle, les outils, l'exécution des tests, la sécurité. | Tout, plus l'infrastructure. |
| Limites | Service en bêta ; les données passent par Anthropic. | Les fonctions Vercel ont une durée limitée : une séance de code de plusieurs minutes s'y heurte. Exécuter des tests demande un bac à sable qu'on n'a pas. | Aujourd'hui, un modèle local code nettement moins bien, et un GPU coûte ~1 000–1 500 $/mois (`torix-et-tiroir.md`, § 7). |
| Verdict | **Recommandé pour commencer.** | À écarter : on réécrirait ce que A fournit. | Horizon (phase 2, piste doctorat), pas maintenant. |

**Recommandation : A.** Torix garde ce qui lui appartient — l'identité, la
mémoire (fiches, doctrine, commandements), l'aiguillage, la garde
propriétaire — et le fournisseur reste une prise interchangeable tout en
bas, comme le prévoit `torix-et-tiroir.md` (§ 5).

---

## 3. Les règles que le cerveau doit respecter

Reprises de la doctrine de Torix (Notion, fiches `doctrine`, `autonomie`,
`contrat`) et de ses commandements :

1. **Niveau d'autonomie 2 — « je propose, tu valides ».** Torix ouvre une
   PR ; il ne fusionne jamais. La PR *est* la validation.
2. **Tiroir = le réel.** Torix ne touche ni la prod, ni `supabase/migrations/`,
   ni les secrets. Il travaille dans `v4/` (et `v5/`) et sur des branches.
3. **Propriétaire seul.** Le bouton n'existe que derrière
   `requireTorixOwnerPage`. Un associé admin ne le voit pas.
4. **Repos 21 h 30 – 7 h.** Pas de séance de code lancée pendant le repos.
5. **Budget plafonné.** Chaque séance a un plafond en dollars (les sessions
   Managed Agents acceptent un budget dur par session), et `/admin` en
   montre le total, comme pour `ai_usage`.
6. **Transparence.** Chaque PR dit ce que Torix a fait, ce qu'il a vérifié
   et ce qu'il n'a pas pu vérifier.

---

## 4. Coût (*estimé*)

Modèle recommandé : Claude Opus 5.5 (4 $ / M de tokens en entrée, 20 $ / M
en sortie, 0,20 $ / M en lecture de cache). Une étape de la V4 comme celles
de cette nuit (fiches, tests, doc) représente quelques millions de tokens,
surtout relus depuis le cache.

- Par étape : **~2 à 10 $** *estimé*.
- Plafond proposé : **15 $ par séance**, **100 $ par mois** au départ.
- À mesurer dès la première séance, comme `estimate-value`.

C'est un coût pour le fondateur, ou pour Tiroir si la licence le prévoit :
voir § 5.

---

## 5. Propriété et secrets — à régler avant de coder

- **Qui possède le code écrit par Torix ?** Torix appartient au fondateur ;
  la V4 appartiendra à Tiroir, une société à trois. Le **contrat de
  licence Torix → Tiroir** doit dire explicitement que le code produit par
  Torix pour Tiroir revient à la société (ou lui est concédé). Sans cette
  clause, la propriété de la V4 devient floue — c'est ce qu'un associé ou
  un acheteur regardera. À voir avec l'avocat en propriété intellectuelle
  (`torix-et-tiroir.md`, § 8).
- **Conditions du fournisseur.** Vérifier ce que les conditions
  commerciales d'Anthropic disent de la propriété des sorties et de
  l'usage des données.
- **Clé d'API et accès GitHub au nom du fondateur seul.** Un compte ou un
  espace de travail Anthropic distinct de celui de Tiroir, et un jeton
  GitHub limité au dépôt, à la création de branches et de PR. Attention :
  les membres du projet Vercel peuvent voir ses variables
  d'environnement — la clé de Torix ne doit pas y être lisible par les
  associés.

---

## 6. Ce que le fondateur doit trancher

1. **Local ou cloud ?** La piste doctorat pose « IA strictement locale,
   jamais connectée à Internet » ; l'option A passe par un fournisseur.
   Principe dès maintenant, ou horizon ? (Mise en garde déjà notée dans
   `torix-et-tiroir.md`, § 9.) **Tant que ce n'est pas tranché, on ne code
   pas l'option A.**
2. **Option A, B ou C ?** Recommandation : A.
3. **Budget** : 15 $ par séance et 100 $ par mois, ou autre ?
4. **Qui paie** : le fondateur (Torix) ou Tiroir (via la licence) ?
5. **Clause de licence** sur le code produit, avec l'avocat.
6. **Vocabulaire** : la règle « jamais le même vocabulaire entre Tiroir et
   Torix » est à préciser — deux lexiques séparés (clés, serrure, prêt
   pour Tiroir ; directions, registres, repos pour Torix), ou l'inverse ?

---

## 7. Le rythme, une fois décidé

| Étape | Quoi | Condition |
|---|---|---|
| 0 | Décisions du § 6, clause de licence, clé et jeton au nom du fondateur | — |
| 1 | Prototype dans le Lab : « Confier à Torix » → une séance → lien de la PR. Une seule étape de la V4, déjà bien décrite (ex. brouillon 0004). | Étape 0 faite |
| 2 | Mesurer le coût réel et la qualité des PR sur 3 à 5 étapes. | Prototype utilisé |
| 3 | Seulement si c'est rentable et fiable : consignes à la voix, suivi en direct, plusieurs étapes enchaînées. | Chiffres de l'étape 2 |

Les fiches de Torix (`knowledge.ts`) seront mises à jour à l'étape 1,
comme l'exige `CLAUDE.md` pour tout nouvel usage de l'IA.
