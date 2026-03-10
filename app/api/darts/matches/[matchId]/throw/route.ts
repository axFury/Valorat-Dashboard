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
    const { playerId, totalScore, isCheckout } = body;
    // Pour l'interface mobile, on envoie souvent le total du "Tour" (ex: 100, 140, 180) plutôt que fléchette par fléchette.
    // L'argument `isCheckout` indique si le jouer a fini par un double/master validé par l'UI.

    if (totalScore === undefined || !playerId) {
        return NextResponse.json({ error: "Missing score info" }, { status: 400 });
    }

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
    let newScore = currentPlayer.scoreLeft - totalScore;
    let bust = false;
    let roundWon = false;

    // 2. Vérifier les règles de Bust (Si l'option OutRule s'applique)
    // Comme c'est un score global (tour), si le score restant est <0, ou =1 avec Double Out, c'est bust.
    if (newScore < 0) bust = true;
    if (rules.outRule === 'double') {
        if (newScore === 1) bust = true;
        if (newScore === 0 && !isCheckout) bust = true; // S'il arrive à 0 mais qu'il n'a pas coché "Checkout", bust
    } else if (rules.outRule === 'master') {
        if (newScore === 1) bust = true;
        if (newScore === 0 && !isCheckout) bust = true;
    }

    // Si c'est un Bust
    let finalScoreThisTurn = totalScore;
    if (bust) {
        newScore = currentPlayer.scoreLeft; // On remet le score précédent
        finalScoreThisTurn = 0; // Il a marqué 0 validé
    }

    // Mettre à jour les stats du joueur
    currentPlayer.stats.dartsThrown += 3; // On assume 3 fléchettes par tour pour un tour "normal". A rafiner pour checkout.
    if (!bust) currentPlayer.stats.totalScore += finalScoreThisTurn;
    if (finalScoreThisTurn === 180) currentPlayer.stats.count180++;
    else if (finalScoreThisTurn >= 140) currentPlayer.stats.count140++;
    else if (finalScoreThisTurn >= 100) currentPlayer.stats.count100++;

    if (finalScoreThisTurn > currentPlayer.stats.bestTurn) {
        currentPlayer.stats.bestTurn = finalScoreThisTurn;
    }

    currentPlayer.scoreLeft = newScore;

    // 3. Vérifier la Condition de Victoire de Leg
    if (newScore === 0 && !bust) {
        roundWon = true;
        currentPlayer.legsWon += 1;
        if (finalScoreThisTurn > currentPlayer.stats.highestCheckout) {
            currentPlayer.stats.highestCheckout = finalScoreThisTurn;
        }
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
            // Reset du leg: Tous les joueurs reprennent à 501 / 301.
            const baseScore = parseInt(match.game_type);
            players = players.map(p => ({ ...p, scoreLeft: baseScore }));

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
