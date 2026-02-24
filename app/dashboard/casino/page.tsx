"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
    BarChart3, Dices, Loader2, Trophy, Users, TrendingUp, TrendingDown, Clock
} from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import { getDiscordProfiles } from "@/lib/discord-profile-cache"

function fmtEcus(n: number) {
    return n.toLocaleString("fr-FR")
}
function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const s = Math.max(1, Math.floor(diff / 1000))
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    const d = Math.floor(h / 24)
    return `${d}j`
}

type BetOption = {
    id: number
    name: string
    totalMise: number
    odds: string
}

type BetEntry = {
    id: number
    title: string
    status: string
    type: string
    created_at: string
    creator_id: string
    resolved_option_id: number | null
    options: BetOption[]
    totalPool: number
    participantCount: number
}

export default function CasinoPage() {
    const [loading, setLoading] = useState(true)
    const [guildId, setGuildId] = useState<string | null>(null)

    // Casino stats
    const [casinoStats, setCasinoStats] = useState<any[]>([])
    const [totalWon, setTotalWon] = useState(0)
    const [totalLost, setTotalLost] = useState(0)

    // Bets
    const [activeBets, setActiveBets] = useState<BetEntry[]>([])
    const [resolvedBets, setResolvedBets] = useState<BetEntry[]>([])

    // Profiles
    const [profiles, setProfiles] = useState<Map<string, { username: string; avatar: string }>>(new Map())

    const supa = useMemo(
        () => createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        ), []
    )

    useEffect(() => {
        const gid = typeof window !== "undefined" ? localStorage.getItem("selected_guild") : null
        setGuildId(gid)
        if (!gid) { setLoading(false); return }

        async function fetchAll() {
            const allUserIds = new Set<string>()

            // 1. Casino stats (if table exists)
            try {
                const { data: stats } = await supa
                    .from("casino_stats")
                    .select("user_id, total_won, total_lost, games_played")
                    .eq("guild_id", gid)
                    .order("total_won", { ascending: false })
                    .limit(15)

                if (stats && stats.length > 0) {
                    setCasinoStats(stats)
                    setTotalWon(stats.reduce((s: number, r: any) => s + (r.total_won || 0), 0))
                    setTotalLost(stats.reduce((s: number, r: any) => s + (r.total_lost || 0), 0))
                    stats.forEach((s: any) => allUserIds.add(s.user_id))
                }
            } catch { /* table may not exist */ }

            // 2. Active bets (open or closed but not resolved)
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
                            const virtualAmt = amt + virtualPerOption
                            let odds = virtualTotalPool / virtualAmt
                            if (odds < 1.01) odds = 1.01
                            return { ...opt, totalMise: amt, odds: odds.toFixed(2) }
                        })

                        allUserIds.add(bet.creator_id)
                        bet.bet_participants?.forEach((p: any) => allUserIds.add(p.user_id))

                        return {
                            id: bet.id,
                            title: bet.title,
                            status: bet.status,
                            type: bet.type,
                            created_at: bet.created_at,
                            creator_id: bet.creator_id,
                            resolved_option_id: bet.resolved_option_id,
                            options,
                            totalPool,
                            participantCount: bet.bet_participants?.length || 0,
                        }
                    })

                    setActiveBets(processed.filter((b: BetEntry) => b.status === "open" || b.status === "closed"))
                    setResolvedBets(processed.filter((b: BetEntry) => b.status === "resolved" || b.status === "cancelled").slice(0, 15))
                }
            } catch { /* table may not exist */ }

            // 3. Profiles
            if (allUserIds.size > 0 && gid) {
                try {
                    const p = await getDiscordProfiles(Array.from(allUserIds), gid)
                    setProfiles(p)
                } catch { /* ignore */ }
            }

            setLoading(false)
        }

        fetchAll()
    }, [supa])

    function userName(userId: string) {
        return profiles.get(userId)?.username || "Utilisateur"
    }
    function userAvatar(userId: string) {
        return profiles.get(userId)?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
    }

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!guildId) {
        return (
            <div className="flex h-96 items-center justify-center text-muted-foreground">
                Sélectionne un serveur pour voir le casino
            </div>
        )
    }

    const netResult = totalWon - totalLost

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Casino</h1>
                <p className="text-muted-foreground">Statistiques de jeu et paris du serveur</p>
            </div>

            <Tabs defaultValue="stats" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="stats" className="gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Statistiques
                    </TabsTrigger>
                    <TabsTrigger value="bets" className="gap-2">
                        <Dices className="h-4 w-4" />
                        Paris
                    </TabsTrigger>
                </TabsList>

                {/* ═══════════════ STATISTIQUES ═══════════════ */}
                <TabsContent value="stats" className="mt-6 space-y-6">
                    {/* Global stats */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Total gagné</CardTitle>
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold text-emerald-500">{fmtEcus(totalWon)} pq</p>
                                <p className="text-xs text-muted-foreground">Gains cumulés du serveur</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Total perdu</CardTitle>
                                <TrendingDown className="h-4 w-4 text-red-500" />
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold text-red-500">{fmtEcus(totalLost)} pq</p>
                                <p className="text-xs text-muted-foreground">Pertes cumulées du serveur</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Résultat net</CardTitle>
                                {netResult >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                            </CardHeader>
                            <CardContent>
                                <p className={`text-2xl font-bold ${netResult >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                                    {netResult >= 0 ? "+" : ""}{fmtEcus(netResult)} pq
                                </p>
                                <p className="text-xs text-muted-foreground">Balance globale</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Top joueurs casino */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-yellow-500" />
                                Top Joueurs Casino
                            </CardTitle>
                            <CardDescription>Les plus gros gagnants du serveur</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {casinoStats.length === 0 ? (
                                <p className="py-8 text-center text-muted-foreground">
                                    Aucune statistique casino disponible — Jouez au /blackjack ou /roulette !
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {casinoStats.slice(0, 10).map((s, i) => {
                                        const net = (s.total_won || 0) - (s.total_lost || 0)
                                        return (
                                            <div key={s.user_id} className="flex items-center gap-3 rounded-2xl bg-muted/50 p-4 transition-all hover:bg-muted">
                                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold ${i === 0 ? "bg-yellow-500/20 text-yellow-500"
                                                        : i === 1 ? "bg-gray-400/20 text-gray-400"
                                                            : i === 2 ? "bg-orange-600/20 text-orange-600"
                                                                : "bg-primary/10 text-primary"
                                                    }`}>
                                                    #{i + 1}
                                                </div>
                                                <Avatar className="h-12 w-12 border-2 border-border">
                                                    <AvatarImage src={userAvatar(s.user_id)} />
                                                    <AvatarFallback>{userName(s.user_id)[0]?.toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-foreground truncate">{userName(s.user_id)}</p>
                                                    <p className="text-sm text-muted-foreground">{s.games_played || 0} parties jouées</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className={`font-bold ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                                        {net >= 0 ? "+" : ""}{fmtEcus(net)} pq
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        <span className="text-emerald-400">+{fmtEcus(s.total_won || 0)}</span>
                                                        {" / "}
                                                        <span className="text-red-400">-{fmtEcus(s.total_lost || 0)}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══════════════ PARIS ═══════════════ */}
                <TabsContent value="bets" className="mt-6 space-y-6">
                    {/* Active bets */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Dices className="h-5 w-5 text-purple-500" />
                                Paris en cours
                            </CardTitle>
                            <CardDescription>Paris ouverts ou en attente de résolution</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {activeBets.length === 0 ? (
                                <p className="py-8 text-center text-muted-foreground">
                                    Aucun pari en cours — Crée un pari avec /pari sur Discord !
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {activeBets.map(bet => (
                                        <div key={bet.id} className="rounded-2xl border border-border bg-muted/30 p-5 space-y-4">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="text-lg font-semibold text-foreground">{bet.title}</h3>
                                                    <p className="text-sm text-muted-foreground mt-0.5">
                                                        Par {userName(bet.creator_id)} · {timeAgo(bet.created_at)}
                                                    </p>
                                                </div>
                                                <Badge className={bet.status === "open"
                                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                }>
                                                    {bet.status === "open" ? "🟢 Ouvert" : "🟡 Fermé"}
                                                </Badge>
                                            </div>

                                            {/* Options with odds */}
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {bet.options.map(opt => {
                                                    const pct = bet.totalPool > 0 ? (opt.totalMise / bet.totalPool) * 100 : 0
                                                    return (
                                                        <div key={opt.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-medium text-foreground">{opt.name}</span>
                                                                <Badge variant="outline" className="text-primary">
                                                                    ×{opt.odds}
                                                                </Badge>
                                                            </div>
                                                            <Progress value={pct} className="h-1.5" />
                                                            <p className="text-xs text-muted-foreground">
                                                                {fmtEcus(opt.totalMise)} pq misés ({pct.toFixed(0)}%)
                                                            </p>
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Users className="h-4 w-4" />
                                                    {bet.participantCount} participant{bet.participantCount > 1 ? "s" : ""}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    💰 Pool: {fmtEcus(bet.totalPool)} pq
                                                </span>
                                                {bet.type === "valorant_next_match" && (
                                                    <Badge variant="outline" className="text-red-400 border-red-500/20">
                                                        🎯 Valorant
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Resolved bets */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-blue-500" />
                                Historique des paris
                            </CardTitle>
                            <CardDescription>Paris résolus et annulés récents</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {resolvedBets.length === 0 ? (
                                <p className="py-8 text-center text-muted-foreground">Aucun historique</p>
                            ) : (
                                <div className="space-y-3">
                                    {resolvedBets.map(bet => {
                                        const winningOption = bet.options.find(o => o.id === bet.resolved_option_id)
                                        return (
                                            <div key={bet.id} className="flex items-center gap-4 rounded-2xl bg-muted/30 p-4">
                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${bet.status === "resolved" ? "bg-emerald-500/10" : "bg-red-500/10"
                                                    }`}>
                                                    {bet.status === "resolved" ? "✅" : "❌"}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-foreground truncate">{bet.title}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {bet.status === "resolved" && winningOption
                                                            ? `Gagnant: ${winningOption.name}`
                                                            : "Annulé — Mises remboursées"}
                                                        {" · "}{timeAgo(bet.created_at)}
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
