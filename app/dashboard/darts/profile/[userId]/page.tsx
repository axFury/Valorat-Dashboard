"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Target, Trophy, TrendingUp, BarChart2, PieChart, Activity, Calendar, History, ArrowLeft, Loader2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"

export default function DartsProfilePage() {
    const params = useParams()
    const router = useRouter()
    const userId = params.userId as string
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<any>(null)
    const [guildId, setGuildId] = useState<string | null>(null)

    useEffect(() => {
        const gid = typeof window !== "undefined" ? localStorage.getItem("selected_guild") : null
        setGuildId(gid)

        if (gid && userId) {
            fetch(`/api/darts/stats?guildId=${gid}&userId=${userId}`)
                .then(res => res.json())
                .then(data => {
                    setStats(data)
                    setLoading(false)
                })
                .catch(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, [userId])

    if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-red-500 w-10 h-10" /></div>
    if (!stats) return <div className="text-center py-20 text-muted-foreground">Profil introuvable.</div>

    const adv = stats.advanced_stats || {}
    const dist = adv.score_distribution || {}

    const checkoutPct = adv.checkout_attempts > 0
        ? Math.round((adv.checkouts_made / adv.checkout_attempts) * 100)
        : 0

    const f9Avg = adv.first_9_darts > 0
        ? ((adv.first_9_total_score / adv.first_9_darts) * 3).toFixed(1)
        : "0.0"

    const matchAvg = stats.darts_thrown > 0
        ? ((stats.total_score / stats.darts_thrown) * 3).toFixed(1)
        : "0.0"

    return (
        <div className="space-y-6 pb-20 max-w-6xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-border pb-6">
                <div>
                    <Button variant="ghost" className="mb-2 p-0 h-auto hover:bg-transparent text-muted-foreground hover:text-white" onClick={() => router.back()}>
                        <ArrowLeft className="w-4 h-4 mr-1" /> Retour
                    </Button>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-red-500/20 ring-2 ring-white/10">
                            {stats.user_name?.[0]?.toUpperCase() || "D"}
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">{stats.user_name || "Joueur"}</h1>
                            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                                <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/5">PRO PLAYER</Badge>
                                <span className="text-xs uppercase tracking-widest font-bold opacity-50 ml-2">Darts Elite Membership</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Card className="bg-muted/30 border-none p-3 px-6 text-center">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Winrate</p>
                        <p className="text-2xl font-black text-emerald-400">
                            {stats.matches_played > 0 ? Math.round((stats.matches_won / stats.matches_played) * 100) : 0}%
                        </p>
                    </Card>
                    <Card className="bg-muted/30 border-none p-3 px-6 text-center">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Total Darts</p>
                        <p className="text-2xl font-black text-white">{stats.darts_thrown}</p>
                    </Card>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard icon={<TrendingUp className="text-red-500" />} label="Match Avg" value={matchAvg} subValue="Moyenne 3 fl." />
                <StatCard icon={<PieChart className="text-orange-500" />} label="First 9 Avg" value={f9Avg} subValue="9 premières fl." />
                <StatCard icon={<Target className="text-emerald-500" />} label="Checkout %" value={`${checkoutPct}%`} subValue={`${adv.checkouts_made}/${adv.checkout_attempts}`} />
                <StatCard icon={<Trophy className="text-yellow-500" />} label="Highest Finish" value={stats.highest_checkout || "-"} subValue="Checkout Max" />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Score Distribution */}
                <Card className="md:col-span-2 border-border bg-card/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <BarChart2 className="w-5 h-5 text-red-500" />
                            Distribution des Scores
                        </CardTitle>
                        <CardDescription>Nombre de tours dans chaque palier de points.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <CountStat label="180" value={stats.count_180s} color="bg-red-500" />
                            <CountStat label="140+" value={stats.count_140s} color="bg-orange-500" />
                            <CountStat label="100+" value={stats.count_100s} color="bg-yellow-500" />
                            <CountStat label="80+" value={dist["80"] || 0} color="bg-emerald-500" />
                            <CountStat label="60+" value={dist["60"] || 0} color="bg-sky-500" />
                            <CountStat label="40+" value={dist["40"] || 0} color="bg-indigo-500" />
                            <CountStat label="Bull" value={stats.cricket_marks || 0} color="bg-purple-500" sub="Marks" />
                            <CountStat label="Miss" value={stats.misses || 0} color="bg-muted" />
                        </div>

                        <div className="space-y-3 mt-6">
                            <p className="text-sm font-bold uppercase text-muted-foreground tracking-widest">Performances Leg</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-black/20 border border-border">
                                    <p className="text-[10px] uppercase text-muted-foreground mb-1">Meilleur Leg</p>
                                    <p className="text-xl font-bold">{adv.best_leg || "-"} <span className="text-xs text-muted-foreground">darts</span></p>
                                </div>
                                <div className="p-4 rounded-xl bg-black/20 border border-border">
                                    <p className="text-[10px] uppercase text-muted-foreground mb-1">Pire Leg</p>
                                    <p className="text-xl font-bold">{adv.worst_leg || "-"} <span className="text-xs text-muted-foreground">darts</span></p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Vertical Highlights */}
                <Card className="border-border bg-card/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Activity className="w-5 h-5 text-orange-500" />
                            Records
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <HighlightRow label="Max Score" value={stats.highest_checkout || 0} />
                        <HighlightRow label="Max Start" value={adv.highest_start_score || 0} />
                        <HighlightRow label="Current Winrate" value={`${stats.matches_played > 0 ? ((stats.matches_won / stats.matches_played) * 100).toFixed(0) : 0}%`} />
                        <HighlightRow label="Matches Played" value={stats.matches_played} />
                        <HighlightRow label="Matches Won" value={stats.matches_won} />

                        <div className="pt-4 border-t border-border mt-4">
                            <h4 className="text-xs font-bold uppercase text-muted-foreground mb-4 tracking-widest flex items-center gap-2">
                                <Calendar className="w-3 h-3" /> Progression
                            </h4>
                            <div className="space-y-4">
                                <ProgressRow label="Consistency" value={75} color="bg-red-500" />
                                <ProgressRow label="Precision" value={60} color="bg-orange-500" />
                                <ProgressRow label="Checkout Master" value={30} color="bg-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full bg-red-600 hover:bg-red-500" onClick={() => window.print()}>
                            <PieChart className="w-4 h-4 mr-2" /> Exporter PDF
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}

function StatCard({ icon, label, value, subValue }: any) {
    return (
        <Card className="border-border bg-muted/20 hover:bg-muted/40 transition-all group overflow-hidden">
            <CardContent className="p-5 relative">
                <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-125 transition-transform">
                    {icon}
                </div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-background border border-border shadow-sm">
                        {icon}
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-white">{value}</p>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase">{subValue}</span>
                </div>
            </CardContent>
        </Card>
    )
}

function CountStat({ label, value, color, sub }: any) {
    return (
        <div className="p-3 rounded-xl bg-black/40 border border-border text-center group hover:border-white/20 transition-all">
            <p className="text-[10px] font-black text-muted-foreground mb-2 tracking-tighter uppercase">{label}</p>
            <p className={`text-2xl font-black mb-2 flex items-center justify-center gap-1 ${value > 0 ? 'text-white' : 'text-white/20'}`}>
                {value}
            </p>
            <div className={`h-1 w-full rounded-full ${color} opacity-20 group-hover:opacity-100 transition-opacity`}></div>
            {sub && <p className="text-[8px] mt-1 text-muted-foreground uppercase">{sub}</p>}
        </div>
    )
}

function HighlightRow({ label, value }: any) {
    return (
        <div className="flex justify-between items-center group">
            <span className="text-sm text-muted-foreground font-medium">{label}</span>
            <div className="h-[1px] flex-1 mx-4 bg-border/50 group-hover:bg-red-500/20 transition-colors"></div>
            <span className="font-mono font-black text-lg">{value}</span>
        </div>
    )
}

function ProgressRow({ label, value, color }: any) {
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span>{label}</span>
                <span className="text-muted-foreground">{value}%</span>
            </div>
            <Progress value={value} className={`h-1.5 ${color}`} />
        </div>
    )
}
