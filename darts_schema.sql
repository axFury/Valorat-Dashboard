-- === Fléchettes (Darts) === --
-- Création de la table des matchs (darts_matches)
CREATE TABLE IF NOT EXISTS public.darts_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    creator_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'setup', -- setup, playing, finished
    mode TEXT NOT NULL DEFAULT 'local', -- local, online
    game_type TEXT NOT NULL DEFAULT '501', -- 501, 301, cricket
    rules JSONB NOT NULL DEFAULT '{"legs": 3, "in": "straight", "out": "double"}',
    players JSONB NOT NULL DEFAULT '[]', -- Liste des joueurs et état (id, nom, score_courant, legs_gagnées, stats)
    current_player_index INTEGER NOT NULL DEFAULT 0,
    history JSONB NOT NULL DEFAULT '[]', -- Historique des lancers par participant
    winner_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser la recherche de matchs par serveur
CREATE INDEX IF NOT EXISTS idx_darts_matches_guild ON public.darts_matches(guild_id);
-- Index pour chercher par créateur (historique personnel)
CREATE INDEX IF NOT EXISTS idx_darts_matches_creator ON public.darts_matches(creator_id);

-- Activer Supabase Realtime pour cette table
ALTER PUBLICATION supabase_realtime ADD TABLE darts_matches;

-- Création de la table de statistiques (darts_stats)
CREATE TABLE IF NOT EXISTS public.darts_stats (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    user_name TEXT, -- Discord username
    matches_played INTEGER DEFAULT 0,
    matches_won INTEGER DEFAULT 0,
    darts_thrown INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    highest_checkout INTEGER DEFAULT 0,
    count_180s INTEGER DEFAULT 0,
    count_140s INTEGER DEFAULT 0,
    count_100s INTEGER DEFAULT 0,
    cricket_marks INTEGER DEFAULT 0,
    misses INTEGER DEFAULT 0,
    advanced_stats JSONB DEFAULT '{}', -- Detailed stats (paliers, checkout %, heatmaps, etc.)
    history JSONB DEFAULT '[]', -- Match averages history for progression graphs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, guild_id)
);

-- RLS (Security Policies) - Optionnel mais recommandé
ALTER TABLE public.darts_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.darts_matches FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.darts_matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for participants" ON public.darts_matches FOR UPDATE USING (true);

ALTER TABLE public.darts_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.darts_stats FOR SELECT USING (true);
CREATE POLICY "Enable update for anyone" ON public.darts_stats FOR UPDATE USING (true);
CREATE POLICY "Enable insert for anyone" ON public.darts_stats FOR INSERT WITH CHECK (true);
