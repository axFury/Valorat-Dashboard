"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, RotateCcw, Crosshair, Crown, Copy, UserPlus, Play } from "lucide-react"
import { MatchState, PlayerState, getCheckoutSuggestion } from "@/lib/darts-engine"
import { supabase } from "@/lib/supabase-client"

export default function DartsLiveMatchPage() {
    const params = useParams()
    const router = useRouter()
    const matchId = params.matchId as string

    const [match, setMatch] = useState<MatchState | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [currentDarts, setCurrentDarts] = useState<{ value: number, multiplier: number }[]>([])
    const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1)
    const [submitting, setSubmitting] = useState(false)
    const [currentUser, setCurrentUser] = useState<any>(null)

    useEffect(() => {
        fetch("/api/auth/user")
            .then(res => res.ok ? res.json() : null)
            .then(data => setCurrentUser(data?.user || data))
    }, [])

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

        // Abonnement Supabase Realtime pour ce match
        const channel = supabase.channel(`match_${matchId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'darts_matches', filter: `id=eq.${matchId}` },
                (payload) => {
                    // Si on était l'envoyeur, le fetch est déjà relancé, mais ça assure aux autres la synchronisation
                    fetchMatch()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchMatch, matchId])

    const activePlayer = match?.players[match?.currentPlayerIndex]

    const handleDartClick = async (value: number) => {
        if (!activePlayer || isFinished || submitting) return;

        // Prevent invalid multiplier/value combinations (e.g. Triple 25)
        let actualMultiplier = multiplier;
        if (value === 0) actualMultiplier = 1; // Miss is always 1x0
        if (value === 25 && actualMultiplier === 3) actualMultiplier = 1; // No Triple Bull, fallback to single bull or you can restrict UI. We'll map T25 to disabled in UI anyway.
        if (value === 50) actualMultiplier = 1; // Bullseye is 50, logically it's Double 25 but we treat it as 50x1 for the throw value.

        const newDarts = [...currentDarts, { value, multiplier: actualMultiplier }];
        setCurrentDarts(newDarts);
        setMultiplier(1); // Reset multiplier after throw

        // Calculate theoretical remaining score
        const totalScoreSoFar = newDarts.reduce((acc, d) => acc + (d.value * d.multiplier), 0);
        const remaining = activePlayer.scoreLeft - totalScoreSoFar;

        let shouldAutoSubmit = false;
        let isCheckout = false;

        // BUST detection (Seulement pour x01)
        if (match.gameType !== "cricket") {
            if (remaining < 0) {
                shouldAutoSubmit = true;
            } else if (match.rules?.outRule === 'double') {
                if (remaining === 1) shouldAutoSubmit = true;
                if (remaining === 0) {
                    const lastDart = newDarts[newDarts.length - 1];
                    const isDouble = lastDart.multiplier === 2 || lastDart.value === 50;
                    if (!isDouble) {
                        shouldAutoSubmit = true;
                    } else {
                        isCheckout = true;
                        shouldAutoSubmit = true;
                    }
                }
            } else if (remaining === 0) {
                isCheckout = true;
                shouldAutoSubmit = true;
            }
        }

        // 3 Darts thrown
        if (newDarts.length === 3 && !shouldAutoSubmit) {
            shouldAutoSubmit = true;
        }

        if (shouldAutoSubmit) {
            await submitTurn(newDarts, isCheckout);
        }
    }

    const handleUndoDart = () => {
        if (currentDarts.length > 0) {
            setCurrentDarts(prev => prev.slice(0, -1));
        }
    }

    const submitTurn = async (dartsToSubmit: { value: number, multiplier: number }[], checkout: boolean) => {
        if (!activePlayer || submitting) return
        setSubmitting(true)

        const totalScore = dartsToSubmit.reduce((acc, d) => acc + (d.value * d.multiplier), 0);
        const dartsThrown = dartsToSubmit.length;

        try {
            const res = await fetch(`/api/darts/matches/${matchId}/throw`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    playerId: activePlayer.id,
                    darts: dartsToSubmit,
                    totalScore: totalScore,
                    isCheckout: checkout,
                    dartsThrown: dartsThrown,
                    first9Score: activePlayer.stats.dartsThrown < 9 ? totalScore : undefined,
                    isFirstTurn: activePlayer.stats.dartsThrown === 0,
                    checkoutAttempt: (activePlayer.scoreLeft <= 170 && !checkout) || checkout // Simplfied check
                })
            })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || "Erreur lors de l'enregistrement.")
            } else {
                setCurrentDarts([])
                setMultiplier(1)
                await fetchMatch() // Refresh State
            }
        } catch (e) {
            alert("Erreur réseau.")
        } finally {
            setSubmitting(false)
        }
    }

    const handleJoin = async () => {
        try {
            const res = await fetch(`/api/darts/matches/${matchId}/join`, { method: "POST" })
            if (res.ok) fetchMatch()
            else {
                const data = await res.json()
                alert(data.error || "Erreur lors de la jointure")
            }
        } catch {
            alert("Erreur réseau")
        }
    }

    const handleStart = async () => {
        try {
            const res = await fetch(`/api/darts/matches/${matchId}/start`, { method: "POST" })
            if (res.ok) fetchMatch()
            else {
                const data = await res.json()
                alert(data.error || "Erreur lors du lancement")
            }
        } catch {
            alert("Erreur réseau")
        }
    }

    const copyInviteLink = () => {
        const url = window.location.href
        navigator.clipboard.writeText(url)
        alert("Lien d'invitation copié !")
    }

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>
    if (error || !match) return <div className="text-center py-20 text-red-500 font-bold">{error}</div>

    const isFinished = match.status === "finished"
    const currentTurnScore = currentDarts.reduce((sum, d) => sum + (d.value * d.multiplier), 0);
    const suggestion = activePlayer && match.gameType !== "cricket" ? getCheckoutSuggestion(activePlayer.scoreLeft - currentTurnScore) : null

    const renderCricketMark = (marks: number = 0) => {
        if (marks === 0) return <span className="text-muted-foreground/30 text-2xl">-</span>;
        if (marks === 1) return <span className="text-white text-2xl">/</span>;
        if (marks === 2) return <span className="text-white text-2xl font-black">X</span>;
        return <div className="relative flex items-center justify-center w-8 h-8"><span className="text-white text-2xl font-black absolute">X</span><div className="w-8 h-8 rounded-full border-2 border-white absolute"></div></div>;
    }

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
                        {match.rules.setsToWin === 1 && match.rules.legsToWin === 1 ? (
                            'Manche Unique'
                        ) : (
                            <>
                                {match.rules.matchFormat === 'best_of' ? 'Best of' : 'Premier à'} <span className="text-white">{match.rules.setsToWin} Set{match.rules.setsToWin > 1 ? 's' : ''}, {match.rules.legsToWin} Leg{match.rules.legsToWin > 1 ? 's' : ''}</span>
                            </>
                        )}
                        {match.gameType === 'cricket'
                            ? (match.rules.cricketMode === 'cut_throat' ? ' • CUT-THROAT' : ' • NORMAL')
                            : (match.rules.outRule ? ` • ${match.rules.outRule.toUpperCase()} OUT` : '')}
                    </p>
                </div>
                <div className="w-24"></div> {/* Spacer to center title */}
            </div>

            {match.status === "setup" ? (
                <Card className="max-w-md mx-auto border-red-500/20 bg-card/50 shadow-2xl">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                            <UserPlus className="w-8 h-8 text-red-500 animate-pulse" />
                        </div>
                        <CardTitle className="text-2xl font-black uppercase tracking-widest">Salle d'Attente</CardTitle>
                        <CardDescription>Match en ligne • {match.gameType}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-tighter">Joueurs Connectés ({match.players.length})</h3>
                            <div className="space-y-2">
                                {match.players.map((p, i) => (
                                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-xs font-bold text-red-400">
                                                {i + 1}
                                            </div>
                                            <span className="font-semibold">{p.name}</span>
                                        </div>
                                        {p.id === match.creatorId && <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-500">Host</Badge>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border text-center space-y-3">
                            <p className="text-sm text-muted-foreground">Invite tes amis à rejoindre via ce lien :</p>
                            <Button variant="outline" size="sm" className="w-full font-mono text-xs" onClick={copyInviteLink}>
                                <Copy className="w-3 h-3 mr-2" /> Copier le lien
                            </Button>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3">
                        {!match.players.find(p => p.id === currentUser?.id) && (
                            <Button className="w-full bg-red-600 hover:bg-red-500 text-white font-bold h-12" onClick={handleJoin}>
                                <UserPlus className="w-5 h-5 mr-2" /> REJOINDRE LA PARTIE
                            </Button>
                        )}
                        {match.creatorId === currentUser?.id && (
                            <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12" onClick={handleStart} disabled={match.players.length < 1}>
                                <Play className="w-5 h-5 mr-2" /> LANCER LE MATCH
                            </Button>
                        )}
                        <p className="text-[10px] text-center text-muted-foreground italic">En attente du lancement par l'hôte...</p>
                    </CardFooter>
                </Card>
            ) : isFinished ? (
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
                                        {match.rules.setsToWin > 1 && <div className="flex justify-between"><span>Sets:</span> <strong className="text-yellow-500">{p.setsWon}</strong></div>}
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
                        {match.gameType === "cricket" ? (
                            <Card className="border-border bg-card/50 shadow-xl overflow-hidden mb-4">
                                <div className="grid grid-cols-12 bg-black/40 text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                                    <div className="col-span-5 text-center p-3 truncate border-r border-border">{match.players[0]?.name || "J1"}</div>
                                    <div className="col-span-2 text-center p-3">Cible</div>
                                    {match.players[1] && <div className="col-span-5 text-center p-3 truncate border-l border-border">{match.players[1].name}</div>}
                                </div>

                                <div className="grid grid-cols-12 bg-muted/10 text-xl font-black border-b border-border shadow-inner">
                                    <div className={`col-span-5 text-center p-3 text-red-400 border-r border-border ${match.currentPlayerIndex === 0 ? 'bg-red-500/10' : ''}`}>{match.players[0]?.scoreLeft || 0} PTS</div>
                                    <div className="col-span-2 text-center p-3 text-sm text-muted-foreground">SCORE</div>
                                    {match.players[1] && <div className={`col-span-5 text-center p-3 text-red-400 border-l border-border ${match.currentPlayerIndex === 1 ? 'bg-red-500/10' : ''}`}>{match.players[1].scoreLeft || 0} PTS</div>}
                                </div>

                                {[20, 19, 18, 17, 16, 15, 25].map(target => (
                                    <div key={target} className="grid grid-cols-12 border-b border-border/50 hover:bg-muted/30 transition-colors">
                                        <div className="col-span-5 flex items-center justify-center p-2 border-r border-border/50">
                                            {renderCricketMark(match.players[0]?.cricketMarks?.[target])}
                                        </div>
                                        <div className="col-span-2 flex items-center justify-center bg-black/20 font-black text-lg p-2">
                                            {target === 25 ? 'BULL' : target}
                                        </div>
                                        {match.players[1] && (
                                            <div className="col-span-5 flex items-center justify-center p-2 border-l border-border/50">
                                                {renderCricketMark(match.players[1]?.cricketMarks?.[target])}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </Card>
                        ) : (
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
                                                            <p className="text-red-300/80 font-medium">RESTE</p>
                                                        </Badge>
                                                    </div>

                                                    <div className="flex justify-between items-center text-sm font-semibold mb-2 text-muted-foreground bg-black/20 p-2 rounded-md mt-4">
                                                        {match.rules.setsToWin > 1 && <span className="flex-1 text-center border-r border-border/50">Sets: <span className="text-white">{p.setsWon}</span></span>}
                                                        <span className="flex-1 text-center border-r border-border/50">Legs: <span className="text-white">{p.legsWon}</span></span>
                                                        <span className="flex-1 text-center">Avg: <span className="text-white">{(p.stats.totalScore / Math.max(1, p.stats.dartsThrown) * 3).toFixed(1)}</span></span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                            </div>
                        )}

                        {/* Suggestion & Input Viewer */}
                        <Card className="border-red-500/30 bg-red-500/5">
                            <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                                {match.gameType !== "cricket" && (
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
                                )}
                                <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-xl border border-border shadow-inner min-w-[150px] justify-center text-2xl font-mono font-bold">
                                    {currentDarts.map((d, i) => (
                                        <span key={i} className={d.multiplier === 3 ? "text-red-500" : d.multiplier === 2 ? "text-orange-500" : "text-white"}>
                                            {d.multiplier === 3 ? 'T' : d.multiplier === 2 ? 'D' : ''}{d.value === 50 ? 'BULL' : d.value === 25 ? '25' : d.value === 0 ? 'MISS' : d.value}
                                        </span>
                                    ))}
                                    {currentDarts.length < 3 && Array.from({ length: 3 - currentDarts.length }).map((_, i) => (
                                        <span key={`empty-${i}`} className="text-muted-foreground/30">-</span>
                                    ))}
                                    {(currentTurnScore > 0) && (
                                        <Badge variant="secondary" className="ml-2 font-black">{currentTurnScore}</Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column : Dart Input Viewer */}
                    <div className="lg:col-span-4">
                        <Card className="border-border shadow-xl">
                            <CardHeader className="py-4">
                                <CardTitle className="text-center text-sm font-bold uppercase tracking-wider">Lancer</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">

                                {/* Multiplier Tabs */}
                                <div className="flex gap-2 mb-4">
                                    <Button
                                        variant={multiplier === 1 ? 'default' : 'secondary'}
                                        className={`flex-1 font-black tracking-widest ${multiplier === 1 ? 'bg-sky-600 hover:bg-sky-500 text-white' : ''}`}
                                        onClick={() => setMultiplier(1)}
                                    >SIMPLE</Button>
                                    <Button
                                        variant={multiplier === 2 ? 'default' : 'secondary'}
                                        className={`flex-1 font-black tracking-widest ${multiplier === 2 ? 'bg-orange-500 hover:bg-orange-400 text-white' : ''}`}
                                        onClick={() => setMultiplier(2)}
                                    >DOUBLE</Button>
                                    <Button
                                        variant={multiplier === 3 ? 'default' : 'secondary'}
                                        className={`flex-1 font-black tracking-widest ${multiplier === 3 ? 'bg-red-600 hover:bg-red-500 text-white' : ''}`}
                                        onClick={() => setMultiplier(3)}
                                    >TRIPLE</Button>
                                </div>

                                {/* Numbers Grid */}
                                <div className="grid grid-cols-4 gap-2">
                                    {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                                        <Button
                                            key={num}
                                            variant="outline"
                                            className="h-12 font-mono font-bold hover:bg-muted-foreground/20 hover:text-white"
                                            onClick={() => handleDartClick(num)}
                                        >
                                            {num}
                                        </Button>
                                    ))}

                                    <Button
                                        variant="outline"
                                        className="h-12 border-orange-500/30 text-orange-400 hover:bg-orange-500/10 font-bold col-span-2"
                                        onClick={() => { setMultiplier(1); handleDartClick(25); }}
                                    >
                                        BULL (25)
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-12 border-red-500/30 text-red-500 hover:bg-red-500/10 font-bold col-span-2"
                                        onClick={() => { setMultiplier(1); handleDartClick(50); }}
                                    >
                                        DBULL (50)
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-12 col-span-2 text-muted-foreground hover:text-white"
                                        onClick={() => { setMultiplier(1); handleDartClick(0); }}
                                    >
                                        MISS (0)
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-12 col-span-2 text-destructive hover:bg-destructive/20 border-destructive/20"
                                        onClick={handleUndoDart}
                                        disabled={currentDarts.length === 0}
                                    >
                                        <RotateCcw className="w-5 h-5 mr-2" /> SUPPR
                                    </Button>
                                </div>

                                <Button
                                    className="w-full mt-4 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold tracking-widest"
                                    onClick={() => submitTurn(currentDarts, false)}
                                    disabled={submitting || currentDarts.length === 0}
                                >
                                    {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                                    VALIDER {currentTurnScore > 0 ? `(${currentTurnScore})` : ''}
                                </Button>
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
            )
            }
        </div >
    )
}
