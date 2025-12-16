'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { GuildSettings } from '@/lib/supabase-client'

interface ModerationSettingsProps {
    moderation: GuildSettings['moderation']
    onChange: (moderation: GuildSettings['moderation']) => void
}

export function ModerationSettings({ moderation, onChange }: ModerationSettingsProps) {
    function update(path: string, value: any) {
        const keys = path.split('.')
        if (keys.length === 1) {
            onChange({ ...moderation, [keys[0]]: value })
        } else if (keys.length === 2) {
            onChange({ ...moderation, [keys[0]]: { ...(moderation as any)[keys[0]], [keys[1]]: value } })
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>🛡️ Modération</CardTitle>
                    <CardDescription>Auto-modération et filtres de contenu</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <Label>Module activé</Label>
                        <Switch checked={moderation.enabled} onCheckedChange={(checked) => update('enabled', checked)} />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label>Auto-modération activée</Label>
                        <Switch checked={moderation.auto_mod_enabled} onCheckedChange={(checked) => update('auto_mod_enabled', checked)} />
                    </div>

                    {moderation.auto_mod_enabled && (
                        <>
                            <Separator />

                            {/* Anti-Spam */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Anti-Spam</Label>
                                    <Switch checked={moderation.anti_spam.enabled} onCheckedChange={(checked) => update('anti_spam.enabled', checked)} />
                                </div>
                                {moderation.anti_spam.enabled && (
                                    <div className="grid gap-4 md:grid-cols-3 ml-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="spam-max">Max messages</Label>
                                            <Input
                                                id="spam-max"
                                                type="number"
                                                min={1}
                                                max={20}
                                                value={moderation.anti_spam.max_messages}
                                                onChange={(e) => update('anti_spam.max_messages', parseInt(e.target.value) || 5)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="spam-time">Période (s)</Label>
                                            <Input
                                                id="spam-time"
                                                type="number"
                                                min={1}
                                                max={60}
                                                value={moderation.anti_spam.timeframe_seconds}
                                                onChange={(e) => update('anti_spam.timeframe_seconds', parseInt(e.target.value) || 5)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="spam-action">Action</Label>
                                            <Select value={moderation.anti_spam.action} onValueChange={(value) => update('anti_spam.action', value)}>
                                                <SelectTrigger id="spam-action">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="warn">⚠️ Avertir</SelectItem>
                                                    <SelectItem value="mute">🔇 Mute</SelectItem>
                                                    <SelectItem value="kick">👢 Kick</SelectItem>
                                                    <SelectItem value="ban">🔨 Ban</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Anti-Link */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Anti-Liens</Label>
                                    <Switch checked={moderation.anti_link.enabled} onCheckedChange={(checked) => update('anti_link.enabled', checked)} />
                                </div>
                                {moderation.anti_link.enabled && (
                                    <div className="grid gap-4 md:grid-cols-2 ml-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="link-action">Action</Label>
                                            <Select value={moderation.anti_link.action} onValueChange={(value) => update('anti_link.action', value)}>
                                                <SelectTrigger id="link-action">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="delete">🗑️ Supprimer</SelectItem>
                                                    <SelectItem value="warn">⚠️ Avertir</SelectItem>
                                                    <SelectItem value="mute">🔇 Mute</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Anti-Caps */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Anti-CAPS</Label>
                                    <Switch checked={moderation.anti_caps.enabled} onCheckedChange={(checked) => update('anti_caps.enabled', checked)} />
                                </div>
                                {moderation.anti_caps.enabled && (
                                    <div className="grid gap-4 md:grid-cols-3 ml-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="caps-threshold">Seuil (%)</Label>
                                            <Input
                                                id="caps-threshold"
                                                type="number"
                                                min={50}
                                                max={100}
                                                value={moderation.anti_caps.threshold_percent}
                                                onChange={(e) => update('anti_caps.threshold_percent', parseInt(e.target.value) || 70)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="caps-length">Longueur min</Label>
                                            <Input
                                                id="caps-length"
                                                type="number"
                                                min={5}
                                                max={50}
                                                value={moderation.anti_caps.min_length}
                                                onChange={(e) => update('anti_caps.min_length', parseInt(e.target.value) || 10)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="caps-action">Action</Label>
                                            <Select value={moderation.anti_caps.action} onValueChange={(value) => update('anti_caps.action', value)}>
                                                <SelectTrigger id="caps-action">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="warn">⚠️ Avertir</SelectItem>
                                                    <SelectItem value="delete">🗑️ Supprimer</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Anti-Mention */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Anti-Mentions</Label>
                                    <Switch checked={moderation.anti_mention.enabled} onCheckedChange={(checked) => update('anti_mention.enabled', checked)} />
                                </div>
                                {moderation.anti_mention.enabled && (
                                    <div className="grid gap-4 md:grid-cols-2 ml-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="mention-max">Max mentions</Label>
                                            <Input
                                                id="mention-max"
                                                type="number"
                                                min={1}
                                                max={20}
                                                value={moderation.anti_mention.max_mentions}
                                                onChange={(e) => update('anti_mention.max_mentions', parseInt(e.target.value) || 5)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="mention-action">Action</Label>
                                            <Select value={moderation.anti_mention.action} onValueChange={(value) => update('anti_mention.action', value)}>
                                                <SelectTrigger id="mention-action">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="warn">⚠️ Avertir</SelectItem>
                                                    <SelectItem value="delete">🗑️ Supprimer</SelectItem>
                                                    <SelectItem value="mute">🔇 Mute</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    <Separator />

                    <div className="flex items-center justify-between">
                        <Label>Logger les actions</Label>
                        <Switch checked={moderation.log_actions} onCheckedChange={(checked) => update('log_actions', checked)} />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label>DM lors d'une action</Label>
                        <Switch checked={moderation.dm_on_action} onCheckedChange={(checked) => update('dm_on_action', checked)} />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
