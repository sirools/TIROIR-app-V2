# Sauvegarde chiffrée de la base de prod — sur le NAS, 0 €/mois

`sauvegarde-base.sh` exporte la base de prod de Tiroir (Supabase) et la
chiffre **au vol** : rien n'est jamais écrit en clair. Tout passe par
Docker, déjà sur le NAS ; aucun abonnement.

**Le principe des deux clés (outil gratuit `age`) :**

| Clé | Sert à | Où elle vit |
| --- | --- | --- |
| Publique (`age1…`) | chiffrer | sur le NAS, dans `.sauvegarde.env` |
| Privée (`AGE-SECRET-KEY-…`) | déchiffrer | **jamais sur le NAS** : trousseau iCloud + papier |

Même avec le contrôle du NAS, on ne peut pas lire les sauvegardes.
**Perdre la clé privée, c'est perdre les sauvegardes** — pour toi aussi.

## 1. Sur le Mac : créer la paire de clés (une fois)

```bash
brew install age libpq
age-keygen -o ~/Desktop/tiroir-cle-privee.txt
```

La commande affiche la clé publique (`Public key: age1…`) : la noter pour
l'étape 3. Puis ranger la clé privée à **deux** endroits sûrs :

1. l'app **Mots de passe** (trousseau iCloud) : nouvelle entrée
   « Tiroir — clé de sauvegarde », coller tout le contenu du fichier ;
2. **sur papier**, dans un endroit sûr chez toi.

Ensuite seulement, supprimer le fichier du Bureau.

## 2. Sur le NAS : un dossier chiffré (une fois)

Synology → Panneau de configuration → Dossier partagé → Créer :
`sauvegardes-tiroir`, case **Chiffrer ce dossier partagé** cochée.
Double protection : le dossier est chiffré, et chaque fichier l'est aussi.

## 3. Sur le NAS : les réglages (une fois)

```bash
cd /volume1/docker/tiroir-preprod/sauvegarde
cp .sauvegarde.env.exemple .sauvegarde.env
chmod 600 .sauvegarde.env
vi .sauvegarde.env
```

- `SUPABASE_DB_URL` : Supabase (prod) → **Connect** → « Session pooler »,
  avec le mot de passe de la base.
- `AGE_RECIPIENT` : la clé **publique** de l'étape 1 (`age1…`).
- `DEST_DIR` : le dossier de l'étape 2, ex. `/volume1/sauvegardes-tiroir`.
- `KEEP` : combien de sauvegardes garder (30 par défaut).

Le script refuse de tourner si le fichier n'est pas en `600`, ou si on y a
mis la clé privée par erreur.

## 4. Première sauvegarde

```bash
./sauvegarde-base.sh
```

Attendu : `✓ /volume1/sauvegardes-tiroir/tiroir-prod-….dump.age (… Ko, chiffré)`.

## 5. Tous les jours, tout seul

Synology → Panneau de configuration → **Planificateur de tâches** → Créer →
Tâche planifiée → Script défini par l'utilisateur :

- Utilisateur : le tien (celui qui a les droits Docker) ;
- Planification : tous les jours, 3 h 17 ;
- Commande : `/volume1/docker/tiroir-preprod/sauvegarde/sauvegarde-base.sh`
- Paramètres : cocher « Envoyer les détails d'exécution par e-mail » —
  seulement en cas d'échec.

## 6. Vérifier (une fois par mois) — sur le Mac

Copier une sauvegarde sur le Mac, puis :

```bash
./verifier-sauvegarde.sh tiroir-prod-….dump.age ~/chemin/vers/cle-privee.txt
```

Attendu : la liste des tables, puis `✓ Sauvegarde lisible : N tables avec
données.` Une sauvegarde qu'on n'a jamais relue n'est pas une sauvegarde.

## Restaurer

Dans une base **vide** (jamais directement sur la prod sans réfléchir) :

```bash
age -d -i cle-privee.txt tiroir-prod-….dump.age \
  | pg_restore --no-owner -d "postgresql://…/base_vide"
```

## Copie hors de chez toi

Si le NAS brûle ou est volé, il faut une autre copie. Les fichiers `.age`
sont illisibles sans la clé privée : on peut en copier une de temps en
temps dans iCloud Drive sans risque.

## Ce que ça ne sauvegarde pas (encore)

- **Les photos** (Supabase Storage) : elles ne sont pas dans la base.
- **Les secrets** (clés d'API des Edge Functions, variables Vercel) : à
  garder dans le trousseau.

## Testé

Base Postgres jetable, clés age générées pour l'occasion : trois
sauvegardes avec rotation (`KEEP=2`), aucun texte en clair dans les
fichiers, vérification avec la bonne clé (OK) et une autre clé (refus),
restauration complète dans une base neuve (500 objets, 2 collections
revenus à l'identique), refus des droits trop ouverts, de la clé privée
mise par erreur, d'un réglage inconnu ; base injoignable → aucun fichier
laissé, anciennes sauvegardes intactes. Le mode Docker (celui du NAS) n'a
pas pu être essayé ici : le lancer une fois à la main (étape 4) avant de
le planifier.
