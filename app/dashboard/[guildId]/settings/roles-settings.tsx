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

interface RolesSettingsProps {
    roles: GuildSettings['roles']
    onChange: (roles: GuildSettings['roles']) => void
    guildId: string
}

interface DiscordRole {
    id: string
    name: string
}

export function RolesSettings({ roles, onChange, guildId }: RolesSettingsProps) {
    const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadRoles()
    }, [guildId])

    async function loadRoles() {
        try {
            const response = await fetch(`/api/guilds/${guildId}/roles`, {
                cache: 'no-store',
            })

            if (!response.ok) {
                console.error('Failed to load roles from API')
                setLoading(false)
                return
            }

            const allRoles = await response.json()

            // Transform to our format
            const roles = allRoles.map((role: any) => ({
                id: role.id,
                name: role.name,
            }))

            setDiscordRoles(roles)
        } catch (error) {
            console.error('Error loading roles:', error)
        } finally {
            setLoading(false)
        }
    }

    function updateRole(key: keyof typeof roles, value: string | null) {
        onChange({ ...roles, [key]: value || null })
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
                    <CardTitle>Rôles Discord</CardTitle>
                    <CardDescription>Configurez les rôles utilisés par le bot</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="admin-role">👑 Admin</Label>
                            <Select
                                value={roles.admin || ''}
                                onValueChange={(value) => updateRole('admin', value)}
                            >
                                <SelectTrigger id="admin-role">
                                    <SelectValue placeholder="Aucun" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Aucun</SelectItem>
                                    {discordRoles.map((role) => (
                                        <SelectItem key={role.id} value={role.id}>
                                            @{role.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="moderator-role">🛡️ Modérateur</Label>
                            <Select
                                value={roles.moderator || ''}
                                onValueChange={(value) => updateRole('moderator', value)}
                            >
                                <SelectTrigger id="moderator-role">
                                    <SelectValue placeholder="Aucun" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Aucun</SelectItem>
                                    {discordRoles.map((role) => (
                                        <SelectItem key={role.id} value={role.id}>
                                            @{role.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="dj-role">🎧 DJ (Musique)</Label>
                            <Select
                                value={roles.dj || ''}
                                onValueChange={(value) => updateRole('dj', value)}
                            >
                                <SelectTrigger id="dj-role">
                                    <SelectValue placeholder="Aucun" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Aucun</SelectItem>
                                    {discordRoles.map((role) => (
                                        <SelectItem key={role.id} value={role.id}>
                                            @{role.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="muted-role">🔇 Muet</Label>
                            <Select
                                value={roles.muted || ''}
                                onValueChange={(value) => updateRole('muted', value)}
                            >
                                <SelectTrigger id="muted-role">
                                    <SelectValue placeholder="Aucun" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Aucun</SelectItem>
                                    {discordRoles.map((role) => (
                                        <SelectItem key={role.id} value={role.id}>
                                            @{role.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="verified-role">✅ Vérifié</Label>
                            <Select
                                value={roles.verified || ''}
                                onValueChange={(value) => updateRole('verified', value)}
                            >
                                <SelectTrigger id="verified-role">
                                    <SelectValue placeholder="Aucun" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Aucun</SelectItem>
                                    {discordRoles.map((role) => (
                                        <SelectItem key={role.id} value={role.id}>
                                            @{role.name}
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
