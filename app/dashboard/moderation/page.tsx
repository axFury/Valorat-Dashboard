"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { sendCommand } from "@/lib/commands"
import { Trash2, Clock, Lock, Unlock, Loader2, Calendar, Play } from "lucide-react"

export default function ModerationPage() {
  const { toast } = useToast()
  const [channels, setChannels] = useState<any[]>([])
  const [selectedChannel, setSelectedChannel] = useState("")
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [purgeMode, setPurgeMode] = useState("count")
  const [purgeCount, setPurgeCount] = useState(50)
  const [slowmodeSeconds, setSlowmodeSeconds] = useState([30])
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    action: string
    details: string
    onConfirm: () => void
  }>({ open: false, action: "", details: "", onConfirm: () => {} })
  const [channelLocks, setChannelLocks] = useState<Record<string, boolean>>({})

  const [leaderboardChannel, setLeaderboardChannel] = useState("")
  const [trackDays, setTrackDays] = useState("7")
  const [dow, setDow] = useState("0")
  const [hour, setHour] = useState("20")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const guildId = localStorage.getItem("selected_guild")
        if (!guildId) return

        console.log("[v0] Fetching text channels via command queue...")
        const { status, result } = await sendCommand("listTextChannels", {})

        if (status === "done" && result?.ok && result?.channels) {
          console.log("[v0] Text channels loaded:", result.channels)
          setChannels(result.channels)
          if (result.channels.length > 0) {
            setSelectedChannel(result.channels[0].id)
            setLeaderboardChannel(result.channels[0].id)
          }
        } else {
          console.error("[v0] Failed to load channels:", result)
          toast({
            title: "Erreur",
            description: "Impossible de charger les salons",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("[v0] Error loading moderation data:", error)
        toast({
          title: "Erreur",
          description: "Impossible de charger les données",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [toast])

  const handlePurge = (channelId: string) => {
    setConfirmDialog({
      open: true,
      action: "Purge",
      details: `Supprimer ${purgeCount} messages en mode ${purgeMode}`,
      onConfirm: async () => {
        setActionLoading(true)
        toast({ title: "Purge", description: "Commande envoyée..." })
        try {
          const { status, result } = await sendCommand("purge", { channelId, amount: purgeCount, mode: purgeMode })
          if (status === "done" && result?.ok) {
            toast({
              title: "Succès",
              description: `${result.deleted || purgeCount} messages supprimés`,
            })
          } else {
            toast({
              title: "Erreur",
              description: result?.reason || "Impossible d'effectuer le purge",
              variant: "destructive",
            })
          }
        } catch (error) {
          toast({
            title: "Erreur",
            description: "Impossible d'effectuer le purge",
            variant: "destructive",
          })
        } finally {
          setActionLoading(false)
        }
      },
    })
  }

  const handleSlowmode = async (channelId: string) => {
    setActionLoading(true)
    toast({ title: "Slowmode", description: "Commande envoyée..." })
    try {
      const { status, result } = await sendCommand("slowmode", { channelId, duration: slowmodeSeconds[0] })
      if (status === "done" && result?.ok) {
        toast({ title: "Succès", description: `Slowmode de ${slowmodeSeconds[0]}s appliqué` })
      } else {
        toast({
          title: "Erreur",
          description: result?.reason || "Impossible d'appliquer le slowmode",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'appliquer le slowmode",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const toggleLock = async (channelId: string, locked: boolean) => {
    setActionLoading(true)
    toast({ title: locked ? "Lock" : "Unlock", description: "Commande envoyée..." })
    try {
      const { status, result } = await sendCommand(locked ? "lock" : "unlock", { channelId })
      if (status === "done" && result?.ok) {
        setChannelLocks({ ...channelLocks, [channelId]: locked })
        toast({
          title: "Succès",
          description: `Salon ${locked ? "verrouillé" : "déverrouillé"}`,
        })
      } else {
        toast({
          title: "Erreur",
          description: result?.reason || `Impossible de ${locked ? "verrouiller" : "déverrouiller"} le salon`,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: `Impossible de ${locked ? "verrouiller" : "déverrouiller"} le salon`,
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleSaveLeaderboardSettings = async () => {
    setActionLoading(true)
    toast({ title: "Enregistrement...", description: "Configuration du leaderboard" })
    try {
      const { status, result } = await sendCommand("schedule_leaderboard", {
        channelId: leaderboardChannel,
        trackDays: Number.parseInt(trackDays),
        dayOfWeek: Number.parseInt(dow),
        hour: Number.parseInt(hour),
      })
      if (status === "done" && result?.ok) {
        toast({ title: "Succès", description: "Configuration du leaderboard enregistrée" })
      } else {
        toast({
          title: "Erreur",
          description: result?.reason || "Impossible d'enregistrer la configuration",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la configuration",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRunLeaderboardNow = async () => {
    setActionLoading(true)
    toast({ title: "Génération...", description: "Création du leaderboard" })
    try {
      const { status, result } = await sendCommand("post_leaderboard", {
        channelId: leaderboardChannel,
      })
      if (status === "done" && result?.ok) {
        toast({ title: "Succès", description: "Leaderboard publié" })
      } else {
        toast({
          title: "Erreur",
          description: result?.reason || "Impossible de publier le leaderboard",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de publier le leaderboard",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Modération</h1>
        <p className="text-muted-foreground">Outils de modération pour votre serveur</p>
      </div>

      {/* Purge */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Purge de messages
          </CardTitle>
          <CardDescription>Supprimer des messages en masse</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Salon</Label>
              <Select value={selectedChannel} onValueChange={setSelectedChannel} disabled={actionLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un salon" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      #{ch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={purgeMode} onValueChange={setPurgeMode} disabled={actionLoading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Nombre de messages</SelectItem>
                  <SelectItem value="users">Messages utilisateurs</SelectItem>
                  <SelectItem value="bots">Messages bots</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {purgeMode === "count" && (
            <div className="space-y-2">
              <Label>Nombre de messages: {purgeCount}</Label>
              <Slider
                value={[purgeCount]}
                onValueChange={(v) => setPurgeCount(v[0])}
                min={1}
                max={100}
                step={1}
                disabled={actionLoading}
              />
            </div>
          )}

          <Button
            onClick={() => handlePurge(selectedChannel)}
            disabled={!selectedChannel || actionLoading}
            className="gap-2"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Exécuter le purge
          </Button>
        </CardContent>
      </Card>

      {/* Slowmode */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Mode lent (Slowmode)
          </CardTitle>
          <CardDescription>Limiter la fréquence des messages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Salon</Label>
            <Select value={selectedChannel} onValueChange={setSelectedChannel} disabled={actionLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un salon" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    #{ch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Délai: {slowmodeSeconds[0]}s</Label>
            <Slider
              value={slowmodeSeconds}
              onValueChange={setSlowmodeSeconds}
              min={0}
              max={21600}
              step={5}
              disabled={actionLoading}
            />
            <p className="text-xs text-muted-foreground">0 = désactivé, max 21600s (6h)</p>
          </div>

          <Button
            onClick={() => handleSlowmode(selectedChannel)}
            disabled={!selectedChannel || actionLoading}
            className="gap-2"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
            Appliquer le slowmode
          </Button>
        </CardContent>
      </Card>

      {/* Lock/Unlock */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Verrouillage de salons
          </CardTitle>
          <CardDescription>Verrouiller ou déverrouiller des salons</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {channels.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between rounded-lg bg-muted p-3">
                <div className="flex items-center gap-2">
                  {channelLocks[ch.id] ? (
                    <Lock className="h-4 w-4 text-destructive" />
                  ) : (
                    <Unlock className="h-4 w-4 text-green-500" />
                  )}
                  <span className="font-medium">#{ch.name}</span>
                </div>
                <Switch
                  checked={channelLocks[ch.id] || false}
                  onCheckedChange={(checked) => toggleLock(ch.id, checked)}
                  disabled={actionLoading}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Scheduling */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Planification des leaderboards
          </CardTitle>
          <CardDescription>Configuration des leaderboards automatiques hebdomadaires</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Période de suivi (jours)</Label>
              <Input
                type="number"
                value={trackDays}
                onChange={(e) => setTrackDays(e.target.value)}
                min="1"
                max="30"
                disabled={actionLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>Salon de publication</Label>
              <Select value={leaderboardChannel} onValueChange={setLeaderboardChannel} disabled={actionLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un salon" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      #{ch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Jour de la semaine</Label>
              <Select value={dow} onValueChange={setDow} disabled={actionLoading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Dimanche</SelectItem>
                  <SelectItem value="1">Lundi</SelectItem>
                  <SelectItem value="2">Mardi</SelectItem>
                  <SelectItem value="3">Mercredi</SelectItem>
                  <SelectItem value="4">Jeudi</SelectItem>
                  <SelectItem value="5">Vendredi</SelectItem>
                  <SelectItem value="6">Samedi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Heure (Europe/Paris)</Label>
              <Input
                type="time"
                value={`${hour}:00`}
                onChange={(e) => setHour(e.target.value.split(":")[0])}
                disabled={actionLoading}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveLeaderboardSettings} disabled={actionLoading} className="gap-2">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
              Enregistrer
            </Button>
            <Button
              onClick={handleRunLeaderboardNow}
              variant="outline"
              disabled={actionLoading}
              className="gap-2 bg-transparent"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Lancer maintenant
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'action</DialogTitle>
            <DialogDescription>Êtes-vous sûr de vouloir effectuer cette action?</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted p-4">
            <p className="font-medium">{confirmDialog.action}</p>
            <p className="text-sm text-muted-foreground">{confirmDialog.details}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                confirmDialog.onConfirm()
                setConfirmDialog({ ...confirmDialog, open: false })
              }}
              disabled={actionLoading}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
