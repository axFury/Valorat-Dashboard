"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { sendCommand } from "@/lib/commands"
import { Play, Pause, SkipForward, Square, Music2, Loader2, Trash2 } from 'lucide-react'

type Track = {
  id: string
  title: string
  artist: string
  duration: string
  thumbnail: string | null
}

type NowPlaying = {
  title: string
  artist: string
  thumbnail: string | null
}

type VoiceChannel = { id: string; name: string }

function fmtMs(ms?: number | null) {
  if (!ms && ms !== 0) return ""
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, "0")
  return `${m}:${ss}`
}

export default function MusicPage() {
  const { toast } = useToast()
  const [isPlaying, setIsPlaying] = useState(false)
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
  const [queue, setQueue] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannel[]>([])
  const [selectedVoiceChannel, setSelectedVoiceChannel] = useState("")
  const [query, setQuery] = useState("")

  // --- charge la liste des salons vocaux via la queue Supabase
  const loadVoiceChannels = useCallback(async () => {
    const { status, result } = await sendCommand("listVoiceChannels")
    if (status === "done" && result?.ok) {
      const chans: VoiceChannel[] = (result.channels || []).map((c: any) => ({ id: String(c.id), name: String(c.name) }))
      setVoiceChannels(chans)
      if (chans.length && !selectedVoiceChannel) setSelectedVoiceChannel(chans[0].id)
    }
  }, [selectedVoiceChannel])

  // --- rafraîchit la queue / état
  const refreshQueue = useCallback(async () => {
    const { status, result } = await sendCommand("getQueue")
    if (status === "done" && result?.ok) {
      const q = (result.queue || []).map((t: any, i: number): Track => ({
        id: String(i), // on utilise l'index pour pouvoir remove
        title: String(t.title || "Unknown"),
        artist: String(t.author || ""),
        duration: fmtMs(typeof t.length === "number" ? t.length : undefined),
        thumbnail: t.artworkUrl || null,
      }))
      setQueue(q)
      if (result.nowPlaying) {
        setNowPlaying({
          title: String(result.nowPlaying.title || "Unknown"),
          artist: String(result.nowPlaying.author || ""),
          thumbnail: result.nowPlaying.artworkUrl || null,
        })
      } else {
        setNowPlaying(null)
      }
      setIsPlaying(!!result.nowPlaying)
    }
  }, [])

  // --- init
  useEffect(() => {
    loadVoiceChannels()
    refreshQueue()
  }, [loadVoiceChannels, refreshQueue])

  // --- auto-refresh doux de la queue
  useEffect(() => {
    const id = setInterval(() => {
      refreshQueue().catch(() => {})
    }, 5000)
    return () => clearInterval(id)
  }, [refreshQueue])

  const handlePlay = async () => {
    if (!query || !selectedVoiceChannel) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir une URL/recherche et sélectionner un salon vocal",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    toast({ title: "Play", description: "Commande envoyée..." })

    try {
      const { status, result } = await sendCommand("play", { voiceChannelId: selectedVoiceChannel, query })
      if (status === "done" && result?.ok) {
        setIsPlaying(true)
        await refreshQueue()
        toast({ title: "Succès", description: "Lecture démarrée" })
        setQuery("")
      } else {
        toast({
          title: "Erreur",
          description: result?.reason || "Impossible de lire la musique",
          variant: "destructive",
        })
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de lire la musique", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: "pause" | "resume" | "skip" | "stop") => {
    setLoading(true)
    toast({ title: action.charAt(0).toUpperCase() + action.slice(1), description: "Commande envoyée..." })

    try {
      const { status, result } = await sendCommand(action)
      if (status === "done" && result?.ok) {
        if (action === "pause") setIsPlaying(false)
        if (action === "resume") setIsPlaying(true)
        if (action === "stop") setIsPlaying(false)
        await refreshQueue()
        toast({ title: "Succès", description: `${action} effectué` })
      } else {
        toast({ title: "Erreur", description: result?.reason || "Action échouée", variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", description: `Impossible d'effectuer ${action}`, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const removeFromQueue = async (index: number) => {
    try {
      const { status, result } = await sendCommand("removeFromQueue", { trackId: index })
      if (status === "done" && result?.ok) {
        await refreshQueue()
        toast({ title: "Retiré", description: "Piste retirée de la file" })
      } else {
        toast({ title: "Erreur", description: result?.reason || "Impossible de retirer la piste", variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de retirer la piste", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Musique</h1>
        <p className="text-muted-foreground">Contrôlez la lecture de musique</p>
      </div>

      {/* Play Music */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Jouer de la musique
          </CardTitle>
          <CardDescription>Ajouter une piste à la file d'attente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Salon vocal</Label>
              <Select value={selectedVoiceChannel} onValueChange={setSelectedVoiceChannel} disabled={loading || !voiceChannels.length}>
                <SelectTrigger>
                  <SelectValue placeholder={voiceChannels.length ? "Sélectionnez un salon vocal" : "Aucun salon vocal"} />
                </SelectTrigger>
                <SelectContent>
                  {voiceChannels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      🔊 {ch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>URL ou recherche</Label>
              <Input
                placeholder="https://youtube.com/... ou nom de musique"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handlePlay} className="gap-2" disabled={loading || !selectedVoiceChannel || !query}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Jouer
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                loadVoiceChannels()
                refreshQueue()
              }}
              disabled={loading}
            >
              <Loader2 className="h-4 w-4" />
              Rafraîchir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5" />
            Contrôles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col items-center text-center">
            {nowPlaying ? (
              <>
                {nowPlaying.thumbnail && (
                  <img
                    src={nowPlaying.thumbnail || "/placeholder.svg"}
                    alt=""
                    className="mb-2 h-14 w-14 rounded-md object-cover"
                  />
                )}
                <p className="max-w-[90%] truncate text-base font-semibold">{nowPlaying.title}</p>
                <p className="max-w-[90%] truncate text-sm text-muted-foreground">{nowPlaying.artist}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Rien en cours de lecture</p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => handleAction("resume")} size="lg" className="gap-2" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              Play
            </Button>

            <Button onClick={() => handleAction("pause")} size="lg" variant="outline" className="gap-2" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Pause className="h-5 w-5" />}
              Pause
            </Button>

            <Button onClick={() => handleAction("skip")} size="lg" variant="outline" className="gap-2" disabled={loading}>
              <SkipForward className="h-5 w-5" />
              Skip
            </Button>
            <Button onClick={() => handleAction("stop")} size="lg" variant="outline" className="gap-2" disabled={loading}>
              <Square className="h-5 w-5" />
              Stop
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Queue */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>File d'attente</CardTitle>
          <CardDescription>
            {queue.length} {queue.length === 1 ? "piste" : "pistes"} en attente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-muted p-12 text-center">
              <Music2 className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">Aucune piste en attente</p>
              <p className="text-sm text-muted-foreground">Les pistes ajoutées apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((track, index) => (
                <div key={`${track.id}-${index}`} className="flex items-center gap-3 rounded-lg bg-muted p-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                    {track.thumbnail ? (
                      <img src={track.thumbnail || "/placeholder.svg"} alt="" className="h-10 w-10 object-cover" />
                    ) : (
                      <Music2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{track.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {track.artist} {track.duration ? `• ${track.duration}` : ""}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeFromQueue(index)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
