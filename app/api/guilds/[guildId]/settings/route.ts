import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(
    request: NextRequest,
    { params }: { params: { guildId: string } }
) {
    try {
        const cookieStore = await cookies()
        const accessToken =
            cookieStore.get('dc_token')?.value ||
            cookieStore.get('discord_token')?.value

        if (!accessToken) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
        }

        const guildId = params.guildId

        // Verify user has access to this guild via Discord API
        const userGuildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: 'no-store',
        })

        if (!userGuildsRes.ok) {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
        }

        const userGuilds = await userGuildsRes.json()
        const hasAccess = userGuilds.some((g: any) => g.id === guildId)

        if (!hasAccess) {
            return NextResponse.json({ error: 'Accès non autorisé à ce serveur' }, { status: 403 })
        }

        // Fetch settings from Supabase using service role
        const { data, error } = await supabaseServer
            .from('guild_settings')
            .select('*')
            .eq('guild_id', guildId)
            .single()

        if (error && error.code !== 'PGRST116') {
            console.error('[settings] Error fetching settings:', error)
            return NextResponse.json({ error: 'Erreur lors de la récupération des paramètres' }, { status: 500 })
        }

        return NextResponse.json(data || null)
    } catch (error) {
        console.error('[settings] Unexpected error:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { guildId: string } }
) {
    try {
        const cookieStore = await cookies()
        const accessToken =
            cookieStore.get('dc_token')?.value ||
            cookieStore.get('discord_token')?.value

        if (!accessToken) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
        }

        const guildId = params.guildId
        const patch = await request.json()

        // Verify user has access to this guild via Discord API
        const userGuildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: 'no-store',
        })

        if (!userGuildsRes.ok) {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
        }

        const userGuilds = await userGuildsRes.json()
        const hasAccess = userGuilds.some((g: any) => g.id === guildId)

        if (!hasAccess) {
            return NextResponse.json({ error: 'Accès non autorisé à ce serveur' }, { status: 403 })
        }

        // Enqueue settings patch job using service role
        const { data, error } = await supabaseServer
            .from('command_queue')
            .insert({
                guild_id: guildId,
                action: 'APPLY_GUILD_SETTINGS_PATCH',
                payload: { patch },
                status: 'pending',
            })
            .select()
            .single()

        if (error) {
            console.error('[settings] Error enqueueing settings patch:', error)
            return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('[settings] Unexpected error:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
