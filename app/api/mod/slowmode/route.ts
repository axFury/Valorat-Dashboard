import { NextResponse } from "next/server"
import { delay } from "@/lib/mock-data"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    await delay(1000)

    return NextResponse.json({ success: true, seconds: body.seconds })
  } catch (error) {
    return NextResponse.json({ error: "Failed to set slowmode" }, { status: 500 })
  }
}
