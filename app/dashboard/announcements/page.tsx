"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { sendCommand } from "@/lib/commands"
import { Megaphone, Send, Calendar, Loader2 } from "lucide-react"

export default function AnnouncementsPage() {
  const { toast } = useToast()
  const [channels, setChannels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [content, setContent] = useState("")
  const [useEmbed, setUseEmbed] = useState(true)
  const [embedTitle, setEmbedTitle] = useState("")
  const [embedDescription, setEmbedDescription] = useState("")
  const [embedColor, setEmbedColor] = useState("#E11D48")
  const [embedImage, setEmbedImage] = useState("")
  const [selectedChannel, setSelectedChannel] = useState("")
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("")

  useEffect(() => {
    const fetchChannels = async () => {
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
        console.error("[v0] Error loading channels:", error)
        toast({
          title: "Erreur",
          description: "Impossible de charger les salons",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchChannels()
  }, [toast])

  const handleSend = async () => {
    setActionLoading(true)
    toast({ title: "Annonce", description: "Commande envoyée..." })

    try {
      const { status, result } = await sendCommand("announce", {
        channelId: selectedChannel,
        message: useEmbed ? null : content,
        embed: useEmbed
          ? {
              title: embedTitle,
              description: embedDescription,
              color: embedColor,
              image: embedImage,
            }
          : null,
      })

      if (status === "done" && result?.ok) {
        toast({ title: "Succès", description: "Annonce publiée" })
        // Reset form
        setContent("")
        setEmbedTitle("")
        setEmbedDescription("")
        setEmbedImage("")
      } else {
        toast({
          title: "Erreur",
          description: result?.reason || "Impossible de publier l'annonce",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de publier l'annonce",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une date et heure", variant: "destructive" })
      return
    }

    setActionLoading(true)
    toast({ title: "Programmation", description: "Commande envoyée..." })

    try {
      const { status, result } = await sendCommand("schedule_announce", {
        channelId: selectedChannel,
        message: useEmbed ? null : content,
        embed: useEmbed
          ? {
              title: embedTitle,
              description: embedDescription,
              color: embedColor,
              image: embedImage,
            }
          : null,
        scheduledFor: `${scheduleDate}T${scheduleTime}`,
      })

      if (status === "done" && result?.ok) {
        toast({ title: "Succès", description: `Annonce programmée pour ${scheduleDate} à ${scheduleTime}` })
        // Reset form
        setContent("")
        setEmbedTitle("")
        setEmbedDescription("")
        setEmbedImage("")
        setScheduleDate("")
        setScheduleTime("")
      } else {
        toast({
          title: "Erreur",
          description: result?.reason || "Impossible de programmer l'annonce",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de programmer l'annonce",
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
        <h1 className="text-3xl font-bold text-foreground">Annonces</h1>
        <p className="text-muted-foreground">Créer et programmer des annonces</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Composer */}
        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                Composer l'annonce
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Salon de destination</Label>
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

              {!useEmbed && (
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Votre annonce..."
                    rows={6}
                    disabled={actionLoading}
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch checked={useEmbed} onCheckedChange={setUseEmbed} disabled={actionLoading} />
                <Label>Utiliser un embed</Label>
              </div>

              {useEmbed && (
                <>
                  <div className="space-y-2">
                    <Label>Titre de l'embed</Label>
                    <Input
                      value={embedTitle}
                      onChange={(e) => setEmbedTitle(e.target.value)}
                      placeholder="Titre de l'annonce"
                      disabled={actionLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={embedDescription}
                      onChange={(e) => setEmbedDescription(e.target.value)}
                      placeholder="Contenu de l'annonce..."
                      rows={6}
                      disabled={actionLoading}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Couleur</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={embedColor}
                          onChange={(e) => setEmbedColor(e.target.value)}
                          className="h-10 w-20"
                          disabled={actionLoading}
                        />
                        <Input
                          value={embedColor}
                          onChange={(e) => setEmbedColor(e.target.value)}
                          placeholder="#E11D48"
                          disabled={actionLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Image (URL)</Label>
                      <Input
                        value={embedImage}
                        onChange={(e) => setEmbedImage(e.target.value)}
                        placeholder="https://..."
                        disabled={actionLoading}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Programmer
              </CardTitle>
              <CardDescription>Planifier l'envoi de l'annonce</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    disabled={actionLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Heure</Label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    disabled={actionLoading}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSend} disabled={!selectedChannel || actionLoading} className="flex-1 gap-2">
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer maintenant
                </Button>
                <Button
                  onClick={handleSchedule}
                  disabled={!selectedChannel || actionLoading}
                  variant="outline"
                  className="flex-1 gap-2 bg-transparent"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                  Programmer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Aperçu</CardTitle>
            <CardDescription>Prévisualisation de l'annonce</CardDescription>
          </CardHeader>
          <CardContent>
            {useEmbed ? (
              <div className="rounded-2xl border-l-4 bg-muted p-4" style={{ borderLeftColor: embedColor }}>
                {embedTitle && <h3 className="mb-2 text-lg font-bold">{embedTitle}</h3>}
                {embedDescription && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{embedDescription}</p>
                )}
                {!embedTitle && !embedDescription && (
                  <p className="text-sm text-muted-foreground">Commencez à écrire pour voir l'aperçu...</p>
                )}
                {embedImage && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>🖼️ Image attachée</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-muted p-4">
                <p className="whitespace-pre-wrap text-sm">{content || "Commencez à écrire pour voir l'aperçu..."}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
