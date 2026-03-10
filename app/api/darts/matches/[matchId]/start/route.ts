import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    // Only creator can start
    if (match.creator_id !== user.id) {
        return NextResponse.json({ error: "Only the creator can start the match" }, { status: 403 });
    }

    if (match.status !== "setup") {
        return NextResponse.json({ error: "Match already started" }, { status: 400 });
    }

    if (match.players.length < 1) {
        return NextResponse.json({ error: "Need at least 1 player to start" }, { status: 400 });
    }

    // Start match
    const { error: updateError } = await supa
        .from("darts_matches")
        .update({ status: "playing" })
        .eq("id", params.matchId);

    if (updateError) {
        return NextResponse.json({ error: "Failed to start match" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
