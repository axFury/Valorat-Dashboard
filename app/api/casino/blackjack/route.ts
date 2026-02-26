import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import crypto from "crypto"

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

function encrypt(text: string) {
    const key = crypto.scryptSync(process.env.SUPABASE_SERVICE_ROLE!.slice(0, 32), 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string) {
    if (!text) return null;
    try {
        const key = crypto.scryptSync(process.env.SUPABASE_SERVICE_ROLE!.slice(0, 32), 'salt', 32);
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift()!, 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText, undefined, 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch {
        return null;
    }
}

async function getGameState() {
    const cookieStore = await cookies()
    const val = cookieStore.get("bj_state")?.value
    if (!val) return null
    const decrypted = decrypt(val)
    if (!decrypted) return null
    try {
        return JSON.parse(decrypted)
    } catch {
        return null
    }
}

async function saveGameState(game: any) {
    const cookieStore = await cookies()
    if (!game) {
        cookieStore.delete("bj_state")
    } else {
        cookieStore.set("bj_state", encrypt(JSON.stringify(game)), { httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 3600, path: "/" })
    }
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

    if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 })

    if (action === "start") {
        if (!mise || mise <= 0) return NextResponse.json({ error: "Mise invalide" }, { status: 400 })
        if (mise > 50000) return NextResponse.json({ error: "Mise max: 50 000 pq" }, { status: 400 })

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

        const game = {
            deck, hands: [player], dealer, bets: [mise],
            currentHand: 0, guildId, userId: user.id, status: "playing", doubled: [false], results: undefined, totalPayout: undefined
        }

        if (isBlackjack(player)) {
            let totalPayout = 0;
            if (isBlackjack(dealer)) {
                game.status = "done"
                game.results = ["push"] as any
                totalPayout = mise
            } else {
                game.status = "done"
                game.results = ["blackjack"] as any
                totalPayout = Math.floor(mise * 2.5)
            }
            game.totalPayout = totalPayout as any

            await getSupa().from("user_wallets")
                .update({ balance: wallet.balance - mise + totalPayout })
                .eq("guild_id", guildId).eq("user_id", user.id)

            const { data: finalWallet } = await getSupa()
                .from("user_wallets").select("balance")
                .eq("guild_id", guildId).eq("user_id", user.id).single()

            await saveGameState(null) // clear
            return NextResponse.json({
                ...gameResponse(game, true),
                newBalance: finalWallet?.balance,
            })
        }

        await saveGameState(game)

        return NextResponse.json({
            ...gameResponse(game),
            canAfford: wallet.balance >= mise * 2 - mise, // We already deducted 1x
            walletBalance: wallet.balance - mise
        })
    }

    const game: any = await getGameState()
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
            const totalBet = game!.bets.reduce((a: number, b: number) => a + b, 0)
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

        await saveGameState(null)
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
        await saveGameState(game)
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
        await saveGameState(game)
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

        await saveGameState(game)
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
        await saveGameState(game)
        return NextResponse.json(gameResponse(game))
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 })
}
