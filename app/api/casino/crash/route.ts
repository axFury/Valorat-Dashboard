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
    const val = cookieStore.get("crash_state")?.value
    if (!val) return null
    const decrypted = decrypt(val)
    if (!decrypted) return null
    try {
        return JSON.parse(decrypted)
    } catch (e) {
        return null;
    }
}

async function saveGameState(res: NextResponse, game: any) {
    if (!game) {
        res.cookies.delete("crash_state")
    } else {
        const compressStr = JSON.stringify(game)
        res.cookies.set("crash_state", encrypt(compressStr), { httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 3600, path: "/" })
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
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getDiscordUser(req)
        if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 })
        const userId = user.id

        const body = await req.json()
        const { guildId, action, mise, cashoutMult } = body

        if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 })
        const supa = getSupa()

        // -----------------------
        // ACTION: START
        // -----------------------
        if (action === "start") {
            if (typeof mise !== "number" || mise < 1 || mise > 500000) {
                return NextResponse.json({ error: "Mise invalide (1 - 500k)" }, { status: 400 })
            }

            const { data: walletData } = await supa
                .from("user_wallets")
                .select("balance")
                .eq("guild_id", guildId)
                .eq("user_id", userId)
                .single()

            const currentEcus = walletData?.balance || 0
            if (currentEcus < mise) {
                return NextResponse.json({ error: "Fonds insuffisants" }, { status: 400 })
            }

            // Deduct initially
            await supa.from("user_wallets").update({
                balance: currentEcus - mise
            }).eq("guild_id", guildId).eq("user_id", userId)

            // Generate crash point (Server Secret)
            const isInstantCrash = Math.random() < 0.05
            let crashPoint = 1.00
            if (!isInstantCrash) {
                const raw = 1 / (1 - Math.random())
                crashPoint = Math.min(1000, Math.floor(raw * 100) / 100)
                if (crashPoint < 1.00) crashPoint = 1.00
            }

            const game = {
                status: "playing",
                mise,
                crashPoint, // SECRET
                startTime: Date.now(),
                userId
            }

            const res = NextResponse.json({
                status: "playing",
                mise,
                newBalance: currentEcus - mise,
                startTime: game.startTime
            })
            await saveGameState(res, game)
            return res
        }

        // -----------------------
        // ACTION: CASHOUT / CRASH
        // -----------------------
        const game: any = await getGameState()
        if (!game || game.userId !== userId || game.status !== "playing") {
            return NextResponse.json({ error: "Aucune partie en cours" }, { status: 400 })
        }

        const { data: walletData } = await supa
            .from("user_wallets")
            .select("balance")
            .eq("guild_id", guildId)
            .eq("user_id", userId)
            .single()
        const currentEcus = walletData?.balance || 0

        // Handle player attempting a manual cashout
        if (action === "cashout") {
            if (typeof cashoutMult !== "number" || cashoutMult < 1.00) {
                return NextResponse.json({ error: "Multiplicateur invalide" }, { status: 400 })
            }

            // Anti-cheat: Check if the cashoutMult requested is possible given the time elapsed
            // Standard crash formula: multiplier = Math.pow(Math.E, 0.06 * seconds)
            // So seconds = ln(multiplier) / 0.06
            const elapsedSec = (Date.now() - game.startTime) / 1000
            const maxPlausibleMult = Math.pow(Math.E, 0.06 * (elapsedSec + 2)) // 2s buffer for latency

            if (cashoutMult > maxPlausibleMult && cashoutMult > 1.00) {
                // If they ask for 5x but only 1 second has passed, reject.
                return NextResponse.json({ error: "Requête de retrait invalide (trop tôt)" }, { status: 400 })
            }

            // Check against actual secret crash point
            if (cashoutMult <= game.crashPoint) {
                // WON !
                const winnings = Math.floor(game.mise * cashoutMult)
                const newBalance = currentEcus + winnings

                await supa.from("user_wallets").update({
                    balance: newBalance,
                    updated_at: new Date().toISOString()
                }).eq("guild_id", guildId).eq("user_id", userId)

                try {
                    await supa.from("command_queue").insert([{
                        guild_id: guildId, action: "ADD_QUEST_PROGRESS",
                        payload: { userId: userId, questId: "CRASH", amount: 1 }
                    }])
                } catch { }

                const res = NextResponse.json({
                    status: "cashed_out",
                    crashPoint: game.crashPoint,
                    winnings,
                    multiplier: cashoutMult,
                    newBalance
                })
                await saveGameState(res, null) // End game
                return res
            } else {
                // LOST ! The crash point was reached before their cashout request
                const res = NextResponse.json({
                    status: "crashed",
                    crashPoint: game.crashPoint,
                    winnings: 0,
                    multiplier: game.crashPoint,
                    newBalance: currentEcus // Already deducted on start
                })
                await saveGameState(res, null) // End game
                return res
            }
        }

        // If action is "poll" or "check" (optional, for frontend syncing if needed), just return safe state
        return NextResponse.json({ status: "playing" })

    } catch (e: any) {
        return NextResponse.json({ error: "Erreur serveur: " + (e.message || "Unknown") }, { status: 500 })
    }
}
