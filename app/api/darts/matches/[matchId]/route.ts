import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PlayerState, MatchRules, MatchState } from "@/lib/darts-engine";

export const dynamic = "force-dynamic";

function getSupa() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
}

export async function GET(req: NextRequest, props: { params: Promise<{ matchId: string }> | { matchId: string } }) {
    const params = await props.params;
    const matchId = params.matchId;

    const supa = getSupa();
    const { data: match, error } = await supa
        .from("darts_matches")
        .select("*")
        .eq("id", matchId)
        .single();

    if (error || !match) {
        return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const matchFormatted = {
        id: match.id,
        guildId: match.guild_id,
        creatorId: match.creator_id,
        status: match.status,
        mode: match.mode,
        gameType: match.game_type,
        rules: match.rules,
        players: match.players,
        currentPlayerIndex: match.current_player_index,
        history: match.history,
        winnerId: match.winner_id,
        createdAt: match.created_at,
        updatedAt: match.updated_at
    };

    return NextResponse.json(matchFormatted);
}
