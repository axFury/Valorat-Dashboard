# Dashboard Multi-Guild Settings - Guide d'Utilisation

Ce guide explique comment utiliser et déployer le nouveau système de settings multi-serveur dans le dashboard.

## 📁 Structure des Fichiers Créés

### Configuration
- `lib/supabase-client.ts` - Client Supabase avec types TypeScript complets
- `components/guild-selector.tsx` - Sélecteur de serveur avec localStorage

### Pages Settings
- `app/dashboard/[guildId]/settings/page.tsx` - Page principale avec tabs
- `app/dashboard/[guildId]/settings/general-settings.tsx` - Langue, timezone, locale
- `app/dashboard/[guildId]/settings/modules-settings.tsx` - Toggle modules (music, AI, valorant, etc.)
- `app/dashboard/[guildId]/settings/channels-settings.tsx` - Configuration salons Discord
- `app/dashboard/[guildId]/settings/roles-settings.tsx` - Configuration rôles Discord
- `app/dashboard/[guildId]/settings/music-settings.tsx` - Settings lecteur musique
- `app/dashboard/[guildId]/settings/valorant-settings.tsx` - Tracking Valorant & RR
- `app/dashboard/[guildId]/settings/ai-settings.tsx` - Configuration LLM/IA
- `app/dashboard/[guildId]/settings/moderation-settings.tsx` - Auto-modération complète
- `app/dashboard/[guildId]/settings/welcome-settings.tsx` - Messages bienvenue/au revoir
- `app/dashboard/[guildId]/settings/stats-settings.tsx` - Tracking activité

## 🚀 Setup Rapide

### 1. Variables d'environnement

Créez `.env.local` dans le dossier `dashoard/` :

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...  # Anon key avec RLS
SUPABASE_SERVICE_ROLE=eyJhb...          # Pour server-side si besoin
```

### 2. Installer les dépendances manquantes

Si des composants UI manquent (slider, separator, etc.) :

```bash
cd dashoard
npx shadcn-ui@latest add slider separator textarea
```

### 3. Migrer la DB Supabase

1. Allez dans Supabase SQL Editor
2. Exécutez les migrations dans l'ordre :
   - `sql/01_enhanced_guild_settings.sql`
   - `sql/02_bot_events.sql`
   - `sql/03_user_guilds.sql`
   - `sql/04_rls_policies.sql`

### 4. Populate `user_guilds`

Dans votre callback OAuth Discord, ajoutez :

```typescript
// Après OAuth success
const { data: { user } } = await supabase.auth.getUser()

//Sync guilds from Discord API
const discordGuilds = await fetch('https://discord.com/api/users/@me/guilds', {
  headers: { Authorization: `Bearer ${discordAccessToken}` }
}).then(r => r.json())

// Insert dans user_guilds
for (const guild of discordGuilds) {
  if ((guild.permissions & 32) === 32) { // MANAGE_GUILD permission
    await supabase.from('user_guilds').upsert({
      user_id: user.id,
      guild_id: guild.id,
      permissions: (guild.permissions & 8) === 8 ? 'admin' : 'manage'
    })
  }
}
```

### 5. Démarrer le dashboard

```bash
cd dashoard
npm run dev
```

Accédez à `http://localhost:3000/dashboard/[guildId]/settings`

## ✨ Fonctionnalités

### Guild Selector
- Dropdown avec tous les serveurs de l'utilisateur
- Sauvegarde dans localStorage
- Redirection automatique vers `/dashboard/{guildId}/settings`

### Tabs Settings (10 sections)
1. **Général** - Langue, timezone, locale, prefix
2. **Modules** - Toggle features (music, valorant, AI, stats, moderation, gifs)
3. **Salons** - Log, welcome, moderation, music, valorant
4. **Rôles** - Admin, moderator, DJ, muted, verified
5. **Musique** - DJ-only, volume, queue, auto-leave, filters
6. **Valorant** - Region, auto-update, notifications, leaderboard
7. **IA** - Provider (Google/OpenAI), model, style, temperature, rate-limits
8. **Modération** - Anti-spam, anti-link, anti-caps, anti-mention, bad-words
9. **Bienvenue** - Messages welcome/goodbye avec embeds
10. **Stats** - Tracking messages/vocal, leaderboard public

