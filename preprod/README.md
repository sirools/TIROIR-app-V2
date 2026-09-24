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

## Clé SSH (déploiement autonome)
```bash
ssh-keygen -t ed25519 -N "" -C "preprod-deploy@tiroir" -f preprod/ssh/tiroir_preprod_ed25519
cat preprod/ssh/tiroir_preprod_ed25519.pub | ssh clementougier@192.168.1.23 \
  'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
```

## Déployer une nouvelle version (V4/V5/V6)
Depuis `main` à jour : `cd preprod && ./deploy.sh clementougier@192.168.1.23`
(rsync du code + rebuild de l'image + redémarrage — le drive et le hello world ne bougent pas).
