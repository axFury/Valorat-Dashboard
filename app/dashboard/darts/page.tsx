"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Target, Trophy, Clock, Plus, BarChart2 } from "lucide-react"
import Link from "next/link"

export default function DartsDashboardPage() {
    const [guildId, setGuildId] = useState<string | null>(null)

    useEffect(() => {
        const gid = typeof window !== "undefined" ? localStorage.getItem("selected_guild") : null
        setGuildId(gid)
    }, [])

    if (!guildId) {
        return (
            <div className="flex h-96 items-center justify-center text-muted-foreground">
                Sélectionne un serveur.
            </div>
        )
    }

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
                        <div className="text-center py-10 text-muted-foreground">
                            {/* TODO Fetch history */}
                            <p>Aucune partie n'a été jouée récemment.</p>
                            <Link href={`/dashboard/darts/setup`}>
                                <Button variant="outline" className="mt-4"><Target className="w-4 h-4 mr-2" /> Jouer Maintenant</Button>
                            </Link>
                        </div>
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
                                <p className="text-2xl font-bold font-mono">0</p>
                            </div>
                            <div className="bg-muted/50 p-3 rounded-xl border border-border">
                                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Victoires</p>
                                <p className="text-2xl font-bold font-mono text-emerald-400">0</p>
                            </div>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-xl border border-border">
                            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold hover:text-red-400 transition-colors">Taux de Victoire</p>
                            <p className="text-2xl font-bold font-mono text-center my-2 text-foreground/80">- %</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/50 p-3 rounded-xl border border-border flex flex-col items-center">
                                <p className="text-[10px] text-muted-foreground mb-1 uppercase font-semibold">Meilleur Finish</p>
                                <p className="text-xl font-bold text-orange-400">-</p>
                            </div>
                            <div className="bg-muted/50 p-3 rounded-xl border border-border flex flex-col items-center">
                                <p className="text-[10px] text-muted-foreground mb-1 uppercase font-semibold">Moy. 3 Fléchettes</p>
                                <p className="text-xl font-bold text-red-400">-</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
