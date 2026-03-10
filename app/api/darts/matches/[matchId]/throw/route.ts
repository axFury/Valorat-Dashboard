import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PlayerState, MatchRules, isBust, DartThrow } from "@/lib/darts-engine";

export const dynamic = "force-dynamic";

function getSupa() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
}

export async function POST(req: NextRequest, props: { params: Promise<{ matchId: string }> | { matchId: string } }) {
    const params = await props.params;
    const body = await req.json();
    const { playerId, darts, isCheckout } = body as { playerId: string, darts: DartThrow[], isCheckout: boolean };

    if (!darts || !Array.isArray(darts) || !playerId) {
        return NextResponse.json({ error: "Missing score info or invalid darts format" }, { status: 400 });
    }

    const totalScore = darts.reduce((sum, d) => sum + (d.value * d.multiplier), 0);
    const maxScore = 180;
    if (totalScore < 0 || totalScore > maxScore) {
        return NextResponse.json({ error: "Score invalide" }, { status: 400 });
    }

    const supa = getSupa();

    // 1. Récupérer le match
    const { data: match, error } = await supa
        .from("darts_matches")
        .select("*")
        .eq("id", params.matchId)
        .single();

    if (error || !match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
    if (match.status !== "playing") return NextResponse.json({ error: "Match is not active" }, { status: 400 });

    let players: PlayerState[] = match.players;
    const rules: MatchRules = match.rules;
    const pIndex = match.current_player_index;

    if (players[pIndex].id !== playerId) {
        return NextResponse.json({ error: "Ce n'est pas le tour de ce joueur." }, { status: 400 });
    }

    const currentPlayer = players[pIndex];
    let newScore = currentPlayer.scoreLeft;
    let bust = false;
    let roundWon = false;

    // Cricket Targets
    const CRICKET_TARGETS = [15, 16, 17, 18, 19, 20, 25];

    let finalScoreThisTurn = 0;
    let turnMisses = 0;

    if (match.game_type === "cricket") {
        // Logique Cricket
        if (!currentPlayer.cricketMarks) currentPlayer.cricketMarks = { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 };
        if (currentPlayer.cricketPoints === undefined) currentPlayer.cricketPoints = 0;

        for (const dart of darts) {
            if (dart.value === 0) {
                turnMisses++;
                continue;
            }
            if (!CRICKET_TARGETS.includes(dart.value)) {
                // Pas une cible cricket (ex: 12), c'est un "miss" stratégique
                turnMisses++;
                continue;
            }

            const target = dart.value;
            let currentMarks = currentPlayer.cricketMarks[target] || 0;
            let newMarks = currentMarks + dart.multiplier;

            if (newMarks > 3) {
                // Surplus de marques -> potentiellement des points
                const excess = newMarks - Math.max(3, currentMarks);
                currentPlayer.cricketMarks[target] = 3;

                // Vérifier si un adversaire a la cible ouverte (marks < 3)
                // En cricket, on marque des points si la cible est fermée chez nous (3)
                // mais PAS chez TOUS les adversaires.
                let allOpponentsClosed = true;
                for (const p of players) {
                    if (p.id !== playerId) {
                        if ((p.cricketMarks?.[target] || 0) < 3) {
                            allOpponentsClosed = false;
                            break;
                        }
                    }
                }

                if (!allOpponentsClosed) {
                    const pointsScored = excess * target;
                    // Note: Bullseye = 25. Double Bullseye = 50 (donc target=25, multiplier=2)
                    // points = excess * 25.
                    currentPlayer.cricketPoints += pointsScored;
                    finalScoreThisTurn += pointsScored; // Pour les stats globales
                }
            } else {
                currentPlayer.cricketMarks[target] = newMarks;
            }
        }

        // Victoire Cricket
        // Le joueur a 3 marques partout ET ses points >= le plus grand score des autres
        const allTargetsClosed = CRICKET_TARGETS.every(t => (currentPlayer.cricketMarks![t] || 0) === 3);

        let highestOpponentPoints = 0;
        for (const p of players) {
            if (p.id !== playerId && (p.cricketPoints || 0) > highestOpponentPoints) {
                highestOpponentPoints = p.cricketPoints || 0;
            }
        }

        if (allTargetsClosed && currentPlayer.cricketPoints! >= highestOpponentPoints) {
            roundWon = true;
        }

        newScore = currentPlayer.cricketPoints; // Pour l'UI History, score restant n'a pas de sens en cricket

    } else {
        // Logique x01 (301, 501, etc.)
        for (const dart of darts) {
            if (dart.value === 0) turnMisses++;
        }

        newScore = currentPlayer.scoreLeft - totalScore;

        // 2. Vérifier les règles de Bust (Si l'option OutRule s'applique)
        if (newScore < 0) bust = true;
        if (rules.outRule === 'double') {
            if (newScore === 1) bust = true;
            if (newScore === 0 && !isCheckout) bust = true; // S'il arrive à 0 mais n'a pas fini proprement sur double
        } else if (rules.outRule === 'master') {
            if (newScore === 1) bust = true;
            if (newScore === 0 && !isCheckout) bust = true;
        }

        // Si c'est un Bust
        finalScoreThisTurn = totalScore;
        if (bust) {
            newScore = currentPlayer.scoreLeft; // On remet le score précédent
            finalScoreThisTurn = 0; // Il a marqué 0 validé
        }

        // Victoire x01
        if (newScore === 0 && !bust) {
            roundWon = true;
            if (finalScoreThisTurn > currentPlayer.stats.highestCheckout) {
                currentPlayer.stats.highestCheckout = finalScoreThisTurn;
            }
        }
    }

    // Mettre à jour les stats du joueur
    currentPlayer.stats.dartsThrown += Array.isArray(darts) ? darts.length : 3;
    currentPlayer.stats.misses = (currentPlayer.stats.misses || 0) + turnMisses;

    if (match.game_type === "cricket") {
        const totalMarks = CRICKET_TARGETS.reduce((sum, t) => sum + (currentPlayer.cricketMarks?.[t] || 0), 0)
        currentPlayer.stats.cricketMarks = totalMarks;
        // On n'incrémente totalScore qu'en fonction des points du cricket ? 
        // Ou des darts réels ? Les pros préfèrent MPRO (Marks Per Round) au score brut. On met les points validés :
        currentPlayer.stats.totalScore += finalScoreThisTurn;
    } else {
        if (!bust) currentPlayer.stats.totalScore += finalScoreThisTurn;
        if (finalScoreThisTurn === 180) currentPlayer.stats.count180++;
        else if (finalScoreThisTurn >= 140) currentPlayer.stats.count140++;
        else if (finalScoreThisTurn >= 100) currentPlayer.stats.count100++;
    }

    if (finalScoreThisTurn > currentPlayer.stats.bestTurn) {
        currentPlayer.stats.bestTurn = finalScoreThisTurn;
    }

    currentPlayer.scoreLeft = newScore;

    // Legs handling
    if (roundWon) {
        currentPlayer.legsWon += 1;
    }

    // Ajouter l'historique
    const turnLog = {
        playerId,
        scoreBefore: currentPlayer.scoreLeft + (bust ? 0 : totalScore),
        scoreAfter: newScore,
        throwScore: totalScore,
        isBust: bust
    };
    const newHistory = [...match.history, turnLog];

    // Déterminer le prochain état
    let nextStatus = "playing";
    let nextPlayerIndex = (pIndex + 1) % players.length;
    let winnerId = match.winner_id;

    // Si Leg gagné
    if (roundWon) {
        if (currentPlayer.legsWon >= rules.legsToWin) {
            nextStatus = "finished";
            winnerId = currentPlayer.id;
        } else {
            // Reset du leg
            const baseScore = parseInt(match.game_type);
            players = players.map(p => ({
                ...p,
                scoreLeft: isNaN(baseScore) ? 0 : baseScore,
                ...(match.game_type === "cricket" ? {
                    cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
                    cricketPoints: 0
                } : {})
            }));

            // Celui qui a commencé le leg précédent laisse la main.
            // On peut simplifier : Le gagnant commence, ou alternance. Par convention, on va dire alternance du premier lanceur.
            // (Pour l'instant, disons que le perdant commence au prochain ou on tourne simplement).
            let totalLegsPlayed = players.reduce((sum, p) => sum + p.legsWon, 0);
            nextPlayerIndex = totalLegsPlayed % players.length;
        }
    }

    // 4. Update Database
    const { error: updateError } = await supa.from("darts_matches")
        .update({
            players,
            current_player_index: nextStatus === "finished" ? pIndex : nextPlayerIndex,
            history: newHistory,
            status: nextStatus,
            winner_id: winnerId
        })
        .eq("id", params.matchId);

    if (updateError) {
        return NextResponse.json({ error: "Failed to update match" }, { status: 500 });
    }

    // 5. Si match gagné, update stats global
    if (nextStatus === "finished" && winnerId) {
        // En vrai: Insérer/Updater `darts_stats` pour chaque user discord (pas guest).
        for (const p of players) {
            if (!p.isGuest) {
                // Upsert les stats
                // Note : On pourrait le faire dans un script en "background" pour ne pas bloquer l'appel.
                const { data: existingStats } = await supa.from("darts_stats")
                    .select("*")
                    .eq("guild_id", match.guild_id)
                    .eq("user_id", p.id)
                    .single();

                if (existingStats) {
                    await supa.from("darts_stats").update({
                        matches_played: existingStats.matches_played + 1,
                        matches_won: existingStats.matches_won + (p.id === winnerId ? 1 : 0),
                        darts_thrown: existingStats.darts_thrown + p.stats.dartsThrown,
                        total_score: existingStats.total_score + p.stats.totalScore,
                        highest_checkout: Math.max(existingStats.highest_checkout, p.stats.highestCheckout),
                        count_180s: existingStats.count_180s + p.stats.count180,
                        count_140s: existingStats.count_140s + p.stats.count140,
                        count_100s: existingStats.count_100s + p.stats.count100,
                        cricket_marks: (existingStats.cricket_marks || 0) + (p.stats.cricketMarks || 0),
                        misses: (existingStats.misses || 0) + (p.stats.misses || 0),
                    }).eq("user_id", p.id).eq("guild_id", match.guild_id);
                } else {
                    await supa.from("darts_stats").insert([{
                        user_id: p.id,
                        guild_id: match.guild_id,
                        matches_played: 1,
                        matches_won: (p.id === winnerId ? 1 : 0),
                        darts_thrown: p.stats.dartsThrown,
                        total_score: p.stats.totalScore,
                        highest_checkout: p.stats.highestCheckout,
                        count_180s: p.stats.count180,
                        count_140s: p.stats.count140,
                        count_100s: p.stats.count100,
                        cricket_marks: p.stats.cricketMarks || 0,
                        misses: p.stats.misses || 0
                    }]);
                }
            }
        }
    }

    return NextResponse.json({
        success: true,
        isBust: bust,
        roundWon,
        matchWon: nextStatus === "finished",
        newScore: newScore
    });
}
