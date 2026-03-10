import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PlayerState, MatchRules, MatchState } from "@/lib/darts-engine";

export const dynamic = "force-dynamic";

function getSupa() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
}

export async function GET(req: NextRequest, { params }: { params: { matchId: string } }) {
    const supa = getSupa();
    const { data: match, error } = await supa
        .from("darts_matches")
        .select("*")
        .eq("id", params.matchId)
        .single();

    if (error || !match) {
        return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    return NextResponse.json(match);
}
