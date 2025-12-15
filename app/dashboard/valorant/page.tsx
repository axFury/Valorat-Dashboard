"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from "@supabase/supabase-js"
import { Activity } from "lucide-react"

type ValoProfile = {
  guild_id: string
  user_id: string
  riot_id: string | null
  discord_name: string | null
  rank: string | null      // ex: "Diamond 2", "Radiant"
  rr: number | null        // 0..100
  rank_icon: string | null // URL du logo de rang
  last_update: string | null
}

// ---------- helpers classement ----------
const TIERS = ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"] as const
const TIER_WEIGHT: Record<string, number> = Object.fromEntries(TIERS.map((t, i) => [t.toLowerCase(), i + 1]))

function parseRank(rank: string | null | undefined) {
  if (!rank) return { tierKey: "unranked", tierScore: 0, div: 0 }
  const [tierRaw, divRaw] = rank.trim().split(/\s+/) // "Diamond 2" -> ["Diamond","2"]
  const tierKey = (tierRaw || "").toLowerCase()
  const tierScore = TIER_WEIGHT[tierKey] ?? 0
  const div = Number(divRaw) || (tierKey === "radiant" ? 4 : 0) // Radiant > Immortal 3
  return { tierKey, tierScore, div }
}

function rankScore(rank: string | null | undefined, rr?: number | null) {
  const { tierScore, div } = parseRank(rank)
  return tierScore * 1000 + div * 100 + (Number.isFinite(rr as number) ? (rr as number) : 0)
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(+d)) return "—"
  return d.toLocaleString()
}

function initialFromRiot(riot?: string | null) {
  const s = (riot || "").trim()
  return s ? s[0]?.toUpperCase() : "?"
}

// ---------- page ----------
export default function ValorantPage() {
  const [profiles, setProfiles] = useState<ValoProfile[]>([])
  const [loading, setLoading] = useState(true)

  const supa = useMemo(() => {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }, [])

  useEffect(() => {
    let mounted = true
    const gid = typeof window !== "undefined" ? localStorage.getItem("selected_guild") : null
    if (!gid) {
      setLoading(false)
      return
    }

    async function load() {
      // fetch initial
      const { data } = await supa
        .from("valorant_profile")
        .select("*")
        .eq("guild_id", gid)

      if (mounted) {
        setProfiles(data || [])
        setLoading(false)
      }

      // subscribe realtime
      const ch = supa
        .channel("valo_profiles")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "valorant_profile", filter: `guild_id=eq.${gid}` },
          async () => {
            const { data } = await supa
              .from("valorant_profile")
              .select("*")
              .eq("guild_id", gid)
            if (mounted) setProfiles(data || [])
          }
        )
        .subscribe()

      return () => supa.removeChannel(ch)
    }

    load()
    return () => { mounted = false }
  }, [supa])

  // tri: meilleur rang puis RR (desc)
  const sorted = useMemo(() => {
    const arr = [...profiles]
    arr.sort((a, b) => {
      const sb = rankScore(b.rank, b.rr)
      const sa = rankScore(a.rank, a.rr)
      if (sb !== sa) return sb - sa
      const ra = (a.riot_id || "").localeCompare(b.riot_id || "")
      return ra
    })
    return arr
  }, [profiles])

  const top3 = sorted.slice(0, 3)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Valorant</h1>
      </div>

      {/* Top 3 */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>🏆 Top 3 joueurs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : top3.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun profil Valorant pour ce serveur.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {top3.map((p, i) => (
                <div key={p.user_id} className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-base font-bold">#{i + 1}</span>
                  </div>
                  <Avatar className="h-12 w-12 bg-transparent ring-0">
                    {p.rank_icon ? (
                      <AvatarImage src={p.rank_icon} alt={p.rank || "Rank"} />
                    ) : null}
                    <AvatarFallback>{initialFromRiot(p.riot_id)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.discord_name || "<non lié>"}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.riot_id || "—"}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline">{p.rank || "Unranked"}</Badge>
                      <span className="text-xs text-muted-foreground">RR {p.rr ?? 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Classement complet temps réel */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Classement de tous les joueurs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun profil Valorant pour ce serveur.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Discord</th>
                    <th className="py-2 pr-4">Riot</th>
                    <th className="py-2 pr-4">Rang</th>
                    <th className="py-2 pr-4">RR</th>
                    <th className="py-2 pr-0">Dernière maj</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, idx) => (
                    <tr key={p.user_id} className="border-b border-border/60">
                      <td className="py-2 pr-4 font-medium">{idx + 1}</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 bg-transparent ring-0">
                            {p.rank_icon ? (
                              <AvatarImage src={p.rank_icon} alt={p.rank || "Rank"} />
                            ) : null}
                            <AvatarFallback>{initialFromRiot(p.riot_id)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate">{p.discord_name || "<non lié>"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{p.riot_id || "—"}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline">{p.rank || "Unranked"}</Badge>
                      </td>
                      <td className="py-2 pr-4">{p.rr ?? 0}</td>
                      <td className="py-2 pr-0 text-muted-foreground">{fmtDate(p.last_update)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
