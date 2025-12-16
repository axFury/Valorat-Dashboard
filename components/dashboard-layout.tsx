"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Shield,
  Music,
  Trophy,
  ImageIcon,
  Megaphone,
  Target,
  Settings,
  ChevronDown,
  User,
  Menu,
  X,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Function to generate navigation with dynamic guildId
const getNavigation = (guildId?: string) => [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Modération", href: "/dashboard/moderation", icon: Shield }, // ← masquée si pas admin
  { name: "Musique", href: "/dashboard/music", icon: Music },
  { name: "Leaderboards", href: "/dashboard/leaderboards", icon: Trophy },
  { name: "Annonces", href: "/dashboard/announcements", icon: Megaphone },
  { name: "Valorant", href: "/dashboard/valorant", icon: Target },
  { name: "Paramètres", href: guildId ? `/dashboard/${guildId}/settings` : "/dashboard/settings", icon: Settings },
]

// Pages à restreindre aux admins/owners (ajoute ici si tu veux en masquer d’autres)
const RESTRICTED_NAMES = new Set<string>(["Modération", "Annonces", "Paramètres"])

function hasAdminOrManageGuild(permStr?: string) {
  try {
    if (!permStr) return false
    const p = BigInt(permStr)
    const ADMIN = 0x00000008n
    const MANAGE_GUILD = 0x00000020n
    return (p & ADMIN) === ADMIN || (p & MANAGE_GUILD) === MANAGE_GUILD
  } catch {
    return false
  }
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [selectedGuild, setSelectedGuild] = useState<any>(null)
  const [availableGuilds, setAvailableGuilds] = useState<any[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // état d’accès
  const [isMember, setIsMember] = useState<boolean>(false)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [accessLoading, setAccessLoading] = useState<boolean>(true)

  useEffect(() => {
    const loadGuilds = async () => {
      try {
        const response = await fetch("/api/guilds", { cache: "no-store" })
        if (!response.ok) return
        const guilds = await response.json()
        setAvailableGuilds(guilds)

        const storedGuildId = typeof window !== "undefined" ? localStorage.getItem("selected_guild") : null
        const guild = guilds.find((g: any) => g.id === storedGuildId) || guilds[0]
        if (guild) {
          setSelectedGuild(guild)
          if (!storedGuildId) localStorage.setItem("selected_guild", guild.id)
        }
      } catch (error) {
        console.error("[v0] Failed to load guilds:", error)
      }
    }

    loadGuilds()
  }, [])

  useEffect(() => {
    const checkAccess = async () => {
      if (!selectedGuild?.id) return
      setAccessLoading(true)
      try {
        // Appelle notre route is-member (voit aussi les permissions)
        const res = await fetch(`/api/auth/is-member?guildId=${selectedGuild.id}`, { cache: "no-store" })
        if (res.ok) {
          const data = await res.json()
          const member = !!data?.isMember
          const admin = !!data?.owner || hasAdminOrManageGuild(data?.permissions)
          setIsMember(member)
          setIsAdmin(admin)
        } else {
          // fallback léger : certaines implémentations de /api/guilds incluent permissions
          const admin = hasAdminOrManageGuild(selectedGuild?.permissions)
          setIsMember(true) // s’il est dans /api/guilds, c’est un membre
          setIsAdmin(admin)
        }
      } catch {
        const admin = hasAdminOrManageGuild(selectedGuild?.permissions)
        setIsMember(true)
        setIsAdmin(admin)
      } finally {
        setAccessLoading(false)
      }
    }

    checkAccess()
  }, [selectedGuild])

  const filteredNav = useMemo(() => {
    const navigation = getNavigation(selectedGuild?.id)
    // tant que l’accès n’est pas résolu, on évite le flash: on masque les pages restreintes
    if (accessLoading) {
      return navigation.filter((item) => !RESTRICTED_NAMES.has(item.name))
    }
    if (!isMember) {
      // pas membre → masque aussi les restreintes (et laisse les publiques si besoin)
      return navigation.filter((item) => !RESTRICTED_NAMES.has(item.name))
    }
    if (!isAdmin) {
      // membre mais pas admin → masque les restreintes
      return navigation.filter((item) => !RESTRICTED_NAMES.has(item.name))
    }
    // admin/owner → tout afficher
    return navigation
  }, [accessLoading, isMember, isAdmin, selectedGuild?.id])

  const handleGuildChange = (guild: any) => {
    setSelectedGuild(guild)
    localStorage.setItem("selected_guild", guild.id)
    // recharge pour refetch is-member/permissions
    window.location.reload()
  }

  const handleLogout = () => {
    // on nettoie les deux noms de cookie possibles
    document.cookie = "discord_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    document.cookie = "dc_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    localStorage.removeItem("selected_guild")
    router.push("/")
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex-col border-r border-border bg-card transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-border px-6">
            <Image src="/valoratbot-logo.png" alt="Valoratbot" width={32} height={32} className="h-8 w-8" />
            <span className="text-lg font-bold text-foreground">Valoratbot</span>
            <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {filteredNav.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-border p-4">
            <div className="rounded-2xl bg-muted p-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs font-medium text-foreground">
                  {accessLoading
                    ? "Vérification…"
                    : isMember
                      ? isAdmin
                        ? "Admin du serveur"
                        : "Membre du serveur"
                      : "Hors serveur"}
                </span>
              </div>
              {/* Option: tu peux afficher une vraie latence du bot si tu la stockes en Supabase */}
              <p className="mt-1 text-xs text-muted-foreground">Accès: {isAdmin ? "complet" : "lecture"}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Image src="/valoratbot-logo.png" alt="Valoratbot" width={32} height={32} className="h-8 w-8 lg:hidden" />
          </div>

          <div className="flex items-center gap-4">
            {selectedGuild && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={
                          selectedGuild.icon
                            ? `https://cdn.discordapp.com/icons/${selectedGuild.id}/${selectedGuild.icon}.png`
                            : "/placeholder.svg"
                        }
                      />
                      <AvatarFallback>{selectedGuild.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline">{selectedGuild.name}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {availableGuilds.map((guild) => (
                    <DropdownMenuItem key={guild.id} onClick={() => handleGuildChange(guild)} className="gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={
                            guild.icon
                              ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
                              : "/placeholder.svg"
                          }
                        />
                        <AvatarFallback>{guild.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{guild.name}</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
