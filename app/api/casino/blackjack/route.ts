import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

function getSupa() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!)
}

const SUITS = ["♠", "♥", "♦", "♣"] as const
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const

type Card = { suit: string; rank: string }

function newDeck(): Card[] {
    const deck: Card[] = []
    for (const s of SUITS) for (const r of RANKS) deck.push({ suit: s, rank: r })
    // Shuffle (Fisher-Yates)
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]
    }
    return deck
}

function cardValue(rank: string): number {
    if (rank === "A") return 11
    if (["K", "Q", "J"].includes(rank)) return 10
    return parseInt(rank, 10)
}

function handValue(hand: Card[]): number {
    let total = hand.reduce((s, c) => s + cardValue(c.rank), 0)
    let aces = hand.filter(c => c.rank === "A").length
    while (total > 21 && aces > 0) { total -= 10; aces-- }
    return total
}

function isBlackjack(hand: Card[]) {
    return hand.length === 2 && handValue(hand) === 21
}

// In-memory game state (simple approach — works for single-server deployments)
const games = new Map<string, {
    deck: Card[]; player: Card[]; dealer: Card[]; bet: number;
    guildId: string; userId: string; status: string; doubled: boolean;
}>()

async function getDiscordUser(req: NextRequest) {
    const token = req.cookies.get("discord_token")?.value || req.cookies.get("dc_token")?.value
    if (!token) return null
    const res = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
}

function gameResponse(game: any, showDealer = false) {
    return {
        player: game.player,
        playerValue: handValue(game.player),
        dealer: showDealer ? game.dealer : [game.dealer[0], { suit: "?", rank: "?" }],
        dealerValue: showDealer ? handValue(game.dealer) : cardValue(game.dealer[0].rank),
        bet: game.bet,
        status: game.status,
        doubled: game.doubled,
    }
}

