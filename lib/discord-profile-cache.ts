import { createBrowserClient } from "@supabase/ssr"

type DiscordProfile = {
  username: string
  avatar: string
}

// Cache in memory for the session
const sessionCache = new Map<string, DiscordProfile>()

export async function getDiscordProfile(userId: string, guildId: string): Promise<DiscordProfile> {
  // Check session cache first
  if (sessionCache.has(userId)) {
    console.log("[v0] Profile from session cache:", userId)
    return sessionCache.get(userId)!
  }

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  try {
    // Check Supabase profiles table
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("discord_username, discord_avatar")
      .eq("discord_id", userId)
      .single()

    if (!error && profile?.discord_username) {
      console.log("[v0] Profile from Supabase:", userId)
      const cachedProfile: DiscordProfile = {
        username: profile.discord_username,
        avatar: profile.discord_avatar || `https://cdn.discordapp.com/embed/avatars/${Number.parseInt(userId) % 5}.png`,
      }
      sessionCache.set(userId, cachedProfile)
      return cachedProfile
    }
  } catch (err) {
    console.error("[v0] Error checking Supabase profile:", err)
  }

  // If not in cache, fetch from Discord API
  console.log("[v0] Fetching profile from Discord API:", userId)
  try {
    const response = await fetch(`/api/guilds/${guildId}/members/${userId}`)
    if (!response.ok) throw new Error("Failed to fetch user")

    const data = await response.json()
    const username = data.user?.username || data.nick || "Utilisateur inconnu"
    const avatar = data.user?.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${data.user.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${Number.parseInt(userId) % 5}.png`

    const newProfile: DiscordProfile = { username, avatar }

    // Store in Supabase for future use
    await supabase.from("profiles").upsert(
      {
        discord_id: userId,
        discord_username: username,
        discord_avatar: avatar,
      },
      { onConflict: "discord_id" },
    )

    // Store in session cache
    sessionCache.set(userId, newProfile)

    return newProfile
  } catch (error) {
    console.error("[v0] Error fetching Discord user:", userId, error)
    return {
      username: "Utilisateur inconnu",
      avatar: `https://cdn.discordapp.com/embed/avatars/0.png`,
    }
  }
}

// Batch fetch multiple profiles at once
export async function getDiscordProfiles(userIds: string[], guildId: string): Promise<Map<string, DiscordProfile>> {
  const results = new Map<string, DiscordProfile>()
  const uncachedIds: string[] = []

  // Check session cache first
  for (const userId of userIds) {
    if (sessionCache.has(userId)) {
      results.set(userId, sessionCache.get(userId)!)
    } else {
      uncachedIds.push(userId)
    }
  }

  if (uncachedIds.length === 0) {
    console.log("[v0] All profiles from session cache")
    return results
  }

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  try {
    // Fetch from Supabase
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("discord_id, discord_username, discord_avatar")
      .in("discord_id", uncachedIds)

    const stillUncached: string[] = []

    if (!error && profiles) {
      console.log("[v0] Found profiles in Supabase:", profiles.length)
      for (const profile of profiles) {
        if (profile.discord_username) {
          const cachedProfile: DiscordProfile = {
            username: profile.discord_username,
            avatar:
              profile.discord_avatar ||
              `https://cdn.discordapp.com/embed/avatars/${Number.parseInt(profile.discord_id) % 5}.png`,
          }
          results.set(profile.discord_id, cachedProfile)
          sessionCache.set(profile.discord_id, cachedProfile)
        }
      }

      // Find which IDs are still not cached
      for (const userId of uncachedIds) {
        if (!results.has(userId)) {
          stillUncached.push(userId)
        }
      }
    } else {
      stillUncached.push(...uncachedIds)
    }

    // Fetch remaining from Discord API (in parallel)
    if (stillUncached.length > 0) {
      console.log("[v0] Fetching from Discord API:", stillUncached.length, "profiles")
      const fetchPromises = stillUncached.map((userId) => getDiscordProfile(userId, guildId))
      const fetchedProfiles = await Promise.all(fetchPromises)

      stillUncached.forEach((userId, index) => {
        results.set(userId, fetchedProfiles[index])
      })
    }
  } catch (error) {
    console.error("[v0] Error in batch profile fetch:", error)
  }

  return results
}
