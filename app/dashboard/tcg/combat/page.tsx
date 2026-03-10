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
        hostEnergy?: number
        guestEnergy?: number
    }
    winner_id: string | null
}

const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key'
)

export default function TCGCombatPage() {
    const [guildId, setGuildId] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [matches, setMatches] = useState<Match[]>([])
    const [activeMatch, setActiveMatch] = useState<Match | null>(null)
    const [leaderboard, setLeaderboard] = useState<any[]>([])
    const [myProfile, setMyProfile] = useState<any>(null)

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

    const fetchRanking = useCallback(async () => {
        if (!guildId || !userId) return
        const res = await fetch(`/api/casino/tcg/ranking?guildId=${guildId}&userId=${userId}`)
        if (res.ok) {
            const data = await res.json()
            setLeaderboard(data.topPlayers)
            setMyProfile(data.myProfile)
        }
    }, [guildId, userId])

    useEffect(() => {
        if (guildId && userId) {
            setLoading(true)
            Promise.all([fetchMatches(), fetchCollection(), fetchRanking()]).finally(() => setLoading(false))
        } else if (guildId && !userId) {
            // Waiting for userId to fetch ranking
            setLoading(true)
            Promise.all([fetchMatches(), fetchCollection()]).finally(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, [guildId, userId, fetchMatches, fetchCollection, fetchRanking])

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
                            copy[idx] = { ...copy[idx], ...updated }
                            return copy
                        } else {
                            return [updated, ...prev]
                        }
                    })
                } else {
                    setMatches(prev => prev.filter(m => m.id !== updated.id))
                }

                // Update active match if relevant
                setActiveMatch(current => {
                    if (current && current.id === updated.id) {
                        return { ...current, ...updated }
                    }

                    // If we created a lobby and someone joined, or we joined
                    if (!current && updated.status === "active" && (updated.host_id === userId || updated.guest_id === userId)) {
                        return { ...updated }
                    }
                    return current
                })
            })
            .subscribe()

        return () => { supa.removeChannel(channel) }
    }, [guildId, userId])

    /* ─── Actions ─── */
    async function createLobby() {
        if (selectedCards.length !== 3) return
        setLoading(true)
        const res = await fetch("/api/casino/tcg/matches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "attack", guildId, attackIndex: index })
        })
        if (!res.ok) {
            const err = await res.json()
            console.error(err.error)
        }
    }

    async function deleteLobby() {
        if (!activeMatch) return
        if (!confirm("Voulez-vous vraiment supprimer ce salon ?")) return
        setLoading(true)
        const res = await fetch(`/api/casino/tcg/matches/${activeMatch.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete", guildId })
        })
        if (res.ok) {
            setActiveMatch(null)
            fetchMatches()
        }
        setLoading(false)
    }

    async function surrenderMatch() {
        if (!activeMatch) return
        if (!confirm("Voulez-vous vraiment abandonner le combat ?")) return
        setLoading(true)
        await fetch(`/api/casino/tcg/matches/${activeMatch.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "surrender", guildId })
        })
        setLoading(false)
    }

    /* ─── Renderers ─── */

    if (!guildId || !userId) {
        return <div className="flex h-96 items-center justify-center text-muted-foreground">Sélectionne un serveur.</div>
    }

    if (activeMatch) {
        const isPlayingSelf = activeMatch.host_id === activeMatch.guest_id && activeMatch.status === "active"
        let turnRole = activeMatch.state?.turn
        if (turnRole && turnRole !== "host" && turnRole !== "guest") {
            turnRole = turnRole === activeMatch.host_id ? "host" : "guest"
        }

        const isHost = isPlayingSelf ? turnRole === "host" : userId === activeMatch.host_id
        const isWaiting = activeMatch.status === "waiting"

        const myP = isHost ? { deck: activeMatch.host_deck || [], hp: activeMatch.state?.hostHp || [], active: activeMatch.state?.hostActive || 0, energy: activeMatch.state?.hostEnergy || 0 }
            : { deck: activeMatch.guest_deck || [], hp: activeMatch.state?.guestHp || [], active: activeMatch.state?.guestActive || 0, energy: activeMatch.state?.guestEnergy || 0 }

        const opP = isWaiting ? null : (isHost ? { deck: activeMatch.guest_deck || [], hp: activeMatch.state?.guestHp || [], active: activeMatch.state?.guestActive || 0, energy: activeMatch.state?.guestEnergy || 0 }
            : { deck: activeMatch.host_deck || [], hp: activeMatch.state?.hostHp || [], active: activeMatch.state?.hostActive || 0, energy: activeMatch.state?.hostEnergy || 0 })

        const myActive = myP.deck[myP.active]
        const opActive = opP ? opP.deck[opP.active] : null

        const isMyTurn = isPlayingSelf ? true : ((turnRole === "host" && userId === activeMatch.host_id) || (turnRole === "guest" && userId === activeMatch.guest_id))

        return (
            <div className="space-y-6 max-w-5xl mx-auto pb-10">
                <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                        {activeMatch.status === "waiting" && isHost && (
                            <Button variant="destructive" size="sm" onClick={deleteLobby} disabled={loading}>
                                Supprimer le salon
                            </Button>
                        )}
                        {activeMatch.status === "active" && (
                            <Button variant="destructive" size="sm" onClick={surrenderMatch} disabled={loading}>
                                Abandonner
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setActiveMatch(null)} className="gap-2">
                            <ArrowLeft className="h-4 w-4" /> Retour
                        </Button>
                    </div>
                    <Badge variant={activeMatch.status === "finished" ? "secondary" : "destructive"} className="animate-pulse">
                        {activeMatch.status === "finished" ? "MATCH TERMINÉ" : isWaiting ? "EN ATTENTE D'ADVERSAIRE" : "COMBAT EN COURS"}
                    </Badge>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Battle Log */}
                    <Card className="lg:col-span-1 order-last lg:order-none min-h-[500px] lg:h-[800px] flex flex-col shadow-xl border-zinc-800/50">
                        <CardHeader className="py-3 border-b border-zinc-800/50 flex flex-row items-center justify-between bg-zinc-900/50">
                            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Journal de Combat</CardTitle>
                            <Send className="h-4 w-4 text-primary opacity-50" />
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-4 space-y-2 text-xs font-mono bg-black/20">
                            {activeMatch.state.log.map((line, i) => (
                                <div key={i} className={`p-2 rounded ${i === 0 ? "bg-primary/10 text-primary border-l-2 border-primary" : "text-muted-foreground"}`}>
                                    {line}
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Arena */}
                    <Card className="lg:col-span-2 overflow-hidden bg-gradient-to-b from-zinc-900 to-black border-zinc-800 shadow-2xl">
                        <CardContent className="p-0 flex flex-col min-h-[800px]">
                            {/* Opponent side */}
                            <div className="p-6 sm:p-8 flex-1 flex flex-col items-center justify-center gap-4 border-b border-zinc-800/50 bg-indigo-950/20">
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
                                            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Adversaire</p>
                                            <h3 className="text-xl font-bold">{opActive?.name}</h3>
                                            <div className="mt-2 w-48 sm:w-64 bg-zinc-950 h-4 rounded-full overflow-hidden border border-zinc-800 relative shadow-inner">
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
                                                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${opP!.hp[i] > 0 ? "bg-red-500" : "bg-zinc-800"}`} />
                                                ))}
                                            </div>
                                            <div className="mt-3 flex gap-0.5 justify-center">
                                                {[...Array(10)].map((_, i) => (
                                                    <div key={i} className={`w-3 h-1.5 rounded-sm ${i < opP!.energy ? "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]" : "bg-zinc-800"}`} />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="w-32 h-32 sm:w-48 sm:h-48 relative group transition-transform duration-700 hover:scale-105">
                                            <div className="absolute inset-0 bg-red-500/20 rounded-full blur-3xl group-hover:bg-red-500/30 transition-all duration-500" />
                                            <img src={opActive?.image} className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_25px_rgba(239,68,68,0.4)] brightness-90 grayscale-[0.1]" />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Player side */}
                            <div className="p-6 sm:p-8 flex-1 flex flex-col items-center justify-center gap-4 bg-emerald-950/10">
                                <div className="w-32 h-32 sm:w-48 sm:h-48 relative group transition-transform duration-700 hover:scale-105">
                                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-3xl group-hover:bg-emerald-500/30 transition-all duration-500" />
                                    <img src={myActive.image} className={`w-full h-full object-contain relative z-10 drop-shadow-[0_0_25px_rgba(16,185,129,0.4)] ${!isMyTurn || isWaiting ? "brightness-90" : "animate-pulse"}`} />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-emerald-400">{myActive.name}</h3>
                                    <div className="mt-2 w-48 sm:w-64 bg-zinc-950 h-4 rounded-full overflow-hidden border border-zinc-800 relative shadow-inner">
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
                                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${myP.hp[i] > 0 ? "bg-emerald-500" : "bg-zinc-800 shadow-none"} ${i === myP.active ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900" : ""}`} />
                                        ))}
                                    </div>
                                    <div className="mt-3 flex gap-0.5 justify-center">
                                        {[...Array(10)].map((_, i) => (
                                            <div key={i} className={`w-3 h-1.5 rounded-sm ${i < myP.energy ? "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]" : "bg-zinc-800"}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="bg-zinc-900 border-t border-zinc-800 p-4 sm:p-6 mt-auto">
                                {isMyTurn && activeMatch.status === "active" ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
                                        {myActive.attacks.map((atk: any, i: number) => {
                                            const canAfford = myP.energy >= atk.cost
                                            return (
                                                <Button
                                                    key={i}
                                                    disabled={!canAfford}
                                                    onClick={() => handleAttack(i)}
                                                    variant={i === 0 ? "default" : (i === 1 ? "secondary" : "destructive")}
                                                    className={`h-16 flex flex-col items-center justify-center gap-0.5 group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] 
                                                    ${!canAfford ? "opacity-30 cursor-not-allowed grayscale" :
                                                            (i === 2 ? "bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 shadow-[0_0_20px_rgba(124,58,237,0.3)] border-none" :
                                                                (i === 0 ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)] border-none" :
                                                                    "bg-zinc-800 hover:bg-zinc-700 border-zinc-700"))}`}
                                                >
                                                    <span className="absolute top-1 left-2 text-[10px] text-yellow-400 font-black drop-shadow-md bg-black/50 px-1 rounded">⚡ {atk.cost}</span>
                                                    {i === 0 && <span className="absolute top-1 right-2 text-[10px] text-emerald-400 font-black drop-shadow-md bg-black/50 px-1 rounded">+1 ⚡</span>}
                                                    <span className={`font-bold relative z-10 ${i === 2 || i === 0 ? "text-white" : "text-zinc-200 group-hover:text-white"}`}>{atk.name}</span>
                                                    <span className={`text-[10px] relative z-10 ${i === 2 ? "text-purple-200" : (i === 0 ? "text-emerald-100" : "text-zinc-400")}`}>{atk.damage} Dmg • {atk.accuracy}% P.</span>
                                                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                                </Button>
                                            )
                                        })}
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
                    <p className="text-muted-foreground flex items-center gap-2 mt-1">
                        Affronte d'autres dresseurs et grimpe dans le ladder.
                        {myProfile && (
                            <Badge variant="outline" className="ml-2 border-yellow-500/50 text-yellow-500 bg-yellow-500/10">
                                🏆 {myProfile.trophies || 0}
                            </Badge>
                        )}
                        {myProfile && (
                            <span className="text-xs text-zinc-500">
                                ({myProfile.wins || 0}V - {myProfile.losses || 0}D)
                            </span>
                        )}
                    </p>
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
                                {CARDS.filter(c => inventory.includes(c.id)).sort((a, b) => {
                                    const RARITY_ORDER: Record<string, number> = { COMMON: 0, RARE: 1, EPIC: 2, LEGENDARY: 3, MYTHIC: 4 }
                                    return RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]
                                }).map(card => {
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

            {/* Lobbies and Leaderboard Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

                {/* Lobbies List - 3/4 width on large screens */}
                <div className="xl:col-span-3">
                    <h2 className="text-xl font-bold mt-2 mb-4 flex items-center gap-2">
                        <Swords className="h-5 w-5 text-red-500" /> Salons Ouverts
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {matches.length === 0 ? (
                            <div className="md:col-span-2 lg:col-span-3 py-20 bg-zinc-900/40 rounded-3xl border border-dashed border-zinc-800 flex flex-col items-center justify-center text-muted-foreground">
                                <Users className="h-10 w-10 mb-4 opacity-20" />
                                <p>Aucun salon ouvert pour le moment.</p>
                                <Button variant="link" onClick={() => setShowDeckSelector(true)}>Sois le premier à relever le défi !</Button>
                            </div>
                        ) : (
                            matches.map(match => (
                                <Card key={match.id} className="bg-gradient-to-br from-zinc-950 to-zinc-900 border-zinc-800 group hover:border-red-500/50 hover:shadow-[0_0_30px_rgba(239,68,68,0.1)] transition-all duration-300 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <CardHeader className="pb-2 relative z-10">
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
                                                {[1, 2, 3].map((_, i) => (
                                                    <div key={i} className="w-10 h-14 bg-zinc-900 rounded border border-zinc-800 flex items-center justify-center flex-1 shadow-inner">
                                                        <span className="text-zinc-700 text-xs font-bold">?</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <Button
                                                className={`w-full text-white transition-all duration-300 relative z-10 shadow-lg ${match.host_id === userId ? "bg-indigo-600 hover:bg-indigo-500" : "bg-zinc-800 hover:bg-red-600"}`}
                                                onClick={() => joinMatch(match.id)}
                                            >
                                                {match.host_id === userId ? "Rejoindre (Test local)" : "Rejoindre & Combattre"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>

                {/* Leaderboard - 1/4 width on large screens */}
                <div className="xl:col-span-1">
                    <Card className="border-zinc-800 bg-zinc-950/50 backdrop-blur-md shadow-2xl h-full">
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Trophy className="h-5 w-5 text-yellow-500" />
                                Classement Élo
                            </CardTitle>
                            <CardDescription>Les meilleurs joueurs du serveur.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 p-4 pt-0">
                            {leaderboard.length === 0 ? (
                                <p className="text-muted-foreground text-sm text-center py-4">Aucun joueur classé.</p>
                            ) : (
                                leaderboard.map((p, i) => {
                                    const winrate = p.wins + p.losses > 0
                                        ? Math.round((p.wins / (p.wins + p.losses)) * 100)
                                        : 0

                                    return (
                                        <div key={p.user_id} className={`flex items-center justify-between p-3 rounded-lg border ${p.user_id === userId ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(220,38,38,0.15)]" : "bg-zinc-900/50 border-zinc-800"}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-yellow-500 text-yellow-950" :
                                                    i === 1 ? "bg-zinc-300 text-zinc-800" :
                                                        i === 2 ? "bg-amber-700 text-white" :
                                                            "bg-zinc-800 text-zinc-400"
                                                    }`}>
                                                    {i + 1}
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-bold ${p.user_id === userId ? "text-primary" : "text-zinc-200"}`}>
                                                        {p.username || "Inconnu"}
                                                    </p>
                                                    <p className="text-[10px] text-zinc-500 font-medium">WR: {winrate}%</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-yellow-500 flex items-center justify-end gap-1">
                                                    {p.trophies} 🏆
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
