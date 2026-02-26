"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import {
    BarChart3, Dices, Loader2, Trophy, Users, TrendingUp, TrendingDown,
    Clock, Wallet, RotateCcw
} from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import { getDiscordProfiles } from "@/lib/discord-profile-cache"

function fmtEcus(n: number) { return n.toLocaleString("fr-FR") }
function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const s = Math.max(1, Math.floor(diff / 1000))
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}j`
}

/* ═══════════════════════════════════════
   ROULETTE WHEEL CONSTANTS
   ═══════════════════════════════════════ */
const WHEEL_ORDER = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
    11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
    22, 18, 29, 7, 28, 12, 35, 3, 26
]
const RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

function numberColor(n: number): string {
    if (n === 0) return "bg-emerald-600"
    return RED_SET.has(n) ? "bg-red-600" : "bg-zinc-900"
}
function numberTextColor(n: number): string {
    if (n === 0) return "text-emerald-400"
    return RED_SET.has(n) ? "text-red-400" : "text-zinc-300"
}

/* ═══════════════════════════════════════
   CARD DISPLAY HELPERS
   ═══════════════════════════════════════ */
type BJCard = { suit: string; rank: string }

function cardColor(suit: string) {
    return suit === "♥" || suit === "♦" ? "text-red-500" : "text-foreground"
}

function PlayingCard({ card, hidden = false, delay = 0 }: { card: BJCard; hidden?: boolean; delay?: number }) {
    const [visible, setVisible] = useState(delay === 0)
    useEffect(() => {
        if (delay > 0) {
            const t = setTimeout(() => setVisible(true), delay)
            return () => clearTimeout(t)
        }
    }, [delay])

    if (!visible) return (
        <div className="w-20 h-28 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 animate-pulse" />
    )

    if (hidden || card.rank === "?") return (
        <div className="w-20 h-28 rounded-xl bg-gradient-to-br from-primary to-primary/80 border-2 border-primary/30 flex items-center justify-center shadow-lg shadow-primary/10 transition-all duration-300">
            <span className="text-2xl font-bold text-primary-foreground/50">?</span>
        </div>
    )

    return (
        <div className="w-20 h-28 rounded-xl bg-card border-2 border-border flex flex-col items-center justify-center shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl">
            <span className={`text-xl font-bold ${cardColor(card.suit)}`}>{card.rank}</span>
            <span className={`text-2xl ${cardColor(card.suit)}`}>{card.suit}</span>
        </div>
    )
}

/* ═══════════════════════════════════════
   BET TYPES FOR ROULETTE
   ═══════════════════════════════════════ */
const BET_GROUPS = [
    {
        label: "Couleurs",
        bets: [
            { value: "rouge", label: "🔴 Rouge", mult: "×2" },
            { value: "noir", label: "⚫ Noir", mult: "×2" },
        ]
    },
    {
        label: "Parité",
        bets: [
            { value: "pair", label: "Pair", mult: "×2" },
            { value: "impair", label: "Impair", mult: "×2" },
        ]
    },
    {
        label: "Moitiés",
        bets: [
            { value: "1-18", label: "1-18", mult: "×2" },
            { value: "19-36", label: "19-36", mult: "×2" },
        ]
    },
    {
        label: "Douzaines",
        bets: [
            { value: "doz1", label: "1ère (1-12)", mult: "×3" },
            { value: "doz2", label: "2ème (13-24)", mult: "×3" },
            { value: "doz3", label: "3ème (25-36)", mult: "×3" },
        ]
    },
    {
        label: "Colonnes",
        bets: [
            { value: "col1", label: "Col. 1", mult: "×3" },
            { value: "col2", label: "Col. 2", mult: "×3" },
            { value: "col3", label: "Col. 3", mult: "×3" },
        ]
    },
]

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function CasinoPage() {
    const [loading, setLoading] = useState(true)
    const [guildId, setGuildId] = useState<string | null>(null)

    // User / Balance
    const [userInfo, setUserInfo] = useState<any>(null)
    const [balance, setBalance] = useState(0)

    // Roulette
    const [activeRouletteBets, setActiveRouletteBets] = useState<{ bet: string, label: string, mise: number }[]>([])
    const [rouletteMise, setRouletteMise] = useState(100)
    const [rouletteSpinning, setRouletteSpinning] = useState(false)
    const [rouletteResult, setRouletteResult] = useState<any>(null)
    const [wheelRotation, setWheelRotation] = useState(0)
    const [rouletteNumberInput, setRouletteNumberInput] = useState<string>("")

    function handleAddRouletteBet(betValue: string, label: string) {
        if (rouletteMise <= 0) return;
        setActiveRouletteBets(prev => {
            const existing = prev.find(b => b.bet === betValue);
            if (existing) {
                return prev.map(b => b.bet === betValue ? { ...b, mise: b.mise + rouletteMise } : b);
            }
            return [...prev, { bet: betValue, label, mise: rouletteMise }];
        });
    }

    function handleRemoveRouletteBet(betValue: string) {
        setActiveRouletteBets(prev => prev.filter(b => b.bet !== betValue));
    }

    function handleClearRouletteBets() {
        setActiveRouletteBets([]);
    }

    // Blackjack
    const [bjState, setBjState] = useState<any>(null)
    const [bjMise, setBjMise] = useState(100)
    const [bjLoading, setBjLoading] = useState(false)

    // Bets
    const [activeBets, setActiveBets] = useState<any[]>([])
    const [resolvedBets, setResolvedBets] = useState<any[]>([])
    const [profiles, setProfiles] = useState<Map<string, { username: string; avatar: string }>>(new Map())

    // Slots
    const [slotsMise, setSlotsMise] = useState(100)
    const [slotsSpinning, setSlotsSpinning] = useState(false)
    const [slotsResult, setSlotsResult] = useState<any>(null)
    const [slotsReels, setSlotsReels] = useState(["🍒", "🍋", "🍊"])

    // Crash
    const [crashMise, setCrashMise] = useState(100)
    const [crashTarget, setCrashTarget] = useState("2.00")
    const [crashPlaying, setCrashPlaying] = useState(false)
    const [crashResult, setCrashResult] = useState<any>(null)
    const [crashCurrentMult, setCrashCurrentMult] = useState(1.00)
    const crashAnimRef = useRef<number>(0)

    // Mines
    const [minesMise, setMinesMise] = useState(100)
    const [minesCount, setMinesCount] = useState(3)
    const [minesState, setMinesState] = useState<any>(null)
    const [minesLoading, setMinesLoading] = useState(false)

    const supa = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const fetchBalance = useCallback(async (gid: string) => {
        const res = await fetch(`/api/casino/balance?guildId=${gid}`)
        if (res.ok) {
            const data = await res.json()
            setUserInfo(data)
            setBalance(data.balance)
        }
    }, [])

    useEffect(() => {
        const gid = typeof window !== "undefined" ? localStorage.getItem("selected_guild") : null
        setGuildId(gid)
        if (!gid) { setLoading(false); return }

        async function init() {
            await fetchBalance(gid!)

            // Fetch bets
            try {
                const { data: bets } = await supa
                    .from("bets")
                    .select(`
            id, guild_id, creator_id, title, status, type, resolved_option_id, created_at,
            bet_options:bet_options!bet_options_bet_id_fkey(id, name),
            bet_participants(id, option_id, user_id, amount)
          `)
                    .eq("guild_id", gid)
                    .order("created_at", { ascending: false })
                    .limit(30)

                if (bets) {
                    const allIds = new Set<string>()
                    const processed = bets.map((bet: any) => {
                        let totalPool = 0
                        const optionTotals: Record<number, number> = {}
                        bet.bet_options?.forEach((opt: any) => { optionTotals[opt.id] = 0 })
                        bet.bet_participants?.forEach((p: any) => {
                            totalPool += Number(p.amount)
                            optionTotals[p.option_id] = (optionTotals[p.option_id] || 0) + Number(p.amount)
                        })
                        const VIRTUAL_POOL = 2000
                        const virtualPerOption = VIRTUAL_POOL / (bet.bet_options?.length || 1)
                        const virtualTotalPool = totalPool + VIRTUAL_POOL
                        const options = (bet.bet_options || []).map((opt: any) => {
                            const amt = optionTotals[opt.id] || 0
                            let odds = virtualTotalPool / (amt + virtualPerOption)
                            if (odds < 1.01) odds = 1.01
                            return { ...opt, totalMise: amt, odds: odds.toFixed(2) }
                        })
                        allIds.add(bet.creator_id)
                        bet.bet_participants?.forEach((p: any) => allIds.add(p.user_id))
                        return { id: bet.id, title: bet.title, status: bet.status, type: bet.type, created_at: bet.created_at, creator_id: bet.creator_id, resolved_option_id: bet.resolved_option_id, options, totalPool, participantCount: bet.bet_participants?.length || 0 }
                    })
                    setActiveBets(processed.filter((b: any) => b.status === "open" || b.status === "closed"))
                    setResolvedBets(processed.filter((b: any) => b.status === "resolved" || b.status === "cancelled").slice(0, 10))

                    if (allIds.size > 0) {
                        try { setProfiles(await getDiscordProfiles(Array.from(allIds), gid!)) } catch { }
                    }
                }
            } catch { }

            setLoading(false)
        }
        init()
    }, [fetchBalance])

    // ── Roulette spin ──
    async function spinRoulette() {
        if (!guildId || rouletteSpinning || activeRouletteBets.length === 0) return
        setRouletteSpinning(true)
        setRouletteResult(null)

        const res = await fetch("/api/casino/roulette", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guildId, bets: activeRouletteBets }),
        })

        const data = await res.json()
        if (!res.ok) {
            setRouletteSpinning(false)
            setRouletteResult({ error: data.error })
            return
        }

        // Animate wheel
        const targetIdx = WHEEL_ORDER.indexOf(data.number)
        const segmentAngle = 360 / 37
        const targetAngle = 360 - (targetIdx * segmentAngle)
        const spins = 5 + Math.floor(Math.random() * 3)
        const finalRotation = wheelRotation + spins * 360 + targetAngle
        setWheelRotation(finalRotation)

        // Wait for animation
        setTimeout(() => {
            setRouletteResult(data)
            setBalance(data.newBalance)
            setRouletteSpinning(false)
        }, 3500)
    }

    // ── Blackjack actions ──
    async function bjAction(action: string) {
        if (!guildId || bjLoading) return
        setBjLoading(true)

        const res = await fetch("/api/casino/blackjack", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guildId, action, mise: action === "start" ? bjMise : undefined }),
        })

        const data = await res.json()
        setBjLoading(false)

        if (!res.ok) {
            setBjState((prev: any) => prev ? { ...prev, error: data.error } : { initError: data.error })
            return
        }

        setBjState(data)
        if (data.newBalance !== undefined) setBalance(data.newBalance)
    }

    // ── Slots spin ──
    async function spinSlots() {
        if (!guildId || slotsSpinning) return
        setSlotsSpinning(true)
        setSlotsResult(null)

        const res = await fetch("/api/casino/slots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guildId, mise: slotsMise }),
        })

        const data = await res.json()
        if (!res.ok) {
            setSlotsSpinning(false)
            setSlotsResult({ error: data.error })
            return
        }

        // Animate reels
        const symbols = ["🍒", "🍋", "🍊", "🍇", "⭐", "💎", "7️⃣"]
        let tick = 0
        const interval = setInterval(() => {
            tick++
            setSlotsReels([
                tick < 8 ? symbols[Math.floor(Math.random() * symbols.length)] : data.reels[0].emoji,
                tick < 14 ? symbols[Math.floor(Math.random() * symbols.length)] : data.reels[1].emoji,
                tick < 20 ? symbols[Math.floor(Math.random() * symbols.length)] : data.reels[2].emoji,
            ])
            if (tick >= 20) {
                clearInterval(interval)
                setSlotsResult(data)
                setBalance(data.newBalance)
                setSlotsSpinning(false)
            }
        }, 100)
    }

    // ── Crash play ──
    async function playCrash() {
        if (!guildId || crashPlaying) return
        const targetNum = parseFloat(crashTarget)
        if (targetNum < 1.01 || targetNum > 1000) return

        setCrashPlaying(true)
        setCrashResult(null)
        setCrashCurrentMult(1.00)
        if (crashAnimRef.current) cancelAnimationFrame(crashAnimRef.current)

        try {
            const res = await fetch("/api/casino/crash", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ guildId, action: "start", mise: crashMise, cashoutMult: 1.00 }),
            })
            const data = await res.json()

            if (!res.ok) {
                setCrashPlaying(false)
                setCrashResult({ error: data.error })
                return
            }

            setBalance(data.newBalance) // Deduct bet immediately

            // Wait a small amount of time assuming 1 frame passes
            const START_TIME = performance.now()
            const actualCrashPoint = data.crashPoint || 1000;

            async function cashoutReq(mult: number) {
                try {
                    const cRes = await fetch("/api/casino/crash", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ guildId, action: "cashout", mise: crashMise, cashoutMult: mult }),
                    })
                    const cData = await cRes.json()

                    if (cData.status === "cashed_out" || cData.status === "crashed") {
                        if (crashAnimRef.current) cancelAnimationFrame(crashAnimRef.current)
                        setCrashCurrentMult(cData.status === "crashed" ? cData.crashPoint : mult)
                        setCrashResult({
                            won: cData.status === "cashed_out",
                            crashPoint: cData.crashPoint,
                            winnings: cData.winnings,
                            multiplier: cData.multiplier,
                            newBalance: cData.newBalance
                        })
                        if (cData.newBalance !== undefined) setBalance(cData.newBalance)
                        setCrashPlaying(false)
                    } else if (!cRes.ok || cData.error) {
                        setCrashResult({ error: cData.error || "Erreur lors du retrait" })
                        setCrashPlaying(false)
                        if (crashAnimRef.current) cancelAnimationFrame(crashAnimRef.current)
                    }
                } catch (e) { console.error("Crash cashout error", e); setCrashPlaying(false) }
            }

            // Expose manual cashout to window for button to use (temporary workaround since we anim in a loop)
            // Better to manage state, but we need the latest multiplier inside the callback.
            // We can just define a state variable `crashManualCashout` inside the effect, but we have `playCrash`.
            // Let's use `window.triggerCashout`.
            let isAborted = false;
            ; (window as any).triggerCrashCashout = () => {
                if (isAborted) return;
                isAborted = true;
                cashoutReq(parseFloat(document.getElementById('crash-multiplier-display')?.innerText || "1.00"))
                    ; (window as any).triggerCrashCashout = undefined;
            }

            // Animation loop
            const K = 0.0006 // vitesse exponentielle
            let sentAutoCashout = false;

            function step(now: number) {
                if (isAborted) return; // Might have been aborted by manual cashout
                const elapsed = now - START_TIME
                let m = 1.00 * Math.exp(K * elapsed)

                // The visual multiplier should not exceed the max possible, let's say 1000
                if (m > 1000) m = 1000;

                // Stop if it hits the actual crash point early
                if (m >= actualCrashPoint) {
                    m = actualCrashPoint;
                    setCrashCurrentMult(m);
                    isAborted = true;
                    // Force the server to record the loss by sending a cashout just above the crash point
                    cashoutReq(actualCrashPoint + 0.01);
                    return;
                }

                // If we reach the target, trigger automatic cashout
                if (m >= targetNum && !sentAutoCashout) {
                    m = targetNum; // freeze visual at target while waiting
                    sentAutoCashout = true;
                    cashoutReq(targetNum);
                }

                setCrashCurrentMult(m)

                if (!sentAutoCashout && typeof (window as any).triggerCrashCashout === "function") {
                    crashAnimRef.current = requestAnimationFrame(step)
                }
            }
            crashAnimRef.current = requestAnimationFrame(step)
        } catch (e) {
            setCrashPlaying(false);
            console.error(e)
        }
    }

    async function handleManualCashout() {
        if (typeof (window as any).triggerCrashCashout === "function") {
            (window as any).triggerCrashCashout();
        }
    }

    // ── Mines play ──
    async function playMines(action: "start" | "pick" | "cashout", pickIndex?: number) {
        if (!guildId || minesLoading) return

        if (action === "start" && minesState?.status === "playing") return
        if (action !== "start" && minesState?.status !== "playing") return

        setMinesLoading(true)
        if (action === "start") setMinesState({ status: "loading", board: Array(25).fill("?") })

        try {
            const res = await fetch("/api/casino/mines", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ guildId, action, mise: minesMise, minesCount, pickIndex }),
            })
            const data = await res.json()
            if (!res.ok) {
                if (action === "start") setMinesState({ error: data.error })
                return
            }

            // Delay reveal slightly for UX
            if (action === "pick") {
                setTimeout(() => setMinesState(data), 150)
            } else {
                setMinesState(data)
            }

            if (data.newBalance !== undefined) setBalance(data.newBalance)
        } catch (e) {
            console.error("Mines fetch error", e)
        } finally {
            setMinesLoading(false)
        }
    }

    function userName(userId: string) { return profiles.get(userId)?.username || "Utilisateur" }
    function userAvatar(userId: string) { return profiles.get(userId)?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png" }

    if (loading) {
        return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    }
    if (!guildId) {
        return <div className="flex h-96 items-center justify-center text-muted-foreground">Sélectionne un serveur</div>
    }

    const isGameOver = bjState?.status === "done" || bjState?.error || bjState?.initError;

    return (
        <div className="space-y-6">
            {/* Header with balance */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Casino</h1>
                    <p className="text-muted-foreground">Roulette, Blackjack et paris</p>
                </div>
                <Card className="border-border bg-gradient-to-r from-amber-500/10 to-yellow-500/10 sm:w-auto">
                    <CardContent className="flex items-center gap-3 p-4">
                        <Wallet className="h-5 w-5 text-amber-500" />
                        <div>
                            <p className="text-xs text-muted-foreground">Ton solde</p>
                            <p className="text-xl font-bold text-amber-500">{fmtEcus(balance)} pq</p>
                        </div>
                        <Button variant="ghost" size="icon" className="ml-2 h-8 w-8" onClick={() => guildId && fetchBalance(guildId)}>
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="roulette" className="w-full">
                <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto p-1">
                    <TabsTrigger value="roulette" className="gap-2 p-2">
                        <span className="text-lg leading-none">🎰</span>
                        <span className="hidden sm:inline">Roulette</span>
                    </TabsTrigger>
                    <TabsTrigger value="blackjack" className="gap-2 p-2">
                        <span className="text-lg leading-none">🃏</span>
                        <span className="hidden sm:inline">Blackjack</span>
                    </TabsTrigger>
                    <TabsTrigger value="slots" className="gap-2 p-2">
                        <span className="text-lg leading-none">🍒</span>
                        <span className="hidden sm:inline">Machine à sous</span>
                    </TabsTrigger>
                    <TabsTrigger value="crash" className="gap-2 p-2">
                        <span className="text-lg leading-none">🚀</span>
                        <span className="hidden sm:inline">Crash</span>
                    </TabsTrigger>
                    <TabsTrigger value="mines" className="gap-2 p-2">
                        <span className="text-lg leading-none">💣</span>
                        <span className="hidden sm:inline">Mines</span>
                    </TabsTrigger>
                    <TabsTrigger value="bets" className="gap-2 p-2">
                        <Dices className="h-4 w-4" />
                        <span className="hidden sm:inline">Paris</span>
                    </TabsTrigger>
                </TabsList>

                {/* ═══════════════ ROULETTE ═══════════════ */}
                <TabsContent value="roulette" className="mt-6 space-y-6">
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Wheel */}
                        <Card className="border-border bg-gradient-to-br from-card to-emerald-500/5">
                            <CardHeader>
                                <CardTitle className="text-center">🎰 Roulette Européenne</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center space-y-6">
                                {/* Visual Wheel */}
                                <div className="relative w-72 h-72">
                                    {/* Pointer */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[20px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-lg" />

                                    {/* Spinning wheel */}
                                    <div
                                        className="w-72 h-72 rounded-full border-4 border-amber-500/50 overflow-hidden shadow-2xl shadow-amber-500/10"
                                        style={{
                                            transform: `rotate(${wheelRotation}deg)`,
                                            transition: rouletteSpinning ? "transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
                                        }}
                                    >
                                        <svg viewBox="0 0 200 200" className="w-full h-full">
                                            {WHEEL_ORDER.map((num, i) => {
                                                const angle = (i * 360) / 37
                                                const nextAngle = ((i + 1) * 360) / 37
                                                const midAngle = (angle + nextAngle) / 2
                                                const rOuter = 100
                                                const rInner = 40
                                                const a1 = (angle - 90) * (Math.PI / 180)
                                                const a2 = (nextAngle - 90) * (Math.PI / 180)
                                                const aM = (midAngle - 90) * (Math.PI / 180)
                                                const x1o = 100 + rOuter * Math.cos(a1)
                                                const y1o = 100 + rOuter * Math.sin(a1)
                                                const x2o = 100 + rOuter * Math.cos(a2)
                                                const y2o = 100 + rOuter * Math.sin(a2)
                                                const x1i = 100 + rInner * Math.cos(a2)
                                                const y1i = 100 + rInner * Math.sin(a2)
                                                const x2i = 100 + rInner * Math.cos(a1)
                                                const y2i = 100 + rInner * Math.sin(a1)
                                                const textR = 73
                                                const tx = 100 + textR * Math.cos(aM)
                                                const ty = 100 + textR * Math.sin(aM)
                                                const fill = num === 0 ? "#059669" : RED_SET.has(num) ? "#dc2626" : "#18181b"
                                                return (
                                                    <g key={num}>
                                                        <path
                                                            d={`M ${x1o} ${y1o} A ${rOuter} ${rOuter} 0 0 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${rInner} ${rInner} 0 0 0 ${x2i} ${y2i} Z`}
                                                            fill={fill}
                                                            stroke="#333"
                                                            strokeWidth="0.5"
                                                        />
                                                        <text
                                                            x={tx} y={ty}
                                                            textAnchor="middle"
                                                            dominantBaseline="central"
                                                            fill="white"
                                                            fontSize="6"
                                                            fontWeight="bold"
                                                            transform={`rotate(${midAngle}, ${tx}, ${ty})`}
                                                        >
                                                            {num}
                                                        </text>
                                                    </g>
                                                )
                                            })}
                                            <circle cx="100" cy="100" r="38" fill="#1a1a2e" stroke="#333" strokeWidth="1" />
                                            <text x="100" y="100" textAnchor="middle" dominantBaseline="central" fill="#f59e0b" fontSize="10" fontWeight="bold">
                                                {rouletteResult ? rouletteResult.number : "🎰"}
                                            </text>
                                        </svg>
                                    </div>
                                </div>

                                {/* Result */}
                                {rouletteResult && !rouletteResult.error && (
                                    <div className={`rounded-2xl p-4 text-center w-full ${rouletteResult.won ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
                                        <div className="flex items-center justify-center gap-3 mb-2">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${numberColor(rouletteResult.number)}`}>
                                                {rouletteResult.number}
                                            </div>
                                            <span className="text-lg font-bold">
                                                {rouletteResult.color === "red" ? "🔴 Rouge" : rouletteResult.color === "black" ? "⚫ Noir" : "🟢 Vert"}
                                            </span>
                                        </div>
                                        <div className="text-sm mb-2 text-muted-foreground break-words">
                                            {rouletteResult.results.map((r: any, i: number) => (
                                                <span key={i} className={r.won ? "text-emerald-400" : "text-red-400"}>
                                                    {r.bet} ({fmtEcus(r.mise)}pq){r.won ? ` +${fmtEcus(r.winnings)}` : ""}
                                                    {i < rouletteResult.results.length - 1 ? " | " : ""}
                                                </span>
                                            ))}
                                        </div>
                                        <p className={`text-xl font-bold ${rouletteResult.won ? "text-emerald-400" : "text-red-400"}`}>
                                            {rouletteResult.won ? `+${fmtEcus(rouletteResult.winnings)} pq 🎉` : `-${fmtEcus(rouletteResult.totalMise)} pq`}
                                        </p>
                                    </div>
                                )}
                                {rouletteResult?.error && (
                                    <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-center text-red-400 w-full">
                                        ❌ {rouletteResult.error}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Bet controls */}
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <CardTitle>Placer ta mise</CardTitle>
                                <CardDescription>Choisis ton pari et le montant</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {/* Mise amount */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Montant</label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number" min={1} max={50000}
                                            value={rouletteMise}
                                            onChange={e => setRouletteMise(Math.max(1, parseInt(e.target.value) || 0))}
                                            className="flex-1"
                                        />
                                        <div className="flex gap-1">
                                            {[100, 500, 1000, 5000].map(v => (
                                                <Button key={v} variant="outline" size="sm" className="text-xs" onClick={() => setRouletteMise(v)}>
                                                    {v >= 1000 ? `${v / 1000}k` : v}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Bet type selection */}
                                <div className="space-y-3">
                                    {BET_GROUPS.map(group => (
                                        <div key={group.label} className="space-y-1.5">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{group.label}</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {group.bets.map(b => {
                                                    const isActive = activeRouletteBets.some(ab => ab.bet === b.value);
                                                    return (
                                                        <Button
                                                            key={b.value}
                                                            variant={isActive ? "default" : "outline"}
                                                            size="sm"
                                                            className="text-xs"
                                                            onClick={() => handleAddRouletteBet(b.value, b.label)}
                                                        >
                                                            {b.label} <span className="ml-1 opacity-60">{b.mult}</span>
                                                        </Button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Direct number bet */}
                                    <div className="space-y-1.5">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Numéro direct (×36)</p>
                                        <div className="flex gap-2 items-center">
                                            <Input
                                                type="number" min={0} max={36}
                                                placeholder="0-36"
                                                value={rouletteNumberInput}
                                                onChange={e => setRouletteNumberInput(e.target.value)}
                                                className="w-24"
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    if (rouletteNumberInput !== "" && parseInt(rouletteNumberInput) >= 0 && parseInt(rouletteNumberInput) <= 36) {
                                                        handleAddRouletteBet(rouletteNumberInput, `Numéro ${rouletteNumberInput}`);
                                                        setRouletteNumberInput("");
                                                    }
                                                }}
                                            >Ajouter</Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Active Bets Summary */}
                                {activeRouletteBets.length > 0 && (
                                    <div className="flex flex-col gap-2 p-3 rounded-lg bg-black/20 border border-white/5">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-semibold">Paris en cours</span>
                                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={handleClearRouletteBets}>Tout effacer</Button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {activeRouletteBets.map(b => (
                                                <Badge key={b.bet} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 bg-white/5">
                                                    <span>{b.label} <span className="text-amber-400 ml-1">{fmtEcus(b.mise)} pq</span></span>
                                                    <div
                                                        className="ml-1 cursor-pointer opacity-50 hover:opacity-100 p-0.5 rounded-full hover:bg-white/10"
                                                        onClick={() => handleRemoveRouletteBet(b.bet)}
                                                    >
                                                        ✕
                                                    </div>
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="text-right text-sm text-muted-foreground mt-1">
                                            Total: <span className="text-amber-400 font-bold">{fmtEcus(activeRouletteBets.reduce((acc, b) => acc + b.mise, 0))} pq</span>
                                        </div>
                                    </div>
                                )}

                                {/* Spin button */}
                                <Button
                                    className="w-full h-14 text-lg font-bold gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/20"
                                    disabled={rouletteSpinning || activeRouletteBets.length === 0}
                                    onClick={spinRoulette}
                                >
                                    {rouletteSpinning ? (
                                        <><Loader2 className="h-5 w-5 animate-spin" /> La roue tourne...</>
                                    ) : (
                                        <>🎰 Tourner la roue — {fmtEcus(activeRouletteBets.reduce((acc, b) => acc + b.mise, 0))} pq</>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Roulette table grid */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle>Table de la Roulette</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <div className="grid grid-cols-13 gap-0.5 min-w-[520px]" style={{ gridTemplateColumns: "repeat(13, 1fr)" }}>
                                    {/* 0 spanning first column */}
                                    <button
                                        onClick={() => handleAddRouletteBet("0", "Numéro 0")}
                                        className={`row-span-3 rounded-lg flex items-center justify-center text-sm font-bold text-white transition-all hover:scale-105 ${activeRouletteBets.some(ab => ab.bet === "0") ? "ring-2 ring-amber-400 scale-105" : ""} bg-emerald-600 h-full min-h-[80px]`}
                                    >
                                        0
                                    </button>
                                    {/* Numbers 1-36 in 3 rows */}
                                    {[
                                        [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
                                        [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
                                        [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
                                    ].map((row, ri) =>
                                        row.map(n => (
                                            <button
                                                key={n}
                                                onClick={() => handleAddRouletteBet(String(n), `Numéro ${n}`)}
                                                className={`h-[28px] rounded flex items-center justify-center text-xs font-bold text-white transition-all hover:scale-110 ${activeRouletteBets.some(ab => ab.bet === String(n)) ? "ring-2 ring-amber-400 scale-110" : ""} ${RED_SET.has(n) ? "bg-red-600 hover:bg-red-500" : "bg-zinc-800 hover:bg-zinc-700"}`}
                                            >
                                                {n}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══════════════ BLACKJACK ═══════════════ */}
                <TabsContent value="blackjack" className="mt-6 space-y-6">
                    <Card className="border-border bg-gradient-to-br from-card via-card to-emerald-500/5">
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl">🃏 Blackjack</CardTitle>
                            <CardDescription>Bat le croupier sans dépasser 21</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            {/* Game table */}
                            {bjState && !bjState.initError ? (
                                <div className="space-y-8">
                                    {/* Dealer */}
                                    <div className="text-center space-y-3">
                                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                            Croupier {isGameOver ? `— ${bjState.dealerValue}` : `— ${bjState.dealerValue}+?`}
                                        </p>
                                        <div className="flex justify-center gap-3 flex-wrap">
                                            {bjState.dealer.map((card: BJCard, i: number) => (
                                                <PlayingCard key={i} card={card} delay={isGameOver && i === 1 ? 300 : 0} />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Divider with result */}
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 h-px bg-border" />
                                        {isGameOver && (
                                            <div className="flex flex-col gap-2">
                                                {bjState.results.map((res: string, i: number) => (
                                                    <div key={i} className={`px-6 py-2 rounded-full font-bold text-sm text-center ${res === "win" || res === "blackjack" || res === "dealer_bust"
                                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                                        : res === "push"
                                                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                                            : "bg-red-500/10 text-red-400 border border-red-500/30"
                                                        }`}>
                                                        {bjState.hands.length > 1 && <span className="opacity-70 mr-2">Main {i + 1}</span>}
                                                        {res === "blackjack" && "🎰 BLACKJACK !"}
                                                        {res === "win" && "✅ Tu gagnes !"}
                                                        {res === "dealer_bust" && "💥 Croupier bust !"}
                                                        {res === "push" && "🤝 Égalité"}
                                                        {res === "bust" && "💀 Bust !"}
                                                        {res === "lose" && "❌ Perdu"}
                                                    </div>
                                                ))}
                                                {bjState.totalPayout > 0 && <div className="text-center font-bold text-emerald-400">+{fmtEcus(bjState.totalPayout)} pq</div>}
                                            </div>
                                        )}
                                        <div className="flex-1 h-px bg-border" />
                                    </div>

                                    {/* Player Hands */}
                                    <div className="flex flex-col gap-6">
                                        {bjState.hands.map((hand: BJCard[], i: number) => {
                                            const v = bjState.values[i];
                                            const isActive = !isGameOver && i === bjState.currentHand;
                                            return (
                                                <div key={i} className={`text-center space-y-3 transition-opacity duration-300 ${!isActive && !isGameOver ? "opacity-50" : "opacity-100"}`}>
                                                    <div className="flex justify-center gap-3 flex-wrap relative">
                                                        {isActive && <div className="absolute -left-8 top-1/2 -translate-y-1/2 text-xl animate-pulse">👉</div>}
                                                        {hand.map((card: BJCard, j: number) => (
                                                            <PlayingCard key={j} card={card} delay={j >= 2 ? 200 : 0} />
                                                        ))}
                                                    </div>
                                                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                                        {bjState.hands.length > 1 ? `Main ${i + 1} — ` : "Toi — "}
                                                        <span className={`font-bold ${v > 21 ? "text-red-400" : v === 21 ? "text-emerald-400" : "text-foreground"}`}>{v}</span>
                                                    </p>
                                                    <div className="flex justify-center">
                                                        <Badge variant="outline" className={`bg-amber-500/5 text-amber-400 border-amber-500/20`}>
                                                            Mise: {fmtEcus(bjState.bets[i])} pq{bjState.doubled[i] && " (double)"}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>



                                    {/* Actions */}
                                    {!isGameOver ? (
                                        <div className="flex justify-center gap-3 flex-wrap border-t border-border pt-6">
                                            <Button
                                                onClick={() => bjAction("hit")}
                                                disabled={bjLoading}
                                                className="bg-blue-600 hover:bg-blue-500 text-white gap-2 h-12 px-8"
                                            >
                                                {bjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "🎯"} Tirer
                                            </Button>
                                            <Button
                                                onClick={() => bjAction("stand")}
                                                disabled={bjLoading}
                                                variant="outline"
                                                className="gap-2 h-12 px-8"
                                            >
                                                ✋ Rester
                                            </Button>
                                            <Button
                                                onClick={() => bjAction("double")}
                                                disabled={bjLoading || !bjState.canAfford || bjState.hands[bjState.currentHand].length > 2}
                                                className="bg-amber-600 hover:bg-amber-500 text-white gap-2 h-12 px-8"
                                            >
                                                💰 Doubler
                                            </Button>
                                            {bjState.canSplit && (
                                                <Button
                                                    onClick={() => bjAction("split")}
                                                    disabled={bjLoading || !bjState.canAfford}
                                                    className="bg-purple-600 hover:bg-purple-500 text-white gap-2 h-12 px-8"
                                                >
                                                    ✂️ Séparer
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex justify-center border-t border-border pt-6">
                                            <Button
                                                onClick={() => setBjState(null)}
                                                className="gap-2 h-12 px-8 bg-gradient-to-r from-primary to-primary/80"
                                            >
                                                <RotateCcw className="h-4 w-4" /> Nouvelle partie
                                            </Button>
                                        </div>
                                    )}

                                    {bjState.error && (
                                        <p className="text-center text-red-400">❌ {bjState.error}</p>
                                    )}
                                </div>
                            ) : (
                                /* Start new game */
                                <div className="flex flex-col items-center space-y-6 py-8">
                                    <div className="flex gap-3 opacity-30">
                                        {[{ suit: "♠", rank: "A" }, { suit: "♥", rank: "K" }].map((c, i) => (
                                            <PlayingCard key={i} card={c} />
                                        ))}
                                    </div>
                                    <div className="space-y-3 text-center">
                                        <p className="text-muted-foreground">Place ta mise pour commencer</p>
                                        <div className="flex items-center gap-2 justify-center">
                                            <Input
                                                type="number" min={1} max={50000}
                                                value={bjMise}
                                                onChange={e => setBjMise(Math.max(1, parseInt(e.target.value) || 0))}
                                                className="w-32 text-center"
                                            />
                                            <span className="text-muted-foreground">pq</span>
                                        </div>
                                        <div className="flex gap-2 justify-center">
                                            {[100, 500, 1000, 5000].map(v => (
                                                <Button key={v} variant="outline" size="sm" className="text-xs" onClick={() => setBjMise(v)}>
                                                    {v >= 1000 ? `${v / 1000}k` : v}
                                                </Button>
                                            ))}
                                        </div>
                                        <Button
                                            className="h-14 px-10 text-lg font-bold gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20"
                                            disabled={bjLoading || bjMise <= 0}
                                            onClick={() => bjAction("start")}
                                        >
                                            {bjLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "🃏"} Jouer — {fmtEcus(bjMise)} pq
                                        </Button>
                                        {bjState?.initError && (
                                            <p className="text-sm font-medium text-red-400">❌ {bjState.initError}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══════════════ MACHINE À SOUS ═══════════════ */}
                <TabsContent value="slots" className="mt-6 space-y-6">
                    <Card className="border-border bg-gradient-to-br from-card via-card to-purple-500/5">
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl">🍒 Machine à Sous</CardTitle>
                            <CardDescription>Aligne 3 symboles identiques pour gagner !</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            {/* Slot machine display */}
                            <div className="flex justify-center">
                                <div className="rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 border-4 border-amber-500/30 p-8 shadow-2xl shadow-amber-500/10">
                                    <div className="flex gap-4">
                                        {slotsReels.map((emoji, i) => (
                                            <div
                                                key={i}
                                                className={`w-24 h-24 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-800 border-2 border-zinc-600 flex items-center justify-center text-5xl transition-all duration-200 ${slotsSpinning ? "animate-bounce" : ""
                                                    } ${slotsResult?.won && slotsResult?.type === "triple" ? "ring-4 ring-amber-400 shadow-lg shadow-amber-400/30" : ""}`}
                                                style={slotsSpinning ? { animationDelay: `${i * 100}ms` } : {}}
                                            >
                                                {emoji}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Payout table */}
                            <div className="grid grid-cols-4 gap-2 text-center text-sm">
                                {[
                                    { emoji: "🍒", name: "Cerise", mult: "×3" },
                                    { emoji: "🍋", name: "Citron", mult: "×5" },
                                    { emoji: "🍊", name: "Orange", mult: "×8" },
                                    { emoji: "🍇", name: "Raisin", mult: "×12" },
                                    { emoji: "⭐", name: "Étoile", mult: "×25" },
                                    { emoji: "💎", name: "Diamant", mult: "×100" },
                                    { emoji: "7️⃣", name: "JACKPOT", mult: "×500" },
                                ].map(s => (
                                    <div key={s.name} className="rounded-xl bg-muted/30 p-2">
                                        <span className="text-xl">{s.emoji}</span>
                                        <p className="text-xs text-muted-foreground mt-1">{s.mult}</p>
                                    </div>
                                ))}
                                <div className="rounded-xl bg-muted/30 p-2">
                                    <span className="text-sm">2x</span>
                                    <p className="text-xs text-muted-foreground mt-1">÷1/4</p>
                                </div>
                            </div>

                            {/* Result */}
                            {slotsResult && !slotsResult.error && (
                                <div className={`rounded-2xl p-5 text-center ${slotsResult.won ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-red-500/10 border border-red-500/30"} ${slotsResult.isJackpot ? "ring-2 ring-amber-400 animate-pulse" : ""}`}>
                                    {slotsResult.isJackpot && <p className="text-3xl font-black text-amber-400 mb-2">🎰 JACKPOT !!! 🎰</p>}
                                    <p className={`text-xl font-bold ${slotsResult.won ? "text-emerald-400" : "text-red-400"}`}>
                                        {slotsResult.won
                                            ? `+${fmtEcus(slotsResult.winnings)} pq (×${slotsResult.multiplier}) 🎉`
                                            : `-${fmtEcus(slotsMise)} pq`}
                                    </p>
                                    {slotsResult.type === "double" && <p className="text-sm text-muted-foreground mt-1">2 symboles identiques !</p>}
                                    {slotsResult.type === "triple" && <p className="text-sm text-muted-foreground mt-1">3 symboles identiques !</p>}
                                </div>
                            )}
                            {slotsResult?.error && (
                                <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-center text-red-400">
                                    ❌ {slotsResult.error}
                                </div>
                            )}

                            {/* Controls */}
                            <div className="flex flex-col items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number" min={1} max={50000}
                                        value={slotsMise}
                                        onChange={e => setSlotsMise(Math.max(1, parseInt(e.target.value) || 0))}
                                        className="w-32 text-center"
                                    />
                                    <span className="text-muted-foreground">pq</span>
                                </div>
                                <div className="flex gap-2">
                                    {[100, 500, 1000, 5000].map(v => (
                                        <Button key={v} variant="outline" size="sm" className="text-xs" onClick={() => setSlotsMise(v)}>
                                            {v >= 1000 ? `${v / 1000}k` : v}
                                        </Button>
                                    ))}
                                </div>
                                <Button
                                    className="h-14 px-10 text-lg font-bold gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 shadow-lg shadow-purple-500/20 w-full max-w-sm"
                                    disabled={slotsSpinning || slotsMise <= 0}
                                    onClick={spinSlots}
                                >
                                    {slotsSpinning ? (
                                        <><Loader2 className="h-5 w-5 animate-spin" /> Spinning...</>
                                    ) : (
                                        <>🍒 Tirer le levier — {fmtEcus(slotsMise)} pq</>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══════════════ CRASH GAME ═══════════════ */}
                <TabsContent value="crash" className="mt-6 space-y-6">
                    <Card className="border-border bg-gradient-to-br from-card via-card to-orange-500/5">
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl">🚀 Crash</CardTitle>
                            <CardDescription>La fusée s'envole... Multiplie tes gains avant l'explosion !</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            {/* Visual Display */}
                            <div className="relative h-64 w-full rounded-3xl bg-zinc-950 border border-zinc-800 overflow-hidden flex items-center shadow-inner">
                                {/* Grid Background */}
                                <div className="absolute inset-0 opacity-10" style={{
                                    backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                                    backgroundSize: "20px 20px"
                                }} />

                                {/* Multiplier Number */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div
                                        id="crash-multiplier-display"
                                        className={`z-10 text-7xl font-black tabular-nums transition-colors duration-200 ${crashResult && !crashResult.won && !crashResult.error ? "text-red-500" :
                                            crashResult && crashResult.won && !crashResult.error ? "text-emerald-400" :
                                                "text-white"
                                            }`}>
                                        {crashCurrentMult.toFixed(2)}x
                                    </div>
                                </div>

                                {/* Cashed out notification mid-flight */}
                                {crashPlaying && crashResult?.won && (
                                    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 text-xl font-bold font-mono text-emerald-400 bg-emerald-500/10 px-4 py-1.5 rounded-full ring-1 ring-emerald-500/50 animate-bounce">
                                        Retrait effectué!
                                    </div>
                                )}

                                {/* Rocket Animation */}
                                {crashCurrentMult >= 1.00 && (!crashResult || crashResult.won) && (
                                    <div
                                        className="absolute z-20 text-6xl transition-all duration-75"
                                        style={{
                                            // Make rocket curve up and to the right
                                            left: `${Math.min(80, (crashCurrentMult - 1) * 10 + 10)}%`,
                                            bottom: `${Math.min(70, (crashCurrentMult - 1) * 15 + 10)}%`,
                                            transform: `rotate(${Math.min(45, (crashCurrentMult - 1) * 20)}deg)`
                                        }}
                                    >
                                        🚀
                                    </div>
                                )}

                                {/* Explosion Emoji */}
                                {crashResult && !crashResult.error && !crashResult.won && (
                                    <div
                                        className="absolute z-20 text-7xl animate-[ping_0.5s_ease-out_forwards]"
                                        style={{
                                            left: `${Math.min(80, (crashResult.crashPoint - 1) * 10 + 10)}%`,
                                            bottom: `${Math.min(70, (crashResult.crashPoint - 1) * 15 + 10)}%`,
                                        }}
                                    >
                                        💥
                                    </div>
                                )}
                            </div>

                            <div className="max-w-xl mx-auto space-y-6">
                                {/* Result Alert */}
                                {crashResult && !crashResult.error && (
                                    <div className={`rounded-2xl p-4 text-center border ${crashResult.won ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
                                        <p className="font-bold text-lg">
                                            {crashResult.won ? `Retrait réussi (+${fmtEcus(crashResult.winnings)} pq)` : `Crashed à ${crashResult.crashPoint}x !`}
                                        </p>
                                        {!crashResult.won && <p className="text-sm opacity-80 mt-1">La fusée a explosé avant ton objectif de {crashTarget}x</p>}
                                    </div>
                                )}
                                {crashResult?.error && (
                                    <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-center text-red-400">
                                        ❌ {crashResult.error}
                                    </div>
                                )}

                                {/* Controls */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Mise */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">Mise (pq)</label>
                                        <Input
                                            type="number" min={1} max={500000}
                                            value={crashMise}
                                            onChange={e => setCrashMise(Math.max(1, parseInt(e.target.value) || 0))}
                                            disabled={crashPlaying}
                                            className="text-lg h-12"
                                        />
                                        <div className="flex gap-1">
                                            {[100, 1000, "1/2", "Max"].map(v => (
                                                <Button key={v} variant="outline" size="sm" className="text-xs h-8 flex-1 px-0"
                                                    disabled={crashPlaying}
                                                    onClick={() => {
                                                        if (v === "1/2") setCrashMise(Math.max(1, Math.floor(crashMise / 2)))
                                                        else if (v === "Max") setCrashMise(Math.min(500000, balance))
                                                        else setCrashMise(v as number)
                                                    }}>
                                                    {v}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Target Multiplier */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">Retrait Auto (x)</label>
                                        <Input
                                            type="number" min={1.01} step={0.10}
                                            value={crashTarget}
                                            onChange={e => setCrashTarget(e.target.value)}
                                            disabled={crashPlaying}
                                            className="text-lg h-12"
                                        />
                                        <div className="flex gap-1">
                                            {["1.50", "2.00", "5.00", "10.0"].map(v => (
                                                <Button key={v} variant="outline" size="sm" className="text-xs h-8 flex-1 px-0"
                                                    disabled={crashPlaying}
                                                    onClick={() => setCrashTarget(v)}>
                                                    {v}x
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {crashPlaying ? (
                                    <Button
                                        className="w-full h-16 text-xl font-bold overflow-hidden relative group bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20"
                                        onClick={handleManualCashout}
                                    >
                                        <span className="flex items-center gap-2 relative z-10">Encaisser {((crashMise * crashCurrentMult) || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} pq</span>
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-0" />
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full h-16 text-xl font-bold overflow-hidden relative group bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 shadow-lg shadow-orange-900/20"
                                        disabled={crashMise <= 0 || parseFloat(crashTarget) < 1.01}
                                        onClick={playCrash}
                                    >
                                        <span className="flex items-center gap-2 relative z-10">Décoller 🚀</span>
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-0" />
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══════════════ MINES GAME ═══════════════ */}
                <TabsContent value="mines" className="mt-6 space-y-6">
                    <Card className="border-border bg-card">
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl">💣 Mines</CardTitle>
                            <CardDescription>Découvre les étoiles et évite les mines pour multiplier tes gains !</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Inputs & Cashout */}
                            <div className="flex flex-col sm:flex-row gap-4 items-end">
                                <div className="space-y-2 flex-1 relative">
                                    <label className="text-sm font-medium">Mise (pq)</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={minesMise}
                                        onChange={(e) => setMinesMise(Number(e.target.value))}
                                        disabled={minesState?.status === "playing" || minesLoading}
                                        className="bg-zinc-900 border-zinc-800 focus-visible:ring-primary/50 text-white rounded-xl h-12 text-lg"
                                    />
                                    <div className="absolute right-2 top-[34px] flex gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => setMinesMise(Math.max(1, minesMise / 2))} disabled={minesState?.status === "playing" || minesLoading} className="h-8 w-8 p-0">/2</Button>
                                        <Button variant="ghost" size="sm" onClick={() => setMinesMise(minesMise * 2)} disabled={minesState?.status === "playing" || minesLoading} className="h-8 w-8 p-0">x2</Button>
                                    </div>
                                </div>
                                <div className="space-y-2 flex-1">
                                    <label className="text-sm font-medium">Nombre de mines ({minesCount})</label>
                                    <div className="flex items-center gap-2 h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4">
                                        <input
                                            type="range"
                                            min="1" max="24"
                                            value={minesCount}
                                            onChange={(e) => setMinesCount(Number(e.target.value))}
                                            disabled={minesState?.status === "playing" || minesLoading}
                                            className="w-full accent-primary"
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 w-full sm:w-auto h-12">
                                    {minesState?.status === "playing" ? (
                                        <Button
                                            size="lg"
                                            className="w-full h-full font-bold text-lg bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
                                            onClick={() => playMines("cashout")}
                                            disabled={minesLoading || minesState?.revealed?.length === 0}
                                        >
                                            Encaisser {(minesMise * (minesState?.multiplier || 1)).toLocaleString("fr-FR")} pq
                                        </Button>
                                    ) : (
                                        <Button
                                            size="lg"
                                            className="w-full h-full font-bold text-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                                            onClick={() => playMines("start")}
                                            disabled={minesLoading || minesMise <= 0 || minesMise > balance || minesCount < 1 || minesCount > 24}
                                        >
                                            {minesLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Jouer"}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Math / Multiplier Info */}
                            {minesState?.status === "playing" && (
                                <div className="flex justify-between items-center px-4 py-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                                    <span className="text-muted-foreground text-sm font-medium">Diamants trouvés : <span className="text-white">{minesState.revealed?.length || 0}</span></span>
                                    <span className="text-muted-foreground text-sm font-medium">Multiplicateur : <span className="text-primary text-lg font-bold">{minesState.multiplier?.toFixed(2)}x</span></span>
                                </div>
                            )}

                            {/* End Game Messages */}
                            {minesState?.status === "bombed" && (
                                <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-xl text-center">
                                    <p className="text-red-400 font-bold text-lg">💥 BOUM ! La mine a explosé.</p>
                                    <p className="text-muted-foreground">Vous avez perdu {minesState.mise?.toLocaleString("fr-FR")} pq.</p>
                                </div>
                            )}
                            {minesState?.status === "cashed_out" && (
                                <div className="p-4 bg-green-950/40 border border-green-900/50 rounded-xl text-center animate-in zoom-in duration-300">
                                    <p className="text-green-400 font-bold text-lg">💰 Encaissement réussi !</p>
                                    <p className="text-green-300">Gains : +{minesState.winnings?.toLocaleString("fr-FR")} pq ({minesState.multiplier?.toFixed(2)}x)</p>
                                </div>
                            )}
                            {minesState?.error && (
                                <div className="p-4 bg-red-950 border border-red-900 rounded-xl text-center">
                                    <p className="text-red-400 font-bold">{minesState.error}</p>
                                </div>
                            )}

                            {/* 5x5 Grid */}
                            <div className="flex justify-center mt-8">
                                <div className="grid grid-cols-5 gap-2 sm:gap-3 p-4 bg-zinc-900/80 rounded-2xl border border-zinc-800/50 shadow-inner w-full max-w-md aspect-square">
                                    {Array.from({ length: 25 }).map((_, i) => {
                                        const isRevealed = minesState?.status !== "playing" && minesState?.board ? true : minesState?.revealed?.includes(i);
                                        const content = isRevealed ? (minesState?.board ? minesState.board[i] : 'gem') : null;

                                        // Styling based on state
                                        const isBomb = content === 'bomb';
                                        const isGem = content === 'gem';
                                        // Highlight the bomb that killed the player
                                        const isFatalBomb = isBomb && minesState?.status === "bombed" && !minesState?.revealed?.includes(i) === false; // (Wait, the backend clears cookie, so revealed doesn't contain the fatal bomb perfectly if we don't save it. Actually, backend adds to revealed BEFORE sending status="bombed". So the last item in revealed is the fatal bomb).
                                        const isLastPicked = minesState?.revealed?.[minesState.revealed.length - 1] === i;

                                        // Dim unpicked tiles when game is over
                                        const isDimmed = minesState?.status !== "playing" && minesState?.board && !minesState?.revealed?.includes(i) && !isBomb;

                                        return (
                                            <button
                                                key={`mine-${i}`}
                                                disabled={minesState?.status !== "playing" || isRevealed || minesLoading}
                                                onClick={() => playMines("pick", i)}
                                                className={`
                                                    relative w-full h-full rounded-xl transition-all duration-300 ease-out transform
                                                    flex items-center justify-center text-3xl sm:text-4xl shadow-sm
                                                    ${!isRevealed ? "bg-zinc-800 hover:bg-zinc-700 hover:scale-[1.03] hover:shadow-md border-b-4 border-zinc-900 cursor-pointer" : ""}
                                                    ${isGem ? "bg-emerald-900/40 border border-emerald-500/30 shadow-[inset_0_0_15px_rgba(16,185,129,0.2)]" : ""}
                                                    ${isBomb ? "bg-red-900/40 border border-red-500/30 shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]" : ""}
                                                    ${isFatalBomb && isLastPicked ? "bg-red-600/60 scale-105 border-red-500 z-10 animate-pulse" : ""}
                                                    ${isDimmed ? "opacity-30" : "opacity-100"}
                                                `}
                                                style={{ perspective: "1000px" }}
                                            >
                                                {/* Animation wrapper for content */}
                                                <div className={`transition-all duration-500 ${isRevealed ? "scale-100 rotate-y-0 opacity-100" : "scale-50 rotate-y-90 opacity-0"}`}>
                                                    {isBomb && "💣"}
                                                    {isGem && "💎"}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══════════════ PARIS ═══════════════ */}
                <TabsContent value="bets" className="mt-6 space-y-6">
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Dices className="h-5 w-5 text-purple-500" />
                                Paris en cours
                            </CardTitle>
                            <CardDescription>Paris ouverts ou en attente • Mise via /pari sur Discord</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {activeBets.length === 0 ? (
                                <p className="py-8 text-center text-muted-foreground">Aucun pari en cours — Crée un pari avec /pari sur Discord !</p>
                            ) : (
                                <div className="space-y-4">
                                    {activeBets.map(bet => (
                                        <div key={bet.id} className="rounded-2xl border border-border bg-muted/30 p-5 space-y-4">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="text-lg font-semibold text-foreground">{bet.title}</h3>
                                                    <p className="text-sm text-muted-foreground mt-0.5">Par {userName(bet.creator_id)} · {timeAgo(bet.created_at)}</p>
                                                </div>
                                                <Badge className={bet.status === "open" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"}>
                                                    {bet.status === "open" ? "🟢 Ouvert" : "🟡 Fermé"}
                                                </Badge>
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {bet.options.map((opt: any) => {
                                                    const pct = bet.totalPool > 0 ? (opt.totalMise / bet.totalPool) * 100 : 0
                                                    return (
                                                        <div key={opt.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-medium text-foreground">{opt.name}</span>
                                                                <Badge variant="outline" className="text-primary">×{opt.odds}</Badge>
                                                            </div>
                                                            <Progress value={pct} className="h-1.5" />
                                                            <p className="text-xs text-muted-foreground">{fmtEcus(opt.totalMise)} pq ({pct.toFixed(0)}%)</p>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1"><Users className="h-4 w-4" />{bet.participantCount}</span>
                                                <span>💰 {fmtEcus(bet.totalPool)} pq</span>
                                                {bet.type === "valorant_next_match" && <Badge variant="outline" className="text-red-400 border-red-500/20">🎯 Valorant</Badge>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-blue-500" />Historique</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {resolvedBets.length === 0 ? (
                                <p className="py-8 text-center text-muted-foreground">Aucun historique</p>
                            ) : (
                                <div className="space-y-3">
                                    {resolvedBets.map(bet => {
                                        const win = bet.options.find((o: any) => o.id === bet.resolved_option_id)
                                        return (
                                            <div key={bet.id} className="flex items-center gap-4 rounded-2xl bg-muted/30 p-4">
                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${bet.status === "resolved" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                                                    {bet.status === "resolved" ? "✅" : "❌"}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-foreground truncate">{bet.title}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {bet.status === "resolved" && win ? `Gagnant: ${win.name}` : "Annulé"} · {timeAgo(bet.created_at)}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-sm font-semibold">{fmtEcus(bet.totalPool)} pq</p>
                                                    <p className="text-xs text-muted-foreground">{bet.participantCount} joueurs</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
