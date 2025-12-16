'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { type UserGuild } from '@/lib/supabase-client'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export function GuildSelector() {
    const router = useRouter()
    const pathname = usePathname()
    const [guilds, setGuilds] = useState<UserGuild[]>([])
    const [selectedGuildId, setSelectedGuildId] = useState<string>('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadUserGuilds()
    }, [])

    async function loadUserGuilds() {
        try {
            // Load guilds from API (uses Discord OAuth)
            const response = await fetch('/api/guilds', { cache: 'no-store' })

            if (!response.ok) {
                console.error('Failed to load guilds from API')
                setLoading(false)
                return
            }

            const apiGuilds = await response.json()

            // Transform API guilds to UserGuild format
            const userGuilds: UserGuild[] = apiGuilds.map((g: any) => ({
                guild_id: g.id,
                user_id: '', // Not needed from API
                permissions: g.permissions || '0',
                is_owner: g.owner || false,
                created_at: new Date().toISOString(),
            }))

            setGuilds(userGuilds)

            // Load selected guild from localStorage or use first guild
            const savedGuildId = localStorage.getItem('selected_guild_id')
            if (savedGuildId && userGuilds.find((g) => g.guild_id === savedGuildId)) {
                setSelectedGuildId(savedGuildId)
            } else if (userGuilds.length > 0) {
                setSelectedGuildId(userGuilds[0].guild_id)
                localStorage.setItem('selected_guild_id', userGuilds[0].guild_id)
            }
        } catch (error) {
            console.error('Error loading guilds:', error)
        } finally {
            setLoading(false)
        }
    }

    function handleGuildChange(guildId: string) {
        setSelectedGuildId(guildId)
        localStorage.setItem('selected_guild_id', guildId)

        // Redirect to settings page for selected guild
        if (pathname.includes('/settings')) {
            router.push(`/dashboard/${guildId}/settings`)
        } else {
            router.push(`/dashboard/${guildId}`)
        }
    }

    if (loading) {
        return (
            <Card className="p-4 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Chargement des serveurs...</span>
            </Card>
        )
    }

    if (guilds.length === 0) {
        return (
            <Card className="p-4">
                <p className="text-sm text-muted-foreground">
                    Aucun serveur disponible. Assurez-vous d&apos;avoir les permissions nécessaires.
                </p>
            </Card>
        )
    }

    return (
        <Card className="p-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">Serveur Discord</label>
                <Select value={selectedGuildId} onValueChange={handleGuildChange}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sélectionner un serveur" />
                    </SelectTrigger>
                    <SelectContent>
                        {guilds.map((guild) => (
                            <SelectItem key={guild.guild_id} value={guild.guild_id}>
                                <div className="flex items-center gap-2">
                                    <span>{guild.guild_id}</span>
                                    <span className="text-xs text-muted-foreground">
                                        ({guild.permissions})
                                    </span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    {guilds.length} serveur{guilds.length > 1 ? 's' : ''} disponible{guilds.length > 1 ? 's' : ''}
                </p>
            </div>
        </Card>
    )
}
