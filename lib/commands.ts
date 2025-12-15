export type CommandAction =
  | "play"
  | "pause"
  | "resume"
  | "skip"
  | "stop"
  | "announce"
  | "schedule_announce"
  | "purge"
  | "slowmode"
  | "lock"
  | "unlock"
  | "link_valorant"
  | "unlink_valorant"
  | "update_tracking"
  | "schedule_leaderboard"
  | "post_leaderboard"
  | "listTextChannels" // Added command to fetch text channels from backend

export async function sendCommand(action: CommandAction, payload?: any) {
  const guildId = typeof window !== "undefined" ? localStorage.getItem("selected_guild") : null
  if (!guildId) throw new Error("Aucune guilde sélectionnée")

  // 1) enqueue
  const r = await fetch("/api/cmd", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ guildId, action, payload }),
  })
  if (!r.ok) throw new Error("Enqueue échoué")
  const { id } = await r.json()
  if (!id) throw new Error("Enqueue sans id")

  // 2) poll (pending → processing → done|error)
  let status = "pending",
    result: any = null
  for (let i = 0; i < 30; i++) {
    // ~24s max
    const s = await fetch(`/api/cmd?id=${id}`).then((r) => r.json())
    status = s.status
    result = s.result
    if (status === "done" || status === "error") break
    await new Promise((res) => setTimeout(res, 800))
  }
  return { status, result }
}
