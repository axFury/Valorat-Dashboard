# Backend Implementation Guide - Valoratbot Dashboard

Ce document décrit toutes les commandes que votre backend Discord bot doit implémenter pour fonctionner avec le dashboard.

## Architecture

Le dashboard communique avec votre backend via une file de commandes Supabase :

1. **Dashboard** → Insère une commande dans la table `commands` (status: `pending`)
2. **Backend Bot** → Récupère les commandes pending, les traite, et met à jour le status (`processing` → `done` ou `error`)
3. **Dashboard** → Poll la commande jusqu'à ce que status = `done` ou `error`

## Table Supabase : `commands`

\`\`\`sql
CREATE TABLE commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB,
  status TEXT DEFAULT 'pending', -- 'pending' | 'processing' | 'done' | 'error'
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
\`\`\`

## Commandes à implémenter

### 1. **listTextChannels** - Liste des salons textuels

**Payload envoyé :**
\`\`\`json
{}
\`\`\`

**Résultat attendu (result) :**
\`\`\`json
{
  "ok": true,
  "channels": [
    { "id": "123456789", "name": "general", "type": 0 },
    { "id": "987654321", "name": "annonces", "type": 0 }
  ]
}
\`\`\`

**Action backend :** Récupérer tous les salons textuels du guild via l'API Discord.

---

### 2. **purge** - Supprimer des messages

**Payload envoyé :**
\`\`\`json
{
  "channelId": "123456789",
  "amount": 50,
  "mode": "count" | "users" | "bots"
}
\`\`\`

**Résultat attendu :**
\`\`\`json
{
  "ok": true,
  "deleted": 47
}
\`\`\`

**Action backend :**
- Si `mode === "count"` : Supprimer les `amount` derniers messages
- Si `mode === "users"` : Supprimer uniquement les messages d'utilisateurs (non-bots)
- Si `mode === "bots"` : Supprimer uniquement les messages de bots

---

### 3. **slowmode** - Activer le mode lent

**Payload envoyé :**
\`\`\`json
{
  "channelId": "123456789",
  "duration": 30
}
\`\`\`

**Résultat attendu :**
\`\`\`json
{
  "ok": true
}
\`\`\`

**Action backend :** Appliquer un slowmode de `duration` secondes sur le salon (0 = désactiver).

---

### 4. **lock** - Verrouiller un salon

**Payload envoyé :**
\`\`\`json
{
  "channelId": "123456789"
}
\`\`\`

**Résultat attendu :**
\`\`\`json
{
  "ok": true
}
\`\`\`

**Action backend :** Retirer les permissions d'envoi de messages pour @everyone.

---

### 5. **unlock** - Déverrouiller un salon

**Payload envoyé :**
\`\`\`json
{
  "channelId": "123456789"
}
\`\`\`

**Résultat attendu :**
\`\`\`json
{
  "ok": true
}
\`\`\`

**Action backend :** Restaurer les permissions d'envoi de messages pour @everyone.

---

### 6. **announce** - Publier une annonce

**Payload envoyé :**
\`\`\`json
{
  "channelId": "123456789",
  "message": "Texte simple" | null,
  "embed": {
    "title": "Titre",
    "description": "Description",
    "color": "#E11D48",
    "image": "https://example.com/image.png" | null
  } | null
}
\`\`\`

**Résultat attendu :**
\`\`\`json
{
  "ok": true,
  "messageId": "111222333444555"
}
\`\`\`

**Action backend :** Envoyer le message ou l'embed dans le salon spécifié.

---

### 7. **schedule_announce** - Programmer une annonce

**Payload envoyé :**
\`\`\`json
{
  "channelId": "123456789",
  "message": "Texte" | null,
  "embed": { ... } | null,
  "scheduledFor": "2025-12-25T20:00"
}
\`\`\`

**Résultat attendu :**
\`\`\`json
{
  "ok": true,
  "scheduledId": "abc123"
}
\`\`\`

**Action backend :** Stocker l'annonce programmée dans une table et l'envoyer à la date/heure spécifiée.

---

### 8. **schedule_leaderboard** - Configurer les leaderboards automatiques

**Payload envoyé :**
\`\`\`json
{
  "channelId": "123456789",
  "trackDays": 7,
  "dayOfWeek": 0,
  "hour": 20
}
\`\`\`

**Résultat attendu :**
\`\`\`json
{
  "ok": true
}
\`\`\`

**Action backend :** Sauvegarder la configuration pour publier automatiquement les leaderboards chaque semaine.

---

### 9. **post_leaderboard** - Publier le leaderboard maintenant

**Payload envoyé :**
\`\`\`json
{
  "channelId": "123456789"
}
\`\`\`

**Résultat attendu :**
\`\`\`json
{
  "ok": true
}
\`\`\`

**Action backend :** Générer et publier immédiatement le leaderboard dans le salon.

---

### 10. **play** - Jouer de la musique

**Payload envoyé :**
\`\`\`json
{
  "query": "nom de la chanson",
  "voiceChannelId": "123456789"
}
\`\`\`

**Résultat attendu :**
\`\`\`json
{
  "ok": true,
  "track": {
    "title": "Never Gonna Give You Up",
    "artist": "Rick Astley",
    "thumbnail": "https://..."
  }
}
\`\`\`

---

### 11. **pause** - Mettre en pause

**Payload envoyé :**
\`\`\`json
{}
\`\`\`

**Résultat attendu :**
\`\`\`json
{
  "ok": true
}
\`\`\`

---

### 12. **resume** - Reprendre la lecture

**Payload envoyé :**
\`\`\`json
{}
\`\`\`

**Résultat attendu :**
\`\`\`json
{
  "ok": true
}
\`\`\`

---

### 13. **skip** - Passer la chanson

**Payload envoyé :**
\`\`\`json
{}
\`\`\`

**Résultat attendu :**
\`\`\`json
{
  "ok": true
}
\`\`\`

---

### 14. **stop** - Arrêter la musique

**Payload envoyé :**
\`\`\`json
{}
\`\`\`

**Résultat attendu :**
\`\`\`json
{
  "ok": true
}
\`\`\`

---

## Gestion des erreurs

Si une commande échoue, mettre `status = "error"` et inclure un message :

\`\`\`json
{
  "ok": false,
  "reason": "Permissions insuffisantes"
}
\`\`\`

## Flux de traitement Backend

\`\`\`python
# Pseudo-code Python
while True:
    # 1. Récupérer les commandes pending
    commands = supabase.table("commands").select("*").eq("status", "pending").execute()
    
    for cmd in commands.data:
        # 2. Marquer comme processing
        supabase.table("commands").update({"status": "processing"}).eq("id", cmd["id"]).execute()
        
        # 3. Exécuter l'action
        try:
            result = execute_action(cmd["action"], cmd["payload"])
            supabase.table("commands").update({
                "status": "done",
                "result": result
            }).eq("id", cmd["id"]).execute()
        except Exception as e:
            supabase.table("commands").update({
                "status": "error",
                "result": {"ok": False, "reason": str(e)}
            }).eq("id", cmd["id"]).execute()
    
    time.sleep(1)
\`\`\`

## Sécurité

- Vérifier que `guild_id` correspond bien à un serveur où le bot est présent
- Valider les permissions (admin/modo) avant d'exécuter des actions sensibles
- Limiter le rate limiting pour éviter les abus
