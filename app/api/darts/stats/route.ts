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

export async function GET(req: NextRequest) {
    const user = await getDiscordUser(req);
    const userId = req.nextUrl.searchParams.get("userId") || user?.id;
    const guildId = req.nextUrl.searchParams.get("guildId");
    if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 });

    const supa = getSupa();

    // Fetch stats for the target user (or current user)
    const { data: stats, error } = await supa
        .from("darts_stats")
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", userId)
        .single();

    // If no stats yet, return default empty stats
    if (error && error.code === 'PGRST116') {
        return NextResponse.json({
            user_id: userId,
            guild_id: guildId,
            user_name: user?.username || 'Joueur',
            matches_played: 0,
            matches_won: 0,
            darts_thrown: 0,
            total_score: 0,
            highest_checkout: 0,
            count_180s: 0,
            count_140s: 0,
            count_100s: 0
        });
    }

    if (error) {
        console.error("Error fetching darts stats:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json(stats);
}
