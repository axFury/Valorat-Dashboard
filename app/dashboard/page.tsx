"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Clock, Layout, Plus, X, GripVertical, Target, Trophy, Coins, Layers, Swords, ArrowUpRight, Filter, Settings2, Sparkles, TrendingUp, Info, Users, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@supabase/supabase-js"
import { ActivityLog } from "@/components/activity-log"
import { motion, Reorder, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts"

// --- Types ---
type WidgetType = "valorant" | "darts" | "tcg" | "economy" | "server_stats" | "activity_log" | "bot_status" | "chart_24h"

interface WidgetConfig {
  id: string
  type: WidgetType
  title: string
  size: "small" | "medium" | "large"
}

// --- Catalogs ---
const WIDGET_CATALOG: { type: WidgetType; title: string; defaultSize: "small" | "medium" | "large"; icon: any; color: string }[] = [
  { type: "bot_status", title: "Statut Système", defaultSize: "large", icon: Activity, color: "text-blue-400" },
  { type: "server_stats", title: "Membres Secours", defaultSize: "medium", icon: Users, color: "text-emerald-400" },
  { type: "darts", title: "Fléchettes", defaultSize: "small", icon: Target, color: "text-orange-500" },
  { type: "tcg", title: "Ma Collection TCG", defaultSize: "small", icon: Layers, color: "text-purple-400" },
  { type: "economy", title: "Finance & Bourse", defaultSize: "small", icon: Coins, color: "text-amber-400" },
  { type: "valorant", title: "Valorant Rank", defaultSize: "small", icon: Swords, color: "text-red-500" },
  { type: "chart_24h", title: "Évolution Serveur", defaultSize: "large", icon: TrendingUp, color: "text-blue-500" },
  { type: "activity_log", title: "Flux d'Activité", defaultSize: "large", icon: Clock, color: "text-zinc-400" },
]

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "bot-status", type: "bot_status", title: "Statut Système", size: "large" },
  { id: "server-stats", type: "server_stats", title: "Membres Secours", size: "medium" },
  { id: "darts-preview", type: "darts", title: "Fléchettes", size: "small" },
  { id: "tcg-preview", type: "tcg", title: "Ma Collection TCG", size: "small" },
  { id: "economy-preview", type: "economy", title: "Finance & Bourse", size: "small" },
  { id: "valorant-preview", type: "valorant", title: "Valorant Rank", size: "small" },
  { id: "chart-24h", type: "chart_24h", title: "Évolution Serveur", size: "large" },
  { id: "activity", type: "activity_log", title: "Flux d'Activité", size: "large" },
]

// --- Utils ---
function fmtMs(ms?: number | null) {
  if (!ms && ms !== 0) return "0s"
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const parts = []
  if (d) parts.push(`${d}j`)
  if (h || parts.length) parts.push(`${h}h`)
  if (m || parts.length) parts.push(`${m}m`)
  parts.push(`${ss}s`)
  return parts.join(" ")
}

