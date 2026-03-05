import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateBoosterCards, FREE_BOOSTERS_PER_DAY, BOOSTER_PRICE } from "@/lib/tcg"

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

export async function POST(req: NextRequest) {
    const user = await getDiscordUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const body = await req.json()
    const { guildId, itemKey, packKey, useFree } = body
    if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 })

    const supa = getSupa()
    const today = new Date().toISOString().slice(0, 10)

    let isPaid = false
    let price = BOOSTER_PRICE

    if (itemKey) {
        // Using an item from inventory (booster_premium, pack_duellistes, etc.)
        const { data: inventoryEntry } = await supa
            .from("shop_user_inventory")
            .select("id")
            .eq("guild_id", guildId)
            .eq("user_id", user.id)
            .eq("item_key", itemKey)
            .eq("used", false)
            .limit(1)
            .single()

        if (!inventoryEntry) {
            return NextResponse.json({ error: "Item introuvable ou déjà utilisé." }, { status: 400 })
        }

        // Mark as used
        await supa.from("shop_user_inventory").update({ used: true }).eq("id", inventoryEntry.id)
    } else {
        // Check if user has Sage companion (+2 free boosters)
        let dailyFreeLimit = FREE_BOOSTERS_PER_DAY
        const { data: sageCheck } = await supa
            .from("shop_user_inventory")
            .select("id")
            .eq("guild_id", guildId)
            .eq("user_id", user.id)
            .eq("item_key", "compagnon_sage")
            .eq("used", false)
            .limit(1)

        if (sageCheck && sageCheck.length > 0) {
            dailyFreeLimit += 2
        }

        const { data: tracker } = await supa
            .from("tcg_daily_boosters")
            .select("*")
            .eq("guild_id", guildId)
            .eq("user_id", user.id)
            .single()

        let usedToday = (tracker && tracker.last_date === today) ? tracker.used_count : 0

        if (useFree && usedToday < dailyFreeLimit) {
            // Use free booster
            await supa.from("tcg_daily_boosters").upsert(
                { guild_id: guildId, user_id: user.id, last_date: today, used_count: usedToday + 1 },
                { onConflict: "guild_id,user_id" }
            )
        } else {
            // Must pay for basic booster
            isPaid = true
            const { data: wallet } = await supa
                .from("user_wallets")
                .select("balance")
                .eq("guild_id", guildId)
                .eq("user_id", user.id)
                .single()

            // Resolve real price if specific pack
            if (packKey) {
                // Find pack price from catalog if needed, we'll import it or assume price
                // For simplicity assuming UI sends price or it's static
                // Actually pack_serie2 is 750, pack_serie1 is 500
                const { BOOSTER_PACKS } = await import("@/lib/card-catalog")
                const pack = BOOSTER_PACKS[packKey as keyof typeof BOOSTER_PACKS]
                if (pack) {
                    price = pack.price
                }
            }

            if (!wallet || wallet.balance < price) {
                return NextResponse.json({ error: "Solde insuffisant pour acheter ce booster." }, { status: 400 })
            }

            const newBalance = wallet.balance - price
            await supa.from("user_wallets").update({ balance: newBalance }).eq("guild_id", guildId).eq("user_id", user.id)
        }
    }

    // Generate cards
    const cards = generateBoosterCards(itemKey, packKey)

    // Insert into user collection
    const inserts = cards.map((c: any) => ({
        guild_id: guildId,
        user_id: user.id,
        card_id: c.id,
    }))

    const { error: insertError } = await supa.from("tcg_user_cards").insert(inserts)

    if (insertError) {
        console.error("Failed inserting cards:", insertError)
        return NextResponse.json({ error: "Erreur lors de l'enregistrement des cartes." }, { status: 500 })
    }

    // Fetch user new balance if paid
    let balance = null
    if (isPaid) {
        const { data: updatedWallet } = await supa
            .from("user_wallets")
            .select("balance")
            .eq("guild_id", guildId)
            .eq("user_id", user.id)
            .single()
        if (updatedWallet) balance = updatedWallet.balance
    }

    // Add Quest progress "BOOSTER_OPEN" via proxy if we want, or do it directly
    // Not strictly needed on dashboard, but nice to have
    
    return NextResponse.json({ success: true, cards, isPaid, price: isPaid ? price : 0, balance })
}

export async function GET(req: NextRequest) {
    const user = await getDiscordUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const guildId = req.nextUrl.searchParams.get("guildId")
    if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 })

    const supa = getSupa()
    const today = new Date().toISOString().slice(0, 10)

    let dailyFreeLimit = FREE_BOOSTERS_PER_DAY

    const { data: sageCheck } = await supa
        .from("shop_user_inventory")
        .select("id")
        .eq("guild_id", guildId)
        .eq("user_id", user.id)
        .eq("item_key", "compagnon_sage")
        .eq("used", false)
        .limit(1)

    if (sageCheck && sageCheck.length > 0) {
        dailyFreeLimit += 2
    }

    const { data: tracker } = await supa
        .from("tcg_daily_boosters")
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", user.id)
        .single()

    let usedToday = (tracker && tracker.last_date === today) ? tracker.used_count : 0
    let freeRemaining = Math.max(0, dailyFreeLimit - usedToday)

    const { data: inventoryList } = await supa
        .from("shop_user_inventory")
        .select("item_key")
        .eq("guild_id", guildId)
        .eq("user_id", user.id)
        .eq("used", false)

    // Count available booster items
    const boosters: Record<string, number> = {}
    if (inventoryList) {
        inventoryList.forEach(item => {
            if (item.item_key.includes("booster") || item.item_key.includes("pack_")) {
                boosters[item.item_key] = (boosters[item.item_key] || 0) + 1
            }
        })
    }

    return NextResponse.json({ freeRemaining, boosterInventory: boosters, dailyLimit: dailyFreeLimit })
}
