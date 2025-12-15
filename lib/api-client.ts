export class APIClient {
  private baseUrl: string
  private guildId: string | null = null
  private apiKey: string

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || ""
    this.apiKey = process.env.BOT_API_KEY || ""
    if (typeof window !== "undefined") {
      this.guildId = localStorage.getItem("selected_guild")
    }
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      ...options?.headers,
    }

    // Add x-guild-id if available
    if (this.guildId) {
      headers["x-guild-id"] = this.guildId
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(error.error || `API Error: ${response.statusText}`)
    }

    return response.json()
  }

  async getBotStatus() {
    return this.request<{
      status: string
      latency: number
      uptime: string
      guilds: number
      version: string
    }>(`/api/bot/bot/status`)
  }

  async getBotGuilds() {
    return this.request<Array<{ id: string; name: string }>>(`/api/bot/guilds`)
  }

  // Moderation APIs - /api/moderation/*
  async getModerationLogs() {
    return this.request<
      Array<{ id: string; date: string; author: string; action: string; details: string; channel: string }>
    >(`/api/moderation/logs`)
  }

  async purgeMessages(channelId: string, amount: number, mode = "count") {
    return this.request<{ ok: boolean; deleted?: number }>(`/api/moderation/purge`, {
      method: "POST",
      body: JSON.stringify({ channelId, amount, mode }),
    })
  }

  async setSlowmode(channelId: string, duration: number) {
    return this.request<{ ok: boolean }>(`/api/moderation/slowmode`, {
      method: "POST",
      body: JSON.stringify({ channelId, duration }),
    })
  }

  async lockChannel(channelId: string) {
    return this.request<{ ok: boolean }>(`/api/moderation/lock`, {
      method: "POST",
      body: JSON.stringify({ channelId }),
    })
  }

  async unlockChannel(channelId: string) {
    return this.request<{ ok: boolean }>(`/api/moderation/unlock`, {
      method: "POST",
      body: JSON.stringify({ channelId }),
    })
  }

  // Music APIs - /api/music/*
  async playMusic(query: string, voiceChannelId: string) {
    return this.request<{ ok: boolean; reason?: string }>(`/api/music/play`, {
      method: "POST",
      body: JSON.stringify({ query, voiceChannelId }),
    })
  }

  async pauseMusic() {
    return this.request<{ ok: boolean; reason?: string }>(`/api/music/pause`, {
      method: "POST",
      body: JSON.stringify({}),
    })
  }

  async resumeMusic() {
    return this.request<{ ok: boolean; reason?: string }>(`/api/music/resume`, {
      method: "POST",
      body: JSON.stringify({}),
    })
  }

  async skipMusic() {
    return this.request<{ ok: boolean; reason?: string }>(`/api/music/skip`, {
      method: "POST",
      body: JSON.stringify({}),
    })
  }

  async stopMusic() {
    return this.request<{ ok: boolean; reason?: string }>(`/api/music/stop`, {
      method: "POST",
      body: JSON.stringify({}),
    })
  }

  async getQueue() {
    return this.request<Array<{ id: string; title: string; artist: string; duration: string; thumbnail: string }>>(
      `/api/music/queue`,
    )
  }

  async reorderQueue(oldIndex: number, newIndex: number) {
    return this.request<{ ok: boolean }>(`/api/music/queue/reorder`, {
      method: "POST",
      body: JSON.stringify({ oldIndex, newIndex }),
    })
  }

  // Leaderboard APIs - /api/leaderboards
  async getLeaderboards() {
    return this.request<{
      messages: Array<{ rank: number; user: string; total: number }>
      voice: Array<{ rank: number; user: string; hours: string }>
    }>(`/api/leaderboards`)
  }

  async scheduleLeaderboard(channelId: string, type: string, schedule: string) {
    return this.request<{ ok: boolean; scheduleId: string }>(`/api/leaderboards/schedule`, {
      method: "POST",
      body: JSON.stringify({ channelId, type, schedule }),
    })
  }

  async deleteSchedule(scheduleId: string) {
    return this.request<{ ok: boolean }>(`/api/leaderboards/schedule/${scheduleId}`, {
      method: "DELETE",
    })
  }

  // Ping & GIFs APIs - /api/ping/* and /api/gifs
  async getPingMessage() {
    return this.request<{ message: string }>(`/api/ping/message`)
  }

  async updatePingMessage(message: string) {
    return this.request<{ ok: boolean }>(`/api/ping/message`, {
      method: "PUT",
      body: JSON.stringify({ message }),
    })
  }

  async getGifs() {
    return this.request<Array<{ id: string; url: string; tag: string; addedBy: string; date: string }>>(`/api/gifs`)
  }

  async addGif(url: string, tag?: string) {
    return this.request<{ ok: boolean }>(`/api/gifs`, {
      method: "POST",
      body: JSON.stringify({ url, tag }),
    })
  }

  async deleteGif(gifId: string) {
    return this.request<{ ok: boolean }>(`/api/gifs/${gifId}`, {
      method: "DELETE",
    })
  }

  // Announcements APIs - /api/announcements
  async createAnnouncement(data: { channelId: string; message?: string; embed?: any; mention?: string }) {
    return this.request<{ ok: boolean }>(`/api/announcements`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async scheduleAnnouncement(data: any) {
    return this.request<{ ok: boolean; scheduleId: string }>(`/api/announcements/schedule`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  // Valorant APIs - /api/valorant/*
  async getValorantLinks() {
    return this.request<
      Array<{
        discordId: string
        discordUsername: string
        riotId: string
        rank: string
        rr: number
        lastUpdate: string
      }>
    >(`/api/valorant/links`)
  }

  async linkValorantAccount(discordId: string, riotId: string) {
    return this.request<{ ok: boolean }>(`/api/valorant/link`, {
      method: "POST",
      body: JSON.stringify({ discordId, riotId }),
    })
  }

  async unlinkValorantAccount(discordId: string) {
    return this.request<{ ok: boolean }>(`/api/valorant/unlink/${discordId}`, {
      method: "DELETE",
    })
  }

  async updateValorantTracking(enabled: boolean) {
    return this.request<{ ok: boolean }>(`/api/valorant/tracking`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    })
  }

  // Settings APIs - /api/settings
  async getSettings() {
    return this.request<{
      guildName: string
      prefix: string
      language: string
      timezone: string
      features: { moderation: boolean; music: boolean; leaderboards: boolean; valorant: boolean }
    }>(`/api/settings`)
  }

  async updateSettings(settings: any) {
    return this.request<{ ok: boolean }>(`/api/settings`, {
      method: "PUT",
      body: JSON.stringify(settings),
    })
  }

  async getAuditLog() {
    return this.request<Array<{ action: string; user: string; date: string }>>(`/api/settings/audit`)
  }
}

export const apiClient = new APIClient()
