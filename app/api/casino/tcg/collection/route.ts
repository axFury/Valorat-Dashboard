import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

async function getDiscordUser(req: NextRequest) {
    const token = req.cookies.get("discord_token")?.value || req.cookies.get("dc_token")?.value
    if (!token) return null
    const res = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 30 },
    })
    if (!res.ok) return null
    return res.json()
}

export async function GET(req: NextRequest) {
    const user = await getDiscordUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const guildId = req.nextUrl.searchParams.get("guildId")
    if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 })

    const supa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE!
    )

    // Fetch only THIS user's cards for THIS guild
    const { data, error } = await supa
        .from("tcg_user_cards")
        .select("card_id")
        .eq("guild_id", guildId)
        .eq("user_id", user.id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count copies per card_id
    const counts: Record<string, number> = {}
    for (const row of data || []) {
        counts[row.card_id] = (counts[row.card_id] || 0) + 1
    }

    return NextResponse.json({ userId: user.id, counts })
}
