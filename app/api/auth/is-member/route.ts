import { NextRequest, NextResponse } from "next/server";
import { fetchUserGuilds } from "@/lib/discord";

export async function GET(req: NextRequest) {
  try {
    const guildId = req.nextUrl.searchParams.get("guildId");
    if (!guildId) return NextResponse.json({ ok: false, error: "missing_guildId" }, { status: 400 });

    // Récupère le token utilisateur depuis un cookie sécurisé posé à l’auth
    const token = req.cookies.get("dc_token")?.value;
    if (!token) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

    const guilds = await fetchUserGuilds(token);
    const g = guilds.find(g => g.id === guildId);
    if (!g) return NextResponse.json({ ok: true, isMember: false });

    return NextResponse.json({
      ok: true,
      isMember: true,
      permissions: g.permissions, // string bitfield du user dans cette guilde
      owner: g.owner,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "check_failed" }, { status: 500 });
  }
}
