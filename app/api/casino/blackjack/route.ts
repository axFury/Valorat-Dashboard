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

function canSplit(hand: Card[]) {
    return hand.length === 2 && cardValue(hand[0].rank) === cardValue(hand[1].rank)
}

const games = new Map<string, {
    deck: Card[]; hands: Card[][]; dealer: Card[]; bets: number[];
    currentHand: number; guildId: string; userId: string;
    status: string; doubled: boolean[]; results?: any[]; totalPayout?: number;
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
        hands: game.hands,
        currentHand: game.currentHand,
        values: game.hands.map((h: Card[]) => handValue(h)),
        canSplit: canSplit(game.hands[game.currentHand]) && game.hands.length < 3,
        dealer: showDealer ? game.dealer : [game.dealer[0], { suit: "?", rank: "?" }],
        dealerValue: showDealer ? handValue(game.dealer) : cardValue(game.dealer[0].rank),
        bets: game.bets,
        status: game.status,
        doubled: game.doubled,
        results: game.results,
        totalPayout: game.totalPayout,
    }
}

export async function POST(req: NextRequest) {
    const user = await getDiscordUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const body = await req.json()
    const { guildId, action, mise } = body
    const gameKey = `${guildId}:${user.id}`

    if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 })

    if (action === "start") {
        if (!mise || mise <= 0) return NextResponse.json({ error: "Mise invalide" }, { status: 400 })
        if (mise > 50000) return NextResponse.json({ error: "Mise max: 50 000 pq" }, { status: 400 })

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

        await getSupa()
            .from("user_wallets")
            .update({ balance: wallet.balance - mise })
            .eq("guild_id", guildId)
            .eq("user_id", user.id)

        const deck = newDeck()
        const player = [deck.pop()!, deck.pop()!]
        const dealer = [deck.pop()!, deck.pop()!]

        const game: typeof games extends Map<any, infer I> ? I : never = {
            deck, hands: [player], dealer, bets: [mise],
            currentHand: 0, guildId, userId: user.id, status: "playing", doubled: [false], results: undefined, totalPayout: undefined
        }

        if (isBlackjack(player)) {
            let totalPayout = 0;
            if (isBlackjack(dealer)) {
                game.status = "done"
                game.results = ["push"]
                totalPayout = mise
            } else {
                game.status = "done"
                game.results = ["blackjack"]
                totalPayout = Math.floor(mise * 2.5)
            }
            game.totalPayout = totalPayout

            await getSupa().from("user_wallets")
                .update({ balance: wallet.balance - mise + totalPayout })
                .eq("guild_id", guildId).eq("user_id", user.id)

            const { data: finalWallet } = await getSupa()
                .from("user_wallets").select("balance")
                .eq("guild_id", guildId).eq("user_id", user.id).single()

            return NextResponse.json({
                ...gameResponse(game, true),
                newBalance: finalWallet?.balance,
            })
        }

        games.set(gameKey, game as any)
        setTimeout(() => { games.delete(gameKey) }, 300_000)

        return NextResponse.json({
            ...gameResponse(game),
            canAfford: wallet.balance >= mise * 2 - mise, // We already deducted 1x
            walletBalance: wallet.balance - mise
        })
    }

    const game = games.get(gameKey)
    if (!game) return NextResponse.json({ error: "Aucune partie en cours" }, { status: 404 })

    const { data: wallet } = await getSupa()
        .from("user_wallets").select("balance")
        .eq("guild_id", guildId).eq("user_id", user.id).single()

    async function settleGame() {
        while (handValue(game!.dealer) < 17) {
            game!.dealer.push(game!.deck.pop()!)
        }

        const dv = handValue(game!.dealer)
        let totalPayout = 0
        game!.results = []

        for (let i = 0; i < game!.hands.length; i++) {
            const pv = handValue(game!.hands[i])
            const bet = game!.bets[i]
            let res = ""
            let payout = 0

            if (pv > 21) { res = "bust"; payout = 0 }
            else if (dv > 21) { res = "dealer_bust"; payout = bet * 2 }
            else if (pv > dv) { res = "win"; payout = bet * 2 }
            else if (pv === dv) { res = "push"; payout = bet }
            else { res = "lose"; payout = 0 }

            game!.results.push(res)
            totalPayout += payout
        }

        game!.status = "done"
        game!.totalPayout = totalPayout

        if (totalPayout > 0) {
            await getSupa().from("user_wallets")
                .update({ balance: (wallet?.balance || 0) + totalPayout })
                .eq("guild_id", guildId).eq("user_id", user.id)
        }

        try {
            const totalBet = game!.bets.reduce((a, b) => a + b, 0)
            const won = totalPayout > totalBet ? totalPayout - totalBet : 0
            const lost = totalPayout < totalBet ? totalBet - totalPayout : 0
            await getSupa().from("casino_stats").upsert({
                guild_id: guildId, user_id: user.id,
                total_won: won, total_lost: lost, games_played: 1,
            }, { onConflict: "guild_id,user_id" })

            // Quest Progress logic over queue
            await getSupa().from("command_queue").insert([{
                guild_id: guildId,
                action: "ADD_QUEST_PROGRESS",
                payload: { userId: user.id, questId: "BLACKJACK", amount: 1 }
            }])
        } catch { }

        games.delete(gameKey)
    }

    if (action === "hit") {
        game.hands[game.currentHand].push(game.deck.pop()!)
        if (handValue(game.hands[game.currentHand]) > 21) {
            game.currentHand++
            if (game.currentHand >= game.hands.length) {
                await settleGame()
                const { data: w } = await getSupa().from("user_wallets").select("balance")
                    .eq("guild_id", guildId).eq("user_id", user.id).single()
                return NextResponse.json({ ...gameResponse(game, true), newBalance: w?.balance })
            }
        }
        return NextResponse.json(gameResponse(game))
    }

    if (action === "double") {
        const bet = game.bets[game.currentHand]
        if (!wallet || wallet.balance < bet) {
            return NextResponse.json({ error: "Solde insuffisant pour doubler" }, { status: 400 })
        }

        await getSupa().from("user_wallets")
            .update({ balance: wallet.balance - bet })
            .eq("guild_id", guildId).eq("user_id", user.id)

        game.bets[game.currentHand] *= 2
        game.doubled[game.currentHand] = true
        game.hands[game.currentHand].push(game.deck.pop()!)

        game.currentHand++
        if (game.currentHand >= game.hands.length) {
            await settleGame()
            const { data: w } = await getSupa().from("user_wallets").select("balance")
                .eq("guild_id", guildId).eq("user_id", user.id).single()
            return NextResponse.json({ ...gameResponse(game, true), newBalance: w?.balance })
        }
        return NextResponse.json(gameResponse(game))
    }

    if (action === "split") {
        if (!canSplit(game.hands[game.currentHand]) || game.hands.length >= 3) {
            return NextResponse.json({ error: "Impossible de split cette main" }, { status: 400 })
        }
        const bet = game.bets[game.currentHand]
        if (!wallet || wallet.balance < bet) {
            return NextResponse.json({ error: "Solde insuffisant pour séparer" }, { status: 400 })
        }

        await getSupa().from("user_wallets")
            .update({ balance: wallet.balance - bet })
            .eq("guild_id", guildId).eq("user_id", user.id)

        const hand = game.hands[game.currentHand]
        const card = hand.pop()!
        game.hands.splice(game.currentHand + 1, 0, [card])
        game.bets.splice(game.currentHand + 1, 0, bet)
        game.doubled.splice(game.currentHand + 1, 0, false)

        game.hands[game.currentHand].push(game.deck.pop()!)
        game.hands[game.currentHand + 1].push(game.deck.pop()!)

        return NextResponse.json(gameResponse(game))
    }

    if (action === "stand") {
        game.currentHand++
        if (game.currentHand >= game.hands.length) {
            await settleGame()
            const { data: finalW } = await getSupa().from("user_wallets").select("balance")
                .eq("guild_id", guildId).eq("user_id", user.id).single()

            return NextResponse.json({
                ...gameResponse(game, true),
                newBalance: finalW?.balance,
            })
        }
        return NextResponse.json(gameResponse(game))
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 })
}
