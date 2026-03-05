"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@supabase/supabase-js"
import { CARDS, RARITIES, COLLECTIONS } from "@/lib/card-catalog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Swords, Trophy, Users, ArrowLeft, RefreshCw, Send } from "lucide-react"

/* ─── Types ─── */
type Match = {
    id: string
    guild_id: string
    host_id: string
    guest_id: string | null
    status: "waiting" | "active" | "finished"
    host_deck: any[]
    guest_deck: any[] | null
    state: {
        turn: string
        log: string[]
        hostHp: number[]
        guestHp: number[]
        hostActive: number
        guestActive: number
    }
    winner_id: string | null
}

const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TCGCombatPage() {
    const [guildId, setGuildId] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [matches, setMatches] = useState<Match[]>([])
    const [activeMatch, setActiveMatch] = useState<Match | null>(null)

    // UI State
    const [showDeckSelector, setShowDeckSelector] = useState(false)
    const [pendingJoinMatchId, setPendingJoinMatchId] = useState<string | null>(null) // Nuovo: segue quale match stiamo cercando di unire
    const [selectedCards, setSelectedCards] = useState<string[]>([])
    const [inventory, setInventory] = useState<string[]>([]) // List of card IDs owned

    /* ─── Initialization ─── */
    useEffect(() => {
        const gid = typeof window !== "undefined" ? localStorage.getItem("selected_guild") : null
        setGuildId(gid)

        async function fetchUser() {
            const res = await fetch("/api/auth/user")
            if (res.ok) {
                const data = await res.json()
                setUserId(data.id)
            }
        }
        fetchUser()
    }, [])

    const fetchMatches = useCallback(async () => {
        if (!guildId) return
        const res = await fetch(`/api/casino/tcg/matches?guildId=${guildId}`)
        if (res.ok) {
            const data = await res.json()
            setMatches(data)
        }
    }, [guildId])

    const fetchCollection = useCallback(async () => {
        if (!guildId) return
        const res = await fetch(`/api/casino/tcg/collection?guildId=${guildId}`)
        if (res.ok) {
            const data = await res.json()
            const ids: string[] = []
            Object.entries(data.counts).forEach(([id, count]) => {
                if ((count as number) > 0) ids.push(id)
            })
            setInventory(ids)
        }
    }, [guildId])

    useEffect(() => {
        if (guildId) {
            setLoading(true)
            Promise.all([fetchMatches(), fetchCollection()]).finally(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, [guildId, fetchMatches, fetchCollection])

    /* ─── Realtime ─── */
    useEffect(() => {
        if (!guildId) return

        const channel = supa.channel(`tcg_matches_guild_${guildId}`)
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "tcg_matches",
                filter: `guild_id=eq.${guildId}`
            }, (payload) => {
                const updated = payload.new as Match

                // Update lists
                if (updated.status === "waiting") {
                    setMatches(prev => {
                        const idx = prev.findIndex(m => m.id === updated.id)
                        if (idx >= 0) {
                            const copy = [...prev]
                            copy[idx] = updated
                            return copy
                        } else {
                            return [updated, ...prev]
                        }
                    })
                } else {
                    setMatches(prev => prev.filter(m => m.id !== updated.id))
                }

                // Update active match if relevant
                if (activeMatch && activeMatch.id === updated.id) {
                    setActiveMatch(updated)
                }

                // If we created a lobby and someone joined, or we joined
                if (updated.status === "active" && !activeMatch && (updated.host_id === userId || updated.guest_id === userId)) {
                    setActiveMatch(updated)
                }
            })
            .subscribe()

        return () => { supa.removeChannel(channel) }
    }, [guildId, activeMatch, userId])

    /* ─── Actions ─── */
    async function createLobby() {
        if (selectedCards.length !== 3) return
        setLoading(true)
        const res = await fetch("/api/casino/tcg/matches", {
            method: "POST",
            body: JSON.stringify({ guildId, deck: selectedCards })
        })
        if (res.ok) {
            const data = await res.json()
            setActiveMatch(data) // Redirige vers l'arène
            setShowDeckSelector(false)
        } else {
            const err = await res.json()
            alert(err.error)
        }
        setLoading(false)
    }

    async function joinMatch(matchId: string) {
        if (selectedCards.length !== 3) {
            setPendingJoinMatchId(matchId)
            setShowDeckSelector(true)
            return
        }
        setLoading(true)
        try {
            const res = await fetch(`/api/casino/tcg/matches/${matchId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "join", guildId, deck: selectedCards })
            })
            if (res.ok) {
                const data = await res.json()
                // Redirect guest immediately
                setActiveMatch(data)
                setShowDeckSelector(false)
                setPendingJoinMatchId(null)
            } else {
                const err = await res.json()
                alert(err.error || "Erreur lors de la tentative de rejoindre.")
            }
        } catch (e) {
            console.error("Join error:", e)
            alert("Une erreur est survenue.")
        } finally {
            setLoading(false)
        }
    }

    async function handleAttack(index: number) {
        if (!activeMatch) return
        const res = await fetch(`/api/casino/tcg/matches/${activeMatch.id}`, {
            method: "POST",
            body: JSON.stringify({ action: "attack", guildId, attackIndex: index })
        })
        if (!res.ok) {
            const err = await res.json()
            console.error(err.error)
        }
    }

    /* ─── Renderers ─── */

    if (!guildId || !userId) {
        return <div className="flex h-96 items-center justify-center text-muted-foreground">Sélectionne un serveur.</div>
    }

    if (activeMatch) {
        const isHost = userId === activeMatch.host_id
        const isWaiting = activeMatch.status === "waiting"

        const myP = isHost ? { deck: activeMatch.host_deck, hp: activeMatch.state.hostHp || [], active: activeMatch.state.hostActive || 0 }
            : { deck: activeMatch.guest_deck!, hp: activeMatch.state.guestHp, active: activeMatch.state.guestActive }

        const opP = isWaiting ? null : (isHost ? { deck: activeMatch.guest_deck!, hp: activeMatch.state.guestHp, active: activeMatch.state.guestActive }
            : { deck: activeMatch.host_deck, hp: activeMatch.state.hostHp, active: activeMatch.state.hostActive })

        const myActive = myP.deck[myP.active]
        const opActive = opP ? opP.deck[opP.active] : null
        const isMyTurn = activeMatch.state.turn === userId

        return (
            <div className="space-y-6 max-w-5xl mx-auto pb-10">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => setActiveMatch(null)} className="gap-2">
                        <ArrowLeft className="h-4 w-4" /> Retour au lobby
                    </Button>
                    <Badge variant={activeMatch.status === "finished" ? "secondary" : "destructive"} className="animate-pulse">
                        {activeMatch.status === "finished" ? "MATCH TERMINÉ" : isWaiting ? "EN ATTENTE D'ADVERSAIRE" : "COMBAT EN COURS"}
                    </Badge>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Battle Log */}
                    <Card className="lg:col-span-1 order-last lg:order-none h-[500px] flex flex-col">
                        <CardHeader className="py-3 border-b flex flex-row items-center justify-between">
                            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Journal de Combat</CardTitle>
                            <Send className="h-4 w-4 text-primary opacity-50" />
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-4 space-y-2 text-xs font-mono">
                            {activeMatch.state.log.map((line, i) => (
                                <div key={i} className={`p-2 rounded ${i === 0 ? "bg-primary/10 text-primary border-l-2 border-primary" : "text-muted-foreground"}`}>
                                    {line}
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Arena */}
                    <Card className="lg:col-span-2 overflow-hidden bg-gradient-to-b from-zinc-900 to-black border-zinc-800 shadow-2xl">
                        <CardContent className="p-0 flex flex-col h-[500px]">
                            {/* Opponent side */}
                            <div className="p-8 flex-1 flex flex-col items-center justify-center gap-4 border-b border-zinc-800/50 bg-indigo-950/20">
                                {isWaiting ? (
                                    <div className="text-center space-y-4">
                                        <div className="flex justify-center">
                                            <div className="w-16 h-16 rounded-full border-4 border-t-primary border-zinc-800 animate-spin" />
                                        </div>
                                        <p className="text-sm font-medium text-muted-foreground animate-pulse">En attente d'un adversaire...</p>
                                        <p className="text-[10px] text-zinc-500">Partage le lien ou attends qu'un dresseur rejoigne !</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-center">
                                            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Adversaire</p>
                                            <h3 className="text-2xl font-bold">{opActive?.name}</h3>
                                            <div className="mt-2 w-64 bg-zinc-950 h-5 rounded-full overflow-hidden border border-zinc-800 relative shadow-inner">
                                                <div
                                                    className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500"
                                                    style={{ width: `${(opP!.hp[opP!.active] / opActive!.maxHp) * 100}%` }}
                                                />
                                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white uppercase drop-shadow">
                                                    {opP!.hp[opP!.active]} / {opActive!.maxHp} HP
                                                </span>
                                            </div>
                                            <div className="mt-2 flex gap-1 justify-center">
                                                {opP!.deck.map((_, i) => (
                                                    <div key={i} className={`w-2 h-2 rounded-full ${opP!.hp[i] > 0 ? "bg-red-500" : "bg-zinc-800"}`} />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="w-40 h-40 relative group">
                                            <div className="absolute inset-0 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-all" />
                                            <img src={opActive?.image} className="w-full h-full object-contain relative z-10 drop-shadow-2xl brightness-75 grayscale-[0.2]" />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Player side */}
                            <div className="p-8 flex-1 flex flex-col items-center justify-center gap-4 bg-emerald-950/10">
                                <div className="w-40 h-40 relative group">
                                    <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all" />
                                    <img src={myActive.image} className={`w-full h-full object-contain relative z-10 drop-shadow-2xl ${!isMyTurn || isWaiting ? "brightness-75" : "animate-pulse"}`} />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-2xl font-bold text-emerald-400">{myActive.name}</h3>
                                    <div className="mt-2 w-64 bg-zinc-950 h-5 rounded-full overflow-hidden border border-zinc-800 relative shadow-inner">
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                                            style={{ width: `${(myP.hp[myP.active] / myActive.maxHp) * 100}%` }}
                                        />
                                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white uppercase drop-shadow">
                                            {myP.hp[myP.active]} / {myActive.maxHp} HP
                                        </span>
                                    </div>
                                    <div className="mt-2 flex gap-1 justify-center">
                                        {myP.deck.map((_, i) => (
                                            <div key={i} className={`w-2 h-2 rounded-full ${myP.hp[i] > 0 ? "bg-emerald-500" : "bg-zinc-800 shadow-none"} ${i === myP.active ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900" : ""}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="bg-zinc-900 border-t border-zinc-800 p-6">
                                {isMyTurn && activeMatch.status === "active" ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        {myActive.attacks.map((atk: any, i: number) => (
                                            <Button
                                                key={i}
                                                onClick={() => handleAttack(i)}
                                                variant={i === 0 ? "default" : "secondary"}
                                                className="h-16 flex flex-col items-center justify-center gap-0.5 group relative overflow-hidden"
                                            >
                                                <span className="font-bold relative z-10">{atk.name}</span>
                                                <span className="text-[10px] opacity-60 relative z-10">{atk.damage} Dmg • {atk.accuracy}% Précision</span>
                                                <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-200" />
                                            </Button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-16 flex items-center justify-center text-muted-foreground font-medium animate-pulse bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                                        {activeMatch.status === "finished" ? (
                                            activeMatch.winner_id === userId ? "✨ VICTOIRE !" : "💀 DÉFAITE"
                                        ) : isWaiting ? (
                                            "⏳ En attente d'un adversaire..."
                                        ) : (
                                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Advesaire en train de réfléchir...</>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                        Arène de Combat TCG
                    </h1>
                    <p className="text-muted-foreground">Affronte d'autres dresseurs en duel.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchMatches}>
                        <RefreshCw className="h-4 w-4 mr-2" /> Actualiser
                    </Button>
                    <Button className="bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20" onClick={() => {
                        setPendingJoinMatchId(null)
                        setShowDeckSelector(true)
                    }}>
                        <Swords className="h-4 w-4 mr-2" /> Créer un salon
                    </Button>
                </div>
            </div>

            {/* Deck Selector Modal */}
            {showDeckSelector && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-zinc-800 bg-zinc-950">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Choisis tes 3 cartes</CardTitle>
                                <CardDescription>Prends tes meilleures cartes pour {pendingJoinMatchId ? "rejoindre le combat" : "créer un salon"}.</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowDeckSelector(false)}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto min-h-0 p-6">
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                                {CARDS.filter(c => inventory.includes(c.id)).map(card => {
                                    const isSelected = selectedCards.includes(card.id)
                                    return (
                                        <div
                                            key={card.id}
                                            onClick={() => {
                                                if (isSelected) setSelectedCards(prev => prev.filter(id => id !== card.id))
                                                else if (selectedCards.length < 3) setSelectedCards(prev => [...prev, card.id])
                                            }}
                                            className={`
                                                relative cursor-pointer rounded-xl border-2 p-2 transition-all group aspect-[3/4] flex flex-col
                                                ${isSelected ? "border-primary bg-primary/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}
                                            `}
                                        >
                                            <div className="flex-1 overflow-hidden rounded-lg bg-black/40 mb-2 relative">
                                                <img src={card.image || ""} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" />
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2 bg-primary text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                                        {selectedCards.indexOf(card.id) + 1}
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-[10px] font-bold truncate leading-tight">{card.name}</p>
                                            <p className="text-[8px] opacity-40 uppercase tracking-tighter mt-0.5">{card.rarity}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-between items-center">
                            <p className="text-sm font-medium">Cartes sélectionnées : {selectedCards.length} / 3</p>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setShowDeckSelector(false)}>Annuler</Button>
                                <Button
                                    disabled={selectedCards.length !== 3 || loading}
                                    onClick={() => pendingJoinMatchId ? joinMatch(pendingJoinMatchId) : createLobby()}
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    {pendingJoinMatchId ? "Rejoindre & Combattre" : "Confirmer & Créer"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Lobbies List */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {matches.length === 0 ? (
                    <div className="md:col-span-2 lg:col-span-3 py-20 bg-zinc-900/40 rounded-3xl border border-dashed border-zinc-800 flex flex-col items-center justify-center text-muted-foreground">
                        <Users className="h-10 w-10 mb-4 opacity-20" />
                        <p>Aucun salon ouvert pour le moment.</p>
                        <Button variant="link" onClick={() => setShowDeckSelector(true)}>Sois le premier à relever le défi !</Button>
                    </div>
                ) : (
                    matches.map(match => (
                        <Card key={match.id} className="bg-zinc-950 border-zinc-800 group hover:border-red-900/50 transition-colors duration-300">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <Badge variant="outline" className="text-[10px] bg-red-950/20 text-red-500 border-red-500/20">LOBBY OUVERT</Badge>
                                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Duel #{(match.id as string).slice(0, 4)}</p>
                                </div>
                                <CardTitle className="text-lg mt-2 flex items-center gap-2">
                                    Hôte: {match.host_id.slice(0, 8)}...
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex gap-1">
                                        {match.host_deck.map((c, i) => (
                                            <div key={i} className="w-10 h-14 bg-zinc-900 rounded border border-zinc-800  overflow-hidden relative flex-1">
                                                <img src={c.image} className="w-full h-full object-cover grayscale opacity-50" />
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        disabled={match.host_id === userId}
                                        className="w-full bg-zinc-900 text-white hover:bg-white hover:text-black transition-all"
                                        onClick={() => joinMatch(match.id)}
                                    >
                                        {match.host_id === userId ? "Ton salon" : "Rejoindre & Combattre"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}
