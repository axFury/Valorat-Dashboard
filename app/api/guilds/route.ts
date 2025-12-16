import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

type UserGuild = { id: string; name: string; icon: string | null; owner: boolean; permissions: string }

export async function GET(req: NextRequest) {
  try {
    const userToken =
      req.cookies.get("dc_token")?.value ||
      req.cookies.get("discord_token")?.value

    if (!userToken) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
    }

    // 1) guilds de l'utilisateur
    const u = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${userToken}` },
      cache: "no-store",
    })
    if (!u.ok) {
      const err = await u.json().catch(() => ({}))
      return NextResponse.json({ error: "guilds_fetch_failed", detail: err }, { status: 502 })
    }
    const userGuilds = (await u.json()) as UserGuild[]

    // 2) guilds où le bot est présent (depuis Supabase)
    let botGuildIds: string[] = []
    try {
      const { data: botGuilds, error } = await supabaseServer
        .from("bot_guilds")
        .select("guild_id")

      if (!error && botGuilds) {
        botGuildIds = botGuilds.map((g) => g.guild_id)
      }
    } catch (e) {
      console.error("[guilds] Failed to fetch bot_guilds from Supabase:", e)
    }

    // 3) intersection (si on connaît les guilds du bot)
    const final = botGuildIds.length
      ? userGuilds.filter(g => botGuildIds.includes(g.id))
      : userGuilds // fallback: montrer les guilds user même si Supabase indispo

    // 4) renvoyer un format propre
    return NextResponse.json(
      final.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        owner: g.owner,
        permissions: g.permissions,
      }))
    )
  } catch (e) {
    console.error("[guilds] Unexpected error:", e)
    return NextResponse.json({ error: "unexpected" }, { status: 500 })
  }
}
