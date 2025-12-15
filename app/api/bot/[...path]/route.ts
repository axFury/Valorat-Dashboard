import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"     // pas de cache
export const runtime = "nodejs"            // côté serveur

const BASE = (process.env.BACKEND_URL || "").replace(/\/$/, "") // ex: http://IP:3001/api
const API_KEY = process.env.BOT_API_KEY || ""

// Relai générique
async function relay(req: NextRequest, path: string[]) {
  if (!BASE) return new Response(JSON.stringify({ error: "BACKEND_URL missing" }), { status: 500 })

  // reconstruit l’URL cible (garde la query string)
  const qs = req.nextUrl.search
  const target = `${BASE}/${path.join("/")}${qs}`

  // lis le body tel quel (important pour éviter toute altération)
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text()

  // récupère/relaye l’ID de guilde si présent
  const guildId = req.headers.get("x-guild-id") || req.headers.get("X-Guild-Id") || undefined

  const res = await fetch(target, {
    method: req.method,
    headers: {
      "content-type": req.headers.get("content-type") || "application/json",
      "authorization": `Bearer ${API_KEY}`,       // clé pour ton back /api
      ...(guildId ? { "X-Guild-ID": guildId } : {}),
    },
    body,
    cache: "no-store",
  })

  // relais brut (texte) + content-type d’origine
  const txt = await res.text()
  return new Response(txt, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  })
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } })  { return relay(req, ctx.params.path) }
export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) { return relay(req, ctx.params.path) }
export async function PUT(req: NextRequest, ctx: { params: { path: string[] } })  { return relay(req, ctx.params.path) }
export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) { return relay(req, ctx.params.path) }
export async function OPTIONS() { return new Response(null, { status: 204 }) }
