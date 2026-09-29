# Un seul compte, partout — site, app, back-office

Décision du fondateur (2026-09-29) : chaque personne a **un seul compte
Tiroir**, quel que soit son moyen de connexion (e-mail et mot de passe,
Google, Apple, plus tard Microsoft et passkeys), et le retrouve à
l'identique sur le site, dans l'app et — pour le fondateur, seul admin —
dans le back-office. Tous les autres comptes sont Gratuit, Premium ou Pro.

## Pourquoi c'est nécessaire

Supabase rattache deux connexions au même compte quand elles donnent la
même adresse e-mail confirmée. Mais « Se connecter avec Apple » peut donner
une **adresse masquée** (`…@privaterelay.appleid.com`), et un Google peut
porter une autre adresse : la personne se retrouve avec deux comptes et
croit avoir perdu ses objets.

## Fil par fil

1. ✅ **Site** — « Mon compte » : section *Moyens de connexion* (relier,
   retirer, jamais le dernier) ; Apple sur l'inscription, derrière le même
   interrupteur que la connexion (`lib/identities.ts`, `APPLE_WEB_ENABLED`).
2. **App** — la même section dans le profil (Apple natif, Google).
3. **Microsoft** — fournisseur « Azure » dans Supabase, puis boutons.
4. **Passkeys** (Face ID, empreinte) — après vérification de ce que
   Supabase propose.
5. **Torix** — reconnaître le fondateur par l'identifiant de son compte,
   plus par son adresse.

## Réglages à faire dans Supabase (une fois)

- **Authentication → « Allow manual linking »** : sans lui, « Relier »
  répond que la liaison n'est pas activée.
- **Apple sur le site** : identifiant de service Apple (Services ID) et
  secret dans Authentication → Providers → Apple, puis
  `APPLE_WEB_ENABLED = true` dans `web/lib/identities.ts`. D'ici là, Apple
  se relie depuis l'app.
