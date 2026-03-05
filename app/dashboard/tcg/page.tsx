"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@supabase/supabase-js"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CARDS, RARITIES, COLLECTIONS, TOTAL_UNIQUE } from "@/lib/card-catalog"
import { Loader2, Search, Filter, LayersIcon, Trophy, ChevronDown } from "lucide-react"

/* ─── Types ─── */
type RarityKey = "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC"
type SortMode = "rarity_desc" | "rarity_asc" | "name" | "duplicates" | "collection"

const RARITY_ORDER: Record<RarityKey, number> = { COMMON: 0, RARE: 1, EPIC: 2, LEGENDARY: 3, MYTHIC: 4 }

const RARITY_STYLE: Record<RarityKey, { border: string; glow: string; badge: string; shine: string }> = {
    COMMON: { border: "border-gray-500/30", glow: "", badge: "bg-gray-500/20 text-gray-300", shine: "from-gray-500/5" },
    RARE: { border: "border-blue-500/40", glow: "", badge: "bg-blue-500/20 text-blue-300", shine: "from-blue-500/10" },
    EPIC: { border: "border-purple-500/50", glow: "shadow-purple-500/20 shadow-lg", badge: "bg-purple-500/20 text-purple-300", shine: "from-purple-500/10" },
    LEGENDARY: { border: "border-yellow-500/60", glow: "shadow-yellow-500/25 shadow-xl", badge: "bg-yellow-500/20 text-yellow-300", shine: "from-yellow-500/10" },
    MYTHIC: { border: "border-red-500/70", glow: "shadow-red-500/40 shadow-2xl ring-1 ring-red-500/30", badge: "bg-red-500/20 text-red-300", shine: "from-red-500/15" },
}

const RARITY_EMOJI: Record<RarityKey, string> = {
    COMMON: "⬜", RARE: "🟦", EPIC: "🟪", LEGENDARY: "🟨", MYTHIC: "🌟"
}

