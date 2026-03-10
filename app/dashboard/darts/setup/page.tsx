"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Target, Users, Play, Loader2, Plus, X } from "lucide-react"

export default function DartsSetupPage() {
    const router = useRouter()
    const [guildId, setGuildId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [mode, setMode] = useState("local")
    const [gameType, setGameType] = useState("501")
    const [matchFormat, setMatchFormat] = useState("first_to")
    const [legs, setLegs] = useState("3")
    const [sets, setSets] = useState("1")
    const [inRule, setInRule] = useState("straight")
    const [outRule, setOutRule] = useState("double")
    const [cricketMode, setCricketMode] = useState("normal")

    // Players state
    const [players, setPlayers] = useState<{ id: string, name: string, isGuest: boolean }[]>([
        { id: "guest_1", name: "Joueur 1", isGuest: true }
    ])
    const [newPlayerName, setNewPlayerName] = useState("")

    useEffect(() => {
        const gid = typeof window !== "undefined" ? localStorage.getItem("selected_guild") : null
        setGuildId(gid)

        // Auto-add current user
        fetch("/api/auth/user")
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data && (data.id || data.user?.id)) {
                    const user = data.user || data;
                    setPlayers([{ id: user.id, name: user.username || "Moi", isGuest: false }])
                }
            })
            .catch(() => { })
    }, [])

    const addGuestPlayer = () => {
        if (!newPlayerName.trim()) return
        const newId = `guest_${Date.now()}`
        setPlayers([...players, { id: newId, name: newPlayerName.trim(), isGuest: true }])
        setNewPlayerName("")
    }

    const removePlayer = (id: string) => {
        setPlayers(players.filter(p => p.id !== id))
    }

    const createMatch = async () => {
        if (!guildId) {
            setError("Veuillez sélectionner un serveur.")
            return
        }
        if (players.length < 1) {
            setError("Il faut au moins 1 joueur.")
            return
        }

        setLoading(true)
        setError(null)

        try {
            const res = await fetch("/api/darts/matches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    guildId,
                    mode,
                    gameType,
                    rules: {
                        matchFormat,
                        legsToWin: parseInt(legs, 10),
                        setsToWin: parseInt(sets, 10),
                        ...(gameType === "cricket"
                            ? { cricketMode }
                            : { inRule, outRule })
                    },
                    players
                })
            })

            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Erreur de création de partie")
                setLoading(false)
            } else {
                router.push(`/dashboard/darts/match/${data.matchId}`)
            }
        } catch (e) {
            setError("Erreur réseau")
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
            <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent flex items-center gap-2">
                    <Target className="h-8 w-8 text-red-500" />
                    Configuration de la Partie
                </h1>
                <p className="text-muted-foreground mt-1">Préparez le terrain. Ajustez les règles et ajoutez des joueurs.</p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm text-center">
                    {error}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-border">
                    <CardHeader>
                        <CardTitle className="text-lg">Paramètres du Jeu</CardTitle>
                        <CardDescription>Règles et format du match.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Mode de Jeu</Label>
                            <Select value={mode} onValueChange={setMode}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sélectionnez le mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="local">Local (Même écran)</SelectItem>
                                    <SelectItem value="online">En Ligne</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Jeu</Label>
                            <Select value={gameType} onValueChange={setGameType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sélectionnez le jeu" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="501">501</SelectItem>
                                    <SelectItem value="301">301</SelectItem>
                                    <SelectItem value="cricket">Cricket</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Format</Label>
                                <Select value={matchFormat} onValueChange={setMatchFormat}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="first_to">First To</SelectItem>
                                        <SelectItem value="best_of">Best Of</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Sets</Label>
                                <Select value={sets} onValueChange={setSets}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent className="max-h-[200px]">
                                        {Array.from({ length: 21 }, (_, i) => i + 1).map(num => (
                                            <SelectItem key={`set-${num}`} value={num.toString()}>{num}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Legs</Label>
                                <Select value={legs} onValueChange={setLegs}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent className="max-h-[200px]">
                                        {Array.from({ length: 21 }, (_, i) => i + 1).map(num => (
                                            <SelectItem key={`leg-${num}`} value={num.toString()}>{num}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {gameType === "cricket" ? (
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label>Mode Cricket</Label>
                                    <Select value={cricketMode} onValueChange={setCricketMode}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="normal">Normal (Points pour soi)</SelectItem>
                                            <SelectItem value="cut_throat">Cut-Throat (Points aux autres)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>IN (Début)</Label>
                                    <Select value={inRule} onValueChange={setInRule}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="straight">Straight In</SelectItem>
                                            <SelectItem value="double">Double In</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>OUT (Fin)</Label>
                                    <Select value={outRule} onValueChange={setOutRule}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="straight">Straight Out</SelectItem>
                                            <SelectItem value="double">Double Out</SelectItem>
                                            <SelectItem value="master">Master Out</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-border">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center justify-between">
                            Joueurs
                            <Badge variant="secondary" className="font-mono">{players.length}</Badge>
                        </CardTitle>
                        <CardDescription>Ajoutez les participants (Mode {mode === 'local' ? 'Local' : 'En Ligne'})</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Nom du joueur invité..."
                                value={newPlayerName}
                                onChange={(e) => setNewPlayerName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addGuestPlayer()}
                            />
                            <Button type="button" variant="secondary" onClick={addGuestPlayer}>
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="space-y-2 mt-4 max-h-[220px] overflow-y-auto pr-2">
                            {players.map((p, idx) => (
                                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center font-bold text-xs ring-1 ring-red-500/50">
                                            {idx + 1}
                                        </div>
                                        <span className="font-semibold text-sm">{p.name} {p.isGuest && <Badge variant="outline" className="ml-2 text-[10px] py-0 border-orange-500/30 text-orange-500">Invité</Badge>}</span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400" onClick={() => removePlayer(p.id)}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                            {players.length === 0 && (
                                <p className="text-sm text-center text-muted-foreground py-4">Aucun joueur ajouté.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end gap-4 mt-8">
                <Button variant="outline" onClick={() => router.back()}>Annuler</Button>
                <Button
                    className="bg-red-600 hover:bg-red-500 text-white font-bold w-full md:w-auto shadow-lg shadow-red-500/20"
                    size="lg"
                    onClick={createMatch}
                    disabled={loading || players.length === 0}
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                    Lancer la Partie
                </Button>
            </div>
        </div>
    )
}
