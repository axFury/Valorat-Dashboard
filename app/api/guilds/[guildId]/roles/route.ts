import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest, { params }: { params: { guildId: string } }) {
  try {
    const cookieStore = await cookies()
    const accessToken =
      cookieStore.get('dc_token')?.value ||
      cookieStore.get('discord_token')?.value

    if (!accessToken) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const guildId = params.guildId

    console.log("[v0] Fetching roles for guild:", guildId)

    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
    })

    if (!response.ok) {
      console.error("[v0] Discord API error:", response.status, response.statusText)
      return NextResponse.json({ error: "Erreur Discord API" }, { status: response.status })
    }

    const roles = await response.json()
    console.log("[v0] Fetched roles:", roles.length)

    return NextResponse.json(roles)
  } catch (error) {
    console.error("[v0] Error fetching roles:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