export default function TCGPage() {
    const [loading, setLoading] = useState(true)
    const [guildId, setGuildId] = useState<string | null>(null)
    const [ownedCards, setOwnedCards] = useState<Record<string, number>>({}) // card_id -> count

    // Filters
    const [search, setSearch] = useState("")
    const [rarityFilter, setRarityFilter] = useState<RarityKey | "ALL">("ALL")
    const [collectionFilter, setCollectionFilter] = useState<string>("ALL")
    const [onlyOwned, setOnlyOwned] = useState(false)
    const [onlyDuplicates, setOnlyDuplicates] = useState(false)
    const [sortMode, setSortMode] = useState<SortMode>("rarity_desc")

    const supa = useMemo(() => createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ), [])

    const fetchCollection = useCallback(async (gid: string) => {
        setLoading(true)
        const { data } = await supa
            .from("tcg_user_cards")
            .select("card_id")
            .eq("guild_id", gid)

        const counts: Record<string, number> = {}
        if (data) {
            for (const row of data) {
                counts[row.card_id] = (counts[row.card_id] || 0) + 1
            }
        }
        setOwnedCards(counts)
        setLoading(false)
    }, [supa])

    useEffect(() => {
        const gid = typeof window !== "undefined" ? localStorage.getItem("selected_guild") : null
        setGuildId(gid)
        if (gid) fetchCollection(gid)
        else setLoading(false)
    }, [fetchCollection])

    /* ─── Computed stats ─── */
    const totalOwned = useMemo(() => Object.keys(ownedCards).length, [ownedCards])
    const totalCopies = useMemo(() => Object.values(ownedCards).reduce((s, v) => s + v, 0), [ownedCards])
    const totalDuplicates = useMemo(() => Object.values(ownedCards).reduce((s, v) => s + Math.max(0, v - 1), 0), [ownedCards])

    /* ─── Filtered / sorted cards ─── */
    const filteredCards = useMemo(() => {
        let list = [...CARDS] as any[]

        if (search.trim()) {
            const q = search.toLowerCase()
            list = list.filter(c => c.name.toLowerCase().includes(q) || c.id.includes(q))
        }
        if (rarityFilter !== "ALL") list = list.filter(c => c.rarity === rarityFilter)
        if (collectionFilter !== "ALL") list = list.filter(c => c.collection === collectionFilter)
        if (onlyOwned) list = list.filter(c => ownedCards[c.id] > 0)
        if (onlyDuplicates) list = list.filter(c => (ownedCards[c.id] || 0) > 1)

        list.sort((a, b) => {
            switch (sortMode) {
                case "rarity_desc": return RARITY_ORDER[b.rarity as RarityKey] - RARITY_ORDER[a.rarity as RarityKey]
                case "rarity_asc": return RARITY_ORDER[a.rarity as RarityKey] - RARITY_ORDER[b.rarity as RarityKey]
                case "name": return a.name.localeCompare(b.name)
                case "duplicates": return (ownedCards[b.id] || 0) - (ownedCards[a.id] || 0)
                case "collection": return a.collection.localeCompare(b.collection)
                default: return 0
            }
        })

        return list
    }, [search, rarityFilter, collectionFilter, onlyOwned, onlyDuplicates, sortMode, ownedCards])

    if (!guildId) {
        return (
            <div className="flex h-96 items-center justify-center text-muted-foreground">
                Sélectionne un serveur pour voir ta collection.
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        Collection TCG
                    </h1>
                    <p className="text-muted-foreground mt-1">Explore et trie tes cartes collectionnées.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => guildId && fetchCollection(guildId)}>
                    <Loader2 className="mr-2 h-3 w-3" /> Actualiser
                </Button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: "Cartes uniques", value: `${totalOwned} / ${TOTAL_UNIQUE}`, sub: `${Math.round(totalOwned / TOTAL_UNIQUE * 100)}% du catalogue`, color: "text-purple-400" },
                    { label: "Total cartes", value: totalCopies, sub: "toutes copies incluses", color: "text-blue-400" },
                    { label: "Doublons", value: totalDuplicates, sub: "copies superflues", color: "text-amber-400" },
                    { label: "Cartes manquantes", value: TOTAL_UNIQUE - totalOwned, sub: "encore à découvrir", color: "text-red-400" },
                ].map(s => (
                    <Card key={s.label} className="border-border bg-card">
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Completion bar */}
            <Card className="border-border bg-card">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Progression du Pokédex</span>
                        <span className="text-sm font-bold text-purple-400">{totalOwned}/{TOTAL_UNIQUE}</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-700"
                            style={{ width: `${Math.round(totalOwned / TOTAL_UNIQUE * 100)}%` }}
                        />
                    </div>
                    {/* Per-rarity mini bars */}
                    <div className="mt-3 grid grid-cols-5 gap-2">
                        {(["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"] as RarityKey[]).map(r => {
                            const rarityCards = CARDS.filter(c => c.rarity === r)
                            const owned = rarityCards.filter(c => ownedCards[c.id] > 0).length
                            const style = RARITY_STYLE[r]
                            return (
                                <div key={r} className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>{RARITY_EMOJI[r]} {RARITIES[r].name}</span>
                                        <span>{owned}/{rarityCards.length}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all`}
                                            style={{
                                                width: `${Math.round(owned / rarityCards.length * 100)}%`,
                                                background: r === "COMMON" ? "#6b7280"
                                                    : r === "RARE" ? "#3b82f6"
                                                        : r === "EPIC" ? "#a855f7"
                                                            : r === "LEGENDARY" ? "#eab308"
                                                                : "#ef4444"
                                            }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Filters */}
            <Card className="border-border bg-card">
                <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex flex-col gap-3 md:flex-row">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher une carte..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {/* Sort */}
                        <div className="flex gap-2 flex-wrap">
                            <select
                                value={sortMode}
                                onChange={e => setSortMode(e.target.value as SortMode)}
                                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="rarity_desc">⬇ Rareté (décrois.)</option>
                                <option value="rarity_asc">⬆ Rareté (crois.)</option>
                                <option value="name">📚 Nom (A-Z)</option>
                                <option value="duplicates">📦 Plus de copies</option>
                                <option value="collection">🎴 Collection</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        {/* Rarity filters */}
                        <button
                            onClick={() => setRarityFilter("ALL")}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${rarityFilter === "ALL" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                        >
                            Toutes
                        </button>
                        {(Object.entries(RARITIES) as [RarityKey, any][]).map(([key, r]) => (
                            <button
                                key={key}
                                onClick={() => setRarityFilter(rarityFilter === key ? "ALL" : key)}
                                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${rarityFilter === key ? RARITY_STYLE[key].badge + " border-transparent" : "border-border text-muted-foreground hover:border-primary/50"}`}
                            >
                                {RARITY_EMOJI[key]} {r.name}
                            </button>
                        ))}

                        <div className="w-px h-4 bg-border mx-1" />

                        {/* Toggle filters */}
                        <button
                            onClick={() => setOnlyOwned(!onlyOwned)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${onlyOwned ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "border-border text-muted-foreground hover:border-emerald-500/30"}`}
                        >
                            ✅ Possédées
                        </button>
                        <button
                            onClick={() => setOnlyDuplicates(!onlyDuplicates)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${onlyDuplicates ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "border-border text-muted-foreground hover:border-amber-500/30"}`}
                        >
                            🔁 Doublons
                        </button>
                    </div>

                    {/* Collection filter pills */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setCollectionFilter("ALL")}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${collectionFilter === "ALL" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                        >
                            Toutes les collections
                        </button>
                        {Object.entries(COLLECTIONS).map(([key, col]: any) => (
                            <button
                                key={key}
                                onClick={() => setCollectionFilter(collectionFilter === key ? "ALL" : key)}
                                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${collectionFilter === key ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground hover:border-primary/30"}`}
                            >
                                {col.emoji} {col.name}
                            </button>
                        ))}
                    </div>

                    <p className="text-xs text-muted-foreground">{filteredCards.length} carte{filteredCards.length !== 1 ? "s" : ""} affichée{filteredCards.length !== 1 ? "s" : ""}</p>
                </CardContent>
            </Card>

            {/* Cards grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filteredCards.map((card: any) => {
                    const count = ownedCards[card.id] || 0
                    const owned = count > 0
                    const hasDupe = count > 1
                    const style = RARITY_STYLE[card.rarity as RarityKey]
                    const rarity = RARITIES[card.rarity as RarityKey]

                    return (
                        <div
                            key={card.id}
                            className={`
                                relative flex flex-col rounded-xl border bg-gradient-to-b ${style.shine} to-card overflow-hidden 
                                transition-all duration-200 group
                                ${style.border} ${style.glow}
                                ${!owned ? "opacity-35 grayscale" : "hover:scale-[1.03] cursor-pointer"}
                            `}
                        >
                            {/* Image or placeholder */}
                            <div className={`relative w-full aspect-square bg-muted/50 flex items-center justify-center overflow-hidden`}>
                                {card.image ? (
                                    <img
                                        src={card.image}
                                        alt={card.name}
                                        className={`w-full h-full object-cover transition-transform duration-300 ${owned ? "group-hover:scale-110" : ""}`}
                                        onError={e => {
                                            (e.target as HTMLImageElement).style.display = "none"
                                            const parent = (e.target as HTMLImageElement).parentElement!
                                            const span = document.createElement("span")
                                            span.textContent = card.emoji
                                            span.className = "text-5xl"
                                            parent.appendChild(span)
                                        }}
                                    />
                                ) : (
                                    <span className="text-5xl">{card.emoji}</span>
                                )}

                                {/* Rarity glow overlay for MYTHIC */}
                                {card.rarity === "MYTHIC" && owned && (
                                    <div className="absolute inset-0 bg-gradient-to-b from-red-500/0 to-red-500/20 pointer-events-none" />
                                )}

                                {/* Badge owned count */}
                                {count > 0 && (
                                    <div className={`absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${hasDupe ? "bg-amber-500 text-black" : "bg-emerald-500/90 text-white"}`}>
                                        {count}
                                    </div>
                                )}

                                {/* Not owned overlay */}
                                {!owned && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                        <span className="text-2xl">🔒</span>
                                    </div>
                                )}
                            </div>

                            {/* Card info */}
                            <div className="p-2 flex-1 flex flex-col gap-1">
                                <p className="font-semibold text-xs text-foreground line-clamp-2 leading-tight">{card.name}</p>
                                <div className="flex items-center gap-1 flex-wrap mt-auto pt-1">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${style.badge}`}>
                                        {RARITY_EMOJI[card.rarity as RarityKey]} {rarity?.name}
                                    </span>
                                    {hasDupe && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                                            ×{count}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[9px] text-muted-foreground">
                                    {(COLLECTIONS as any)[card.collection]?.emoji} {(COLLECTIONS as any)[card.collection]?.name}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {filteredCards.length === 0 && (
                <div className="py-20 text-center text-muted-foreground">
                    <p className="text-4xl mb-3">🔍</p>
                    <p className="font-medium">Aucune carte trouvée</p>
                    <p className="text-sm">Essaie d'ajuster tes filtres.</p>
                </div>
            )}
        </div>
    )
}
