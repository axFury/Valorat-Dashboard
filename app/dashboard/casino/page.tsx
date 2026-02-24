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
    const [rouletteBet, setRouletteBet] = useState("rouge")
    const [rouletteMise, setRouletteMise] = useState(100)
    const [rouletteSpinning, setRouletteSpinning] = useState(false)
    const [rouletteResult, setRouletteResult] = useState<any>(null)
    const [wheelRotation, setWheelRotation] = useState(0)
    const [rouletteNumberBet, setRouletteNumberBet] = useState<string>("")

    // Blackjack
    const [bjState, setBjState] = useState<any>(null)
    const [bjMise, setBjMise] = useState(100)
    const [bjLoading, setBjLoading] = useState(false)

    // Bets
    const [activeBets, setActiveBets] = useState<any[]>([])
    const [resolvedBets, setResolvedBets] = useState<any[]>([])
    const [profiles, setProfiles] = useState<Map<string, { username: string; avatar: string }>>(new Map())

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
        if (!guildId || rouletteSpinning) return
        const actualBet = rouletteNumberBet !== "" ? rouletteNumberBet : rouletteBet
        setRouletteSpinning(true)
        setRouletteResult(null)

        const res = await fetch("/api/casino/roulette", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guildId, bet: actualBet, mise: rouletteMise }),
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
            setBjState((prev: any) => ({ ...prev, error: data.error }))
            return
        }

        setBjState(data)
        if (data.newBalance !== undefined) setBalance(data.newBalance)
    }

    function userName(userId: string) { return profiles.get(userId)?.username || "Utilisateur" }
    function userAvatar(userId: string) { return profiles.get(userId)?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png" }

    if (loading) {
        return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    }
    if (!guildId) {
        return <div className="flex h-96 items-center justify-center text-muted-foreground">Sélectionne un serveur</div>
    }

    const isGameOver = bjState?.result && bjState.result !== ""

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
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="roulette" className="gap-2">
                        <span className="text-lg">🎰</span>
                        <span className="hidden sm:inline">Roulette</span>
                    </TabsTrigger>
                    <TabsTrigger value="blackjack" className="gap-2">
                        <span className="text-lg">🃏</span>
                        <span className="hidden sm:inline">Blackjack</span>
                    </TabsTrigger>
                    <TabsTrigger value="bets" className="gap-2">
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
                                        <p className={`text-xl font-bold ${rouletteResult.won ? "text-emerald-400" : "text-red-400"}`}>
                                            {rouletteResult.won ? `+${fmtEcus(rouletteResult.winnings)} pq 🎉` : `-${fmtEcus(rouletteMise)} pq`}
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
                                                {group.bets.map(b => (
                                                    <Button
                                                        key={b.value}
                                                        variant={rouletteBet === b.value && rouletteNumberBet === "" ? "default" : "outline"}
                                                        size="sm"
                                                        className="text-xs"
                                                        onClick={() => { setRouletteBet(b.value); setRouletteNumberBet("") }}
                                                    >
                                                        {b.label} <span className="ml-1 opacity-60">{b.mult}</span>
                                                    </Button>
                                                ))}
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
                                                value={rouletteNumberBet}
                                                onChange={e => {
                                                    setRouletteNumberBet(e.target.value)
                                                    if (e.target.value !== "") setRouletteBet("")
                                                }}
                                                className="w-24"
                                            />
                                            {rouletteNumberBet !== "" && (
                                                <Badge className="bg-primary/10 text-primary">Numéro {rouletteNumberBet}</Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Spin button */}
                                <Button
                                    className="w-full h-14 text-lg font-bold gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/20"
                                    disabled={rouletteSpinning || rouletteMise <= 0}
                                    onClick={spinRoulette}
                                >
                                    {rouletteSpinning ? (
                                        <><Loader2 className="h-5 w-5 animate-spin" /> La roue tourne...</>
                                    ) : (
                                        <>🎰 Tourner la roue — {fmtEcus(rouletteMise)} pq</>
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
                                        onClick={() => { setRouletteNumberBet("0"); setRouletteBet("") }}
                                        className={`row-span-3 rounded-lg flex items-center justify-center text-sm font-bold text-white transition-all hover:scale-105 ${rouletteNumberBet === "0" ? "ring-2 ring-amber-400 scale-105" : ""} bg-emerald-600 h-full min-h-[80px]`}
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
                                                onClick={() => { setRouletteNumberBet(String(n)); setRouletteBet("") }}
                                                className={`h-[28px] rounded flex items-center justify-center text-xs font-bold text-white transition-all hover:scale-110 ${rouletteNumberBet === String(n) ? "ring-2 ring-amber-400 scale-110" : ""} ${RED_SET.has(n) ? "bg-red-600 hover:bg-red-500" : "bg-zinc-800 hover:bg-zinc-700"}`}
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
                            {bjState ? (
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
                                            <div className={`px-6 py-2 rounded-full font-bold text-sm ${bjState.result === "win" || bjState.result === "blackjack" || bjState.result === "dealer_bust"
                                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                                    : bjState.result === "push"
                                                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                                        : "bg-red-500/10 text-red-400 border border-red-500/30"
                                                }`}>
                                                {bjState.result === "blackjack" && "🎰 BLACKJACK !"}
                                                {bjState.result === "win" && "✅ Tu gagnes !"}
                                                {bjState.result === "dealer_bust" && "💥 Croupier bust !"}
                                                {bjState.result === "push" && "🤝 Égalité"}
                                                {bjState.result === "bust" && "💀 Bust !"}
                                                {bjState.result === "lose" && "❌ Perdu"}
                                                {bjState.payout !== undefined && bjState.payout > 0 && ` +${fmtEcus(bjState.payout)} pq`}
                                            </div>
                                        )}
                                        <div className="flex-1 h-px bg-border" />
                                    </div>

                                    {/* Player */}
                                    <div className="text-center space-y-3">
                                        <div className="flex justify-center gap-3 flex-wrap">
                                            {bjState.player.map((card: BJCard, i: number) => (
                                                <PlayingCard key={i} card={card} delay={i >= 2 ? 200 : 0} />
                                            ))}
                                        </div>
                                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                            Toi — <span className={`font-bold ${bjState.playerValue > 21 ? "text-red-400" : bjState.playerValue === 21 ? "text-emerald-400" : "text-foreground"}`}>{bjState.playerValue}</span>
                                        </p>
                                    </div>

                                    {/* Bet info */}
                                    <div className="flex justify-center">
                                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-base px-4 py-1">
                                            Mise: {fmtEcus(bjState.bet)} pq{bjState.doubled && " (doublé)"}
                                        </Badge>
                                    </div>

                                    {/* Actions */}
                                    {!isGameOver ? (
                                        <div className="flex justify-center gap-3 flex-wrap">
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
                                                disabled={bjLoading || !bjState.canDouble || bjState.player.length > 2}
                                                className="bg-amber-600 hover:bg-amber-500 text-white gap-2 h-12 px-8"
                                            >
                                                💰 Doubler
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-center">
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
                                    </div>
                                </div>
                            )}
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
