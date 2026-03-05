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

export async function POST(req: NextRequest, { params }: { params: Promise<{ matchId: string }> | { matchId: string } }) {
    const user = await getDiscordUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    // Next.js 15+ compatibility: await params if it's a promise
    const resolvedParams = params instanceof Promise ? await params : params
    const { matchId } = resolvedParams

    const body = await req.json()
    const { action, guildId, deck, attackIndex } = body

    const supa = getSupa()
    const { data: match, error: fetchError } = await supa
        .from("tcg_matches")
        .select("*")
        .eq("id", matchId)
        .single()

    if (fetchError || !match) return NextResponse.json({ error: "Match introuvable." }, { status: 404 })

    // -----------------------
    // ACTION: JOIN
    // -----------------------
    if (action === "join") {
        if (match.status !== "waiting") return NextResponse.json({ error: "Ce match est déjà complet ou terminé." }, { status: 400 })
        if (match.host_id === user.id) return NextResponse.json({ error: "Tu ne peux pas rejoindre ton propre salon." }, { status: 400 })

        if (!deck || !Array.isArray(deck) || deck.length !== 3) {
            return NextResponse.json({ error: "Choisis 3 cartes." }, { status: 400 })
        }

        // Verify ownership
        const { data: owned } = await supa
            .from("tcg_user_cards")
            .select("card_id")
            .eq("guild_id", guildId)
            .eq("user_id", user.id)

        const ownedIds = owned?.map(o => o.card_id) || []
        for (const cid of deck) {
            if (!ownedIds.includes(cid)) return NextResponse.json({ error: "Tu ne possèdes pas toutes ces cartes." }, { status: 400 })
        }

        try {
            const guestDeck = deck.map(cid => {
                const cardModel = CARDS.find(c => c.id === cid)
                if (!cardModel) throw new Error(`Carte ${cid} introuvable`)
                const stats = generateCardStats(cardModel)
                return { ...cardModel, hp: stats.hp, maxHp: stats.hp, attacks: stats.attacks }
            })

            const initialState = {
                turn: match.host_id,
                log: ["Le combat commence !", `C'est au tour de l'hôte.`],
                hostHp: match.host_deck.map((c: any) => c.maxHp),
                guestHp: guestDeck.map((c: any) => c.maxHp),
                hostActive: 0,
                guestActive: 0
            }

            const { data, error } = await supa
                .from("tcg_matches")
                .update({
                    guest_id: user.id,
                    guest_deck: guestDeck,
                    status: "active",
                    state: initialState
                })
                .eq("id", matchId)
                .select()
                .single()

            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            return NextResponse.json(data)
        } catch (e: any) {
            return NextResponse.json({ error: e.message || "Erreur deck" }, { status: 400 })
        }
    }


    // -----------------------
    // ACTION: ATTACK
    // -----------------------
    if (action === "attack") {
        if (match.status !== "active") return NextResponse.json({ error: "Le combat n'est pas actif." }, { status: 400 })
        if (match.state.turn !== user.id) return NextResponse.json({ error: "Ce n'est pas ton tour." }, { status: 403 })

        const isHost = user.id === match.host_id
        const attackerCards = isHost ? match.host_deck : match.guest_deck
        const defenderCards = isHost ? match.guest_deck : match.host_deck

        const attackerIdx = isHost ? match.state.hostActive : match.state.guestActive
        const defenderIdx = isHost ? match.state.guestActive : match.state.hostActive

        const attacker = attackerCards[attackerIdx]
        const attack = attacker.attacks[attackIndex]

        if (!attack) return NextResponse.json({ error: "Attaque invalide." }, { status: 400 })

        // Accuracy check
        const hit = Math.random() * 100 <= attack.accuracy
        let damage = hit ? attack.damage : 0

        const newState = { ...match.state }
        const defenderHpArray = isHost ? newState.guestHp : newState.hostHp
        defenderHpArray[defenderIdx] = Math.max(0, defenderHpArray[defenderIdx] - damage)

        const logMsg = hit
            ? `${attacker.name} lance ${attack.name} ! -${damage} HP.`
            : `${attacker.name} a raté son attaque !`
        newState.log.unshift(logMsg)

        // Check if defender died
        if (defenderHpArray[defenderIdx] <= 0) {
            newState.log.unshift(`${defenderCards[defenderIdx].name} est K.O. !`)

            // Auto switch to next card if any
            let nextActive = -1
            for (let i = 0; i < defenderHpArray.length; i++) {
                if (defenderHpArray[i] > 0) {
                    nextActive = i
                    break
                }
            }

            if (nextActive === -1) {
                // GAME OVER
                const { error } = await supa
                    .from("tcg_matches")
                    .update({
                        status: "finished",
                        winner_id: user.id,
                        state: { ...newState, log: [`FIN DU COMBAT ! Victoire de ${user.global_name || user.username} !`, ...newState.log] }
                    })
                    .eq("id", matchId)
                if (error) return NextResponse.json({ error: error.message }, { status: 500 })
                return NextResponse.json({ status: "finished", winner: user.id })
            } else {
                if (isHost) newState.guestActive = nextActive
                else newState.hostActive = nextActive
            }
        }

        // Switch turn
        newState.turn = isHost ? match.guest_id : match.host_id

        const { error } = await supa
            .from("tcg_matches")
            .update({ state: newState })
            .eq("id", matchId)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ status: "ok" })
    }

    // -----------------------
    // ACTION: SURRENDER
    // -----------------------
    if (action === "surrender") {
        if (match.status !== "active") return NextResponse.json({ error: "Combat non actif." }, { status: 400 })
        const winnerId = user.id === match.host_id ? match.guest_id : match.host_id

        await supa.from("tcg_matches").update({
            status: "finished",
            winner_id: winnerId,
            state: { ...match.state, log: [`Abandon de ${user.global_name || user.username}.`, ...match.state.log] }
        }).eq("id", matchId)

        return NextResponse.json({ status: "finished" })
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 })
}
