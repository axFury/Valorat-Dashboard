import { NextRequest, NextResponse } from "next/server"

type UserGuild = { id: string; name: string; icon: string | null; owner: boolean; permissions: string }

export async function GET(req: NextRequest) {
  try {
    const userToken =
      req.cookies.get("dc_token")?.value ||
      req.cookies.get("discord_token")?.value

    if (!userToken) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
    }

    // 1) guilds de l’utilisateur
    const u = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${userToken}` },
      cache: "no-store",
    })
    if (!u.ok) {
      const err = await u.json().catch(() => ({}))
      return NextResponse.json({ error: "guilds_fetch_failed", detail: err }, { status: 502 })
    }
    const userGuilds = (await u.json()) as UserGuild[]

    // 2) guilds où le bot est présent (backend bot)
    // essaie BACKEND_URL puis NEXT_PUBLIC_BACKEND_URL
    const base =
      process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL
    let botGuildIds: string[] = []
    if (base && process.env.BOT_API_KEY) {
      try {
        const b = await fetch(`${base.replace(/\/+$/, "")}/api/bot/guilds`, {
          headers: { "x-api-key": process.env.BOT_API_KEY },
          cache: "no-store",
        })
        if (b.ok) {
          const data = await b.json().catch(() => ({}))
          // accepte { guilds: [{id,...}]} ou un simple tableau
          const arr = Array.isArray(data) ? data : (Array.isArray(data?.guilds) ? data.guilds : [])
          botGuildIds = arr.map((g: any) => String(g?.id ?? g)).filter(Boolean)
        }
      } catch {}
    }

    // 3) intersection (si on connaît les guilds du bot)
    const final = botGuildIds.length
      ? userGuilds.filter(g => botGuildIds.includes(g.id))
      : userGuilds // fallback: montrer les guilds user même si backend indispo

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
    return NextResponse.json({ error: "unexpected" }, { status: 500 })
  }
}
