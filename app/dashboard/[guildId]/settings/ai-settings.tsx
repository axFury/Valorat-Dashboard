'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import type { GuildSettings } from '@/lib/supabase-client'

interface AISettingsProps {
    ai: GuildSettings['ai']
    onChange: (ai: GuildSettings['ai']) => void
}

export function AISettings({ ai, onChange }: AISettingsProps) {
    function update(key: keyof typeof ai, value: any) {
        onChange({ ...ai, [key]: value })
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>🤖 Paramètres IA & LLM</CardTitle>
                    <CardDescription>Configuration du chatbot intelligent</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>IA activée</Label>
                            <p className="text-sm text-muted-foreground">Activer le module IA</p>
                        </div>
                        <Switch checked={ai.enabled} onCheckedChange={(checked) => update('enabled', checked)} />
                    </div>

                    {ai.enabled && (
                        <>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="provider">Fournisseur</Label>
                                    <Select value={ai.provider} onValueChange={(value: any) => update('provider', value)}>
                                        <SelectTrigger id="provider">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="google">Google (Gemini)</SelectItem>
                                            <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                                            <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="model">Modèle</Label>
                                    <Input
                                        id="model"
                                        value={ai.model}
                                        onChange={(e) => update('model', e.target.value)}
                                        placeholder="gemini-pro"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="style">Style de réponse</Label>
                                    <Select value={ai.style} onValueChange={(value: any) => update('style', value)}>
                                        <SelectTrigger id="style">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="friendly">😊 Amical</SelectItem>
                                            <SelectItem value="professional">💼 Professionnel</SelectItem>
                                            <SelectItem value="funny">😂 Drôle</SelectItem>
                                            <SelectItem value="safe">✅ Modéré</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="max-tokens">Tokens max</Label>
                                    <Input
                                        id="max-tokens"
                                        type="number"
                                        min={100}
                                        max={2000}
                                        value={ai.max_tokens}
                                        onChange={(e) => update('max_tokens', parseInt(e.target.value) || 500)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Température</Label>
                                    <span className="text-sm font-medium">{ai.temperature.toFixed(1)}</span>
                                </div>
                                <Slider
                                    min={0}
                                    max={2}
                                    step={0.1}
                                    value={[ai.temperature]}
                                    onValueChange={([value]) => update('temperature', value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    0 = précis, 2 = créatif
                                </p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="rate-limit">Rate limit par user</Label>
                                    <Input
                                        id="rate-limit"
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={ai.rate_limit_per_user}
                                        onChange={(e) => update('rate_limit_per_user', parseInt(e.target.value) || 10)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="rate-window">Fenêtre (minutes)</Label>
                                    <Input
                                        id="rate-window"
                                        type="number"
                                        min={1}
                                        max={1440}
                                        value={ai.rate_limit_window_minutes}
                                        onChange={(e) => update('rate_limit_window_minutes', parseInt(e.target.value) || 60)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="context">Messages de contexte</Label>
                                    <Input
                                        id="context"
                                        type="number"
                                        min={0}
                                        max={20}
                                        value={ai.context_messages}
                                        onChange={(e) => update('context_messages', parseInt(e.target.value) || 5)}
                                    />
                                    <p className="text-xs text-muted-foreground">Historique à inclure</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Filtre NSFW</Label>
                                    <p className="text-sm text-muted-foreground">Bloquer le contenu inapproprié</p>
                                </div>
                                <Switch checked={ai.nsfw_filter} onCheckedChange={(checked) => update('nsfw_filter', checked)} />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
