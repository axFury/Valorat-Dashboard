import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

function getSupa() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!)
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const guildId = searchParams.get("guildId")
    const userId = searchParams.get("userId")

    if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 })

    const supa = getSupa()

    // Top 10 Leaderboard
    const { data: topPlayers, error: leaderError } = await supa
        .from("tcg_profiles")
        .select("*")
        .eq("guild_id", guildId)
        .order("trophies", { ascending: false })
        .limit(10)

    let myProfile = null
    if (userId) {
        const { data } = await supa
            .from("tcg_profiles")
            .select("*")
            .eq("guild_id", guildId)
            .eq("user_id", userId)
            .single()
        myProfile = data
    }

    if (leaderError) return NextResponse.json({ error: leaderError.message }, { status: 500 })

    return NextResponse.json({ topPlayers: topPlayers || [], myProfile })
}
