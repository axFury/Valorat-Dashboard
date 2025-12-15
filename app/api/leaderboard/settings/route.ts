import { NextResponse } from "next/server"
import { delay } from "@/lib/mock-data"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    await delay(1500)

    return NextResponse.json({ success: true, settings: body })
  } catch (error) {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
