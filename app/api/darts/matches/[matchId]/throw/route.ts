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

    const first9Points = body.isFirst9 ? totalScore : 0;
    const checkoutAttempt = body.checkoutAttempt || false;

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
                    if (rules.cricketMode === "cut_throat") {
                        // Donne les points aux adversaires qui n'ont pas fermé
                        for (const p of players) {
                            if (p.id !== playerId && (p.cricketMarks?.[target] || 0) < 3) {
                                p.cricketPoints = (p.cricketPoints || 0) + pointsScored;
                            }
                        }
                    } else {
                        // Normal : on se donne les points
                        currentPlayer.cricketPoints += pointsScored;
                    }
                    finalScoreThisTurn += pointsScored; // Pour les stats globales (Ttjrs compté même si donné à l'autre)
                }
            } else {
                currentPlayer.cricketMarks[target] = newMarks;
            }
        }

        // Victoire Cricket
        const allTargetsClosed = CRICKET_TARGETS.every(t => (currentPlayer.cricketMarks![t] || 0) === 3);

        if (allTargetsClosed) {
            let win = true;
            for (const p of players) {
                if (p.id !== playerId) {
                    if (rules.cricketMode === "cut_throat") {
                        // Pour gagner en cut_throat, on doit avoir un score INFERIEUR ou EGAL aux autres
                        if (currentPlayer.cricketPoints! > (p.cricketPoints || 0)) {
                            win = false;
                        }
                    } else {
                        // Normal : on doit avoir un score SUPERIEUR ou EGAL aux autres
                        if (currentPlayer.cricketPoints! < (p.cricketPoints || 0)) {
                            win = false;
                        }
                    }
                }
            }
            if (win) roundWon = true;
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
        // Calcul des objectifs (Target)
        let targetLegs = rules.legsToWin;
        let targetSets = rules.setsToWin;
        if (rules.matchFormat === 'best_of') {
            targetLegs = Math.ceil(rules.legsToWin / 2);
            targetSets = Math.ceil(rules.setsToWin / 2);
        }

        if (currentPlayer.legsWon >= targetLegs) {
            // Le joueur gagne le Set !
            currentPlayer.setsWon += 1;

            if (currentPlayer.setsWon >= targetSets) {
                // Le joueur gagne le Match !
                nextStatus = "finished";
                winnerId = currentPlayer.id;
            } else {
                // Reset de tous les joueurs pour le prochain Set (On repart à 0 legs)
                players = players.map(p => ({
                    ...p,
                    legsWon: 0,
                    scoreLeft: isNaN(parseInt(match.game_type)) ? 0 : parseInt(match.game_type),
                    ...(match.game_type === "cricket" ? {
                        cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
                        cricketPoints: 0
                    } : {})
                }));
            }
        } else {
            // Reset du leg (Set toujours en cours)
            const baseScore = parseInt(match.game_type);
            players = players.map(p => ({
                ...p,
                scoreLeft: isNaN(baseScore) ? 0 : baseScore,
                ...(match.game_type === "cricket" ? {
                    cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
                    cricketPoints: 0
                } : {})
            }));

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
        console.error("Failed to update match:", updateError);
        return NextResponse.json({ error: "Failed to update match" }, { status: 500 });
    }

    // 5. Si match gagné, update stats global
    if (nextStatus === "finished" && winnerId) {
        for (const p of players) {
            if (!p.isGuest) {
                // Fetch current stats to calculate new values
                const { data: current } = await supa.from("darts_stats")
                    .select("*")
                    .eq("guild_id", match.guild_id)
                    .eq("user_id", p.id)
                    .single();

                const isWinner = p.id === winnerId;
                const adv = current?.advanced_stats || {};

                // Track score distribution
                const dist = adv.score_distribution || { "40": 0, "60": 0, "80": 0, "100": 0, "120": 0, "140": 0, "160": 0, "180": 0 };
                if (p.stats.totalScore >= 180) dist["180"]++;
                else if (p.stats.totalScore >= 160) dist["160"]++;
                else if (p.stats.totalScore >= 140) dist["140"]++;
                else if (p.stats.totalScore >= 120) dist["120"]++;
                else if (p.stats.totalScore >= 100) dist["100"]++;
                else if (p.stats.totalScore >= 80) dist["80"]++;
                else if (p.stats.totalScore >= 60) dist["60"]++;
                else if (p.stats.totalScore >= 40) dist["40"]++;

                // Track First 9 (this needs to be sent by client or tracked in match state)
                // For now we'll assume the client sends first9Score if it's within first 9 darts of leg
                const f9Score = (adv.first_9_total_score || 0) + (body.first9Score || 0);
                const f9Darts = (adv.first_9_darts || 0) + (body.first9Score !== undefined ? 3 : 0);

                // Track Checkout %
                const coAttempts = (adv.checkout_attempts || 0) + (body.checkoutAttempt ? 1 : 0);
                const coMade = (adv.checkouts_made || 0) + (roundWon && p.id === playerId ? 1 : 0);

                // Leg stats
                const lastLegDarts = p.stats.dartsThrown; // This is reset when leg ends? No, need to track per leg
                const bestLeg = adv.best_leg ? Math.min(adv.best_leg, lastLegDarts) : lastLegDarts;
                const worstLeg = adv.worst_leg ? Math.max(adv.worst_leg, lastLegDarts) : lastLegDarts;

                const statsToUpsert = {
                    user_id: p.id,
                    guild_id: match.guild_id,
                    user_name: p.name,
                    matches_played: (current?.matches_played || 0) + 1,
                    matches_won: (current?.matches_won || 0) + (isWinner ? 1 : 0),
                    darts_thrown: (current?.darts_thrown || 0) + p.stats.dartsThrown,
                    total_score: (current?.total_score || 0) + p.stats.totalScore,
                    highest_checkout: Math.max((current?.highest_checkout || 0), p.stats.highestCheckout),
                    count_180s: (current?.count_180s || 0) + p.stats.count180,
                    count_140s: (current?.count_140s || 0) + p.stats.count140,
                    count_100s: (current?.count_100s || 0) + p.stats.count100,
                    cricket_marks: (current?.cricket_marks || 0) + (p.stats.cricketMarks || 0),
                    misses: (current?.misses || 0) + (p.stats.misses || 0),
                    advanced_stats: {
                        ...adv,
                        score_distribution: dist,
                        first_9_total_score: f9Score,
                        first_9_darts: f9Darts,
                        checkout_attempts: coAttempts,
                        checkouts_made: coMade,
                        best_leg: bestLeg,
                        worst_leg: worstLeg,
                        highest_start_score: Math.max(adv.highest_start_score || 0, body.isFirstTurn ? totalScore : 0)
                    },
                    history: [
                        ...(current?.history || []),
                        {
                            match_id: match.id,
                            date: new Date().toISOString(),
                            avg: parseFloat(((p.stats.totalScore / p.stats.dartsThrown) * 3).toFixed(1)),
                            checkout_pct: coAttempts > 0 ? Math.round((coMade / coAttempts) * 100) : 0,
                            game_type: match.game_type
                        }
                    ].slice(-20), // Keep last 20 matches for charts
                    updated_at: new Date().toISOString()
                };

                const { error: upsertError } = await supa.from("darts_stats")
                    .upsert(statsToUpsert, { onConflict: "user_id,guild_id" });

                if (upsertError) {
                    console.error(`Failed to upsert stats for user ${p.id}:`, upsertError);
                } else {
                    console.log(`Successfully updated stats for user ${p.id} (${p.name})`);
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
