"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Target, Trophy, Clock, Plus, BarChart2 } from "lucide-react"
import Link from "next/link"

export default function DartsDashboardPage() {
    const [guildId, setGuildId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<any>(null)
    const [matches, setMatches] = useState<any[]>([])

    useEffect(() => {
        const gid = typeof window !== "undefined" ? localStorage.getItem("selected_guild") : null
        setGuildId(gid)

        if (gid) {
            Promise.all([
                fetch(`/api/darts/stats?guildId=${gid}`).then(res => res.ok ? res.json() : null),
                fetch(`/api/darts/matches?guildId=${gid}`).then(res => res.ok ? res.json() : [])
            ]).then(([statsData, matchesData]) => {
                setStats(statsData)
                setMatches(matchesData)
                setLoading(false)
            }).catch(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, [])

    if (loading) {
        return <div className="flex h-96 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div></div>
    }

    if (!guildId) {
        return (
            <div className="flex h-96 items-center justify-center text-muted-foreground">
                Sélectionne un serveur.
            </div>
        )
    }

    const winRate = stats && stats.matches_played > 0
        ? Math.round((stats.matches_won / stats.matches_played) * 100)
        : 0;

    const avg3Darts = stats && stats.darts_thrown > 0
        ? ((stats.total_score / stats.darts_thrown) * 3).toFixed(1)
        : "0.0";

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
                        Fléchettes - Darts
                    </h1>
                    <p className="text-muted-foreground mt-1">Cible, précision et stratégie. Deviens le maître du 501.</p>
                </div>
                <div className="flex gap-3">
                    <Link href={`/dashboard/darts/setup`}>
                        <Button className="bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-lg hover:shadow-red-500/30">
                            <Plus className="mr-2 h-4 w-4" /> Nouvelle Partie
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2 border-red-500/20 bg-gradient-to-br from-card to-red-500/5 hover:border-red-500/40 transition-all">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-red-500" />
                            Historique Récent
                        </CardTitle>
                        <CardDescription>Tes dernières parties de fléchettes sur ce serveur.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {matches.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                <p>Aucune partie n'a été jouée récemment sur ce serveur.</p>
                                <Link href={`/dashboard/darts/setup`}>
                                    <Button variant="outline" className="mt-4"><Target className="w-4 h-4 mr-2" /> Jouer Maintenant</Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {matches.map((match: any) => (
                                    <div key={match.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                                        <div>
                                            <p className="font-bold flex items-center gap-2">
                                                {match.game_type} <Badge variant={match.status === 'finished' ? 'secondary' : 'default'} className={match.status === 'finished' ? '' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'}>{match.status === 'finished' ? 'Terminé' : 'En cours'}</Badge>
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {new Date(match.created_at).toLocaleDateString()} - {match.players.length} Joueur(s)
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {match.winner_id && (
                                                <div className="hidden sm:flex items-center gap-2 text-sm text-emerald-400">
                                                    <Trophy className="w-4 h-4" />
                                                    <span>{match.players.find((p: any) => p.id === match.winner_id)?.name || "Gagnant"}</span>
                                                </div>
                                            )}
                                            <Link href={`/dashboard/darts/match/${match.id}`}>
                                                <Button size="sm" variant={match.status === 'finished' ? 'outline' : 'default'} className={match.status === 'finished' ? '' : 'bg-red-600 hover:bg-red-500 text-white'}>
                                                    {match.status === 'finished' ? 'Voir Scores' : 'Rejoindre'}
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-border bg-card hover:border-orange-500/30 transition-all group">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart2 className="h-5 w-5 text-orange-500" />
                            Mes Statistiques
                        </CardTitle>
                        <CardDescription>Ton palmarès global.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/50 p-3 rounded-xl border border-border">
                                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Matchs Joués</p>
                                <p className="text-2xl font-bold font-mono">{stats?.matches_played || 0}</p>
                            </div>
                            <div className="bg-muted/50 p-3 rounded-xl border border-border">
                                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Victoires</p>
                                <p className="text-2xl font-bold font-mono text-emerald-400">{stats?.matches_won || 0}</p>
                            </div>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-xl border border-border">
                            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold hover:text-red-400 transition-colors">Taux de Victoire</p>
                            <p className="text-2xl font-bold font-mono text-center my-2 text-foreground/80">{winRate}%</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/50 p-3 rounded-xl border border-border flex flex-col items-center">
                                <p className="text-[10px] text-muted-foreground mb-1 uppercase font-semibold">Meilleur Finish</p>
                                <p className="text-xl font-bold text-orange-400">{stats?.highest_checkout || "-"}</p>
                            </div>
                            <div className="bg-muted/50 p-3 rounded-xl border border-border flex flex-col items-center">
                                <p className="text-[10px] text-muted-foreground mb-1 uppercase font-semibold">Moy. 3 Fléchettes</p>
                                <p className="text-xl font-bold text-red-400">{avg3Darts}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
