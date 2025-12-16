'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { GuildSettings } from '@/lib/supabase-client'

interface StatsSettingsProps {
    stats: GuildSettings['stats']
    onChange: (stats: GuildSettings['stats']) => void
}

export function StatsSettings({ stats, onChange }: StatsSettingsProps) {
    function update(key: keyof typeof stats, value: any) {
        onChange({ ...stats, [key]: value })
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>📊 Statistiques & Leaderboards</CardTitle>
                    <CardDescription>Tracking de l'activité des membres</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Module activé</Label>
                            <p className="text-sm text-muted-foreground">Activer le tracking d'activité</p>
                        </div>
                        <Switch checked={stats.enabled} onCheckedChange={(checked) => update('enabled', checked)} />
                    </div>

                    {stats.enabled && (
                        <>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Tracker les messages</Label>
                                    <p className="text-sm text-muted-foreground">Comptabiliser les messages envoyés</p>
                                </div>
                                <Switch
                                    checked={stats.track_messages}
                                    onCheckedChange={(checked) => update('track_messages', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Tracker le vocal</Label>
                                    <p className="text-sm text-muted-foreground">Comptabiliser le temps en vocal</p>
                                </div>
                                <Switch
                                    checked={stats.track_voice}
                                    onCheckedChange={(checked) => update('track_voice', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Leaderboard public</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Tout le monde peut voir le classement
                                    </p>
                                </div>
                                <Switch
                                    checked={stats.leaderboard_public}
                                    onCheckedChange={(checked) => update('leaderboard_public', checked)}
                                />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
