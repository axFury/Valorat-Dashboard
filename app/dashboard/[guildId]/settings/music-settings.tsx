'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import type { GuildSettings } from '@/lib/supabase-client'

interface MusicSettingsProps {
    music: GuildSettings['music']
    onChange: (music: GuildSettings['music']) => void
}

export function MusicSettings({ music, onChange }: MusicSettingsProps) {
    function update(key: keyof typeof music, value: any) {
        onChange({ ...music, [key]: value })
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>🎵 Paramètres Musique</CardTitle>
                    <CardDescription>Configuration du module de lecture musicale</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* DJ Only */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="dj-only">Mode DJ uniquement</Label>
                            <p className="text-sm text-muted-foreground">
                                Seuls les utilisateurs avec le rôle DJ peuvent contrôler la musique
                            </p>
                        </div>
                        <Switch
                            id="dj-only"
                            checked={music.dj_only}
                            onCheckedChange={(checked) => update('dj_only', checked)}
                        />
                    </div>

                    {/* Default Volume */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="default-volume">Volume par défaut</Label>
                            <span className="text-sm font-medium">{music.default_volume}%</span>
                        </div>
                        <Slider
                            id="default-volume"
                            min={0}
                            max={100}
                            step={5}
                            value={[music.default_volume]}
                            onValueChange={([value]) => update('default_volume', value)}
                        />
                    </div>

                    {/* Max Queue Length */}
                    <div className="space-y-2">
                        <Label htmlFor="max-queue">Taille max de la file d'attente</Label>
                        <Input
                            id="max-queue"
                            type="number"
                            min={1}
                            max={1000}
                            value={music.max_queue_length}
                            onChange={(e) => update('max_queue_length', parseInt(e.target.value) || 100)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Nombre maximum de titres en attente
                        </p>
                    </div>

                    {/* Allow Playlists */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="allow-playlists">Autoriser les playlists</Label>
                            <p className="text-sm text-muted-foreground">
                                Les utilisateurs peuvent ajouter des playlists entières
                            </p>
                        </div>
                        <Switch
                            id="allow-playlists"
                            checked={music.allow_playlists}
                            onCheckedChange={(checked) => update('allow_playlists', checked)}
                        />
                    </div>

                    {/* Allow Filters */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="allow-filters">Autoriser les filtres audio</Label>
                            <p className="text-sm text-muted-foreground">
                                Bass boost, nightcore, etc.
                            </p>
                        </div>
                        <Switch
                            id="allow-filters"
                            checked={music.allow_filters}
                            onCheckedChange={(checked) => update('allow_filters', checked)}
                        />
                    </div>

                    {/* Announce Songs */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="announce-songs">Annoncer les titres</Label>
                            <p className="text-sm text-muted-foreground">
                                Envoyer un message lors du changement de musique
                            </p>
                        </div>
                        <Switch
                            id="announce-songs"
                            checked={music.announce_songs}
                            onCheckedChange={(checked) => update('announce_songs', checked)}
                        />
                    </div>

                    {/* Auto Leave */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="auto-leave">Quitter si salon vide</Label>
                            <p className="text-sm text-muted-foreground">
                                Le bot quitte automatiquement si personne n'écoute
                            </p>
                        </div>
                        <Switch
                            id="auto-leave"
                            checked={music.auto_leave_empty}
                            onCheckedChange={(checked) => update('auto_leave_empty', checked)}
                        />
                    </div>

                    {/* Auto Leave Timer */}
                    {music.auto_leave_empty && (
                        <div className="space-y-2">
                            <Label htmlFor="auto-leave-timer">Délai avant déconnexion (secondes)</Label>
                            <Input
                                id="auto-leave-timer"
                                type="number"
                                min={0}
                                max={3600}
                                value={music.auto_leave_timer}
                                onChange={(e) => update('auto_leave_timer', parseInt(e.target.value) || 300)}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
