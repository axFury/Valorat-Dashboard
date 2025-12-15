"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { mockChannels } from "@/lib/mock-data"
import { SettingsIcon, Key, Eye, EyeOff, FileText } from "lucide-react"

export default function SettingsPage() {
  const { toast } = useToast()
  const [showKeys, setShowKeys] = useState(false)
  const [announceChannel, setAnnounceChannel] = useState("ch2")
  const [leaderboardChannel, setLeaderboardChannel] = useState("ch5")
  const [timezone, setTimezone] = useState("Europe/Paris")
  const [features, setFeatures] = useState({
    moderation: true,
    music: true,
    leaderboards: true,
    valorant: true,
  })

  const handleSaveSettings = async () => {
    toast({ title: "Enregistrement...", description: "Mise à jour des paramètres" })
    await new Promise((resolve) => setTimeout(resolve, 1500))
    toast({ title: "Succès", description: "Paramètres enregistrés" })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground">Configuration du serveur et du bot</p>
      </div>

      <Tabs defaultValue="guild" className="space-y-6">
        <TabsList>
          <TabsTrigger value="guild">Serveur</TabsTrigger>
          <TabsTrigger value="keys">Clés & Webhooks</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="guild" className="space-y-6">
          {/* Guild Settings */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Paramètres du serveur
              </CardTitle>
              <CardDescription>Configuration générale</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Salon des annonces</Label>
                  <Select value={announceChannel} onValueChange={setAnnounceChannel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mockChannels
                        .filter((ch) => ch.type === "text")
                        .map((ch) => (
                          <SelectItem key={ch.id} value={ch.id}>
                            #{ch.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Salon des leaderboards</Label>
                  <Select value={leaderboardChannel} onValueChange={setLeaderboardChannel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mockChannels
                        .filter((ch) => ch.type === "text")
                        .map((ch) => (
                          <SelectItem key={ch.id} value={ch.id}>
                            #{ch.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Fuseau horaire</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleSaveSettings}>Enregistrer</Button>
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Fonctionnalités</CardTitle>
              <CardDescription>Activer ou désactiver des modules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries({
                  moderation: "Modération",
                  music: "Musique",
                  leaderboards: "Leaderboards",
                  valorant: "Valorant",
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg bg-muted p-3">
                    <Label>{label}</Label>
                    <Switch
                      checked={features[key as keyof typeof features]}
                      onCheckedChange={(checked) => setFeatures({ ...features, [key]: checked })}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keys" className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Clés API et Webhooks
              </CardTitle>
              <CardDescription>Gestion des accès et intégrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                <Label>Afficher les clés</Label>
                <Button size="icon" variant="ghost" onClick={() => setShowKeys(!showKeys)}>
                  {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Token du bot</Label>
                <Input type={showKeys ? "text" : "password"} value="••••••••••••••••••••••••" readOnly />
              </div>

              <div className="space-y-2">
                <Label>Riot API Key</Label>
                <Input type={showKeys ? "text" : "password"} value="••••••••••••••••••••••••" readOnly />
              </div>

              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input type={showKeys ? "text" : "password"} value="••••••••••••••••••••••••" readOnly />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Journal d'audit
              </CardTitle>
              <CardDescription>Toutes les actions effectuées depuis le dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { action: "Modification des paramètres", user: "Admin", date: "2025-01-10 16:45" },
                  { action: "Purge de 50 messages", user: "Moderator", date: "2025-01-10 14:30" },
                  { action: "Ajout d'un GIF", user: "Admin", date: "2025-01-10 12:15" },
                  { action: "Liaison compte Valorant", user: "Player1", date: "2025-01-10 10:00" },
                ].map((log, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-muted p-3">
                    <div>
                      <p className="font-medium">{log.action}</p>
                      <p className="text-sm text-muted-foreground">Par {log.user}</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{log.date}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
