# Configuration du Dashboard Valoratbot

## Prérequis

- Node.js 18+ installé
- Un bot Discord configuré avec access à Supabase
- Les tables Supabase créées (voir schémas SQL)

## Étape 1 : Configuration Supabase

### 1.1 Exécuter les schémas SQL

Dans l'éditeur SQL de Supabase, exécutez dans cet ordre :

1. `/home/axel/Valorat/ValoRatBot/sql/supabase_schema.sql`
2. `/home/axel/Valorat/ValoRatBot/sql/guild_settings_schema.sql`
3. `/home/axel/Valorat/ValoRatBot/sql/guild_tracking_schema.sql` (nouveau)

### 1.2 Obtenir les clés Supabase

Dans votre projet Supabase :
- Allez dans **Settings** → **API**
- Copiez :
  - Project URL (`SUPABASE_URL`)
  - `anon` public key (`SUPABASE_ANON_KEY`)
  - `service_role` key (`SUPABASE_SERVICE_ROLE`)

## Étape 2 : Configuration Discord OAuth

### 2.1 Créer l'application Discord

1. Allez sur https://discord.com/developers/applications
2. Sélectionnez votre application bot
3. Allez dans **OAuth2** → **General**
4. Ajoutez une Redirect URL : `http://localhost:3000/api/auth/callback` (dev) ou votre URL de production
5. Copiez le **Client ID** et **Client Secret**

### 2.2 Obtenir le Client ID pour l'invitation du bot

Le **Client ID** est le même que l'Application ID de votre bot Discord.

## Étape 3 : Configuration du Bot

### 3.1 Variables d'environnement

Créez/modifiez le fichier `.env` dans `/home/axel/Valorat/ValoRatBot` :

```bash
# Discord Bot
DISCORD_TOKEN=votre_token_bot
APPLICATION_ID=votre_application_id

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE=votre_service_role_key

# API Henrik (pour Valorant)
HENRIK_KEY=votre_henrik_key
```

### 3.2 Démarrer le bot

```bash
cd /home/axel/Valorat/ValoRatBot
npm install
npm start
```

Le bot va automatiquement :
- Synchroniser les serveurs dans la table `bot_guilds`
- Mettre à jour les informations toutes les 5 minutes
- Enregistrer/supprimer les serveurs lorsqu'il rejoint/quitte

## Étape 4 : Configuration du Dashboard

### 4.1 Variables d'environnement

Créez le fichier `.env.local` dans `/home/axel/Valorat/dashoard` :

```bash
# Discord OAuth
DISCORD_CLIENT_ID=votre_client_id
DISCORD_CLIENT_SECRET=votre_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/callback
NEXT_PUBLIC_DISCORD_CLIENT_ID=votre_client_id

# Supabase (frontend - lecture seule)
NEXT _PUBLIC_SUP ABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key

# Supabase (backend - accès complet)
SUPABASE_SERVICE_ROLE=votre_service_role_key
```

### 4.2 Installer et démarrer

```bash
cd /home/axel/Valorat/dashoard
npm install
npm run dev
```

Le dashboard sera accessible sur http://localhost:3000

## Étape 5 : Vérification

### 5.1 Vérifier le tracking des guilds

Allez dans Supabase → **Table Editor** → **`bot_guilds`**

Vous devriez voir les serveurs où le bot est présent avec :
- `guild_id`, `guild_name`, `icon`, `member_count`
- `last_seen` mis à jour toutes les 5 minutes

### 5.2 Tester le dashboard

1. Allez sur http://localhost:3000
2. Cliquez sur "Se connecter avec Discord"
3. Autorisez l'application
4. Vous devriez voir la liste des serveurs où le bot est présent
5. Sélectionnez un serveur pour voir le dashboard

## Fonctionnalités du Dashboard

✅ **Page d'accueil** : Présentation du bot avec boutons "Ajouter le bot" et "Se connecter"

✅ **Sélection de serveur** : Liste des serveurs où vous êtes admin ET où le bot est présent

✅ **Dashboard principal** :
- Statut du bot (en ligne/hors ligne)
- Latence
- Version
- Uptime
- Statistiques serveur en temps réel (membres, en ligne, en vocal)
- Graphique d'évolution sur 24h
- Journal d'activité récente (commandes exécutées)

✅ **Mises à jour temps réel** : Les stats et l'activité se mettent à jour automatiquement via Supabase Realtime

## Dépannage

### Le bot n'apparaît pas dans la liste des serveurs

Vérifiez que :
1. Le bot est bien démarré
2. La table `bot_guilds` contient les serveurs
3. Les variables `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE` sont correctes dans les deux projets

### Erreur "not_authenticated" lors de la connexion

Vérifiez que :
1. Les variables Discord OAuth sont correctes
2. La Redirect URI est bien configurée dans Discord Developer Portal
3. L'URL de redirection correspond exactement (http vs https, port, etc.)

### Les stats ne s'affichent pas

Vérifiez que :
1. Le bot publie bien dans `bot_status` et `guild_snapshot` (table Supabase)
2. Le `selected_guild` est bien stocké dans localStorage
3. Les telemetry publishers sont actifs (dans le code du bot)

## Production

Pour déployer en production :

1. Mettez à jour les URLs dans les variables d'environnement
2. Ajoutez la Redirect URI de production dans Discord Developer Portal
3. Utilisez `npm run build` puis `npm start` pour le dashboard
4. Assurez-vous que le bot tourne en tant que service (PM2, systemd, Docker, etc.)
