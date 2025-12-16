// Client-side Supabase client for dashboard
// Uses anon key with RLS enabled
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
})

// Types for our settings
export interface GuildSettings {
    guild_id: string
    created_at?: string
    updated_at?: string
    timezone: string
    locale: string
    language: string
    prefix: string
    weekly_auto_post: boolean
    rrtop_auto_post: boolean
    patch_notifications: boolean
    weekly_channel_id: string | null
    announce_channel_id: string | null
    rrtop_channel_id: string | null
    patch_channel_id: string | null
    modules: {
        music: boolean
        valorant: boolean
        moderation: boolean
        ai: boolean
        stats: boolean
        gifs: boolean
    }
    channels: {
        log?: string | null
        welcome?: string | null
        goodbye?: string | null
        rules?: string | null
        mod_log?: string | null
        music_text?: string | null
        valorant_updates?: string | null
        ai_chat?: string[]
    }
    roles: {
        admin?: string | null
        moderator?: string | null
        dj?: string | null
        muted?: string | null
        verified?: string | null
    }
    music: {
        dj_only: boolean
        default_volume: number
        max_queue_length: number
        allow_playlists: boolean
        allow_filters: boolean
        announce_songs: boolean
        auto_leave_empty: boolean
        auto_leave_timer: number
        allowed_channels: string[]
        blocked_channels: string[]
    }
    valorant: {
        region: 'eu' | 'na' | 'ap' | 'kr' | 'latam' | 'br'
        auto_update_ranks: boolean
        update_interval_hours: number
        notify_rank_changes: boolean
        notify_patch_notes: boolean
        leaderboard_enabled: boolean
        compare_roasts_enabled: boolean
        match_history_enabled: boolean
    }
    ai: {
        enabled: boolean
        provider: 'google' | 'openai' | 'anthropic'
        model: string
        style: 'friendly' | 'professional' | 'funny' | 'safe'
        max_tokens: number
        temperature: number
        allowed_channels: string[]
        blocked_users: string[]
        rate_limit_per_user: number
        rate_limit_window_minutes: number
        nsfw_filter: boolean
        context_messages: number
    }
    moderation: {
        enabled: boolean
        auto_mod_enabled: boolean
        anti_spam: {
            enabled: boolean
            max_messages: number
            timeframe_seconds: number
            action: 'warn' | 'mute' | 'kick' | 'ban'
        }
        anti_link: {
            enabled: boolean
            whitelist_domains: string[]
            action: 'delete' | 'warn' | 'mute'
        }
        anti_caps: {
            enabled: boolean
            threshold_percent: number
            min_length: number
            action: 'warn' | 'delete'
        }
        anti_mention: {
            enabled: boolean
            max_mentions: number
            action: 'warn' | 'delete' | 'mute'
        }
        bad_words: {
            enabled: boolean
            words: string[]
            action: 'delete' | 'warn' | 'mute'
        }
        log_actions: boolean
        dm_on_action: boolean
    }
    welcome: {
        enabled: boolean
        message: string
        embed: {
            enabled: boolean
            title: string
            description: string
            color: string
            thumbnail?: string
            image?: string | null
        }
        auto_role: string | null
        dm_welcome: boolean
    }
    goodbye: {
        enabled: boolean
        message: string
        embed: {
            enabled: boolean
            title: string
            description: string
            color: string
        }
    }
    stats: {
        enabled: boolean
        track_messages: boolean
        track_voice: boolean
        ignored_channels: string[]
        ignored_roles: string[]
        leaderboard_public: boolean
    }
}

export interface UserGuild {
    user_id: string
    guild_id: string
    permissions: 'view' | 'manage' | 'admin'
    added_at: string
}

// Helper to enqueue a settings update job
export async function applySettingsPatch(guildId: string, patch: Partial<GuildSettings>) {
    const { data, error } = await supabase
        .from('command_queue')
        .insert({
            guild_id: guildId,
            action: 'APPLY_GUILD_SETTINGS_PATCH',
            payload: { patch },
            status: 'pending',
        })
        .select()
        .single()

    if (error) throw error
    return data
}

// Helper to get user's manageable guilds
export async function getUserGuilds(userId: string) {
    const { data, error } = await supabase
        .from('user_guilds')
        .select('*')
        .eq('user_id', userId)
        .in('permissions', ['manage', 'admin'])

    if (error) throw error
    return data as UserGuild[]
}

// Helper to get guild settings
export async function getGuildSettings(guildId: string) {
    const { data, error } = await supabase
        .from('guild_settings')
        .select('*')
        .eq('guild_id', guildId)
        .single()

    if (error && error.code !== 'PGRST116') throw error
    return data as GuildSettings | null
}
