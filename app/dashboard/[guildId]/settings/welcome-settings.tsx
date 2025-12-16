'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import type { GuildSettings } from '@/lib/supabase-client'

interface WelcomeSettingsProps {
    welcome: GuildSettings['welcome']
    goodbye: GuildSettings['goodbye']
    onWelcomeChange: (welcome: GuildSettings['welcome']) => void
    onGoodbyeChange: (goodbye: GuildSettings['goodbye']) => void
}

export function WelcomeSettings({ welcome, goodbye, onWelcomeChange, onGoodbyeChange }: WelcomeSettingsProps) {
    return (
        <div className="space-y-6">
            {/* Welcome */}
            <Card>
                <CardHeader>
                    <CardTitle>👋 Messages de Bienvenue</CardTitle>
                    <CardDescription>Message envoyé quand un nouveau membre rejoint le serveur</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Bienvenue activée</Label>
                        <Switch
                            checked={welcome.enabled}
                            onCheckedChange={(checked) => onWelcomeChange({ ...welcome, enabled: checked })}
                        />
                    </div>

                    {welcome.enabled && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="welcome-message">Message simple</Label>
                                <Textarea
                                    id="welcome-message"
                                    value={welcome.message}
                                    onChange={(e) => onWelcomeChange({ ...welcome, message: e.target.value })}
                                    placeholder="Bienvenue {user} sur {server} !"
                                    rows={3}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Variables: {'{user}'}, {'{server}'}, {'{memberCount}'}
                                </p>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between">
                                <Label>Utiliser un embed</Label>
                                <Switch
                                    checked={welcome.embed.enabled}
                                    onCheckedChange={(checked) =>
                                        onWelcomeChange({ ...welcome, embed: { ...welcome.embed, enabled: checked } })
                                    }
                                />
                            </div>

                            {welcome.embed.enabled && (
                                <div className="grid gap-4 md:grid-cols-2 ml-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="welcome-title">Titre</Label>
                                        <Input
                                            id="welcome-title"
                                            value={welcome.embed.title}
                                            onChange={(e) =>
                                                onWelcomeChange({ ...welcome, embed: { ...welcome.embed, title: e.target.value } })
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="welcome-color">Couleur</Label>
                                        <Input
                                            id="welcome-color"
                                            type="color"
                                            value={welcome.embed.color}
                                            onChange={(e) =>
                                                onWelcomeChange({ ...welcome, embed: { ...welcome.embed, color: e.target.value } })
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="welcome-description">Description</Label>
                                        <Textarea
                                            id="welcome-description"
                                            value={welcome.embed.description}
                                            onChange={(e) =>
                                                onWelcomeChange({ ...welcome, embed: { ...welcome.embed, description: e.target.value } })
                                            }
                                            rows={3}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <Label>Envoyer en DM</Label>
                                <Switch
                                    checked={welcome.dm_welcome}
                                    onCheckedChange={(checked) => onWelcomeChange({ ...welcome, dm_welcome: checked })}
                                />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Goodbye */}
            <Card>
                <CardHeader>
                    <CardTitle>👋 Messages d'Au Revoir</CardTitle>
                    <CardDescription>Message envoyé quand un membre quitte le serveur</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Au revoir activé</Label>
                        <Switch
                            checked={goodbye.enabled}
                            onCheckedChange={(checked) => onGoodbyeChange({ ...goodbye, enabled: checked })}
                        />
                    </div>

                    {goodbye.enabled && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="goodbye-message">Message simple</Label>
                                <Textarea
                                    id="goodbye-message"
                                    value={goodbye.message}
                                    onChange={(e) => onGoodbyeChange({ ...goodbye, message: e.target.value })}
                                    placeholder="{user} a quitté le serveur"
                                    rows={2}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label>Utiliser un embed</Label>
                                <Switch
                                    checked={goodbye.embed.enabled}
                                    onCheckedChange={(checked) =>
                                        onGoodbyeChange({ ...goodbye, embed: { ...goodbye.embed, enabled: checked } })
                                    }
                                />
                            </div>

                            {goodbye.embed.enabled && (
                                <div className="grid gap-4 md:grid-cols-2 ml-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="goodbye-title">Titre</Label>
                                        <Input
                                            id="goodbye-title"
                                            value={goodbye.embed.title}
                                            onChange={(e) =>
                                                onGoodbyeChange({ ...goodbye, embed: { ...goodbye.embed, title: e.target.value } })
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="goodbye-color">Couleur</Label>
                                        <Input
                                            id="goodbye-color"
                                            type="color"
                                            value={goodbye.embed.color}
                                            onChange={(e) =>
                                                onGoodbyeChange({ ...goodbye, embed: { ...goodbye.embed, color: e.target.value } })
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="goodbye-description">Description</Label>
                                        <Textarea
                                            id="goodbye-description"
                                            value={goodbye.embed.description}
                                            onChange={(e) =>
                                                onGoodbyeChange({ ...goodbye, embed: { ...goodbye.embed, description: e.target.value } })
                                            }
                                            rows={2}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
