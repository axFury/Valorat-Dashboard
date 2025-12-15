export async function fetchUserGuilds(userAccessToken: string) {
  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${userAccessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("discord guilds fetch failed");
  return (await res.json()) as Array<{ id: string; name: string; permissions: string; owner: boolean }>;
}

export function hasGuild(guilds: Array<{id: string}>, guildId: string) {
  return guilds.some(g => g.id === guildId);
}

// utils permission (si tu veux différencier actions d’admin plus tard)
export function permsHas(permStr: string, bit: bigint) {
  try {
    const n = BigInt(permStr);
    return (n & bit) === bit;
  } catch { return false; }
}
export const PERM_ADMIN      = 0x00000008n; // ADMINISTRATOR
export const PERM_MANAGE_GUILD = 0x00000020n; // MANAGE_GUILD
