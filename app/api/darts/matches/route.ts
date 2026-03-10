import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PlayerState, MatchRules } from "@/lib/darts-engine";

export const dynamic = "force-dynamic";

function getSupa() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
}

async function getDiscordUser(req: NextRequest) {
    const token = req.cookies.get("discord_token")?.value || req.cookies.get("dc_token")?.value;
    if (!token) return null;
    const res = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
}

export async function POST(req: NextRequest) {
    const user = await getDiscordUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const { guildId, mode, gameType, rules, players } = body;

    if (!guildId || !gameType || !rules || !players) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const startingScore = parseInt(gameType); // "501" -> 501, "301" -> 301
    const actualStartingScore = isNaN(startingScore) ? 0 : startingScore; // For Cricket it's 0 usually

    // Transform initial players into PlayerState
    const initialPlayers: PlayerState[] = players.map((p: any) => ({
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        scoreLeft: actualStartingScore,
        legsWon: 0,
        setsWon: 0,
        stats: {
            dartsThrown: 0,
            totalScore: 0,
            highestCheckout: 0,
            count180: 0,
            count140: 0,
            count100: 0,
            bestTurn: 0
        },
        isGuest: p.isGuest
    }));

    const supa = getSupa();

    // Insert new match
    const { data: matchData, error } = await supa.from("darts_matches").insert([{
        guild_id: guildId,
        creator_id: user.id,
        status: "playing",
        mode: mode || "local",
        game_type: gameType,
        rules: rules,
        players: initialPlayers,
        current_player_index: 0,
        history: []
    }]).select("id").single();

    if (error) {
        console.error("Erreur création match darts:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ success: true, matchId: matchData.id });
}
