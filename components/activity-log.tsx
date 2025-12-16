"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@supabase/supabase-js"
import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react"

const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Command {
    id: string
    action: string
    status: string
    created_at: string
    result?: any
}

interface ActivityLogProps {
    guildId: string
}

export function ActivityLog({ guildId }: ActivityLogProps) {
    const [commands, setCommands] = useState<Command[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!guildId) return

        // Fetch initial commands
        const fetchCommands = async () => {
            const { data } = await supa
                .from("command_queue")
                .select("*")
                .eq("guild_id", guildId)
                .order("created_at", { ascending: false })
                .limit(10)

            if (data) {
                setCommands(data)
            }
            setLoading(false)
        }

        fetchCommands()

        // Subscribe to realtime updates
        const channel = supa
            .channel(`activity_${guildId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "command_queue",
                    filter: `guild_id=eq.${guildId}`,
                },
                (payload) => {
                    setCommands((prev) => [payload.new as Command, ...prev.slice(0, 9)])
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "command_queue",
                    filter: `guild_id=eq.${guildId}`,
                },
                (payload) => {
                    setCommands((prev) =>
                        prev.map((cmd) => (cmd.id === payload.new.id ? (payload.new as Command) : cmd))
                    )
                }
            )
            .subscribe()

        return () => {
            supa.removeChannel(channel)
        }
    }, [guildId])

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "done":
                return (
                    <Badge variant="default" className="gap-1 bg-green-500/10 text-green-500">
                        <CheckCircle2 className="h-3 w-3" />
                        Terminé
                    </Badge>
                )
            case "error":
                return (
                    <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Erreur
                    </Badge>
                )
            case "processing":
                return (
                    <Badge variant="secondary" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        En cours
                    </Badge>
                )
            default:
                return (
                    <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        En attente
                    </Badge>
                )
        }
    }

    const formatAction = (action: string) => {
        const actionMap: Record<string, string> = {
            play: "🎵 Lecture musique",
            pause: "⏸️ Pause",
            resume: "▶️ Reprise",
            skip: "⏭️ Piste suivante",
            stop: "⏹️ Arrêt",
            purge: "🗑️ Nettoyage messages",
            slowmode: "🐌 Mode lent",
            lock: "🔒 Verrouillage salon",
            unlock: "🔓 Déverrouillage salon",
            announce: "📢 Annonce",
            post_leaderboard: "🏆 Leaderboard",
        }
        return actionMap[action] || action
    }

    const timeAgo = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime()
        const seconds = Math.floor(diff / 1000)
        if (seconds < 60) return `${seconds}s`
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h`
        return `${Math.floor(hours / 24)}j`
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (commands.length === 0) {
        return (
            <div className="py-8 text-center text-sm text-muted-foreground">
                Aucune activité récente
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {commands.map((cmd) => (
                <div
                    key={cmd.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-3"
                >
                    <div className="flex-1">
                        <p className="text-sm font-medium">{formatAction(cmd.action)}</p>
                        <p className="text-xs text-muted-foreground">Il y a {timeAgo(cmd.created_at)}</p>
                    </div>
                    {getStatusBadge(cmd.status)}
                </div>
            ))}
        </div>
    )
}