// POST /api/casino/blackjack
export async function POST(req: NextRequest) {
    const user = await getDiscordUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const body = await req.json()
    const { guildId, action, mise } = body
    const gameKey = `${guildId}:${user.id}`

    if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 })

    // ── START NEW GAME ──
    if (action === "start") {
        if (!mise || mise <= 0) return NextResponse.json({ error: "Mise invalide" }, { status: 400 })
        if (mise > 50000) return NextResponse.json({ error: "Mise max: 50 000 pq" }, { status: 400 })

        // Check if game already exists
        if (games.has(gameKey)) {
            return NextResponse.json({ error: "Tu as déjà une partie en cours !" }, { status: 400 })
        }

        const { data: wallet } = await getSupa()
            .from("user_wallets")
            .select("balance")
            .eq("guild_id", guildId)
            .eq("user_id", user.id)
            .single()

        if (!wallet || wallet.balance < mise) {
            return NextResponse.json({ error: "Solde insuffisant" }, { status: 400 })
        }

        // Deduct bet
        await getSupa()
            .from("user_wallets")
            .update({ balance: wallet.balance - mise })
            .eq("guild_id", guildId)
            .eq("user_id", user.id)

        const deck = newDeck()
        const player = [deck.pop()!, deck.pop()!]
        const dealer = [deck.pop()!, deck.pop()!]

        const game = { deck, player, dealer, bet: mise, guildId, userId: user.id, status: "playing", doubled: false }

        // Check natural blackjack
        if (isBlackjack(player)) {
            if (isBlackjack(dealer)) {
                game.status = "push"
                // Refund
                await getSupa().from("user_wallets")
                    .update({ balance: wallet.balance })
                    .eq("guild_id", guildId).eq("user_id", user.id)
            } else {
                game.status = "blackjack"
                const winnings = Math.floor(mise * 2.5)
                await getSupa().from("user_wallets")
                    .update({ balance: wallet.balance - mise + winnings })
                    .eq("guild_id", guildId).eq("user_id", user.id)
            }

            const { data: finalWallet } = await getSupa()
                .from("user_wallets").select("balance")
                .eq("guild_id", guildId).eq("user_id", user.id).single()

            return NextResponse.json({
                ...gameResponse(game, true),
                result: game.status,
                newBalance: finalWallet?.balance,
            })
        }

        games.set(gameKey, game)
        // Auto-cleanup after 5 min
        setTimeout(() => { games.delete(gameKey) }, 300_000)

        return NextResponse.json({
            ...gameResponse(game),
            canDouble: wallet.balance >= mise * 2,
        })
    }

    // ── GAME ACTIONS (hit, stand, double) ──
    const game = games.get(gameKey)
    if (!game) return NextResponse.json({ error: "Aucune partie en cours" }, { status: 404 })

    if (action === "hit") {
        game.player.push(game.deck.pop()!)
        if (handValue(game.player) > 21) {
            game.status = "bust"
            games.delete(gameKey)

            // Track stats
            try {
                await getSupa().from("casino_stats").upsert({
                    guild_id: guildId, user_id: user.id,
                    total_won: 0, total_lost: game.bet, games_played: 1,
                }, { onConflict: "guild_id,user_id" })
            } catch { }

            const { data: w } = await getSupa().from("user_wallets").select("balance")
                .eq("guild_id", guildId).eq("user_id", user.id).single()

            return NextResponse.json({ ...gameResponse(game, true), result: "bust", newBalance: w?.balance })
        }
        return NextResponse.json(gameResponse(game))
    }

    if (action === "double") {
        const { data: wallet } = await getSupa()
            .from("user_wallets").select("balance")
            .eq("guild_id", guildId).eq("user_id", user.id).single()

        if (!wallet || wallet.balance < game.bet) {
            return NextResponse.json({ error: "Solde insuffisant pour doubler" }, { status: 400 })
        }

        // Deduct extra bet
        await getSupa().from("user_wallets")
            .update({ balance: wallet.balance - game.bet })
            .eq("guild_id", guildId).eq("user_id", user.id)

        game.bet *= 2
        game.doubled = true
        game.player.push(game.deck.pop()!)

        if (handValue(game.player) > 21) {
            game.status = "bust"
            games.delete(gameKey)

            try {
                await getSupa().from("casino_stats").upsert({
                    guild_id: guildId, user_id: user.id,
                    total_won: 0, total_lost: game.bet, games_played: 1,
                }, { onConflict: "guild_id,user_id" })
            } catch { }

            const { data: w } = await getSupa().from("user_wallets").select("balance")
                .eq("guild_id", guildId).eq("user_id", user.id).single()

            return NextResponse.json({ ...gameResponse(game, true), result: "bust", newBalance: w?.balance })
        }
        // Auto-stand after double
        // Fall through to stand logic below
    }

    if (action === "stand" || action === "double") {
        // Dealer plays
        while (handValue(game.dealer) < 17) {
            game.dealer.push(game.deck.pop()!)
        }

        const pv = handValue(game.player)
        const dv = handValue(game.dealer)

        let result: string
        let payout = 0

        if (dv > 21) { result = "dealer_bust"; payout = game.bet * 2 }
        else if (pv > dv) { result = "win"; payout = game.bet * 2 }
        else if (pv === dv) { result = "push"; payout = game.bet }
        else { result = "lose"; payout = 0 }

        game.status = result

        if (payout > 0) {
            const { data: w } = await getSupa().from("user_wallets").select("balance")
                .eq("guild_id", guildId).eq("user_id", user.id).single()
            await getSupa().from("user_wallets")
                .update({ balance: (w?.balance || 0) + payout })
                .eq("guild_id", guildId).eq("user_id", user.id)
        }

        // Track stats
        try {
            const won = payout > game.bet ? payout - game.bet : 0
            const lost = payout < game.bet ? game.bet - payout : 0
            await getSupa().from("casino_stats").upsert({
                guild_id: guildId, user_id: user.id,
                total_won: won, total_lost: lost, games_played: 1,
            }, { onConflict: "guild_id,user_id" })
        } catch { }

        games.delete(gameKey)

        const { data: finalW } = await getSupa().from("user_wallets").select("balance")
            .eq("guild_id", guildId).eq("user_id", user.id).single()

        return NextResponse.json({
            ...gameResponse(game, true),
            result,
            payout,
            newBalance: finalW?.balance,
        })
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 })
}
