import { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!,
  { auth: { persistSession: false } }
)

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { guildId, action, payload } = await req.json()
    if (!guildId || !action) {
      return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400 })
    }
    const { data, error } = await supa
      .from("command_queue")
      .insert({ guild_id: String(guildId), action: String(action), payload: payload ?? null })
      .select()
      .single()

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    return new Response(JSON.stringify({ id: data.id }), { status: 200 })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return new Response(JSON.stringify({ error: "missing_id" }), { status: 400 })

    const { data, error } = await supa
      .from("command_queue")
      .select("*")
      .eq("id", id)
      .single()

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    return new Response(JSON.stringify(data), { status: 200 })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}
