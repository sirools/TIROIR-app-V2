# Preprod Tiroir — NAS UGREEN DXP2800

Environnement de preprod pour valider les versions (V4/V5/V6) avant la prod.

## Architecture
- **NAS (UGOS Pro + Docker)** :
  - `web` (nginx, port **8080**) → hello world + statiques
  - `drive` (filebrowser, port **8081**) → explorateur de fichiers web
  - `tiroir` (Next.js, port **8151**) → front + routes API de Tiroir
- **Cloud Supabase** : projet **dédié de preprod** (base + edge functions), isolé de la prod.

Le conteneur `tiroir` (sur le NAS) parle au **Supabase de preprod** (dans le cloud).

## Contenu
```
preprod/
├── docker-compose.yml         # les 3 services
├── deploy.sh                  # rsync + build + up via SSH
├── nginx/default.conf         # routes nginx
├── web/hello/                 # hello world
├── filebrowser/               # config du drive
├── tiroir/
│   ├── Dockerfile             # image Next.js (Node 22, build sur le NAS)
│   └── .env.preprod.example   # variables (copier en .env.preprod)
├── RUNBOOK-supabase-preprod.md
└── README.md
```

## Mise en route
1. **Supabase preprod** : suivre `RUNBOOK-supabase-preprod.md`.
2. **NAS** : disque installé → volume créé → Docker installé → SSH activé.
3. **Clé SSH** : installer la clé publique sur le NAS (voir plus bas).
4. **Env** : `cp tiroir/.env.preprod.example tiroir/.env.preprod` et remplir.
5. **Déployer** : `./deploy.sh clementougier@192.168.1.23`

URLs finales :
- http://192.168.1.23:8080/ — hello world
- http://192.168.1.23:8081/ — drive
- http://192.168.1.23:8151/ — preprod Tiroir

## Sauvegarde chiffrée de la base de prod

`sauvegarde/` : export quotidien de la base de prod, chiffré pour la clé
publique du fondateur (la clé privée n'est jamais sur le NAS), 0 €/mois.
Mise en place pas à pas : `sauvegarde/README.md`. `deploy.sh` copie le
dossier sans jamais toucher à `sauvegarde/.sauvegarde.env`.

## Clé SSH (déploiement autonome)
```bash
ssh-keygen -t ed25519 -N "" -C "preprod-deploy@tiroir" -f preprod/ssh/tiroir_preprod_ed25519
cat preprod/ssh/tiroir_preprod_ed25519.pub | ssh clementougier@192.168.1.23 \
  'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
```

## Déployer une nouvelle version (V4/V5/V6)
Depuis `main` à jour : `cd preprod && ./deploy.sh clementougier@192.168.1.23`
(rsync du code + rebuild de l'image + redémarrage — le drive et le hello world ne bougent pas).

## Mettre à jour sans le Mac (depuis l'iPhone)

`nas-update.sh` tourne **sur le NAS** : il garde un clone du repo dans
`src/` (sauvegarde locale du code), se place sur la branche voulue, puis
reconstruit la preprod avec le `.env.preprod` déjà présent.

**Installation unique, depuis le Mac :**
1. `./deploy.sh clementougier@192.168.1.23` (copie aussi `nas-update.sh`).
2. Créer un jeton GitHub **en lecture seule** : github.com → Settings →
   Developer settings → Fine-grained tokens → dépôt `sirools/TIROIR-app-V2`
   uniquement, permission *Contents : Read-only*.
3. Le déposer sur le NAS, sans qu'il passe dans l'historique du shell :
   ```bash
   ssh clementougier@192.168.1.23 'umask 077; cat > /volume1/docker/tiroir-preprod/.github-token'
   # coller le jeton, Entrée, puis Ctrl+D
   ```

**Ensuite, depuis l'iPhone** (app SSH type Termius, sur le Wi-Fi de la maison) :
```bash
cd /volume1/docker/tiroir-preprod
./nas-update.sh feature/v4-suggestions-web   # ou ./nas-update.sh main
```
