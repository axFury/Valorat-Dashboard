import { NextResponse } from "next/server"
import { delay } from "@/lib/mock-data"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    await delay(1500)

    return NextResponse.json({ success: true, messageId: "123456789" })
  } catch (error) {
    return NextResponse.json({ error: "Failed to send announcement" }, { status: 500 })
  }
}
