'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { GuildSettings } from '@/lib/supabase-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Save, Settings as SettingsIcon } from 'lucide-react'
import { GuildSelector } from '@/components/guild-selector'

// Import tab components
import { GeneralSettings } from './general-settings'
import { ModulesSettings } from './modules-settings'
import { ChannelsSettings } from './channels-settings'
import { RolesSettings } from './roles-settings'
import { MusicSettings } from './music-settings'
import { ValorantSettings } from './valorant-settings'
import { AISettings } from './ai-settings'
import { ModerationSettings } from './moderation-settings'
import { WelcomeSettings } from './welcome-settings'
import { StatsSettings } from './stats-settings'

export default function SettingsPage() {
    const params = useParams()
    const router = useRouter()
    const { toast } = useToast()
    const guildId = params.guildId as string

    const [settings, setSettings] = useState<GuildSettings | null>(null)
    const [pendingChanges, setPendingChanges] = useState<Partial<GuildSettings>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    useEffect(() => {
        if (guildId) {
            loadSettings()
        }
    }, [guildId])

    async function loadSettings() {
        try {
            setLoading(true)
            const response = await fetch(`/api/guilds/${guildId}/settings`, {
                cache: 'no-store',
            })

            if (!response.ok) {
                if (response.status === 401) {
                    toast({
                        title: 'Non authentifié',
                        description: 'Veuillez vous connecter',
                        variant: 'destructive',
                    })
                    return
                }

                // 404 or other errors - use defaults
                toast({
                    title: 'Serveur non configuré',
                    description: 'Ce serveur n\'a pas encore de configuration. Des valeurs par défaut seront utilisées.',
                    variant: 'default',
                })
                setSettings(getDefaultSettings(guildId))
                return
            }

            const data = await response.json()

            if (!data) {
                toast({
                    title: 'Serveur non configuré',
                    description: 'Ce serveur n\'a pas encore de configuration. Des valeurs par défaut seront utilisées.',
                    variant: 'default',
                })
                setSettings(getDefaultSettings(guildId))
            } else {
                setSettings(data)
            }
        } catch (error: any) {
            console.error('Error loading settings:', error)
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de charger les paramètres',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    function updateSettings(section: string, value: any) {
        setPendingChanges(prev => ({
            ...prev,
            [section]: value,
        }))
        setHasChanges(true)
    }

    async function saveSettings() {
        if (!hasChanges || !guildId) return

        try {
            setSaving(true)

            // Send PATCH request to save settings
            const response = await fetch(`/api/guilds/${guildId}/settings`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(pendingChanges),
            })

            if (!response.ok) {
                throw new Error('Erreur lors de la sauvegarde')
            }

            toast({
                title: 'Paramètres sauvegardés',
                description: 'Les modifications seront appliquées dans quelques secondes.',
            })

            // Clear pending changes
            setPendingChanges({})
            setHasChanges(false)

            // Reload settings after a short delay
            setTimeout(loadSettings, 2000)
        } catch (error: any) {
            console.error('Error saving settings:', error)
            toast({
                title: 'Erreur de sauvegarde',
                description: error.message || 'Impossible de sauvegarder les paramètres',
                variant: 'destructive',
            })
        } finally {
            setSaving(false)
        }
    }

    function resetChanges() {
        setPendingChanges({})
        setHasChanges(false)
        toast({
            title: 'Modifications annulées',
            description: 'Les changements non sauvegardés ont été annulés.',
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    if (!settings) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <Card className="p-6">
                    <p className="text-muted-foreground">Impossible de charger les paramètres</p>
                </Card>
            </div>
        )
    }

    const currentSettings = { ...settings, ...pendingChanges }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <SettingsIcon className="h-8 w-8" />
                        Paramètres du Serveur
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Configurez le comportement du bot pour ce serveur
                    </p>
                </div>
                {hasChanges && (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={resetChanges} disabled={saving}>
                            Annuler
                        </Button>
                        <Button onClick={saveSettings} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sauvegarde...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Sauvegarder
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </div>

            {/* Guild Selector */}
            <GuildSelector />

            {/* Settings Tabs */}
            <Tabs defaultValue="general" className="space-y-4">
                <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10">
                    <TabsTrigger value="general">Général</TabsTrigger>
                    <TabsTrigger value="modules">Modules</TabsTrigger>
                    <TabsTrigger value="channels">Salons</TabsTrigger>
                    <TabsTrigger value="roles">Rôles</TabsTrigger>
                    <TabsTrigger value="music">Musique</TabsTrigger>
                    <TabsTrigger value="valorant">Valorant</TabsTrigger>
                    <TabsTrigger value="ai">IA/LLM</TabsTrigger>
                    <TabsTrigger value="moderation">Modération</TabsTrigger>
                    <TabsTrigger value="welcome">Bienvenue</TabsTrigger>
                    <TabsTrigger value="stats">Stats</TabsTrigger>
                </TabsList>

                <TabsContent value="general">
                    <GeneralSettings
                        settings={currentSettings}
                        onChange={(updates) => updateSettings('general', updates)}
                    />
                </TabsContent>

                <TabsContent value="modules">
                    <ModulesSettings
                        modules={currentSettings.modules}
                        onChange={(modules) => updateSettings('modules', modules)}
                    />
                </TabsContent>

                <TabsContent value="channels">
                    <ChannelsSettings
                        channels={currentSettings.channels}
                        onChange={(channels) => updateSettings('channels', channels)}
                        guildId={guildId}
                    />
                </TabsContent>

                <TabsContent value="roles">
                    <RolesSettings
                        roles={currentSettings.roles}
                        onChange={(roles) => updateSettings('roles', roles)}
                        guildId={guildId}
                    />
                </TabsContent>

                <TabsContent value="music">
                    <MusicSettings
                        music={currentSettings.music}
                        onChange={(music) => updateSettings('music', music)}
                    />
                </TabsContent>

                <TabsContent value="valorant">
                    <ValorantSettings
                        valorant={currentSettings.valorant}
                        onChange={(valorant) => updateSettings('valorant', valorant)}
                    />
                </TabsContent>

                <TabsContent value="ai">
                    <AISettings
                        ai={currentSettings.ai}
                        onChange={(ai) => updateSettings('ai', ai)}
                    />
                </TabsContent>

                <TabsContent value="moderation">
                    <ModerationSettings
                        moderation={currentSettings.moderation}
                        onChange={(moderation) => updateSettings('moderation', moderation)}
                    />
                </TabsContent>

                <TabsContent value="welcome">
                    <WelcomeSettings
                        welcome={currentSettings.welcome}
                        goodbye={currentSettings.goodbye}
                        onWelcomeChange={(welcome) => updateSettings('welcome', welcome)}
                        onGoodbyeChange={(goodbye) => updateSettings('goodbye', goodbye)}
                    />
                </TabsContent>

                <TabsContent value="stats">
                    <StatsSettings
                        stats={currentSettings.stats}
                        onChange={(stats) => updateSettings('stats', stats)}
                    />
                </TabsContent>
            </Tabs>

            {/* Save reminder at bottom */}
            {hasChanges && (
                <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                    <CardContent className="flex items-center justify-between p-4">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                            Vous avez des modifications non sauvegardées
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={resetChanges}>
                                Annuler
                            </Button>
                            <Button size="sm" onClick={saveSettings} disabled={saving}>
                                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

// Default settings helper
function getDefaultSettings(guildId: string): GuildSettings {
    return {
        guild_id: guildId,
        timezone: 'Europe/Paris',
        locale: 'fr-FR',
        language: 'fr-FR',
        prefix: '/',
        weekly_auto_post: true,
        rrtop_auto_post: true,
        patch_notifications: true,
        weekly_channel_id: null,
        announce_channel_id: null,
        rrtop_channel_id: null,
        patch_channel_id: null,
        modules: {
            music: true,
            valorant: true,
            moderation: true,
            ai: true,
            stats: true,
            gifs: true,
        },
        channels: {},
        roles: {},
        music: {
            dj_only: false,
            default_volume: 50,
            max_queue_length: 100,
            allow_playlists: true,
            allow_filters: true,
            announce_songs: true,
            auto_leave_empty: true,
            auto_leave_timer: 300,
            allowed_channels: [],
            blocked_channels: [],
        },
        valorant: {
            region: 'eu',
            auto_update_ranks: true,
            update_interval_hours: 6,
            notify_rank_changes: false,
            notify_patch_notes: true,
            leaderboard_enabled: true,
            compare_roasts_enabled: true,
            match_history_enabled: true,
        },
        ai: {
            enabled: true,
            provider: 'google',
            model: 'gemini-pro',
            style: 'friendly',
            max_tokens: 500,
            temperature: 0.7,
            allowed_channels: [],
            blocked_users: [],
            rate_limit_per_user: 10,
            rate_limit_window_minutes: 60,
            nsfw_filter: true,
            context_messages: 5,
        },
        moderation: {
            enabled: true,
            auto_mod_enabled: false,
            anti_spam: {
                enabled: false,
                max_messages: 5,
                timeframe_seconds: 5,
                action: 'warn',
            },
            anti_link: {
                enabled: false,
                whitelist_domains: [],
                action: 'delete',
            },
            anti_caps: {
                enabled: false,
                threshold_percent: 70,
                min_length: 10,
                action: 'warn',
            },
            anti_mention: {
                enabled: false,
                max_mentions: 5,
                action: 'warn',
            },
            bad_words: {
                enabled: false,
                words: [],
                action: 'delete',
            },
            log_actions: true,
            dm_on_action: false,
        },
        welcome: {
            enabled: false,
            message: 'Bienvenue {user} sur {server} !',
            embed: {
                enabled: false,
                title: 'Bienvenue !',
                description: 'Bienvenue {user} sur {server} !',
                color: '#5865F2',
                thumbnail: 'server_icon',
            },
            auto_role: null,
            dm_welcome: false,
        },
        goodbye: {
            enabled: false,
            message: '{user} a quitté le serveur. À bientôt !',
            embed: {
                enabled: false,
                title: 'Au revoir',
                description: '{user} a quitté {server}',
                color: '#ED4245',
            },
        },
        stats: {
            enabled: true,
            track_messages: true,
            track_voice: true,
            ignored_channels: [],
            ignored_roles: [],
            leaderboard_public: true,
        },
    }
}
