import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest, { params }: { params: { guildId: string } }) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("discord_access_token")?.value

    if (!accessToken) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const guildId = params.guildId

    console.log("[v0] Fetching members for guild:", guildId)

    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
    })

    if (!response.ok) {
      console.error("[v0] Discord API error:", response.status, response.statusText)
      return NextResponse.json({ error: "Erreur Discord API" }, { status: response.status })
    }

    const members = await response.json()
    console.log("[v0] Fetched members:", members.length)

    return NextResponse.json(members)
  } catch (error) {
    console.error("[v0] Error fetching members:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
