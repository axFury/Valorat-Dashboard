import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PlayerState } from "@/lib/darts-engine";

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

export async function POST(req: NextRequest, props: { params: Promise<{ matchId: string }> | { matchId: string } }) {
    const params = await props.params;
    const user = await getDiscordUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const supa = getSupa();

    // 1. Get current match
    const { data: match, error: fetchError } = await supa
        .from("darts_matches")
        .select("*")
        .eq("id", params.matchId)
        .single();

    if (fetchError || !match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
    if (match.status !== "setup") return NextResponse.json({ error: "Match already started" }, { status: 400 });

    const players: PlayerState[] = match.players;

    // Check if player already joined
    if (players.find(p => p.id === user.id)) {
        return NextResponse.json({ success: true, message: "Already in match" });
    }

    // Add new player
    const isCricket = match.game_type === "cricket";
    const startingScore = parseInt(match.game_type);
    const actualStartingScore = isNaN(startingScore) || isCricket ? 0 : startingScore;

    const newPlayer: PlayerState = {
        id: user.id,
        name: user.username || "Joueur",
        avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined,
        scoreLeft: actualStartingScore,
        legsWon: 0,
        setsWon: 0,
        ...(isCricket ? {
            cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
            cricketPoints: 0
        } : {}),
        stats: {
            dartsThrown: 0,
            totalScore: 0,
            highestCheckout: 0,
            count180: 0,
            count140: 0,
            count100: 0,
            bestTurn: 0,
            misses: 0,
            cricketMarks: 0
        },
        isGuest: false
    };

    const newPlayers = [...players, newPlayer];

    const { error: updateError } = await supa
        .from("darts_matches")
        .update({ players: newPlayers })
        .eq("id", params.matchId);

    if (updateError) {
        return NextResponse.json({ error: "Failed to join match" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
