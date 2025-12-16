'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { GuildSettings } from '@/lib/supabase-client'

interface ValorantSettingsProps {
    valorant: GuildSettings['valorant']
    onChange: (valorant: GuildSettings['valorant']) => void
}

export function ValorantSettings({ valorant, onChange }: ValorantSettingsProps) {
    function update(key: keyof typeof valorant, value: any) {
        onChange({ ...valorant, [key]: value })
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>🎮 Paramètres Valorant</CardTitle>
                    <CardDescription>Configuration du tracking Valorant et des notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="region">Région</Label>
                        <Select value={valorant.region} onValueChange={(value: any) => update('region', value)}>
                            <SelectTrigger id="region">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="eu">🇪🇺 Europe</SelectItem>
                                <SelectItem value="na">🇺🇸 North America</SelectItem>
                                <SelectItem value="ap">🌏 Asia Pacific</SelectItem>
                                <SelectItem value="kr">🇰🇷 Korea</SelectItem>
                                <SelectItem value="latam">🌎 LATAM</SelectItem>
                                <SelectItem value="br">🇧🇷 Brazil</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Auto-update des ranks</Label>
                            <p className="text-sm text-muted-foreground">Mise à jour automatique des rangs</p>
                        </div>
                        <Switch checked={valorant.auto_update_ranks} onCheckedChange={(checked) => update('auto_update_ranks', checked)} />
                    </div>

                    {valorant.auto_update_ranks && (
                        <div className="space-y-2">
                            <Label htmlFor="update-interval">Intervalle de mise à jour (heures)</Label>
                            <Input
                                id="update-interval"
                                type="number"
                                min={1}
                                max={24}
                                value={valorant.update_interval_hours}
                                onChange={(e) => update('update_interval_hours', parseInt(e.target.value) || 6)}
                            />
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Notifications changements de rank</Label>
                            <p className="text-sm text-muted-foreground">Notifier quand un joueur change de rang</p>
                        </div>
                        <Switch checked={valorant.notify_rank_changes} onCheckedChange={(checked) => update('notify_rank_changes', checked)} />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Notifications patch notes</Label>
                            <p className="text-sm text-muted-foreground">Annoncer les nouvelles mises à jour Valorant</p>
                        </div>
                        <Switch checked={valorant.notify_patch_notes} onCheckedChange={(checked) => update('notify_patch_notes', checked)} />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Leaderboard activé</Label>
                            <p className="text-sm text-muted-foreground">Classement RR hebdomadaire</p>
                        </div>
                        <Switch checked={valorant.leaderboard_enabled} onCheckedChange={(checked) => update('leaderboard_enabled', checked)} />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Roasts de comparaison</Label>
                            <p className="text-sm text-muted-foreground">Commande /compare avec insultes LLM</p>
                        </div>
                        <Switch checked={valorant.compare_roasts_enabled} onCheckedChange={(checked) => update('compare_roasts_enabled', checked)} />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Historique de matchs</Label>
                            <p className="text-sm text-muted-foreground">Afficher les derniers matchs</p>
                        </div>
                        <Switch checked={valorant.match_history_enabled} onCheckedChange={(checked) => update('match_history_enabled', checked)} />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
