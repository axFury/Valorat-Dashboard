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

// Slot symbols with weights and payouts
const SYMBOLS = [
    { emoji: "🍒", name: "Cerise", weight: 30 },
    { emoji: "🍋", name: "Citron", weight: 25 },
    { emoji: "🍊", name: "Orange", weight: 20 },
    { emoji: "🍇", name: "Raisin", weight: 15 },
    { emoji: "⭐", name: "Étoile", weight: 7 },
    { emoji: "💎", name: "Diamant", weight: 2 },
    { emoji: "7️⃣", name: "Sept", weight: 1 },
]

// Payout table: [symbol index] => multiplier for 3 of a kind
const PAYOUTS: Record<number, number> = {
    0: 3,    // 🍒 ×3
    1: 5,    // 🍋 ×5
    2: 8,    // 🍊 ×8
    3: 12,   // 🍇 ×12
    4: 25,   // ⭐ ×25
    5: 100,  // 💎 ×100
    6: 500,  // 7️⃣ ×500 JACKPOT
}

// Two of a kind pays 1/4 of triple
const TWO_OF_A_KIND_DIVISOR = 4

function weightedRandom(): number {
    const totalWeight = SYMBOLS.reduce((s, sym) => s + sym.weight, 0)
    let r = Math.random() * totalWeight
    for (let i = 0; i < SYMBOLS.length; i++) {
        r -= SYMBOLS[i].weight
        if (r <= 0) return i
    }
    return 0
}

function spin(): [number, number, number] {
    return [weightedRandom(), weightedRandom(), weightedRandom()]
}

function calculateWinnings(reels: [number, number, number], mise: number): { multiplier: number; type: string } {
    const [a, b, c] = reels

    // Three of a kind
    if (a === b && b === c) {
        return { multiplier: PAYOUTS[a] || 2, type: "triple" }
    }

    // Two of a kind
    if (a === b || b === c || a === c) {
        const match = a === b ? a : (b === c ? b : a)
        const mult = (PAYOUTS[match] || 2) / TWO_OF_A_KIND_DIVISOR
        return { multiplier: Math.max(1, Math.floor(mult * 10) / 10), type: "double" }
    }

    // No match
    return { multiplier: 0, type: "none" }
}

// POST /api/casino/slots
export async function POST(req: NextRequest) {
    const user = await getDiscordUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const body = await req.json()
    const { guildId, mise } = body
    if (!guildId || !mise || mise <= 0) return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 })
    if (mise > 50000) return NextResponse.json({ error: "Mise max: 50 000 pq" }, { status: 400 })

    const supa = getSupa()

    const { data: wallet } = await supa
        .from("user_wallets")
        .select("balance")
        .eq("guild_id", guildId)
        .eq("user_id", user.id)
        .single()

    if (!wallet) return NextResponse.json({ error: "Portefeuille introuvable" }, { status: 404 })
    if (wallet.balance < mise) return NextResponse.json({ error: "Solde insuffisant" }, { status: 400 })

    const reels = spin()
    const { multiplier, type } = calculateWinnings(reels, mise)
    const won = multiplier > 0
    const winnings = won ? Math.floor(mise * multiplier) : 0
    const netChange = won ? winnings - mise : -mise
    const newBalance = wallet.balance + netChange

    await supa.from("user_wallets")
        .update({ balance: newBalance })
        .eq("guild_id", guildId).eq("user_id", user.id)

    // Track stats
    try {
        await supa.from("casino_stats").upsert({
            guild_id: guildId, user_id: user.id,
            total_won: won ? winnings : 0,
            total_lost: won ? 0 : mise,
            games_played: 1,
        }, { onConflict: "guild_id,user_id" })

        // Quest Progress logic over queue
        await supa.from("command_queue").insert([{
            guild_id: guildId,
            action: "ADD_QUEST_PROGRESS",
            payload: { userId: user.id, questId: "SLOTS", amount: 1 }
        }])
    } catch { /* table may not exist */ }

    return NextResponse.json({
        reels: reels.map(i => ({ index: i, emoji: SYMBOLS[i].emoji, name: SYMBOLS[i].name })),
        multiplier,
        type,
        won,
        winnings,
        netChange,
        newBalance,
        isJackpot: type === "triple" && reels[0] === 6,
    })
}
