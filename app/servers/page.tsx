"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Users } from "lucide-react"

interface Guild {
  id: string
  name: string
  icon: string | null
  owner: boolean
  permissions: string
}

export default function ServersPage() {
  const router = useRouter()
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchGuilds = async () => {
      console.log("[v0] Fetching guilds from /api/guilds")
      try {
        const response = await fetch("/api/guilds")

        console.log("[v0] Response status:", response.status)

        if (!response.ok) {
          if (response.status === 401) {
            console.log("[v0] Not authenticated, redirecting to home")
            router.push("/")
            return
          }
          const errorData = await response.json()
          console.error("[v0] Error response:", errorData)
          throw new Error(errorData.error || "Failed to fetch guilds")
        }

        const data = await response.json()
        console.log("[v0] Guilds received:", data.length)
        setGuilds(data)
      } catch (err) {
        console.error("[v0] Fetch error:", err)
        setError(err instanceof Error ? err.message : "Une erreur est survenue")
      } finally {
        setLoading(false)
      }
    }

    fetchGuilds()
  }, [router])

  const selectGuild = (guildId: string) => {
    // Store selected guild in localStorage/cookie
    localStorage.setItem("selected_guild", guildId)
    router.push("/dashboard")
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Chargement de vos serveurs...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md border-destructive">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">{error}</p>
            <Button className="mt-4" onClick={() => router.push("/")}>
              Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex h-16 items-center gap-3 px-6">
          <Image src="/valoratbot-logo.png" alt="Valoratbot" width={32} height={32} className="h-8 w-8" />
          <span className="text-xl font-bold text-foreground">Valoratbot</span>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground">Sélectionnez un serveur</h1>
          <p className="mt-2 text-muted-foreground">Choisissez le serveur que vous souhaitez gérer</p>
        </div>

        {guilds.length === 0 ? (
          <Card className="mx-auto max-w-md">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                Aucun serveur trouvé. Assurez-vous que le bot est présent sur vos serveurs.
              </p>
              <Button className="mt-4" onClick={() => router.push("/")}>
                Retour
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
            {guilds.map((guild) => (
              <Card
                key={guild.id}
                className="cursor-pointer border-border bg-card transition-all hover:border-primary hover:shadow-lg"
                onClick={() => selectGuild(guild.id)}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <Avatar className="h-16 w-16">
                    <AvatarImage
                      src={
                        guild.icon
                          ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
                          : "/placeholder.svg"
                      }
                    />
                    <AvatarFallback>{guild.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{guild.name}</h3>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Cliquez pour gérer
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
