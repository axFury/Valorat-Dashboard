import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

function getSupa() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!)
}

async function getDiscordUser(req: NextRequest) {
    const token = req.cookies.get("discord_token")?.value || req.cookies.get("dc_token")?.value
    if (!token) return null
    const res = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
}

// GET /api/casino/balance?guildId=xxx
export async function GET(req: NextRequest) {
    const user = await getDiscordUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const guildId = req.nextUrl.searchParams.get("guildId")
    if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 })

    // Ensure wallet exists
    await getSupa()
        .from("user_wallets")
        .upsert(
            { guild_id: guildId, user_id: user.id, balance: 1000 },
            { onConflict: "guild_id,user_id", ignoreDuplicates: true }
        )

    const { data, error } = await getSupa()
        .from("user_wallets")
        .select("balance, loan_amount")
        .eq("guild_id", guildId)
        .eq("user_id", user.id)
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
        userId: user.id,
        username: user.username,
        avatar: user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${Number(user.discriminator || 0) % 5}.png`,
        balance: data.balance,
        loan_amount: data.loan_amount || 0,
    })
}
