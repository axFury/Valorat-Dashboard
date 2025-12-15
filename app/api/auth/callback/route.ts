import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  console.log("[v0] Auth callback called")

  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")

  console.log("[v0] Auth code:", code ? "received" : "missing")

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url))
  }

  try {
    console.log("[v0] Exchanging code for token...")
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
    })

    const tokens = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error("[v0] Discord token error:", tokens)
      return NextResponse.redirect(new URL("/?error=token_failed", request.url))
    }

    console.log("[v0] Token received, expires in:", tokens.expires_in)

    const response = NextResponse.redirect(new URL("/servers", request.url))
    response.cookies.set("discord_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokens.expires_in,
      path: "/",
    })

    console.log("[v0] Cookie set, redirecting to /servers")
    return response
  } catch (error) {
    console.error("[v0] OAuth error:", error)
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url))
  }
}
