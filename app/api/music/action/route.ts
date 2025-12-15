import { NextResponse } from "next/server"
import { delay } from "@/lib/mock-data"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    await delay(1000)

    return NextResponse.json({ success: true, action: body.action })
  } catch (error) {
    return NextResponse.json({ error: "Music action failed" }, { status: 500 })
  }
}
