'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { GuildSettings } from '@/lib/supabase-client'

interface ModulesSettingsProps {
    modules: GuildSettings['modules']
    onChange: (modules: GuildSettings['modules']) => void
}

export function ModulesSettings({ modules, onChange }: ModulesSettingsProps) {
    function toggle(key: keyof typeof modules) {
        onChange({ ...modules, [key]: !modules[key] })
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Modules du Bot</CardTitle>
                    <CardDescription>Activer ou désactiver les fonctionnalités du bot</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        {/* Music */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="module-music">🎵 Musique</Label>
                                <p className="text-sm text-muted-foreground">
                                    Lecture de musique YouTube, Spotify, etc.
                                </p>
                            </div>
                            <Switch
                                id="module-music"
                                checked={modules.music}
                                onCheckedChange={() => toggle('music')}
                            />
                        </div>

                        {/* Valorant */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="module-valorant">🎮 Valorant</Label>
                                <p className="text-sm text-muted-foreground">
                                    Tracking RR, leaderboards, patch notes
                                </p>
                            </div>
                            <Switch
                                id="module-valorant"
                                checked={modules.valorant}
                                onCheckedChange={() => toggle('valorant')}
                            />
                        </div>

                        {/* AI/LLM */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="module-ai">🤖 IA & LLM</Label>
                                <p className="text-sm text-muted-foreground">
                                    Chatbot IA (Google Gemini, OpenAI, etc.)
                                </p>
                            </div>
                            <Switch
                                id="module-ai"
                                checked={modules.ai}
                                onCheckedChange={() => toggle('ai')}
                            />
                        </div>

                        {/* Moderation */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="module-moderation">🛡️ Modération</Label>
                                <p className="text-sm text-muted-foreground">
                                    Auto-mod, anti-spam, filtres de contenu
                                </p>
                            </div>
                            <Switch
                                id="module-moderation"
                                checked={modules.moderation}
                                onCheckedChange={() => toggle('moderation')}
                            />
                        </div>

                        {/* Stats */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="module-stats">📊 Statistiques</Label>
                                <p className="text-sm text-muted-foreground">
                                    Leaderboards messages & vocal, activité
                                </p>
                            </div>
                            <Switch
                                id="module-stats"
                                checked={modules.stats}
                                onCheckedChange={() => toggle('stats')}
                            />
                        </div>

                        {/* GIFs */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="module-gifs">🎞️ GIFs</Label>
                                <p className="text-sm text-muted-foreground">
                                    Pile de GIFs personnalisés, /ping avec médias
                                </p>
                            </div>
                            <Switch
                                id="module-gifs"
                                checked={modules.gifs}
                                onCheckedChange={() => toggle('gifs')}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
