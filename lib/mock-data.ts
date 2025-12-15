// Mock data utilities
export const delay = (ms = 1000) => new Promise((resolve) => setTimeout(resolve, ms))

export const mockGuilds = [
  { id: "1", name: "Serveur Principal", icon: "/server-icon.png", memberCount: 1234 },
  { id: "2", name: "Communauté FR", icon: "/community-icon.png", memberCount: 567 },
  { id: "3", name: "Gaming Squad", icon: "/generic-gaming-icon.png", memberCount: 890 },
]

export const mockChannels = [
  { id: "ch1", name: "général", type: "text" },
  { id: "ch2", name: "annonces", type: "text" },
  { id: "ch3", name: "vocal-général", type: "voice" },
  { id: "ch4", name: "musique", type: "voice" },
  { id: "ch5", name: "leaderboards", type: "text" },
]

export const mockUsers = [
  { id: "u1", username: "Player1", discriminator: "0001", avatar: "/diverse-group-avatars.png" },
  { id: "u2", username: "GamerPro", discriminator: "0002", avatar: "/pandora-ocean-scene.png" },
  { id: "u3", username: "DiscordFan", discriminator: "0003", avatar: "/diverse-group-futuristic-setting.png" },
]

export const mockModerationLogs = [
  {
    id: "1",
    action: "purge",
    channel: "général",
    author: "Admin#0001",
    date: "2025-01-10 14:30",
    details: "50 messages supprimés",
  },
  {
    id: "2",
    action: "slowmode",
    channel: "général",
    author: "Modo#0002",
    date: "2025-01-10 12:15",
    details: "30s de slowmode",
  },
  {
    id: "3",
    action: "lock",
    channel: "annonces",
    author: "Admin#0001",
    date: "2025-01-09 18:45",
    details: "Salon verrouillé",
  },
]

export const mockGifs = [
  {
    id: "1",
    url: "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif",
    tag: "celebration",
    addedBy: "Admin",
    date: "2025-01-05",
  },
  {
    id: "2",
    url: "https://media.giphy.com/media/g9582DNuQppxC/giphy.gif",
    tag: "happy",
    addedBy: "Modo",
    date: "2025-01-06",
  },
  {
    id: "3",
    url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
    tag: "dance",
    addedBy: "Admin",
    date: "2025-01-07",
  },
]

export const mockLeaderboardData = {
  messages: [
    { rank: 1, user: "Player1#0001", total: 1542 },
    { rank: 2, user: "GamerPro#0002", total: 1389 },
    { rank: 3, user: "DiscordFan#0003", total: 1201 },
    { rank: 4, user: "ChatMaster#0004", total: 987 },
    { rank: 5, user: "Moderator#0005", total: 856 },
  ],
  voice: [
    { rank: 1, user: "VocalKing#0001", hours: 42.5 },
    { rank: 2, user: "TalkMaster#0002", hours: 38.2 },
    { rank: 3, user: "VoiceHero#0003", hours: 35.8 },
    { rank: 4, user: "Chatter#0004", hours: 31.4 },
    { rank: 5, user: "Speaker#0005", hours: 28.9 },
  ],
}

export const mockValorantLinks = [
  {
    discordId: "u1",
    discordUsername: "Player1#0001",
    riotId: "Player1#TAG",
    rank: "Immortal 2",
    rr: 267,
    lastUpdate: "2025-01-10 15:30",
  },
  {
    discordId: "u2",
    discordUsername: "GamerPro#0002",
    riotId: "ProGamer#999",
    rank: "Diamond 3",
    rr: 189,
    lastUpdate: "2025-01-10 14:20",
  },
  {
    discordId: "u3",
    discordUsername: "DiscordFan#0003",
    riotId: "FanBoy#123",
    rank: "Platinum 1",
    rr: 56,
    lastUpdate: "2025-01-10 13:10",
  },
]
