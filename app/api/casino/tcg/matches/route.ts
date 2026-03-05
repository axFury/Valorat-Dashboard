import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { CARDS } from "@/lib/card-catalog"
import { generateCardStats } from "@/lib/tcg-combat"

export const dynamic = "force-dynamic"

function getSupa() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!)
}

async function getDiscordUser(req: NextRequest) {
    const token = req.cookies.get("discord_token")?.value || req.cookies.get("dc_token")?.value
    if (!token) return null
    try {
        const res = await fetch("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return null
        return res.json()
    } catch {
        return null
    }
}

export async function GET(req: NextRequest) {
    const user = await getDiscordUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const guildId = req.nextUrl.searchParams.get("guildId")
    if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 })

    const { data, error } = await getSupa()
        .from("tcg_matches")
        .select("*")
        .eq("guild_id", guildId)
        .eq("status", "waiting")
        .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
    const user = await getDiscordUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const body = await req.json()
    const { guildId, deck } = body // deck is array of 3 card IDs

    if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 })
    if (!deck || !Array.isArray(deck) || deck.length !== 3) {
        return NextResponse.json({ error: "Tu dois choisir exactement 3 cartes pour ton deck." }, { status: 400 })
    }

    // Verify user owns these cards
    const supa = getSupa()
    const { data: owned } = await supa
        .from("tcg_user_cards")
        .select("card_id")
        .eq("guild_id", guildId)
        .eq("user_id", user.id)

    const ownedIds = owned?.map(o => o.card_id) || []
    for (const cid of deck) {
        if (!ownedIds.includes(cid)) {
            return NextResponse.json({ error: `Tu ne possèdes pas la carte ${cid}.` }, { status: 400 })
        }
    }

    // Prepare combat stats for the deck
    const guestDeck = deck.map(cid => {
        const cardModel = CARDS.find(c => c.id === cid)
        if (!cardModel) return null
        const stats = generateCardStats(cardModel)
        return {
            ...cardModel,
            hp: stats.hp,
            maxHp: stats.hp,
            attacks: stats.attacks
        }
    }).filter(Boolean)

    // Check if user already has a 'waiting' match
    const { data: existing } = await supa
        .from("tcg_matches")
        .select("id")
        .eq("guild_id", guildId)
        .eq("host_id", user.id)
        .eq("status", "waiting")
        .single()

    if (existing) {
        return NextResponse.json({ error: "Tu as déjà un salon de combat en attente." }, { status: 400 })
    }

    const { data, error } = await supa
        .from("tcg_matches")
        .insert([{
            guild_id: guildId,
            host_id: user.id,
            host_deck: guestDeck,
            status: "waiting",
            state: {
                log: ["Le salon a été créé. En attente d'un adversaire..."]
            }
        }])
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}
