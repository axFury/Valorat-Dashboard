import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

function getSupa() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!)
}

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

async function getDiscordUser(req: NextRequest) {
    const token = req.cookies.get("discord_token")?.value || req.cookies.get("dc_token")?.value
    if (!token) return null
    const res = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
}

function resolveBet(bet: string, number: number): number {
    if (bet === "rouge") return RED.has(number) ? 2 : 0
    if (bet === "noir") return (!RED.has(number) && number !== 0) ? 2 : 0
    if (bet === "pair") return (number !== 0 && number % 2 === 0) ? 2 : 0
    if (bet === "impair") return (number % 2 === 1) ? 2 : 0
    if (bet === "1-18") return (number >= 1 && number <= 18) ? 2 : 0
    if (bet === "19-36") return (number >= 19 && number <= 36) ? 2 : 0
    if (bet === "col1") return ([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].includes(number)) ? 3 : 0
    if (bet === "col2") return ([2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].includes(number)) ? 3 : 0
    if (bet === "col3") return ([3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].includes(number)) ? 3 : 0
    if (bet === "doz1") return (number >= 1 && number <= 12) ? 3 : 0
    if (bet === "doz2") return (number >= 13 && number <= 24) ? 3 : 0
    if (bet === "doz3") return (number >= 25 && number <= 36) ? 3 : 0
    // Straight number bet
    const n = parseInt(bet, 10)
    if (!isNaN(n) && n >= 0 && n <= 36) return (number === n) ? 36 : 0
    return 0
}

// POST /api/casino/roulette
export async function POST(req: NextRequest) {
    const user = await getDiscordUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const body = await req.json()
    const { guildId, bet, mise } = body

    if (!guildId || !bet || !mise || mise <= 0) {
        return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 })
    }
    if (mise > 50000) {
        return NextResponse.json({ error: "Mise maximum: 50 000 pq" }, { status: 400 })
    }

    // Get balance
    const { data: wallet, error: wErr } = await getSupa()
        .from("user_wallets")
        .select("balance")
        .eq("guild_id", guildId)
        .eq("user_id", user.id)
        .single()

    if (wErr || !wallet) return NextResponse.json({ error: "Portefeuille introuvable" }, { status: 404 })
    if (wallet.balance < mise) return NextResponse.json({ error: "Solde insuffisant" }, { status: 400 })

    // Spin
    const number = Math.floor(Math.random() * 37) // 0-36
    const multiplier = resolveBet(bet, number)
    const won = multiplier > 0
    const winnings = won ? mise * multiplier : 0
    const netChange = won ? winnings - mise : -mise
    const newBalance = wallet.balance + netChange

    // Update balance
    await getSupa()
        .from("user_wallets")
        .update({ balance: newBalance })
        .eq("guild_id", guildId)
        .eq("user_id", user.id)

    // Track stats
    try {
        await getSupa()
            .from("casino_stats")
            .upsert({
                guild_id: guildId,
                user_id: user.id,
                total_won: won ? winnings : 0,
                total_lost: won ? 0 : mise,
                games_played: 1,
            }, { onConflict: "guild_id,user_id" })
    } catch { /* table may not exist */ }

    return NextResponse.json({
        number,
        color: number === 0 ? "green" : RED.has(number) ? "red" : "black",
        multiplier,
        won,
        winnings,
        netChange,
        newBalance,
    })
}