function timeAgo(iso?: string) {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.max(1, Math.floor(diff / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}j`
}

// --- Dashboard Component ---
export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  // Data States
  const [guildId, setGuildId] = useState<string>("")
  const [userId, setUserId] = useState<string>("")
  const [snapshot, setSnapshot] = useState<any>(null)
  const [series, setSeries] = useState<any[]>([])
  const [botStatus, setBotStatus] = useState<any>(null)

  // Real User Stats
  const [userIdResolved, setUserIdResolved] = useState(false)
  const [dartsStats, setDartsStats] = useState<any>(null)
  const [tcgStats, setTcgStats] = useState<{ cards: number, trophies: number }>({ cards: 0, trophies: 0 })
  const [valRank, setValRank] = useState<any>(null)
  const [ecoBalance, setEcoBalance] = useState<number>(0)

  const supa = useMemo(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    [])

  useEffect(() => {
    let currentUid = ""

    async function fetchUser() {
      const res = await fetch("/api/auth/user")
      if (res.ok) {
        const data = await res.json()
        setUserId(data.id)
        currentUid = data.id
      }
      setUserIdResolved(true)
    }

    const gid = typeof window !== "undefined" ? localStorage.getItem("selected_guild") || "" : ""
    setGuildId(gid)

    // Load layout
    const saved = localStorage.getItem(`dashboard_layout_${gid}`)
    if (saved) {
      setWidgets(JSON.parse(saved))
    } else {
      setWidgets(DEFAULT_WIDGETS)
    }

    if (!gid) {
      setLoading(false)
      return
    }

    async function init() {
      await fetchUser()

      // Fetch Server Data
      const { data: snap } = await supa.from("guild_snapshot").select("*").eq("guild_id", gid).order("created_at", { ascending: false }).limit(1)
      setSnapshot(snap?.[0])

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: hist } = await supa.from("guild_snapshot").select("*").eq("guild_id", gid).gte("created_at", since).order("created_at", { ascending: true })
      setSeries((hist || []).map(r => ({ t: r.created_at, total: r.members_total, online: r.members_online, voice: r.voice_in_channels })))

      const { data: bot } = await supa.from("bot_status").select("*").order("created_at", { ascending: false }).limit(1)
      setBotStatus(bot?.[0])

      if (currentUid) {
        // Fetch User Data
        const [dartsRes, tcgCollRes, tcgRankRes, valoRes, ecoRes] = await Promise.all([
          supa.from("darts_stats").select("*").eq("guild_id", gid).eq("user_id", currentUid).single(),
          fetch(`/api/casino/tcg/collection?guildId=${gid}`),
          fetch(`/api/casino/tcg/ranking?guildId=${gid}&userId=${currentUid}`),
          supa.from("valorant_profile").select("*").eq("guild_id", gid).eq("user_id", currentUid).single(),
          supa.from("guild_members").select("currency").eq("guild_id", gid).eq("user_id", currentUid).single()
        ])

        if (dartsRes.data) setDartsStats(dartsRes.data)
        if (valoRes.data) setValRank(valoRes.data)
        if (ecoRes.data) setEcoBalance(ecoRes.data.currency || 0)

        const tcgCollection = tcgCollRes.ok ? await tcgCollRes.json() : null
        const tcgRanking = tcgRankRes.ok ? await tcgRankRes.json() : null
        let cardsCount = 0
        if (tcgCollection && tcgCollection.counts) {
          cardsCount = Object.keys(tcgCollection.counts).filter(k => tcgCollection.counts[k] > 0).length
        }
        let trophies = 0
        if (tcgRanking && tcgRanking.myProfile) trophies = tcgRanking.myProfile.trophies || 0
        setTcgStats({ cards: cardsCount, trophies })
      }

      setLoading(false)
    }

    init()
  }, [supa])

  const saveLayout = (newWidgets: WidgetConfig[]) => {
    setWidgets(newWidgets)
    localStorage.setItem(`dashboard_layout_${guildId}`, JSON.stringify(newWidgets))
  }

  const toggleSize = (widgetId: string) => {
    setWidgets(prev => prev.map(w => {
      if (w.id !== widgetId) return w
      const nextSize = w.size === "small" ? "medium" : w.size === "medium" ? "large" : "small"
      return { ...w, size: nextSize }
    }))
    // Save effect triggered implicitly or explicitly here:
    setTimeout(() => localStorage.setItem(`dashboard_layout_${guildId}`, JSON.stringify(widgets)), 100)
  }

  const isOnline = botStatus && Date.now() - new Date(botStatus.created_at).getTime() < 2 * 60 * 1000

  // --- Widget Renderers ---
  const renderWidget = (widget: WidgetConfig) => {
    const commonClass = cn(
      "relative group border border-white/5 bg-[#121722]/40 backdrop-blur-md rounded-2xl overflow-hidden transition-all duration-300 h-full flex flex-col",
      isEditing ? "ring-2 ring-blue-500/50 scale-[0.98] cursor-grab active:cursor-grabbing" : "hover:border-white/10 hover:shadow-2xl hover:shadow-black/20"
    )

    const header = (icon: any, color: string) => (
      <div className="flex items-center justify-between p-4 pb-0 opacity-80 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg bg-white/5", color)}>{icon}</div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{widget.title}</span>
        </div>
        {isEditing && (
          <div className="flex gap-1" onPointerDown={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-blue-500/20 text-white/20 hover:text-blue-500" onClick={(e) => { e.stopPropagation(); toggleSize(widget.id) }}>
              <Maximize2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-red-500/20 text-white/20 hover:text-red-500" onClick={(e) => { e.stopPropagation(); saveLayout(widgets.filter(w => w.id !== widget.id)) }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    )

    switch (widget.type) {
      case "bot_status":
        return (
          <div className={cn(commonClass, "col-span-full")}>
            {header(<Activity className="h-4 w-4" />, "text-blue-400")}
            <div className="p-6 pt-2 grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
              <StatusItem label="Statut" value={isOnline ? "Opérationnel" : "Déconnecté"} sub={botStatus ? `Signal: ${timeAgo(botStatus.created_at)}` : "N/A"} dot={isOnline ? "bg-green-500" : "bg-red-500"} />
              <StatusItem label="Latence" value={`${botStatus?.latency_ms ?? 0}ms`} sub={botStatus?.latency_ms < 100 ? "Excellent" : "Stable"} />
              <StatusItem label="Uptime" value={fmtMs(botStatus?.uptime_ms)} sub="Execution continue" />
              <StatusItem label="Version" value={botStatus?.version || "1.0.0"} sub="Build stable" />
            </div>
          </div>
        )
      case "server_stats":
        return (
          <div className={cn(commonClass, "md:col-span-2")}>
            {header(<Users className="h-4 w-4" />, "text-emerald-400")}
            <div className="p-6 pt-2 h-full flex-1">
              <div className="grid grid-cols-3 gap-4 h-full">
                <SimpleStat label="Total" value={snapshot?.members_total || 0} icon={<Users className="w-4 h-4 opacity-20" />} />
                <SimpleStat label="Online" value={snapshot?.members_online || 0} color="text-green-400" icon={<div className="w-1.5 h-1.5 rounded-full bg-green-500" />} />
                <SimpleStat label="Vocal" value={snapshot?.voice_in_channels || 0} color="text-blue-400" icon={<Clock className="w-4 h-4 opacity-20" />} />
              </div>
            </div>
          </div>
        )
      case "darts": {
        const avg = dartsStats?.advanced_stats?.matchAverage || 0
        const isUp = true // mock trend
        return (
          <div className={cn(commonClass)}>
            {header(<Target className="h-4 w-4" />, "text-orange-500")}
            <div className="p-6 py-4 flex-1 flex flex-col justify-center">
              {dartsStats ? (
                <>
                  <p className="text-3xl font-black">{avg.toFixed(1)}</p>
                  <p className="text-[10px] text-white/30 uppercase font-bold flex items-center gap-1">Moyenne <TrendingUp className={cn("w-3 h-3", isUp ? "text-green-500" : "text-red-500 rotate-180")} /></p>
                  <div className="mt-4 flex gap-1">
                    {[mathMin(1, avg / 10), mathMin(1, avg / 20), mathMin(1, avg / 30), mathMin(1, avg / 40), mathMin(1, avg / 50), mathMin(1, avg / 60)].map((fill, i) => (
                      <div key={i} className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 transition-all" style={{ width: `${fill * 100}%` }} />
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-sm text-zinc-500 mt-2 font-medium">Aucune donnée</p>}
            </div>
          </div>
        )
      }
      case "tcg":
        return (
          <div className={cn(commonClass)}>
            {header(<Layers className="h-4 w-4" />, "text-purple-400")}
            <div className="p-6 py-4 flex-1 flex flex-col justify-between">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-black">{tcgStats.cards}</p>
                  <p className="text-[10px] text-white/30 uppercase font-bold">Cartes</p>
                </div>
                <div className="h-10 w-8 bg-gradient-to-t from-purple-500 to-indigo-500 rounded-sm rotate-6 shadow-lg shadow-purple-500/20 ring-1 ring-white/20 flex items-center justify-center">
                  <span className="text-[8px] font-black text-white/50">{tcgStats.trophies}🏆</span>
                </div>
              </div>
              <div className="mt-4 text-[10px] bg-purple-500/10 text-purple-400 p-1.5 rounded-lg border border-purple-500/20 text-center font-bold truncate">
                Arène TCG
              </div>
            </div>
          </div>
        )
      case "economy":
        return (
          <div className={cn(commonClass)}>
            {header(<Coins className="h-4 w-4" />, "text-amber-400")}
            <div className="p-6 py-4 flex-1 flex flex-col justify-between">
              <div>
                <p className="text-3xl font-black">{ecoBalance.toLocaleString()}</p>
                <p className="text-[10px] text-white/30 uppercase font-bold">V-Credits</p>
              </div>
              <div className="mt-4 flex items-center justify-between px-2">
                {[0.5, 0.7, 0.6, 0.4, 1.0].map((v, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="h-8 w-1.5 bg-white/5 rounded-full relative">
                      <div className="absolute bottom-0 w-full bg-amber-500 rounded-full transition-all duration-500" style={{ height: `${v * 100}%`, boxShadow: v === 1 ? '0 0 8px rgba(245,158,11,0.3)' : 'none' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      case "valorant":
        return (
          <div className={cn(commonClass)}>
            {header(<Swords className="h-4 w-4" />, "text-red-500")}
            <div className="p-6 py-4 flex-1 flex flex-col justify-center">
              {valRank ? (
                <div className="flex items-center gap-4">
                  {valRank.rank_icon ? (
                    <img src={valRank.rank_icon} className="h-12 w-12 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]" alt="rank" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                      <Target className="w-8 h-8 text-white" />
                    </div>
                  )}
                  <div>
                    <p className="text-xl font-black">{valRank.rank || "Unranked"}</p>
                    <p className="text-[10px] text-zinc-400 uppercase font-bold">{valRank.rr} RR</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 font-medium">Non classé</p>
              )}
            </div>
          </div>
        )
      case "chart_24h":
        return (
          <div className={cn(commonClass, "col-span-full")}>
            {header(<TrendingUp className="h-4 w-4" />, "text-blue-500")}
            <div className="p-6 h-[300px] flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="t" tickFormatter={(t) => new Date(t).getHours() + "h"} stroke="#ffffff20" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#ffffff20" fontSize={10} axisLine={false} tickLine={false} hide />
                  <Tooltip contentStyle={{ backgroundColor: '#0b0e13', borderColor: '#ffffff10', borderRadius: '12px' }} itemStyle={{ fontSize: '12px' }} labelStyle={{ color: '#fff' }} />
                  <Area type="monotone" dataKey="total" name="Membres" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                  <Area type="monotone" dataKey="online" name="En ligne" stroke="#10b981" strokeWidth={3} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      case "activity_log":
        return (
          <div className={cn(commonClass, "col-span-full")}>
            {header(<Clock className="h-4 w-4" />, "text-zinc-400")}
            <div className="p-6 flex-1 h-[400px] overflow-hidden relative">
              <div className="absolute inset-x-6 top-6 bottom-6 overflow-y-auto pr-2 custom-scrollbar">
                <ActivityLog guildId={guildId} />
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  function mathMin(a: number, b: number) { return a < b ? a : b }

  const unusedWidgets = WIDGET_CATALOG.filter(w => !widgets.some(active => active.type === w.type))

  return (
    <div className="space-y-8 max-w-7xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-red-500 fill-red-500/20" />
            Vue d'ensemble
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Bienvenue sur votre centre de commandement, <span className="text-white">Capitaine</span>.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isEditing ? "default" : "outline"}
            className={cn("gap-2 rounded-xl h-11 px-6 font-bold transition-all shadow-lg", isEditing ? "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20" : "bg-white/5 border-white/10 hover:bg-white/10")}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? <Settings2 className="w-4 h-4 animate-spin-slow" /> : <Layout className="w-4 h-4" />}
            {isEditing ? "Terminer l'édition" : "Personnaliser"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse flex-1">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-40 bg-white/5 rounded-3xl" />)}
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={widgets}
          onReorder={saveLayout}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 group/grid auto-rows-max"
        >
          {widgets.map((widget) => (
            <Reorder.Item
              key={widget.id}
              value={widget}
              dragListener={isEditing}
              className={cn(
                "select-none h-full",
                widget.size === "medium" && "md:col-span-2",
                widget.size === "large" && "md:col-span-2 lg:col-span-4"
              )}
            >
              {renderWidget(widget)}
            </Reorder.Item>
          ))}

          <AnimatePresence>
            {isEditing && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center gap-3 h-40 border-2 border-dashed border-white/10 rounded-3xl text-white/20 hover:text-white/40 hover:border-white/20 hover:bg-white/5 transition-all w-full md:col-span-2 lg:col-span-4"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-8 h-8" />
                <span className="text-xs font-bold uppercase tracking-widest">Ajouter un widget</span>
              </motion.button>
            )}
          </AnimatePresence>
        </Reorder.Group>
      )}

      {/* Add Widget Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-[#0b0e13] border-white/10 max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2"><Plus className="w-5 h-5 text-blue-500" /> Ajouter un widget</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
            {unusedWidgets.length === 0 ? (
              <p className="col-span-full text-center text-zinc-500 py-8 font-medium">Tous les widgets sont déjà affichés.</p>
            ) : unusedWidgets.map(w => {
              const Icon = w.icon;
              return (
                <div
                  key={w.type}
                  onClick={() => {
                    saveLayout([...widgets, { id: `${w.type}-${Date.now()}`, type: w.type, title: w.title, size: w.defaultSize }])
                    setShowAddModal(false)
                  }}
                  className="flex flex-col items-center gap-3 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95"
                >
                  <div className={cn("p-3 rounded-xl bg-white/5 shadow-inner", w.color)}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-bold text-center text-white/80">{w.title}</p>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Access Floating Tip */}
      <AnimatePresence>
        {!isEditing && widgets.length < 5 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 bg-blue-600 p-4 rounded-2xl shadow-2xl flex items-center gap-4 z-50 text-white max-w-sm"
          >
            <div className="bg-white/20 p-2 rounded-lg"><Info className="w-5 h-5" /></div>
            <div>
              <p className="text-sm font-bold">Astuce</p>
              <p className="text-xs opacity-80">Clique sur "Personnaliser" pour réorganiser tes widgets !</p>
            </div>
            <Button variant="ghost" size="icon" onClick={(e) => (e.currentTarget.parentElement!.style.display = 'none')}>
              <X className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatusItem({ label, value, sub, dot }: any) {
  return (
    <div className="flex flex-col gap-1 h-full justify-center">
      <p className="text-[10px] font-bold uppercase text-white/30 truncate">{label}</p>
      <div className="flex items-center gap-2">
        {dot && <div className={cn("h-2 w-2 rounded-full", dot)} />}
        <p className="text-lg xl:text-xl font-black truncate">{value}</p>
      </div>
      <p className="text-[10px] text-white/20 truncate">{sub}</p>
    </div>
  )
}

function SimpleStat({ label, value, color, icon }: any) {
  return (
    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 group hover:bg-white/10 transition-colors h-full flex flex-col justify-center">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-black uppercase text-white/30 tracking-tighter truncate">{label}</p>
        {icon}
      </div>
      <p className={cn("text-2xl xl:text-3xl font-black tabular-nums truncate", color || "text-white")}>{value}</p>
    </div>
  )
}