### Flux de Modification

1. User modifie un setting dans l'UI
2. État mis à jour dans `pendingChanges`
3. Banner "Modifications non sauvegardées" apparaît
4. User clique "Sauvegarder"
5. → Job `APPLY_GUILD_SETTINGS_PATCH` inséré dans `command_queue`
6. → Worker valide + normalise + applique
7. → Trigger SQL → INSERT dans `bot_events`
8. → Bot polling (5s) → cache invalidé
9. → Settings rechargés dans dashboard (2s delay)

### Validation

Côté bot (`settingsValidator.js`) :
- Snowflakes (`/^\d{17,19}$/`)
- Enums (region, provider, style, action types)
- Ranges (volume 0-100, temperature 0-2, etc.)
- Required vs optional fields
- Type coercion automatique

Erreurs retournées dans le job result si validation échoue.

## 🔍 Debug & Troubleshooting

### User ne voit pas ses guilds
```sql
-- Vérifier user_guilds
SELECT * FROM user_guilds WHERE user_id = 'DISCORD_USER_ID';

-- Ajouter manuellement
INSERT INTO user_guilds (user_id, guild_id, permissions)
VALUES ('DISCORD_USER_ID', 'GUILD_ID', 'admin');
```

### Settings ne se sauvegardent pas

```sql
-- Vérifier RLS  policies
SELECT * FROM pg_policies WHERE tablename = 'guild_settings';

-- Vérifier job queue
SELECT * FROM command_queue
WHERE action = 'APPLY_GUILD_SETTINGS_PATCH'
ORDER BY created_at DESC LIMIT 10;

-- Vérifier erreurs
SELECT * FROM command_queue
WHERE status = 'error'
ORDER BY created_at DESC LIMIT 5;
```

### Channels/Roles ne se chargent pas

Le dashboard utilise la queue pour récupérer les données Discord :

```sql
-- Vérifier que le bot traite les jobs
SELECT * FROM command_queue
WHERE action IN ('listTextChannels', 'listRoles')
AND status = 'done'
ORDER BY created_at DESC LIMIT 10;
```

Si aucun résultat :
- Vérifier que le bot est démarré
- Vérifier que `srcqueue/worker.js` traite bien ces actions
- Check logs bot pour erreurs

### Bot events non traités

```sql
-- Events en attente
SELECT * FROM bot_events WHERE processed_at IS NULL;

-- Si beaucoup d'events en attente, vérifier polling bot
-- Logs bot devraient afficher : "[GuildConfig] Processing X bot_events"
```

## 📝 Next Steps

### Améliorations possibles

1. **Realtime au lieu de polling**
   - Remplacer `pollBotEvents()` par Supabase Realtime
   - Plus rapide (instantané vs 5s)
   - Moins de queries DB

2. **Validation côté dashboard**
   - Dupliquer validation schemas en TypeScript
   - Feedback immédiat avant sauvegarde
   - Éviter les erreurs côté queue

3. **Preview des embeds**
   - Afficher un preview de l'embed welcome/goodbye
   - Tester les variables `{user}`, `{server}`

4. **Historique des changements**
   - Logger les modifications dans une table `settings_history`
   - Afficher qui a modifié quoi et quand
   - Rollback possible

5. **Import/Export settings**
   - Exporter config enjson
   - Importer config d'un autre serveur
   - Templates de config prédéfinis

## 🎯 Checklist de Déploiement

- [ ] Migrations SQL exécutées dans Supabase
- [ ] Variables d'environnement configurées
- [ ] OAuth Discord setup avec sync `user_guilds`
- [ ] Bot démarré avec bot_events polling
- [ ] Test : créer un user_guilds manuellement
- [ ] Test : modifier un setting et vérifier job queue
- [ ] Test : vérifier que bot invalide cache
- [ ] Test : recharger settings dans dashboard
- [ ] Monitoring : surveiller `command_queue` pour erreurs
- [ ] Cleanup : setup cron pour `cleanup_old_bot_events(30)`

---

**Dashboard Settings System v1.0** ✅
