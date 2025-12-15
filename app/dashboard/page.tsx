"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@supabase/supabase-js"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

type GuildSnapshot = {
  guild_id: string
  members_total: number
  members_online: number
  voice_in_channels: number
  created_at: string
}
type BotStatusRow = {
  latency_ms: number
  uptime_ms: number
  version: string | null
  created_at: string
}

function fmtMs(ms?: number | null) {
  if (!ms && ms !== 0) return "N/A"
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
function fmtTimeLabel(iso: string) {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [snapshot, setSnapshot] = useState<GuildSnapshot | null>(null)
  const [series, setSeries] = useState<any[]>([])
  const [botStatus, setBotStatus] = useState<BotStatusRow | null>(null)

  const supa = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  useEffect(() => {
    let mounted = true
    const gid = typeof window !== "undefined" ? localStorage.getItem("selected_guild") : null
    if (!gid) {
      setLoading(false)
      return
    }

    async function init() {
      // 1) dernier snapshot
      supa
        .from("guild_snapshot")
        .select("*")
        .eq("guild_id", gid)
        .order("created_at", { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (!mounted) return
          setSnapshot((data && data[0]) || null)
        })

      // 2) série (dernières 24h)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      supa
        .from("guild_snapshot")
        .select("members_total,members_online,voice_in_channels,created_at")
        .eq("guild_id", gid)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .then(({ data }) => {
          if (!mounted) return
          const rows =
            (data || []).map((r) => ({
              t: r.created_at,
              total: r.members_total ?? 0,
              online: r.members_online ?? 0,
              voice: r.voice_in_channels ?? 0,
            })) ?? []
          setSeries(rows)
        })

      // 3) live updates snapshot + append série
      const ch1 = supa
        .channel("snapshots")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "guild_snapshot", filter: `guild_id=eq.${gid}` },
          (payload) => {
            const row = payload.new as GuildSnapshot
            setSnapshot(row)
            setSeries((prev) => [
              ...prev.slice(-500), // borne max pour éviter d’alourdir
              {
                t: row.created_at,
                total: row.members_total ?? 0,
                online: row.members_online ?? 0,
                voice: row.voice_in_channels ?? 0,
              },
            ])
          }
        )
        .subscribe()

      // 4) statut bot
      supa
        .from("bot_status")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (!mounted) return
          setBotStatus((data && data[0]) || null)
          setLoading(false)
        })
      const ch2 = supa
        .channel("botstatus")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "bot_status" },
          (payload) => setBotStatus(payload.new as BotStatusRow)
        )
        .subscribe()

      return () => {
        supa.removeChannel(ch1)
        supa.removeChannel(ch2)
      }
    }

    init()
    return () => {
      mounted = false
    }
  }, [supa])

  const isOnline =
    botStatus && Date.now() - new Date(botStatus.created_at).getTime() < 2 * 60 * 1000

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Vue d'ensemble</h1>
      </div>

      {/* Cartes statut bot */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Statut</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div
                className={cn("h-3 w-3 rounded-full", isOnline ? "bg-green-500" : "bg-red-500")}
              />
              <p className="text-2xl font-bold">
                {loading ? "..." : isOnline ? "En ligne" : "Hors ligne"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Dernier signal: {botStatus ? `${timeAgo(botStatus.created_at)} ago` : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Latence</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? "..." : `${botStatus?.latency_ms ?? 0}ms`}</p>
            <p className="text-xs text-muted-foreground">
              {botStatus && botStatus.latency_ms < 100
                ? "Excellent"
                : botStatus && botStatus.latency_ms < 200
                ? "Bon"
                : "Moyen"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Version</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? "..." : botStatus?.version || "N/A"}</p>
            <p className="text-xs text-muted-foreground">Build du bot</p>
          </CardContent>
        </Card>
      </div>

      {/* Statistiques serveur (live) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Statistiques serveur (live)</CardTitle>
            <CardDescription>
              {snapshot ? `Snapshot: ${timeAgo(snapshot.created_at)} ago` : "—"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Membres</p>
                <p className="mt-1 text-3xl font-bold">
                  {snapshot?.members_total ?? (loading ? "..." : 0)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">En ligne</p>
                <p className="mt-1 text-3xl font-bold">
                  {snapshot?.members_online ?? (loading ? "..." : 0)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">En vocal</p>
                <p className="mt-1 text-3xl font-bold">
                  {snapshot?.voice_in_channels ?? (loading ? "..." : 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Graphe des 24h */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Évolution (24h)</CardTitle>
            <CardDescription>Membres total / en ligne / en vocal</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  tickFormatter={fmtTimeLabel}
                  minTickGap={24}
                />
                <YAxis allowDecimals={false} />
                <Tooltip
                  formatter={(v: any) => v}
                  labelFormatter={(l) => new Date(l).toLocaleString()}
                />
                <Legend />
                <Line type="monotone" dataKey="total" name="Membres" strokeOpacity={0.9} dot={false} />
                <Line type="monotone" dataKey="online" name="En ligne" strokeOpacity={0.9} dot={false} />
                <Line type="monotone" dataKey="voice" name="En vocal" strokeOpacity={0.9} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
