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

// Shop catalog (prices must match bot's shopService.js)
const SHOP_CATALOG: Record<string, {
    name: string; price: number; category: string; durationHours?: number;
}> = {
    booster_premium: { name: "Booster Premium", price: 2000, category: "tcg" },
    pack_duellistes: { name: "Pack Duellistes", price: 5000, category: "tcg" },
    pack_legendaire: { name: "Pack Légendaire", price: 15000, category: "tcg" },
    carte_protection: { name: "Protection de Carte", price: 3000, category: "tcg", durationHours: 168 },
    bouclier_combat: { name: "Bouclier de Combat", price: 2000, category: "combat", durationHours: 24 },
    potion_force: { name: "Potion de Force", price: 1500, category: "combat", durationHours: 24 },
    ticket_revanche: { name: "Ticket de Revanche", price: 1000, category: "combat" },
    boost_salaire: { name: "Boost de Salaire", price: 5000, category: "economy", durationHours: 168 },
    boost_quete: { name: "Boost de Quêtes", price: 3000, category: "economy", durationHours: 168 },
    assurance_pari: { name: "Assurance Pari", price: 1500, category: "economy" },
    lootbox_bronze: { name: "Caisse Bronze", price: 1500, category: "lootbox" },
    lootbox_argent: { name: "Caisse Argent", price: 4000, category: "lootbox" },
    lootbox_or: { name: "Caisse Or", price: 10000, category: "lootbox" },
    lootbox_radiant: { name: "Caisse Radiant", price: 35000, category: "lootbox" },
    ticket_loterie: { name: "Ticket de Loterie", price: 1000, category: "lottery" },
    compagnon_spike: { name: "Petit Spike", price: 5000, category: "companion" },
    compagnon_phoenix: { name: "Phoenix Jr", price: 8000, category: "companion" },
    compagnon_sage: { name: "Sage Bot", price: 10000, category: "companion" },
    compagnon_omen: { name: "Omen Shadow", price: 15000, category: "companion" },
    compagnon_radiant: { name: "Renard Radiant", price: 30000, category: "companion" },
    pass_vip: { name: "Pass VIP", price: 12000, category: "pass", durationHours: 720 },
    pass_premium: { name: "Pass Premium", price: 30000, category: "pass", durationHours: 720 },
    pass_radiant: { name: "Pass Radiant", price: 60000, category: "pass", durationHours: 720 },
}

// POST /api/casino/shop — Buy an item
export async function POST(req: NextRequest) {
    const user = await getDiscordUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const body = await req.json()
    const { guildId, itemKey } = body
    if (!guildId || !itemKey) return NextResponse.json({ error: "Missing params" }, { status: 400 })

    const item = SHOP_CATALOG[itemKey]
    if (!item) return NextResponse.json({ error: "Item introuvable" }, { status: 404 })

    const supa = getSupa()

    // Get balance
    const { data: wallet } = await supa
        .from("user_wallets")
        .select("balance")
        .eq("guild_id", guildId)
        .eq("user_id", user.id)
        .single()

    if (!wallet) return NextResponse.json({ error: "Portefeuille introuvable" }, { status: 404 })
    if (wallet.balance < item.price) return NextResponse.json({ error: "Solde insuffisant" }, { status: 400 })

    // Deduct balance
    const newBalance = wallet.balance - item.price
    await supa.from("user_wallets").update({ balance: newBalance }).eq("guild_id", guildId).eq("user_id", user.id)

    // Handle lottery tickets
    if (item.category === "lottery") {
        const now = new Date()
        const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
        const wk = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
        const week = `${d.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`

        await supa.from("shop_lottery").upsert(
            { guild_id: guildId, user_id: user.id, week, tickets: 1 },
            { onConflict: "guild_id,week,user_id" }
        )
        // Increment ticket count
        const { data: existing } = await supa.from("shop_lottery")
            .select("tickets").eq("guild_id", guildId).eq("user_id", user.id).eq("week", week).single()
        if (existing && existing.tickets >= 1) {
            await supa.from("shop_lottery")
                .update({ tickets: existing.tickets + 1 })
                .eq("guild_id", guildId).eq("user_id", user.id).eq("week", week)
        }
    } else {
        // Store in inventory
        const expiresAt = item.durationHours
            ? new Date(Date.now() + item.durationHours * 3600_000).toISOString()
            : null

        await supa.from("shop_user_inventory").insert({
            guild_id: guildId,
            user_id: user.id,
            item_key: itemKey,
            expires_at: expiresAt,
        })
    }

    // Log purchase
    await supa.from("shop_purchase_log").insert({
        guild_id: guildId,
        user_id: user.id,
        item_key: itemKey,
        item_name: item.name,
        price: item.price,
    })

    return NextResponse.json({ success: true, newBalance, itemName: item.name })
}

// GET /api/casino/shop?guildId=xxx — Get user's inventory
export async function GET(req: NextRequest) {
    const user = await getDiscordUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const guildId = req.nextUrl.searchParams.get("guildId")
    if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 })

    const supa = getSupa()

    const { data: inventory } = await supa
        .from("shop_user_inventory")
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", user.id)
        .eq("used", false)
        .order("purchased_at", { ascending: false })

    // Filter expired
    const now = new Date()
    const active = (inventory || []).filter((i: any) => !i.expires_at || new Date(i.expires_at) > now)

    return NextResponse.json({ inventory: active, userId: user.id })
}
