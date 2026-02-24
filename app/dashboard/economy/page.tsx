"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
    Wallet, ShoppingBag, Package, Ticket,
    Loader2, Trophy, Clock, TrendingUp, AlertTriangle, Sparkles, RotateCcw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@supabase/supabase-js"
import { getDiscordProfiles } from "@/lib/discord-profile-cache"

/* ═══════════════════════════════════════
   SHOP CATALOG (mirrored from bot)
   ═══════════════════════════════════════ */

const SHOP_CATALOG: Record<string, {
    name: string; emoji: string; description: string;
    category: string; price: number; durationHours?: number;
    bonus?: Record<string, any>; roleKey?: string; roleName?: string;
}> = {
    booster_premium: { name: "Booster Premium", emoji: "🌟", description: "Booster avec taux doublé de cartes rares et plus", category: "tcg", price: 2000 },
    pack_duellistes: { name: "Pack Duellistes", emoji: "🎯", description: "5 cartes Valorant garanties", category: "tcg", price: 5000 },
    pack_legendaire: { name: "Pack Légendaire", emoji: "🟨", description: "1 carte Légendaire ou Mythique garantie", category: "tcg", price: 15000 },
    carte_protection: { name: "Protection de Carte", emoji: "🛡️", description: "Protège une carte pendant 7 jours", category: "tcg", price: 3000, durationHours: 168 },
    bouclier_combat: { name: "Bouclier de Combat", emoji: "🔰", description: "Bloque tous les défis pendant 24h", category: "combat", price: 2000, durationHours: 24 },
    potion_force: { name: "Potion de Force", emoji: "💪", description: "+10% de dégâts pendant 24h", category: "combat", price: 1500, durationHours: 24 },
    ticket_revanche: { name: "Ticket de Revanche", emoji: "🔄", description: "Rejoue un combat perdu (usage unique)", category: "combat", price: 1000 },
    boost_salaire: { name: "Boost de Salaire", emoji: "📈", description: "+1 000 pq/jour pendant 7 jours (retour: 7k)", category: "economy", price: 5000, durationHours: 168 },
    boost_quete: { name: "Boost de Quêtes", emoji: "⚡", description: "Progression de quêtes x2 pendant 7 jours", category: "economy", price: 3000, durationHours: 168 },
    assurance_pari: { name: "Assurance Pari", emoji: "🔒", description: "Récupère 50% de ta mise si tu perds", category: "economy", price: 1500 },
    lootbox_bronze: { name: "Caisse Bronze", emoji: "🟫", description: "Récompenses aléatoires (500-3 000 pq)", category: "lootbox", price: 1500 },
    lootbox_argent: { name: "Caisse Argent", emoji: "⬜", description: "Récompenses aléatoires (2 000-8 000 pq)", category: "lootbox", price: 4000 },
    lootbox_or: { name: "Caisse Or", emoji: "🟨", description: "Récompenses aléatoires (5 000-25 000 pq)", category: "lootbox", price: 10000 },
    lootbox_radiant: { name: "Caisse Radiant", emoji: "💎", description: "Récompenses aléatoires (15 000-100 000 pq)", category: "lootbox", price: 35000 },
    ticket_loterie: { name: "Ticket de Loterie", emoji: "🎟️", description: "Participe au tirage hebdomadaire (dim. 21h)", category: "lottery", price: 1000 },
    compagnon_spike: { name: "Petit Spike", emoji: "💣", description: "Compagnon — +500 pq/jour passif", category: "companion", price: 5000, bonus: { dailyEcus: 500 } },
    compagnon_phoenix: { name: "Phoenix Jr", emoji: "🔥", description: "Compagnon — +15% dégâts en combat TCG", category: "companion", price: 8000, bonus: { combatDmg: 15 } },
    compagnon_sage: { name: "Sage Bot", emoji: "💚", description: "Compagnon — +2 boosters gratuits par jour", category: "companion", price: 10000, bonus: { freeBooster: 2 } },
    compagnon_omen: { name: "Omen Shadow", emoji: "👤", description: "Compagnon — 800 pq/jour + 15% chance loot", category: "companion", price: 15000, bonus: { dailyEcus: 800, lootLuck: 15 } },
    compagnon_radiant: { name: "Renard Radiant", emoji: "🦊", description: "Compagnon LÉGENDAIRE — 2 000 pq/jour + 25% loot", category: "companion", price: 30000, bonus: { dailyEcus: 2000, lootLuck: 25 } },
    pass_vip: { name: "Pass VIP", emoji: "⭐", description: "Rôle VIP + 1 500 pq/jour (30j = 45k retour)", category: "pass", price: 12000, durationHours: 720, roleKey: "vip", roleName: "⭐ VIP" },
    pass_premium: { name: "Pass Premium", emoji: "💎", description: "Rôle Premium + 3 000 pq/jour + boosts (30j = 90k)", category: "pass", price: 30000, durationHours: 720, roleKey: "premium", roleName: "💎 Premium" },
    pass_radiant: { name: "Pass Radiant", emoji: "🌟", description: "Rôle Radiant + 6 000 pq/jour + TOUS les bonus (30j = 180k)", category: "pass", price: 60000, durationHours: 720, roleKey: "radiant", roleName: "🌟 Radiant" },
}

