import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string; userId: string }> }) {
  try {
    const { guildId, userId } = await params
    const token = process.env.DISCORD_BOT_TOKEN

    if (!token) {
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 })
    }

    // Fetch member info from Discord API
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      headers: {
        Authorization: `Bot ${token}`,
      },
    })

    if (!response.ok) {
      console.error("[v0] Failed to fetch member:", response.status, response.statusText)
      return NextResponse.json({ error: "Failed to fetch member" }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error fetching guild member:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
