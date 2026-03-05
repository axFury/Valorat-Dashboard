"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Package, Sparkles, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"

const SHOP_CATALOG: Record<string, { name: string; emoji: string }> = {
    booster_premium: { name: "Booster Premium", emoji: "🌟" },
    pack_duellistes: { name: "Pack Duellistes", emoji: "🎯" },
    pack_legendaire: { name: "Pack Légendaire", emoji: "🟨" },
}

export default function TCGBoosterPage() {
    const [loading, setLoading] = useState(true)
    const [guildId, setGuildId] = useState<string | null>(null)
    const [balance, setBalance] = useState(0)
    const [boosterData, setBoosterData] = useState<{ freeRemaining: number, boosterInventory: Record<string, number>, dailyLimit: number }>({ freeRemaining: 0, boosterInventory: {}, dailyLimit: 2 })
    const [openingBooster, setOpeningBooster] = useState(false)
    const [openedCards, setOpenedCards] = useState<any[]>([])
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

    const fetchBalance = useCallback(async (gid: string) => {
        try {
            const res = await fetch(`/api/casino/balance?guildId=${gid}`)
            if (res.ok) {
                const data = await res.json()
                setBalance(data.balance)
            }
        } catch { }
    }, [])

    const fetchBoosterData = useCallback(async (gid: string) => {
        try {
            const res = await fetch(`/api/casino/tcg/booster?guildId=${gid}`)
            if (res.ok) {
                const data = await res.json()
                setBoosterData(data)
            }
        } catch { }
    }, [])

    useEffect(() => {
        const gid = typeof window !== "undefined" ? localStorage.getItem("selected_guild") : null
        setGuildId(gid)
        if (gid) {
            Promise.all([fetchBalance(gid), fetchBoosterData(gid)]).finally(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, [fetchBalance, fetchBoosterData])

    async function handleOpenBooster(itemKey: string | null = null, useFree: boolean = false) {
        if (!guildId || openingBooster) return
        setOpeningBooster(true)
        setMsg(null)
        setOpenedCards([])

        try {
            const res = await fetch("/api/casino/tcg/booster", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ guildId, itemKey, useFree })
            })
            const data = await res.json()
            if (!res.ok) {
                setMsg({ text: data.error || "Erreur lors de l'ouverture du booster", ok: false })
            } else {
                setOpenedCards(data.cards)
                if (data.balance !== undefined && data.balance !== null) {
                    setBalance(data.balance)
                }
                fetchBoosterData(guildId)
            }
        } catch {
            setMsg({ text: "Erreur réseau", ok: false })
        }
        setOpeningBooster(false)
        if (!itemKey) {
            setTimeout(() => setMsg(null), 4000)
        }
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
                Sélectionne un serveur.
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    Ouverture de Boosters TCG
                </h1>
                <p className="text-muted-foreground mt-1">Ouvre tes boosters et packs pour agrandir ta collection.</p>
            </div>

            {msg && (
                <div className={`rounded-lg p-3 text-sm font-medium ${msg.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"}`}>
                    {msg.text}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                {/* Basic Booster Card */}
                <Card className="border-emerald-500/20 bg-gradient-to-br from-card to-emerald-500/5 relative overflow-hidden transition-all hover:shadow-lg hover:shadow-emerald-500/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-emerald-500" />
                            Booster Standard
                        </CardTitle>
                        <CardDescription>Ouvre un booster classique de 5 cartes !</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4 border border-border">
                            <div>
                                <p className="font-semibold text-foreground">Boosters Quotidiens</p>
                                <p className="text-sm text-muted-foreground">{boosterData.freeRemaining} gratuit(s) restant(s) sur {boosterData.dailyLimit}</p>
                            </div>
                            <div className="text-3xl animate-bounce">🃏</div>
                        </div>
                        <div className="flex gap-3">
                            {boosterData.freeRemaining > 0 ? (
                                <Button
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-lg hover:shadow-emerald-500/50"
                                    onClick={() => handleOpenBooster(null, true)}
                                    disabled={openingBooster}
                                >
                                    {openingBooster ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                                    Ouvrir Gratuitement
                                </Button>
                            ) : (
                                <Button
                                    className="w-full transition-all"
                                    onClick={() => handleOpenBooster(null, false)}
                                    disabled={openingBooster || balance < 500}
                                >
                                    {openingBooster ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wallet className="h-4 w-4 mr-2" />}
                                    Ouvrir (500 pq)
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Inventaire de Boosters */}
                <Card className="border-border bg-card transition-all hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-purple-500" />
                            Tes Packs et Boosters
                        </CardTitle>
                        <CardDescription>Ouvre tes objets TCG en attente</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {Object.keys(boosterData.boosterInventory).length === 0 ? (
                            <p className="py-8 text-center text-muted-foreground">Tu n'as pas de packs spéciaux en inventaire. Achètes-en dans l'économie !</p>
                        ) : (
                            <div className="space-y-3">
                                {Object.entries(boosterData.boosterInventory).map(([key, count]) => {
                                    const item = SHOP_CATALOG[key] || { name: key, emoji: "📦" }
                                    return (
                                        <div key={key} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 hover:bg-muted transition-colors">
                                            <span className="text-2xl">{item.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-foreground">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">Quantité: {count}</p>
                                            </div>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleOpenBooster(key, false)}
                                                disabled={openingBooster}
                                            >
                                                {openingBooster ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Ouvrir"}
                                            </Button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Zone de Résultat du Booster */}
            {openedCards.length > 0 && (
                <Card className="border-primary/30 bg-primary/5 mt-8 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                            <Sparkles className="h-6 w-6 text-yellow-500" />
                            Cartes Obtenues
                            <Sparkles className="h-6 w-6 text-yellow-500" />
                        </CardTitle>
                        <CardDescription>Félicitations pour tes nouveaux tirages !</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {openedCards.map((card, idx) => {
                                let rarityColor = "bg-gray-500/10 text-gray-500 border-gray-500/20"
                                if (card.rarity === "RARE") rarityColor = "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                if (card.rarity === "EPIC") rarityColor = "bg-purple-500/10 text-purple-400 border-purple-500/30"
                                if (card.rarity === "LEGENDARY") rarityColor = "bg-yellow-500/10 text-yellow-500 border-yellow-500/40"
                                if (card.rarity === "MYTHIC") rarityColor = "bg-red-500/10 text-red-500 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.5)]"

                                return (
                                    <div
                                        key={idx}
                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border ${rarityColor} relative overflow-hidden group hover:scale-105 transition-transform duration-300 animate-in zoom-in`}
                                        style={{ animationDelay: `${idx * 150}ms`, animationFillMode: "both" }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <span className="text-4xl mb-2 drop-shadow-md">{card.emoji}</span>
                                        <p className="font-bold text-sm text-center line-clamp-2">{card.name}</p>
                                        <Badge variant="outline" className={`mt-2 text-[10px] ${rarityColor} border-none`}>
                                            {card.rarity}
                                        </Badge>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="mt-6 text-center">
                            <Button variant="outline" onClick={() => setOpenedCards([])}>Fermer</Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
