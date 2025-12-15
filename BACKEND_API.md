# Backend API Documentation

Ce document décrit comment le dashboard Next.js communique avec votre API backend selon votre documentation.

## Configuration

### Variables d'environnement requises

Ajoutez ces variables dans la section **Vars** du panneau latéral v0:

- `NEXT_PUBLIC_BACKEND_URL`: URL de votre backend (ex: `https://nathan-vps-1.taile26801.ts.net`)
- `BOT_API_KEY`: Votre clé API pour authentification (ex: `HDEV-4efbea15-4c82`)
- `DISCORD_BOT_TOKEN`: Token de votre bot Discord (requis pour récupérer les channels/membres/roles via l'API Discord)

### Headers envoyés par le dashboard

Toutes les requêtes au backend incluent:
- `x-api-key: <BOT_API_KEY>` - Authentification
- `x-guild-id: <GUILD_ID>` - ID du serveur Discord sélectionné
- `Content-Type: application/json`

## Endpoints API utilisés

Le dashboard utilise exactement les endpoints publics de votre API (`/api/*`):

### Bot Status
- **GET** `/api/bot/bot/status` - État du bot, latence, uptime, nombre de guilds, version
- **GET** `/api/bot/guilds` - Liste des serveurs Discord où le bot est actif

### Modération
- **GET** `/api/moderation/logs` - Historique des actions de modération
- **POST** `/api/moderation/purge` - Purge de messages
  - Body: `{ channelId, amount, mode: "count"|"users"|"bots" }`
  - Response: `{ ok: true, deleted?: number }`
- **POST** `/api/moderation/slowmode` - Mode lent
  - Body: `{ channelId, duration }` (en secondes)
  - Response: `{ ok: true }`
- **POST** `/api/moderation/lock` - Verrouiller un salon
  - Body: `{ channelId }`
  - Response: `{ ok: true }`
- **POST** `/api/moderation/unlock` - Déverrouiller un salon
  - Body: `{ channelId }`
  - Response: `{ ok: true }`

### Musique
- **GET** `/api/music/queue` - File d'attente
  - Response: `[{ id, title, artist, duration, thumbnail }, ...]`
- **POST** `/api/music/play` - Jouer une piste
  - Body: `{ query, voiceChannelId }`
  - Response: `{ ok: true }` ou `{ ok: false, reason: "no_player" }`
- **POST** `/api/music/pause` - Mettre en pause
  - Response: `{ ok: true|false, reason?: string }`
- **POST** `/api/music/resume` - Reprendre la lecture
- **POST** `/api/music/skip` - Passer à la piste suivante
- **POST** `/api/music/stop` - Arrêter la lecture
- **POST** `/api/music/queue/reorder` - Réorganiser la file
  - Body: `{ oldIndex, newIndex }`

### Leaderboards
- **GET** `/api/leaderboards` - Classements messages et vocal
  - Response: `{ messages: [{ rank, user, total }], voice: [{ rank, user, hours }] }`
- **POST** `/api/leaderboards/schedule` - Planifier un leaderboard
  - Body: `{ channelId, type, schedule }`
  - Response: `{ ok: true, scheduleId }`
- **DELETE** `/api/leaderboards/schedule/:scheduleId` - Supprimer un planning

### Ping & GIFs
- **GET** `/api/ping/message` - Message de ping actuel
  - Response: `{ message: "..." }`
- **PUT** `/api/ping/message` - Modifier le message
  - Body: `{ message }`
- **GET** `/api/gifs` - Liste des GIFs
  - Response: `[{ id, url, tag, addedBy, date }, ...]`
- **POST** `/api/gifs` - Ajouter un GIF
  - Body: `{ url, tag? }`
- **DELETE** `/api/gifs/:gifId` - Supprimer un GIF

### Annonces
- **POST** `/api/announcements` - Créer une annonce
  - Body: `{ channelId, message?, embed?, mention? }`
- **POST** `/api/announcements/schedule` - Planifier une annonce
  - Body: configuration de planification
  - Response: `{ ok: true, scheduleId }`

### Valorant
- **GET** `/api/valorant/links` - Comptes Riot liés
  - Response: `[{ discordId, discordUsername, riotId, rank, rr, lastUpdate }, ...]`
- **POST** `/api/valorant/link` - Lier un compte
  - Body: `{ discordId, riotId }`
- **DELETE** `/api/valorant/unlink/:discordId` - Délier un compte
- **PUT** `/api/valorant/tracking` - Activer/désactiver le suivi
  - Body: `{ enabled: true|false }`

### Paramètres
- **GET** `/api/settings` - Configuration du serveur
  - Response: `{ guildName, prefix, language, timezone, features: {...} }`
- **PUT** `/api/settings` - Mettre à jour la configuration
  - Body: partial settings à fusionner
- **GET** `/api/settings/audit` - Journal d'audit
  - Response: `[{ action, user, date }, ...]`

## Format des réponses

### Succès
\`\`\`json
{ "ok": true, "data": "..." }
\`\`\`

### Erreur (4xx/5xx)
\`\`\`json
{ "error": "message d'erreur" }
\`\`\`

## Données Discord

Le dashboard récupère les données Discord en temps réel via des API routes Next.js qui utilisent le `DISCORD_BOT_TOKEN`:

- **GET** `/api/guilds/:guildId/channels` - Récupère les salons textuels et vocaux
- **GET** `/api/guilds/:guildId/members` - Récupère les membres du serveur
- **GET** `/api/guilds/:guildId/roles` - Récupère les rôles du serveur

Ces endpoints sont gérés automatiquement par le dashboard et n'ont pas besoin d'être implémentés dans votre backend.

## Mode développement

Pour désactiver l'authentification pendant le développement, activez `DEV_NO_AUTH=1` dans votre backend. En production, assurez-vous que l'authentification par `x-api-key` est activée.

## Notes importantes

- Toutes les requêtes incluent automatiquement le header `x-guild-id` avec l'ID du serveur sélectionné
- Le dashboard gère automatiquement les erreurs et affiche des toasts appropriés à l'utilisateur
- Les vrais channels, membres et rôles Discord sont maintenant utilisés partout dans le dashboard
