"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { Trophy, MessageSquare, Mic, Loader2 } from "lucide-react"
import { createBrowserClient } from "@supabase/ssr"
import { getDiscordProfiles } from "@/lib/discord-profile-cache"

type LeaderboardEntry = {
  rank: number
  discordId: string
  username: string
  avatar: string
  value: number // messages count or voice seconds
}

export default function LeaderboardsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [messagesLeaderboard, setMessagesLeaderboard] = useState<LeaderboardEntry[]>([])
  const [voiceLeaderboard, setVoiceLeaderboard] = useState<LeaderboardEntry[]>([])
  const [currentWeek, setCurrentWeek] = useState("")

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const guildId = localStorage.getItem("selected_guild")
        if (!guildId) return

        // Get current week in format YYYY-Www (e.g., 2025-W48)
        const now = new Date()
        const year = now.getFullYear()
        const week = getWeekNumber(now)
        const weekString = `${year}-W${week.toString().padStart(2, "0")}`
        setCurrentWeek(weekString)

        console.log("[v0] Fetching leaderboard for week:", weekString)

        // Fetch leaderboard data from Supabase
        const { data, error } = await supabase
          .from("leaderboards")
          .select("msgs, voice")
          .eq("guild_id", guildId)
          .eq("week", weekString)
          .single()

        if (error) {
          console.error("[v0] Error fetching leaderboard:", error)
          toast({
            title: "Erreur",
            description: "Impossible de charger le leaderboard",
            variant: "destructive",
          })
          return
        }

        console.log("[v0] Leaderboard data:", data)

        if (data?.msgs) {
          const msgsEntries = Object.entries(data.msgs as Record<string, number>)
            .map(([discordId, count]) => ({
              discordId,
              count,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)

          // Batch fetch all user profiles at once
          const userIds = msgsEntries.map((entry) => entry.discordId)
          const profiles = await getDiscordProfiles(userIds, guildId)

          const msgsWithUserInfo = msgsEntries.map((entry, index) => {
            const profile = profiles.get(entry.discordId) || {
              username: "Utilisateur inconnu",
              avatar: `https://cdn.discordapp.com/embed/avatars/0.png`,
            }
            return {
              rank: index + 1,
              discordId: entry.discordId,
              username: profile.username,
              avatar: profile.avatar,
              value: entry.count,
            }
          })
          setMessagesLeaderboard(msgsWithUserInfo)
        }

        if (data?.voice) {
          const voiceEntries = Object.entries(data.voice as Record<string, number>)
            .map(([discordId, seconds]) => ({
              discordId,
              seconds,
            }))
            .sort((a, b) => b.seconds - a.seconds)
            .slice(0, 10)

          // Batch fetch all user profiles at once
          const userIds = voiceEntries.map((entry) => entry.discordId)
          const profiles = await getDiscordProfiles(userIds, guildId)

          const voiceWithUserInfo = voiceEntries.map((entry, index) => {
            const profile = profiles.get(entry.discordId) || {
              username: "Utilisateur inconnu",
              avatar: `https://cdn.discordapp.com/embed/avatars/0.png`,
            }
            return {
              rank: index + 1,
              discordId: entry.discordId,
              username: profile.username,
              avatar: profile.avatar,
              value: entry.seconds,
            }
          })
          setVoiceLeaderboard(voiceWithUserInfo)
        }
      } catch (error) {
        console.error("[v0] Error loading leaderboard:", error)
        toast({
          title: "Erreur",
          description: "Impossible de charger le leaderboard",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [toast])

  const getWeekNumber = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  }

  const formatVoiceTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Leaderboards</h1>
        <p className="text-muted-foreground">Classements hebdomadaires - Semaine {currentWeek}</p>
      </div>

      <Tabs defaultValue="messages" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-2">
            <Mic className="h-4 w-4" />
            Vocal
          </TabsTrigger>
        </TabsList>

        {/* Messages Leaderboard */}
        <TabsContent value="messages" className="mt-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top 10 Messages
              </CardTitle>
              <CardDescription>Les membres les plus actifs en messages cette semaine</CardDescription>
            </CardHeader>
            <CardContent>
              {messagesLeaderboard.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Aucune donnée disponible pour cette semaine
                </div>
              ) : (
                <div className="space-y-3">
                  {messagesLeaderboard.map((entry) => (
                    <div
                      key={entry.discordId}
                      className="flex items-center gap-4 rounded-2xl bg-muted/50 p-4 transition-all hover:bg-muted"
                    >
                      {/* Rank Badge */}
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold ${
                          entry.rank === 1
                            ? "bg-yellow-500/20 text-yellow-500"
                            : entry.rank === 2
                              ? "bg-gray-400/20 text-gray-400"
                              : entry.rank === 3
                                ? "bg-orange-600/20 text-orange-600"
                                : "bg-primary/10 text-primary"
                        }`}
                      >
                        #{entry.rank}
                      </div>

                      {/* Avatar */}
                      <Avatar className="h-12 w-12 border-2 border-border">
                        <AvatarImage src={entry.avatar || "/placeholder.svg"} alt={entry.username} />
                        <AvatarFallback>{entry.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>

                      {/* Username */}
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{entry.username}</p>
                        <p className="text-sm text-muted-foreground">{entry.value} messages</p>
                      </div>

                      {/* Trophy for #1 */}
                      {entry.rank === 1 && (
                        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                          <Trophy className="mr-1 h-3 w-3" />
                          Champion
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voice Leaderboard */}
        <TabsContent value="voice" className="mt-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top 10 Vocal
              </CardTitle>
              <CardDescription>Les membres les plus actifs en vocal cette semaine</CardDescription>
            </CardHeader>
            <CardContent>
              {voiceLeaderboard.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Aucune donnée disponible pour cette semaine
                </div>
              ) : (
                <div className="space-y-3">
                  {voiceLeaderboard.map((entry) => (
                    <div
                      key={entry.discordId}
                      className="flex items-center gap-4 rounded-2xl bg-muted/50 p-4 transition-all hover:bg-muted"
                    >
                      {/* Rank Badge */}
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold ${
                          entry.rank === 1
                            ? "bg-yellow-500/20 text-yellow-500"
                            : entry.rank === 2
                              ? "bg-gray-400/20 text-gray-400"
                              : entry.rank === 3
                                ? "bg-orange-600/20 text-orange-600"
                                : "bg-primary/10 text-primary"
                        }`}
                      >
                        #{entry.rank}
                      </div>

                      {/* Avatar */}
                      <Avatar className="h-12 w-12 border-2 border-border">
                        <AvatarImage src={entry.avatar || "/placeholder.svg"} alt={entry.username} />
                        <AvatarFallback>{entry.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>

                      {/* Username */}
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{entry.username}</p>
                        <p className="text-sm text-muted-foreground">{formatVoiceTime(entry.value)}</p>
                      </div>

                      {/* Trophy for #1 */}
                      {entry.rank === 1 && (
                        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                          <Trophy className="mr-1 h-3 w-3" />
                          Champion
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
