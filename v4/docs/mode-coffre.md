# Mode coffre — plan (décidé le 29 septembre 2026)

Décision du fondateur : un objet peut être mis **« au coffre »**. Pour
les vraies œuvres (une peinture inédite, un objet de valeur) que leur
propriétaire veut garder secrètes tant qu'il ne les a pas partagées.

## Ce qui est déjà vrai aujourd'hui (V3, en prod)

- Chaque objet n'est lisible que par son propriétaire : la base le vérifie
  (RLS « objects: select own »), pas seulement l'app.
- Photos et documents dans des espaces privés (`object-images`,
  `object-documents`), servis par liens signés d'une heure.
- Rien n'est public sans partage ; un partage protégé exige son mot de
  passe (cookie signé).

Ce qui n'est **pas** encore secret : l'analyse IA envoie la photo au
fournisseur d'IA ; la clé service de Supabase (serveur, back-office) peut
tout lire ; les sauvegardes contiennent les données (chiffrées, clé du
fondateur).

**Promesse à afficher tant que l'étape 2 n'existe pas : « Privé, visible
par vous seul ». Jamais « garanti secret ».**

## Étape 1 — le coffre simple (à coder en premier, ce soir)

Un objet au coffre :

1. **n'est jamais envoyé à l'IA**, refusé côté serveur dans chaque Edge
   Function qui lit un objet ou ses photos : `describe-object`,
   `enhance-object-photo`, `estimate-value`, et les photos d'un objet
   au coffre dans `chat-turn`, `detect-scene`, `scene-thumbnail` ;
2. **ne peut pas être partagé** sans le sortir du coffre d'abord : refus
   dans `create-share-link` et dans les politiques des partages
   (collection partagée : les objets au coffre n'y apparaissent pas) ;
3. **n'apparaît dans aucune vue du back-office** : les statistiques
   comptent, mais ne montrent ni photo, ni titre, ni description ;
4. porte un **cadenas** visible dans l'app et sur le web, avec la phrase
   « Au coffre : jamais envoyé à l'IA, jamais partagé. »

### Base (brouillon `v4/supabase/drafts/0005_mode_coffre.sql`)

- `objects.vaulted boolean not null default false` — additif, aucun
  objet existant ne change.
- Fonction `is_object_vaulted(uuid)` (security definer, lecture seule)
  pour les Edge Functions et les politiques.
- Les politiques de partage filtrent `not vaulted`.

### App (mobile) et site (web)

- Fiche objet : interrupteur « Mettre au coffre ». Sortir du coffre
  demande une confirmation.
- Boutons IA et Partager désactivés sur un objet au coffre, avec la
  raison.
- Liste : cadenas sur la vignette.

### Tests à écrire avant de livrer

- Chaque Edge Function IA refuse un objet au coffre (403) sans appeler le
  fournisseur.
- `create-share-link` refuse ; une collection partagée ne montre pas
  l'objet au coffre.
- Un autre utilisateur ne voit toujours rien (non-régression RLS).
- Un objet sorti du coffre retrouve IA et partage.

## Étape 2 — le coffre fort (plus tard)

Chiffrement **sur le téléphone, avant l'envoi** (photos et texte) : ni
Tiroir, ni Supabase, ni le fondateur ne peuvent voir l'objet.

- Prix à accepter : pas d'IA possible, pas de recherche plein texte sur
  ces objets ; **clé perdue = objet perdu**, personne ne peut le
  récupérer.
- À décider : où vit la clé (trousseau iCloud / Google, phrase de
  secours), et comment partager un objet chiffré (déchiffrement au moment
  du partage, sur l'appareil).
- Seulement une fois livrée, on pourra écrire « secret, même pour
  Tiroir ».

## Ordre de ce soir (avec l'ordinateur)

1. Brouillon SQL 0005 + test sur la base jetable.
2. Refus serveur dans les Edge Functions IA et `create-share-link`.
3. Interrupteur et cadenas : web d'abord (testable tout de suite), puis
   mobile.
4. Build iOS et Android (EAS, depuis le Mac), test sur le web en preprod.
