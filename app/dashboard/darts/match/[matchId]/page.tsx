"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, RotateCcw, Crosshair, Crown } from "lucide-react"
import { MatchState, PlayerState, getCheckoutSuggestion } from "@/lib/darts-engine"

export default function DartsLiveMatchPage() {
    const params = useParams()
    const router = useRouter()
    const matchId = params.matchId as string

    const [match, setMatch] = useState<MatchState | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [scoreInput, setScoreInput] = useState<string>("")
    const [submitting, setSubmitting] = useState(false)

    // Load Match Real Time
    const fetchMatch = useCallback(async () => {
        try {
            const res = await fetch(`/api/darts/matches/${matchId}`)
            if (res.ok) {
                const data = await res.json()
                setMatch(data)
            } else {
                setError("Partie introuvable.")
            }
        } catch {
            setError("Erreur de connexion.")
        } finally {
            setLoading(false)
        }
    }, [matchId])

    useEffect(() => {
        fetchMatch()
        // Here we could implement Supabase Realtime subscription
        // for online multiplayer. For now, manual/action refresh is fine for local.
    }, [fetchMatch])

    const handleNumpadClick = (val: string) => {
        if (scoreInput.length < 3) {
            setScoreInput(prev => prev + val)
        }
    }

    const handleBackspace = () => {
        setScoreInput(prev => prev.slice(0, -1))
    }

    const submitScore = async (isCheckout: boolean = false) => {
        if (!match || !scoreInput || submitting) return
        const score = parseInt(scoreInput, 10)

        if (isNaN(score) || score < 0 || score > 180) {
            alert("Score invalide. Maximum 180.")
            return
        }

        setSubmitting(true)
        const activePlayer = match.players[match.currentPlayerIndex]

        try {
            const res = await fetch(`/api/darts/matches/${matchId}/throw`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    playerId: activePlayer.id,
                    totalScore: score,
                    isCheckout
                })
            })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || "Erreur lors de l'enregistrement.")
            } else {
                setScoreInput("")
                await fetchMatch() // Refresh State
            }
        } catch (e) {
            alert("Erreur réseau.")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>
    if (error || !match) return <div className="text-center py-20 text-red-500">{error}</div>

    const activePlayer = match.players[match.currentPlayerIndex]
    const suggestion = getCheckoutSuggestion(activePlayer.scoreLeft)
    const isFinished = match.status === "finished"

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" className="text-muted-foreground hover:text-white" onClick={() => router.push('/dashboard/darts')}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Quitter
                </Button>
                <div className="text-center flex-1">
                    <h1 className="text-2xl font-black uppercase tracking-widest text-red-500">
                        {match.gameType} <span className="text-white">Darts</span>
                    </h1>
                    <p className="text-xs text-muted-foreground font-mono">
                        Premier à <span className="text-white">{match.rules.legsToWin} Legs</span> • {match.rules.outRule.toUpperCase()} OUT
                    </p>
                </div>
                <div className="w-24"></div> {/* Spacer to center title */}
            </div>

            {isFinished ? (
                <Card className="border-yellow-500/50 bg-yellow-500/10 shadow-lg shadow-yellow-500/20 max-w-2xl mx-auto">
                    <CardHeader className="text-center">
                        <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                        <CardTitle className="text-3xl text-yellow-500">Match Terminé !</CardTitle>
                        <CardDescription className="text-lg">Victoire de <strong>{match.players.find(p => p.id === match.winnerId)?.name}</strong></CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            {match.players.map(p => (
                                <div key={p.id} className={`p-4 rounded-xl border ${p.id === match.winnerId ? 'border-yellow-500/50 bg-yellow-500/20' : 'border-border bg-muted/50'}`}>
                                    <p className="font-bold text-center mb-2">{p.name}</p>
                                    <div className="text-sm space-y-1">
                                        <div className="flex justify-between"><span>Legs:</span> <strong>{p.legsWon}</strong></div>
                                        <div className="flex justify-between"><span>Moy (3 fl.):</span> <strong>{p.stats.dartsThrown > 0 ? ((p.stats.totalScore / p.stats.dartsThrown) * 3).toFixed(1) : 0}</strong></div>
                                        <div className="flex justify-between"><span>Max Finish:</span> <strong>{p.stats.highestCheckout}</strong></div>
                                        <div className="flex justify-between"><span>180s:</span> <strong>{p.stats.count180}</strong></div>
                                        <div className="flex justify-between"><span>140+:</span> <strong>{p.stats.count140}</strong></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <Button onClick={() => router.push('/dashboard/darts')} className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold">Retourner au menu</Button>
                    </CardFooter>
                </Card>
            ) : (
                <div className="grid lg:grid-cols-12 gap-6">
                    {/* Left Column : Scoreboard */}
                    <div className="lg:col-span-8 space-y-4">
                        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(match.players.length, 2)}, minmax(0, 1fr))` }}>
                            {match.players.map((p, idx) => {
                                const isActive = idx === match.currentPlayerIndex;
                                return (
                                    <Card key={p.id} className={`transition-all duration-300 ${isActive ? 'ring-2 ring-red-500 scale-[1.02] shadow-xl shadow-red-500/20 bg-gradient-to-b from-card to-red-500/10' : 'border-border bg-muted/30 opacity-70'}`}>
                                        <CardContent className="p-6 relative">
                                            {isActive && <div className="absolute top-2 right-2 flex gap-1">
                                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse delay-75"></div>
                                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse delay-150"></div>
                                            </div>}
                                            <div className="text-center space-y-4">
                                                <h3 className="font-bold text-lg text-muted-foreground uppercase tracking-widest">{p.name}</h3>
                                                <div className="flex items-center justify-center font-mono">
                                                    <span className={`text-7xl font-black ${isActive ? 'text-white' : 'text-white/50'}`}>
                                                        {p.scoreLeft}
                                                    </span>
                                                </div>
                                                <div className="flex justify-center gap-6 text-sm">
                                                    <Badge variant="outline" className={`${isActive ? 'bg-red-500/20 text-red-400 border-red-500/50' : ''} font-mono px-3 py-1 cursor-default text-base`}>
                                                        L {p.legsWon}
                                                    </Badge>
                                                    <div className="flex flex-col text-[10px] text-muted-foreground font-semibold">
                                                        <span>MOY</span>
                                                        <span className="text-sm font-mono text-white">
                                                            {p.stats.dartsThrown > 0 ? ((p.stats.totalScore / p.stats.dartsThrown) * 3).toFixed(1) : "0.0"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>

                        {/* Suggestion & Input Viewer */}
                        <Card className="border-red-500/30 bg-red-500/5">
                            <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="space-y-1 text-center md:text-left">
                                    <p className="text-sm font-medium text-red-400 uppercase tracking-wider flex items-center justify-center md:justify-start gap-2">
                                        <Crosshair className="w-4 h-4" /> Suggestion de Finition
                                    </p>
                                    <div className="h-8 flex items-center justify-center md:justify-start">
                                        {suggestion ? (
                                            <span className="text-2xl font-black font-mono tracking-widest">{suggestion}</span>
                                        ) : (
                                            <span className="text-muted-foreground font-mono text-sm">(Aucune)</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 bg-background px-6 py-3 rounded-xl border border-border shadow-inner min-w-[200px] justify-center">
                                    <span className="text-4xl font-mono font-bold text-red-500">
                                        {scoreInput || "0"}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column : Numpad */}
                    <div className="lg:col-span-4">
                        <Card className="border-border shadow-xl">
                            <CardHeader className="py-4">
                                <CardTitle className="text-center text-sm font-bold uppercase tracking-wider">Score du Tour (3 Fléchettes)</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="grid grid-cols-3 gap-2">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                        <Button
                                            key={num}
                                            variant="secondary"
                                            className="h-16 text-2xl font-mono font-bold hover:bg-muted-foreground/20 hover:text-white"
                                            onClick={() => handleNumpadClick(num.toString())}
                                        >
                                            {num}
                                        </Button>
                                    ))}
                                    <Button
                                        variant="outline"
                                        className="h-16 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                        onClick={handleBackspace}
                                    >
                                        <RotateCcw className="w-6 h-6" />
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        className="h-16 text-2xl font-mono font-bold hover:bg-muted-foreground/20 hover:text-white"
                                        onClick={() => handleNumpadClick("0")}
                                    >
                                        0
                                    </Button>

                                    <Button
                                        className="h-16 bg-red-600 hover:bg-red-500 text-white font-bold text-lg"
                                        onClick={() => submitScore(false)}
                                        disabled={submitting || !scoreInput}
                                    >
                                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "ENTRER"}
                                    </Button>

                                </div>
                                {suggestion && (
                                    <Button
                                        variant="outline"
                                        className="w-full mt-2 h-12 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 font-bold tracking-widest"
                                        onClick={() => submitScore(true)}
                                        disabled={submitting || scoreInput !== activePlayer.scoreLeft.toString()}
                                    >
                                        CHECKOUT {activePlayer.scoreLeft}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        <div className="mt-4 p-4 rounded-xl border border-border bg-card">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Derniers lancers</h4>
                            <div className="space-y-2 h-32 overflow-y-auto pr-2">
                                {match.history.length === 0 ? <p className="text-xs text-muted-foreground">La partie vient de commencer.</p> : null}
                                {[...match.history].reverse().slice(0, 10).map((h, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm p-2 rounded bg-muted/30">
                                        <span className="font-bold w-24 truncate">{match.players.find(p => p.id === h.playerId)?.name}</span>
                                        {h.isBust ? (
                                            <Badge variant="destructive" className="font-mono h-5 text-[10px]">BUST</Badge>
                                        ) : (
                                            <span className="font-mono text-red-400">{h.throwScore}</span>
                                        )}
                                        <span className="font-mono text-muted-foreground w-8 text-right">{h.scoreAfter}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
