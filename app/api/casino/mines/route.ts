import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import crypto from "crypto"

export const dynamic = "force-dynamic"

function getSupa() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!)
}

// AES-256 state encryption to survive Vercel Serverless
function encrypt(text: string) {
    const secret = process.env.SUPABASE_SERVICE_ROLE!.slice(0, 32).padEnd(32, '0');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secret), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string) {
    if (!text) return null;
    try {
        const secret = process.env.SUPABASE_SERVICE_ROLE!.slice(0, 32).padEnd(32, '0');
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift()!, 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secret), iv);
        let decrypted = decipher.update(encryptedText, undefined, 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error("Decryption error:", e);
        return null;
    }
}

async function getGameState() {
    const cookieStore = await cookies()
    const val = cookieStore.get("mines_state")?.value
    if (!val) return null
    const decrypted = decrypt(val)
    if (!decrypted) return null
    try {
        return JSON.parse(decrypted)
    } catch (e) {
        console.error("JSON parse error:", e);
        return null;
    }
}

async function saveGameState(res: NextResponse, game: any) {
    if (!game) {
        res.cookies.delete("mines_state")
    } else {
        const compressStr = JSON.stringify(game)
        res.cookies.set("mines_state", encrypt(compressStr), { httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 3600, path: "/" })
    }
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

// ------------------------------------------------------------------
// MATH: Calculate multiplier based on mines and safe hits
// 1% House Edge implemented through factorial probabilities
// ------------------------------------------------------------------
function calcMultiplier(mines: number, hits: number): number {
    const totalTiles = 25;
    let prob = 1.0;

    // Calculate the probability of picking `hits` safe tiles in a row
    for (let i = 0; i < hits; i++) {
        const safeRemaining = totalTiles - mines - i;
        const totalRemaining = totalTiles - i;
        prob *= (safeRemaining / totalRemaining);
    }

    // Multiplier is inversely proportional to probability, minus 1% house edge
    const rtp = 0.99;
    return Number(((1 / prob) * rtp).toFixed(2));
}

// Removes mines configuration from state before sending to client
function sanitizeGameForClient(game: any) {
    return {
        mise: game.mise,
        minesCount: game.minesCount,
        revealed: game.revealed, // Array of indices that have been clicked
        status: game.status,     // "playing", "cashed_out", "bombed"
        multiplier: game.multiplier,
        maxSafe: 25 - game.minesCount,
        board: game.status === "playing" ? null : game.board // Only reveal board if game over
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getDiscordUser(req)
        if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

        const body = await req.json()
        const { guildId, action, mise, minesCount, pickIndex } = body

        if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 })

        // -----------------------
        // ACTION: START GAME
        // -----------------------
        if (action === "start") {
            if (!mise || mise <= 0) return NextResponse.json({ error: "Mise invalide" }, { status: 400 })
            if (mise > 500000) return NextResponse.json({ error: "Mise max: 500 000 pq" }, { status: 400 })
            if (!minesCount || minesCount < 1 || minesCount > 24) return NextResponse.json({ error: "Nombre de mines invalide (1 - 24)" }, { status: 400 })

            const { data: wallet } = await getSupa()
                .from("user_wallets")
                .select("balance")
                .eq("guild_id", guildId)
                .eq("user_id", user.id)
                .single()

            if (!wallet || wallet.balance < mise) {
                return NextResponse.json({ error: "Solde insuffisant" }, { status: 400 })
            }

            // Deduct initially
            await getSupa()
                .from("user_wallets")
                .update({ balance: wallet.balance - mise })
                .eq("guild_id", guildId)
                .eq("user_id", user.id)

            // Generate board: 25 indices, 'bomb' or 'gem'
            const board = Array(25).fill('gem')
            let placed = 0;
            while (placed < minesCount) {
                const ri = Math.floor(Math.random() * 25);
                if (board[ri] !== 'bomb') {
                    board[ri] = 'bomb';
                    placed++;
                }
            }

            const game = {
                mise,
                minesCount,
                board, // Secret
                revealed: [] as number[],
                status: "playing",
                multiplier: 1.00,
                userId: user.id
            }

            const res = NextResponse.json({
                ...sanitizeGameForClient(game),
                newBalance: wallet.balance - mise
            })
            await saveGameState(res, game)
            return res
        }

        // -----------------------
        // ACTIONS FROM EXISTING STATE
        // -----------------------
        const game: any = await getGameState()
        if (!game) return NextResponse.json({ error: "Aucune partie locale en cours" }, { status: 404 })
        if (game.userId !== user.id) return NextResponse.json({ error: "Partie invalide" }, { status: 403 })
        if (game.status !== "playing") return NextResponse.json({ error: "La partie est déjà terminée" }, { status: 400 })

        const { data: wallet } = await getSupa()
            .from("user_wallets").select("balance")
            .eq("guild_id", guildId).eq("user_id", user.id).single()

        const currentBalance = wallet?.balance || 0;

        // -----------------------
        // ACTION: PICK TILE
        // -----------------------
        if (action === "pick") {
            if (typeof pickIndex !== "number" || pickIndex < 0 || pickIndex >= 25) {
                return NextResponse.json({ error: "Index invalide" }, { status: 400 })
            }
            if (game.revealed.includes(pickIndex)) {
                return NextResponse.json({ error: "Case déjà révélée" }, { status: 400 })
            }

            const content = game.board[pickIndex]
            game.revealed.push(pickIndex)

            if (content === 'bomb') {
                // LOST
                game.status = "bombed"
                game.multiplier = 0

                // Stat
                try {
                    await getSupa().from("casino_stats").upsert({
                        guild_id: guildId, user_id: user.id,
                        total_lost: game.mise, games_played: 1,
                    }, { onConflict: "guild_id,user_id" })
                } catch { }

                const res = NextResponse.json(sanitizeGameForClient(game))
                await saveGameState(res, null) // Clear cookie
                return res
            } else {
                // GEM
                game.multiplier = calcMultiplier(game.minesCount, game.revealed.length)

                // Max safe reached?
                const maxSafeCount = 25 - game.minesCount
                if (game.revealed.length === maxSafeCount) {
                    // Auto-cashout
                    game.status = "cashed_out"
                    const winnings = Math.floor(game.mise * game.multiplier)
                    const newBal = currentBalance + winnings

                    await getSupa().from("user_wallets")
                        .update({ balance: newBal })
                        .eq("guild_id", guildId).eq("user_id", user.id)

                    try {
                        await getSupa().from("casino_stats").upsert({
                            guild_id: guildId, user_id: user.id,
                            total_won: winnings - game.mise, games_played: 1,
                        }, { onConflict: "guild_id,user_id" })

                        await getSupa().from("command_queue").insert([{
                            guild_id: guildId, action: "ADD_QUEST_PROGRESS",
                            payload: { userId: user.id, questId: "MINES", amount: 1 }
                        }])
                    } catch { }

                    const res = NextResponse.json({
                        ...sanitizeGameForClient(game),
                        newBalance: newBal,
                        winnings: winnings
                    })
                    await saveGameState(res, null)
                    return res
                }

                const res = NextResponse.json(sanitizeGameForClient(game))
                await saveGameState(res, game) // Save progress
                return res
            }
        }

        // -----------------------
        // ACTION: CASHOUT
        // -----------------------
        if (action === "cashout") {
            if (game.revealed.length === 0) {
                return NextResponse.json({ error: "Vous devez révéler au moins une case" }, { status: 400 })
            }

            game.status = "cashed_out"
            const winnings = Math.floor(game.mise * game.multiplier)
            const newBal = currentBalance + winnings

            await getSupa().from("user_wallets")
                .update({ balance: newBal })
                .eq("guild_id", guildId).eq("user_id", user.id)

            try {
                await getSupa().from("casino_stats").upsert({
                    guild_id: guildId, user_id: user.id,
                    total_won: winnings - game.mise, games_played: 1,
                }, { onConflict: "guild_id,user_id" })

                await getSupa().from("command_queue").insert([{
                    guild_id: guildId, action: "ADD_QUEST_PROGRESS",
                    payload: { userId: user.id, questId: "MINES", amount: 1 }
                }])
            } catch { }

            const res = NextResponse.json({
                ...sanitizeGameForClient(game),
                newBalance: newBal,
                winnings: winnings
            })
            await saveGameState(res, null)
            return res
        }

        return NextResponse.json({ error: "Action inconnue" }, { status: 400 })
    } catch (e: any) {
        console.error("Mines POST error:", e)
        return NextResponse.json({ error: "Erreur serveur: " + (e.message || "Unknown") }, { status: 500 })
    }
}
