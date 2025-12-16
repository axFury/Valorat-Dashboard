'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { GuildSettings } from '@/lib/supabase-client'

interface GeneralSettingsProps {
    settings: GuildSettings
    onChange: (updates: Partial<GuildSettings>) => void
}

export function GeneralSettings({ settings, onChange }: GeneralSettingsProps) {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Paramètres Généraux</CardTitle>
                    <CardDescription>Configuration de base du bot pour ce serveur</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Language */}
                        <div className="space-y-2">
                            <Label htmlFor="language">Langue du bot</Label>
                            <Select
                                value={settings.language}
                                onValueChange={(value) => onChange({ language: value })}
                            >
                                <SelectTrigger id="language">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fr-FR">🇫🇷 Français</SelectItem>
                                    <SelectItem value="en-US">🇬🇧 English</SelectItem>
                                    <SelectItem value="es-ES">🇪🇸 Español</SelectItem>
                                    <SelectItem value="de-DE">🇩🇪 Deutsch</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Timezone */}
                        <div className="space-y-2">
                            <Label htmlFor="timezone">Fuseau horaire</Label>
                            <Select
                                value={settings.timezone}
                                onValueChange={(value) => onChange({ timezone: value })}
                            >
                                <SelectTrigger id="timezone">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Europe/Paris">Europe/Paris (GMT+1)</SelectItem>
                                    <SelectItem value="Europe/London">Europe/London (GMT+0)</SelectItem>
                                    <SelectItem value="America/New_York">America/New_York (GMT-5)</SelectItem>
                                    <SelectItem value="America/Los_Angeles">America/Los_Angeles (GMT-8)</SelectItem>
                                    <SelectItem value="Asia/Tokyo">Asia/Tokyo (GMT+9)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Locale */}
                        <div className="space-y-2">
                            <Label htmlFor="locale">Locale (format dates/nombres)</Label>
                            <Select
                                value={settings.locale}
                                onValueChange={(value) => onChange({ locale: value })}
                            >
                                <SelectTrigger id="locale">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fr-FR">fr-FR</SelectItem>
                                    <SelectItem value="en-US">en-US</SelectItem>
                                    <SelectItem value="en-GB">en-GB</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Prefix */}
                        <div className="space-y-2">
                            <Label htmlFor="prefix">Préfixe (legacy)</Label>
                            <Input
                                id="prefix"
                                value={settings.prefix}
                                onChange={(e) => onChange({ prefix: e.target.value })}
                                maxLength={5}
                                placeholder="/"
                            />
                            <p className="text-xs text-muted-foreground">
                                Les commandes slash (/) sont recommandées
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
