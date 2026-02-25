import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { guildId, mise, target } = body

        if (!guildId || typeof mise !== "number" || typeof target !== "number") {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
        }
        if (mise < 1 || mise > 500000) {
            return NextResponse.json({ error: "Mise invalide (1 - 500k)" }, { status: 400 })
        }
        if (target < 1.01 || target > 1000) {
            return NextResponse.json({ error: "Multiplicateur cible invalide (1.01x - 1000x)" }, { status: 400 })
        }

        const cookieStore = await cookies()
        const discordToken = cookieStore.get("discord_token")?.value
        if (!discordToken) return NextResponse.json({ error: "Non connecté" }, { status: 401 })

        const tokenParts = discordToken.split("|")
        const userId = tokenParts[0]

        const supa = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE!,
            { auth: { persistSession: false } }
        )

        // Verif wallet
        const { data: walletData } = await supa
            .from("wallets")
            .select("ecus")
            .eq("guild_id", guildId)
            .eq("user_id", userId)
            .single()

        const currentEcus = walletData?.ecus || 0
        if (currentEcus < mise) {
            return NextResponse.json({ error: "Fonds insuffisants" }, { status: 400 })
        }

        // Generate crash point
        // 5% chance to crash at 1.00x instantly
        const isInstantCrash = Math.random() < 0.05
        let crashPoint = 1.00
        if (!isInstantCrash) {
            // formula: 1 / (1 - random) produces 1 to Infinity. Average is ~ln(Infinity) which is high but house edge bounds it
            // 99% return = 1 / (1 - random)
            const raw = 1 / (1 - Math.random())
            crashPoint = Math.min(1000, Math.floor(raw * 100) / 100)
            if (crashPoint < 1.00) crashPoint = 1.00
        }

        const won = crashPoint >= target
        let winnings = 0
        let newBalance = currentEcus

        if (won) {
            winnings = Math.floor(mise * target)
            newBalance = currentEcus - mise + winnings
        } else {
            newBalance = currentEcus - mise
        }

        // Update DB
        await supa.from("wallets").upsert({
            guild_id: guildId,
            user_id: userId,
            ecus: newBalance,
            updated_at: new Date().toISOString()
        })

        try {
            // Quest Progress logic over queue for CRASH
            await supa.from("command_queue").insert([{
                guild_id: guildId,
                action: "ADD_QUEST_PROGRESS",
                payload: { userId: userId, questId: "CRASH", amount: 1 }
            }])
        } catch { }

        return NextResponse.json({
            crashPoint,
            won,
            winnings: won ? winnings : 0,
            multiplier: won ? target : crashPoint,
            newBalance
        })
    } catch (e: any) {
        return NextResponse.json({ error: "Erreur serveur: " + e.message }, { status: 500 })
    }
}
