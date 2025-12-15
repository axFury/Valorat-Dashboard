import { NextResponse } from "next/server"
import { delay } from "@/lib/mock-data"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    await delay(1500)

    return NextResponse.json({ success: true, deleted: body.count || 50 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to purge" }, { status: 500 })
  }
}
