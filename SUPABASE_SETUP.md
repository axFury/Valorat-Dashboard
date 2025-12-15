# Configuration Supabase pour Valoratbot Dashboard

Ce dashboard utilise Supabase comme file de commandes pour communiquer avec le bot Discord de manière sécurisée.

## Architecture

Le système fonctionne avec le pattern **enqueue + poll** :

1. Le dashboard envoie une commande dans la table `command_queue`
2. Le bot Discord poll régulièrement cette table
3. Le bot traite la commande et met à jour le statut
4. Le dashboard poll le statut jusqu'à ce que la commande soit terminée

## Variables d'environnement requises

Ajoutez ces variables dans Vercel (section **Vars** du panneau latéral) :

\`\`\`
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE=votre_service_role_key
\`\`\`

⚠️ **Important** : N'utilisez JAMAIS la clé `anon` pour ces opérations. La Service Role est nécessaire pour bypasser RLS.

## Schéma de la table command_queue

\`\`\`sql
CREATE TABLE command_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  picked_at TIMESTAMPTZ,
  result JSONB,
  CONSTRAINT status_check CHECK (status IN ('pending', 'processing', 'done', 'error'))
);

CREATE INDEX idx_command_queue_status_created ON command_queue(status, created_at);
\`\`\`

## Actions supportées

Le dashboard peut envoyer les actions suivantes :

### Musique
- `play` - Jouer une musique (payload: `{ voiceChannelId, query }`)
- `pause` - Mettre en pause
- `resume` - Reprendre la lecture
- `skip` - Passer à la piste suivante
- `stop` - Arrêter la lecture

### Modération
- `purge` - Supprimer des messages (payload: `{ channelId, amount, mode }`)
- `slowmode` - Activer le mode lent (payload: `{ channelId, duration }`)
- `lock` - Verrouiller un salon (payload: `{ channelId }`)
- `unlock` - Déverrouiller un salon (payload: `{ channelId }`)

### Annonces
- `announce` - Publier une annonce (payload: `{ channelId, message?, embed? }`)
- `schedule_announce` - Programmer une annonce (payload: `{ channelId, message?, embed?, scheduledFor }`)

### Valorant
- `link_valorant` - Lier un compte Valorant (payload: `{ discordId, riotId }`)
- `unlink_valorant` - Délier un compte (payload: `{ discordId }`)
- `update_tracking` - Activer/désactiver le tracking (payload: `{ enabled }`)

## Côté bot Discord

Le bot doit implémenter un worker qui :

1. Poll la table `command_queue` toutes les 500-1000ms
2. Filtre les commandes avec `status = 'pending'`
3. Met à jour le statut à `processing` avant traitement
4. Exécute la commande Discord
5. Met à jour le statut à `done` ou `error` avec le résultat

Exemple de réponse dans `result` :

\`\`\`json
{
  "ok": true,
  "deleted": 50
}
\`\`\`

ou en cas d'erreur :

\`\`\`json
{
  "ok": false,
  "reason": "Bot non connecté au salon vocal"
}
\`\`\`

## Sécurité

✅ **Bonnes pratiques** :
- Aucun appel direct au VPS du bot
- Aucune clé sensible côté client
- Toutes les opérations Supabase se font server-side
- Le `guildId` est stocké en localStorage uniquement

❌ **À éviter** :
- N'exposez jamais `SUPABASE_SERVICE_ROLE` au client
- Ne désactivez pas RLS sans raison
- N'utilisez pas la clé `anon` pour les opérations critiques

## Timeout et retry

Le dashboard attend maximum 24 secondes (30 polls × 800ms) avant de considérer la commande comme timeout. Si le bot ne répond pas dans ce délai, l'utilisateur verra une erreur.

Pour gérer cela côté bot :
- Répondez rapidement même si l'opération est longue
- Utilisez des workers asynchrones si nécessaire
- Marquez `status = 'error'` si l'opération échoue
