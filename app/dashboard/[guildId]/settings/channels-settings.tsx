'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { GuildSettings } from '@/lib/supabase-client'
import { Loader2 } from 'lucide-react'

interface ChannelsSettingsProps {
    channels: GuildSettings['channels']
    onChange: (channels: GuildSettings['channels']) => void
    guildId: string
}

interface DiscordChannel {
    id: string
    name: string
}

export function ChannelsSettings({ channels, onChange, guildId }: ChannelsSettingsProps) {
    const [discordChannels, setDiscordChannels] = useState<DiscordChannel[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadChannels()
    }, [guildId])

    async function loadChannels() {
        try {
            const response = await fetch(`/api/guilds/${guildId}/channels`, {
                cache: 'no-store',
            })

            if (!response.ok) {
                console.error('Failed to load channels from API')
                setLoading(false)
                return
            }

            const allChannels = await response.json()

            // Filter text channels only (type 0 = GUILD_TEXT)
            const textChannels = allChannels
                .filter((ch: any) => ch.type === 0)
                .map((ch: any) => ({
                    id: ch.id,
                    name: ch.name,
                }))

            setDiscordChannels(textChannels)
        } catch (error) {
            console.error('Error loading channels:', error)
        } finally {
            setLoading(false)
        }
    }

    function updateChannel(key: keyof typeof channels, value: string | null) {
        onChange({ ...channels, [key]: value || null })
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Salons Discord</CardTitle>
                    <CardDescription>
                        Configurez les salons utilisés par le bot pour différentes fonctionnalités
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Log Channel */}
                        <div className="space-y-2">
                            <Label htmlFor="log-channel">📋 Salon de logs</Label>
                            <Select
                                value={channels.log || ''}
                                onValueChange={(value) => updateChannel('log', value)}
                            >
                                <SelectTrigger id="log-channel">
                                    <SelectValue placeholder="Aucun" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Aucun</SelectItem>
                                    {discordChannels.map((ch) => (
                                        <SelectItem key={ch.id} value={ch.id}>
                                            #{ch.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Welcome Channel */}
                        <div className="space-y-2">
                            <Label htmlFor="welcome-channel">👋 Salon de bienvenue</Label>
                            <Select
                                value={channels.welcome || ''}
                                onValueChange={(value) => updateChannel('welcome', value)}
                            >
                                <SelectTrigger id="welcome-channel">
                                    <SelectValue placeholder="Aucun" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Aucun</SelectItem>
                                    {discordChannels.map((ch) => (
                                        <SelectItem key={ch.id} value={ch.id}>
                                            #{ch.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Moderation Log */}
                        <div className="space-y-2">
                            <Label htmlFor="mod-log-channel">🛡️ Logs de modération</Label>
                            <Select
                                value={channels.mod_log || ''}
                                onValueChange={(value) => updateChannel('mod_log', value)}
                            >
                                <SelectTrigger id="mod-log-channel">
                                    <SelectValue placeholder="Aucun" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Aucun</SelectItem>
                                    {discordChannels.map((ch) => (
                                        <SelectItem key={ch.id} value={ch.id}>
                                            #{ch.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Music Text Channel */}
                        <div className="space-y-2">
                            <Label htmlFor="music-text-channel">🎵 Salon commandes musique</Label>
                            <Select
                                value={channels.music_text || ''}
                                onValueChange={(value) => updateChannel('music_text', value)}
                            >
                                <SelectTrigger id="music-text-channel">
                                    <SelectValue placeholder="Aucun" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Aucun</SelectItem>
                                    {discordChannels.map((ch) => (
                                        <SelectItem key={ch.id} value={ch.id}>
                                            #{ch.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Valorant Updates */}
                        <div className="space-y-2">
                            <Label htmlFor="valorant-updates-channel">🎮 Mises à jour Valorant</Label>
                            <Select
                                value={channels.valorant_updates || ''}
                                onValueChange={(value) => updateChannel('valorant_updates', value)}
                            >
                                <SelectTrigger id="valorant-updates-channel">
                                    <SelectValue placeholder="Aucun" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Aucun</SelectItem>
                                    {discordChannels.map((ch) => (
                                        <SelectItem key={ch.id} value={ch.id}>
                                            #{ch.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