const CATEGORIES: Record<string, { name: string; emoji: string; description: string }> = {
    tcg: { name: "TCG", emoji: "🃏", description: "Boosters, packs et protections" },
    combat: { name: "Combat", emoji: "⚔️", description: "Items pour les combats TCG" },
    economy: { name: "Économie", emoji: "💰", description: "Boosts de revenus et assurances" },
    lootbox: { name: "Lootbox", emoji: "📦", description: "Caisses mystères à ouvrir" },
    companion: { name: "Compagnons", emoji: "🐾", description: "Petits alliés avec bonus passifs" },
    pass: { name: "Pass", emoji: "👑", description: "Rôles Discord + bonus exclusifs" },
    lottery: { name: "Loterie", emoji: "🎟️", description: "Tickets pour le tirage du dimanche" },
}

function fmtEcus(n: number) {
    return n.toLocaleString("fr-FR")
}

function currentLotteryWeek() {
    const now = new Date()
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const wk = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `${d.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`
}

export default function EconomyPage() {
    const [loading, setLoading] = useState(true)
    const [guildId, setGuildId] = useState<string | null>(null)

    // Portefeuille
    const [topWallets, setTopWallets] = useState<any[]>([])
    const [recentPurchases, setRecentPurchases] = useState<any[]>([])
    const [totalEconomy, setTotalEconomy] = useState({ totalBalance: 0, totalLoans: 0, walletCount: 0 })

    // Boutique
    const [selectedCategory, setSelectedCategory] = useState<string>("tcg")
    const [marketDeals, setMarketDeals] = useState<any[]>([])

    // Inventaire
    const [inventoryStats, setInventoryStats] = useState<any[]>([])
    const [topCollectors, setTopCollectors] = useState<any[]>([])

    // Loterie
    const [lotteryData, setLotteryData] = useState<any[]>([])
    const [lotteryTotals, setLotteryTotals] = useState({ totalTickets: 0, totalPot: 0, participants: 0 })

    // Discord profiles
    const [profiles, setProfiles] = useState<Map<string, { username: string; avatar: string }>>(new Map())

    // Buy
    const [balance, setBalance] = useState(0)
    const [buyLoading, setBuyLoading] = useState<string | null>(null)
    const [buyMsg, setBuyMsg] = useState<{ text: string; ok: boolean } | null>(null)
    const [myInventory, setMyInventory] = useState<any[]>([])

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
            // 1. Top wallets
            const { data: wallets } = await supa
                .from("user_wallets")
                .select("user_id, balance, loan_amount")
                .eq("guild_id", gid)
                .order("balance", { ascending: false })
                .limit(15)

            if (wallets) {
                setTopWallets(wallets)
                const totalBal = wallets.reduce((s: number, w: any) => s + (w.balance || 0), 0)
                const totalLoan = wallets.reduce((s: number, w: any) => s + (w.loan_amount || 0), 0)
                setTotalEconomy({ totalBalance: totalBal, totalLoans: totalLoan, walletCount: wallets.length })
            }

            // 2. Recent purchases
            const { data: purchases } = await supa
                .from("shop_purchase_log")
                .select("*")
                .eq("guild_id", gid)
                .order("purchased_at", { ascending: false })
                .limit(20)
            if (purchases) setRecentPurchases(purchases)

            // 3. Black market
            const now = new Date().toISOString()
            const { data: market } = await supa
                .from("shop_market_rotation")
                .select("*")
                .eq("guild_id", gid)
                .gt("expires_at", now)
                .lte("starts_at", now)
                .order("id")
            if (market) setMarketDeals(market)

            // 4. Inventory stats — count items by item_key
            const { data: invData } = await supa
                .from("shop_user_inventory")
                .select("item_key, user_id, used")
                .eq("guild_id", gid)
                .eq("used", false)

            if (invData) {
                // Group by item_key
                const byItem: Record<string, number> = {}
                const byUser: Record<string, number> = {}
                for (const row of invData) {
                    byItem[row.item_key] = (byItem[row.item_key] || 0) + 1
                    byUser[row.user_id] = (byUser[row.user_id] || 0) + 1
                }
                setInventoryStats(
                    Object.entries(byItem)
                        .map(([key, count]) => ({ key, count, item: SHOP_CATALOG[key] }))
                        .filter(x => x.item)
                        .sort((a, b) => b.count - a.count)
                )
                setTopCollectors(
                    Object.entries(byUser)
                        .map(([userId, count]) => ({ userId, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 10)
                )
            }

            // 5. Lottery
            const week = currentLotteryWeek()
            const { data: lottery } = await supa
                .from("shop_lottery")
                .select("user_id, tickets")
                .eq("guild_id", gid)
                .eq("week", week)

            if (lottery) {
                const sorted = [...lottery].sort((a, b) => b.tickets - a.tickets)
                setLotteryData(sorted)
                const totalTickets = sorted.reduce((s, e) => s + e.tickets, 0)
                setLotteryTotals({
                    totalTickets,
                    totalPot: totalTickets * 1000,
                    participants: sorted.length,
                })
            }

            // 6. Fetch Discord profiles for all user IDs
            const allUserIds = new Set<string>()
            wallets?.forEach(w => allUserIds.add(w.user_id))
            purchases?.forEach(p => allUserIds.add(p.user_id))
            lottery?.forEach(l => allUserIds.add(l.user_id))
            invData?.forEach(i => allUserIds.add(i.user_id))

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

    // Fetch user balance
    const fetchBalance = useCallback(async (gid: string) => {
        try {
            const res = await fetch(`/api/casino/balance?guildId=${gid}`)
            if (res.ok) {
                const data = await res.json()
                setBalance(data.balance)
            }
        } catch { }
    }, [])

    // Fetch user inventory
    const fetchMyInventory = useCallback(async (gid: string) => {
        try {
            const res = await fetch(`/api/casino/shop?guildId=${gid}`)
            if (res.ok) {
                const data = await res.json()
                setMyInventory(data.inventory || [])
            }
        } catch { }
    }, [])

    useEffect(() => {
        if (guildId) {
            fetchBalance(guildId)
            fetchMyInventory(guildId)
        }
    }, [guildId, fetchBalance, fetchMyInventory])

    // Buy
    async function buyItem(itemKey: string) {
        if (!guildId || buyLoading) return
        setBuyLoading(itemKey)
        setBuyMsg(null)
        try {
            const res = await fetch("/api/casino/shop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ guildId, itemKey }),
            })
            const data = await res.json()
            if (!res.ok) {
                setBuyMsg({ text: data.error || "Erreur", ok: false })
            } else {
                setBuyMsg({ text: `✅ ${data.itemName} acheté !`, ok: true })
                setBalance(data.newBalance)
                fetchMyInventory(guildId)
            }
        } catch {
            setBuyMsg({ text: "Erreur réseau", ok: false })
        }
        setBuyLoading(null)
        setTimeout(() => setBuyMsg(null), 4000)
    }

    function userName(userId: string) {
        return profiles.get(userId)?.username || `Utilisateur`
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
                Sélectionne un serveur pour voir l'économie
            </div>
        )
    }

    const catItems = Object.entries(SHOP_CATALOG).filter(([, item]) => item.category === selectedCategory)

    // Lottery countdown
    const now = new Date()
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7
    const nextDraw = new Date(now)
    nextDraw.setDate(now.getDate() + daysUntilSunday)
    nextDraw.setHours(21, 0, 0, 0)
    const timeLeft = nextDraw.getTime() - now.getTime()
    const daysLeft = Math.floor(timeLeft / 86400_000)
    const hoursLeft = Math.floor((timeLeft % 86400_000) / 3600_000)

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Économie</h1>
                    <p className="text-muted-foreground">Portefeuilles, boutique, inventaire et loterie du serveur</p>
                </div>
                <Card className="border-border bg-gradient-to-r from-amber-500/10 to-yellow-500/10 sm:w-auto">
                    <CardContent className="flex items-center gap-3 p-4">
                        <Wallet className="h-5 w-5 text-amber-500" />
                        <div>
                            <p className="text-xs text-muted-foreground">Ton solde</p>
                            <p className="text-xl font-bold text-amber-500">{fmtEcus(balance)} pq</p>
                        </div>
                        <Button variant="ghost" size="icon" className="ml-2 h-8 w-8" onClick={() => guildId && fetchBalance(guildId)}>
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {buyMsg && (
                <div className={`rounded-lg p-3 text-sm font-medium ${buyMsg.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"}`}>
                    {buyMsg.text}
                </div>
            )}

            <Tabs defaultValue="wallet" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="wallet" className="gap-2">
                        <Wallet className="h-4 w-4" />
                        <span className="hidden sm:inline">Portefeuille</span>
                    </TabsTrigger>
                    <TabsTrigger value="shop" className="gap-2">
                        <ShoppingBag className="h-4 w-4" />
                        <span className="hidden sm:inline">Boutique</span>
                    </TabsTrigger>
                    <TabsTrigger value="inventory" className="gap-2">
                        <Package className="h-4 w-4" />
                        <span className="hidden sm:inline">Inventaire</span>
                    </TabsTrigger>
                    <TabsTrigger value="lottery" className="gap-2">
                        <Ticket className="h-4 w-4" />
                        <span className="hidden sm:inline">Loterie</span>
                    </TabsTrigger>
                </TabsList>

                {/* ═══════════════ PORTEFEUILLE ═══════════════ */}
                <TabsContent value="wallet" className="mt-6 space-y-6">
                    {/* Stats cards */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Économie totale</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold text-emerald-500">{fmtEcus(totalEconomy.totalBalance)} pq</p>
                                <p className="text-xs text-muted-foreground">{totalEconomy.walletCount} portefeuilles</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Prêts en cours</CardTitle>
                                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold text-amber-500">{fmtEcus(totalEconomy.totalLoans)} pq</p>
                                <p className="text-xs text-muted-foreground">Crédits actifs</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Achats récents</CardTitle>
                                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">{recentPurchases.length}</p>
                                <p className="text-xs text-muted-foreground">Dernières transactions</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Top richesses */}
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Trophy className="h-5 w-5 text-yellow-500" />
                                    Top Richesses
                                </CardTitle>
                                <CardDescription>Les joueurs les plus riches du serveur</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {topWallets.length === 0 ? (
                                    <p className="py-8 text-center text-muted-foreground">Aucune donnée</p>
                                ) : (
                                    <div className="space-y-3">
                                        {topWallets.slice(0, 10).map((w, i) => (
                                            <div key={w.user_id} className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3 transition-all hover:bg-muted">
                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${i === 0 ? "bg-yellow-500/20 text-yellow-500"
                                                    : i === 1 ? "bg-gray-400/20 text-gray-400"
                                                        : i === 2 ? "bg-orange-600/20 text-orange-600"
                                                            : "bg-primary/10 text-primary"
                                                    }`}>
                                                    #{i + 1}
                                                </div>
                                                <Avatar className="h-10 w-10 border-2 border-border">
                                                    <AvatarImage src={userAvatar(w.user_id)} />
                                                    <AvatarFallback>{userName(w.user_id)[0]?.toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-foreground truncate">{userName(w.user_id)}</p>
                                                    <p className="text-sm text-muted-foreground">{fmtEcus(w.balance)} pq</p>
                                                </div>
                                                {w.loan_amount > 0 && (
                                                    <Badge variant="outline" className="text-amber-500 border-amber-500/30 shrink-0">
                                                        Prêt: {fmtEcus(w.loan_amount)}
                                                    </Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Historique achats */}
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-blue-500" />
                                    Achats récents
                                </CardTitle>
                                <CardDescription>Dernières transactions boutique</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {recentPurchases.length === 0 ? (
                                    <p className="py-8 text-center text-muted-foreground">Aucun achat</p>
                                ) : (
                                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                                        {recentPurchases.map((p, i) => {
                                            const item = SHOP_CATALOG[p.item_key]
                                            const date = new Date(p.purchased_at)
                                            return (
                                                <div key={p.id || i} className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                                                    <span className="text-xl">{item?.emoji || "📦"}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-foreground text-sm truncate">{p.item_name}</p>
                                                        <p className="text-xs text-muted-foreground">{userName(p.user_id)}</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-sm font-semibold text-red-400">-{fmtEcus(p.price)} pq</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ═══════════════ BOUTIQUE ═══════════════ */}
                <TabsContent value="shop" className="mt-6 space-y-6">
                    {/* Category selector */}
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(CATEGORIES).map(([key, cat]) => (
                            <button
                                key={key}
                                onClick={() => setSelectedCategory(key)}
                                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${selectedCategory === key
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                            >
                                <span>{cat.emoji}</span>
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    {/* Items grid */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {catItems.map(([key, item]) => (
                            <Card key={key} className="border-border bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                                <CardContent className="p-5">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
                                            {item.emoji}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-foreground">{item.name}</h3>
                                            <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                                    {fmtEcus(item.price)} pq
                                                </Badge>
                                                {item.durationHours && (
                                                    <Badge variant="outline" className="text-muted-foreground">
                                                        <Clock className="mr-1 h-3 w-3" />
                                                        {item.durationHours >= 168 ? `${Math.floor(item.durationHours / 24)}j` : `${item.durationHours}h`}
                                                    </Badge>
                                                )}
                                            </div>
                                            <Button
                                                size="sm"
                                                className="mt-3 gap-1 w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400"
                                                disabled={buyLoading === key || balance < item.price}
                                                onClick={() => buyItem(key)}
                                            >
                                                {buyLoading === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingBag className="h-3 w-3" />}
                                                Acheter
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Black Market */}
                    <Card className="border-border bg-gradient-to-br from-card to-purple-500/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-400" />
                                Marché Noir
                            </CardTitle>
                            <CardDescription>Deals à durée limitée avec réductions exclusives</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {marketDeals.length === 0 ? (
                                <p className="py-6 text-center text-muted-foreground">
                                    Aucun deal actif — Le marché noir se renouvelle toutes les 12h
                                </p>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {marketDeals.map(deal => {
                                        const item = SHOP_CATALOG[deal.item_key]
                                        if (!item) return null
                                        const discountedPrice = Math.floor(item.price * (1 - deal.discount_pct / 100))
                                        const stockPct = Math.max(0, ((deal.stock - deal.sold) / deal.stock) * 100)
                                        const expiresIn = new Date(deal.expires_at).getTime() - Date.now()
                                        const hoursRemaining = Math.max(0, Math.floor(expiresIn / 3600_000))
                                        const minsRemaining = Math.max(0, Math.floor((expiresIn % 3600_000) / 60_000))
                                        return (
                                            <div key={deal.id} className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">{item.emoji}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-foreground">{item.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-sm font-bold text-emerald-400">{fmtEcus(discountedPrice)} pq</span>
                                                            <span className="text-xs text-muted-foreground line-through">{fmtEcus(item.price)}</span>
                                                            <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                                                                -{deal.discount_pct}%
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-xs text-muted-foreground">
                                                        <span>Stock: {deal.stock - deal.sold}/{deal.stock}</span>
                                                        <span>{hoursRemaining}h {minsRemaining}m restantes</span>
                                                    </div>
                                                    <Progress value={stockPct} className="h-1.5" />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══════════════ INVENTAIRE ═══════════════ */}
                <TabsContent value="inventory" className="mt-6 space-y-6">
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Items en circulation */}
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5 text-blue-500" />
                                    Items en circulation
                                </CardTitle>
                                <CardDescription>Items actifs (non utilisés) sur le serveur</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {inventoryStats.length === 0 ? (
                                    <p className="py-8 text-center text-muted-foreground">Aucun item en circulation</p>
                                ) : (
                                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                                        {inventoryStats.map(({ key, count, item }) => (
                                            <div key={key} className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                                                <span className="text-xl">{item.emoji}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-foreground text-sm">{item.name}</p>
                                                    <p className="text-xs text-muted-foreground">{CATEGORIES[item.category]?.name}</p>
                                                </div>
                                                <Badge className="bg-primary/10 text-primary border-primary/20">
                                                    ×{count}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Top collectionneurs */}
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Trophy className="h-5 w-5 text-yellow-500" />
                                    Top Collectionneurs
                                </CardTitle>
                                <CardDescription>Joueurs avec le plus d'items non utilisés</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {topCollectors.length === 0 ? (
                                    <p className="py-8 text-center text-muted-foreground">Aucune donnée</p>
                                ) : (
                                    <div className="space-y-3">
                                        {topCollectors.map((c, i) => (
                                            <div key={c.userId} className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3 transition-all hover:bg-muted">
                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${i === 0 ? "bg-yellow-500/20 text-yellow-500"
                                                    : i === 1 ? "bg-gray-400/20 text-gray-400"
                                                        : i === 2 ? "bg-orange-600/20 text-orange-600"
                                                            : "bg-primary/10 text-primary"
                                                    }`}>
                                                    #{i + 1}
                                                </div>
                                                <Avatar className="h-10 w-10 border-2 border-border">
                                                    <AvatarImage src={userAvatar(c.userId)} />
                                                    <AvatarFallback>{userName(c.userId)[0]?.toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-foreground truncate">{userName(c.userId)}</p>
                                                    <p className="text-sm text-muted-foreground">{c.count} items</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ═══════════════ LOTERIE ═══════════════ */}
                <TabsContent value="lottery" className="mt-6 space-y-6">
                    {/* Stats cards */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card className="border-border bg-gradient-to-br from-card to-amber-500/5">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">💰 Cagnotte</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold text-amber-500">{fmtEcus(lotteryTotals.totalPot)} pq</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border bg-card">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">🎫 Tickets</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">{lotteryTotals.totalTickets}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border bg-card">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">👥 Participants</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">{lotteryTotals.participants}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border bg-card">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">⏰ Tirage</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">{daysLeft}j {hoursLeft}h</p>
                                <p className="text-xs text-muted-foreground">Dimanche 21h</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Répartition des gains */}
                        <Card className="border-border bg-gradient-to-br from-card to-yellow-500/5">
                            <CardHeader>
                                <CardTitle>🏆 Répartition des gains</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {[
                                    { rank: "🥇 1er", pct: 70, color: "bg-yellow-500" },
                                    { rank: "🥈 2e", pct: 20, color: "bg-gray-400" },
                                    { rank: "🥉 3e", pct: 10, color: "bg-orange-600" },
                                ].map(({ rank, pct, color }) => (
                                    <div key={rank} className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium">{rank}</span>
                                            <span className="text-muted-foreground font-semibold">{fmtEcus(Math.floor(lotteryTotals.totalPot * pct / 100))} pq ({pct}%)</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                                            <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Classement tickets */}
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Ticket className="h-5 w-5 text-purple-500" />
                                    Classement tickets
                                </CardTitle>
                                <CardDescription>Semaine {currentLotteryWeek()}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {lotteryData.length === 0 ? (
                                    <p className="py-8 text-center text-muted-foreground">Aucun participant cette semaine</p>
                                ) : (
                                    <div className="space-y-3">
                                        {lotteryData.slice(0, 10).map((entry, i) => (
                                            <div key={entry.user_id} className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3 transition-all hover:bg-muted">
                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${i === 0 ? "bg-yellow-500/20 text-yellow-500"
                                                    : i === 1 ? "bg-gray-400/20 text-gray-400"
                                                        : i === 2 ? "bg-orange-600/20 text-orange-600"
                                                            : "bg-primary/10 text-primary"
                                                    }`}>
                                                    #{i + 1}
                                                </div>
                                                <Avatar className="h-10 w-10 border-2 border-border">
                                                    <AvatarImage src={userAvatar(entry.user_id)} />
                                                    <AvatarFallback>{userName(entry.user_id)[0]?.toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-foreground truncate">{userName(entry.user_id)}</p>
                                                </div>
                                                <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                                                    🎫 {entry.tickets} ticket{entry.tickets > 1 ? "s" : ""}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
