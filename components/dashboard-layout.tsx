"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Shield,
  Music,
  Trophy,
  Megaphone,
  Target,
  Coins,
  Dices,
  ChevronDown,
  User,
  Menu,
  X,
  LogOut,
  Layers,
  Swords,
  Package,
  Gamepad2,
  Users,
  Settings,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Grouped navigation structure
const getNavigationGroups = (guildId?: string) => [
  {
    title: "Principal",
    items: [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard, color: "text-blue-400" },
    ],
  },
  {
    title: "Gaming Zone",
    items: [
      { name: "Valorant", href: "/dashboard/valorant", icon: Target, color: "text-red-500" },
      { name: "Fléchettes", href: "/dashboard/darts", icon: Target, color: "text-orange-500" },
      { name: "TCG Collection", href: "/dashboard/tcg", icon: Layers, color: "text-purple-400" },
      { name: "TCG Arène", href: "/dashboard/tcg/combat", icon: Swords, color: "text-red-400" },
      { name: "TCG Boosters", href: "/dashboard/tcg/booster", icon: Package, color: "text-yellow-400" },
      { name: "Casino", href: "/dashboard/casino", icon: Dices, color: "text-emerald-400" },
    ],
  },
  {
    title: "Social & Stats",
    items: [
      { name: "Leaderboards", href: "/dashboard/leaderboards", icon: Trophy, color: "text-yellow-500" },
      { name: "Économie", href: "/dashboard/economy", icon: Coins, color: "text-amber-400" },
    ],
  },
  {
    title: "Admin & Tools",
    items: [
      { name: "Musique", href: "/dashboard/music", icon: Music, color: "text-pink-400" },
      { name: "Modération", href: "/dashboard/moderation", icon: Shield, color: "text-zinc-400", restricted: true },
      { name: "Annonces", href: "/dashboard/announcements", icon: Megaphone, color: "text-zinc-400", restricted: true },
    ],
  },
]

function hasAdminOrManageGuild(permStr?: string) {
  try {
    if (!permStr) return false
    const p = BigInt(permStr)
    const ADMIN = BigInt(0x00000008)
    const MANAGE_GUILD = BigInt(0x00000020)
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
        const res = await fetch(`/api/auth/is-member?guildId=${selectedGuild.id}`, { cache: "no-store" })
        if (res.ok) {
          const data = await res.json()
          const member = !!data?.isMember
          const admin = !!data?.owner || hasAdminOrManageGuild(data?.permissions)
          setIsMember(member)
          setIsAdmin(admin)
        } else {
          const admin = hasAdminOrManageGuild(selectedGuild?.permissions)
          setIsMember(true)
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

  const navigationGroups = useMemo(() => {
    const groups = getNavigationGroups(selectedGuild?.id)
    return groups.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!item.restricted) return true
        if (accessLoading) return false
        return isMember && isAdmin
      })
    })).filter(group => group.items.length > 0)
  }, [accessLoading, isMember, isAdmin, selectedGuild?.id])

  const handleGuildChange = (guild: any) => {
    setSelectedGuild(guild)
    localStorage.setItem("selected_guild", guild.id)
    window.location.reload()
  }

  const handleLogout = () => {
    document.cookie = "discord_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    document.cookie = "dc_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    localStorage.removeItem("selected_guild")
    router.push("/")
  }

  if (pathname.startsWith('/dashboard/darts/match/')) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 flex-col border-r border-border bg-[#0b0e13] transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-20 items-center justify-between px-6 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-gradient-to-br from-red-500 to-rose-600 p-[2px] shadow-lg shadow-red-500/20">
                <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#0b0e13]">
                  <Image src="/valoratbot-logo.png" alt="Logo" width={24} height={24} className="h-6 w-6" />
                </div>
              </div>
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">VALORATBOT</span>
            </div>
            <button className="lg:hidden text-muted-foreground hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto p-4 custom-scrollbar">
            {navigationGroups.map((group) => (
              <div key={group.title} className="space-y-2">
                <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">{group.title}</h3>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200",
                          isActive
                            ? "bg-red-500/10 text-white shadow-[inset_0_0_0_1px_rgba(239,68,68,0.2)]"
                            : "text-muted-foreground hover:bg-white/5 hover:text-white",
                        )}
                        onClick={() => setSidebarOpen(false)}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="active-nav"
                            className="absolute inset-y-2 left-0 w-1 bg-red-500 rounded-full"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                        <item.icon className={cn("h-5 w-5 transition-colors", isActive ? item.color : "group-hover:text-white")} />
                        <span>{item.name}</span>
                        {isActive && (
                          <Sparkles className="ml-auto h-3 w-3 text-red-500 animate-pulse" />
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-4 border-t border-white/5">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/5 to-transparent p-4 border border-white/5">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("h-2 w-2 rounded-full", accessLoading ? "bg-zinc-500 animate-pulse" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]")} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                    {accessLoading ? "Vérification..." : isAdmin ? "Accès Administrateur" : "Accès Membre"}
                  </span>
                </div>
                <p className="text-xs font-medium text-white/40 leading-relaxed">
                  Connecté sur <span className="text-white font-bold">{selectedGuild?.name}</span>
                </p>
              </div>
              <div className="absolute top-0 right-0 -mr-4 -mt-4 h-16 w-16 rounded-full bg-red-500/5 blur-2xl" />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-20 items-center justify-between border-b border-white/5 bg-[#0b0e13]/80 backdrop-blur-xl px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden hover:bg-white/5 rounded-xl" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-6 w-6" />
            </Button>
            <div className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-white/20">Dashboard</span>
              <span className="text-white/20">/</span>
              <span className="text-white font-bold capitalize">
                {pathname.split('/').pop() || "Overview"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {selectedGuild && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 gap-3 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 rounded-xl px-4 transition-all active:scale-95">
                    <Avatar className="h-6 w-6 ring-2 ring-white/10">
                      <AvatarImage
                        src={
                          selectedGuild.icon
                            ? `https://cdn.discordapp.com/icons/${selectedGuild.id}/${selectedGuild.icon}.png`
                            : "/placeholder.svg"
                        }
                      />
                      <AvatarFallback className="bg-red-500 text-[10px] font-bold">{selectedGuild.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline font-bold text-sm tracking-tight">{selectedGuild.name}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 bg-[#121722] border-white/10 p-2 rounded-2xl shadow-2xl">
                  <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/30 border-b border-white/5 mb-2">Choisir un serveur</div>
                  {availableGuilds.map((guild) => (
                    <DropdownMenuItem
                      key={guild.id}
                      onClick={() => handleGuildChange(guild)}
                      className="gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer focus:bg-white/5 transition-colors"
                    >
                      <Avatar className="h-10 w-10 rounded-xl">
                        <AvatarImage
                          src={
                            guild.icon
                              ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
                              : "/placeholder.svg"
                          }
                        />
                        <AvatarFallback className="bg-muted rounded-xl">{guild.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-sm truncate">{guild.name}</p>
                        <p className="text-[10px] text-white/30 uppercase tracking-tighter">ID: {guild.id.slice(0, 12)}...</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 w-10 p-0 hover:bg-white/5 rounded-xl active:scale-90 transition-transform">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center p-[1px] ring-2 ring-white/5">
                    <div className="h-full w-full rounded-[9px] bg-[#121722] flex items-center justify-center overflow-hidden">
                      <Avatar className="h-full w-full rounded-none">
                        <AvatarFallback className="bg-transparent">
                          <User className="h-5 w-5 text-white/50" />
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[#121722] border-white/10 p-2 rounded-2xl shadow-2xl mt-2">
                <div className="px-3 py-2 border-b border-white/5 mb-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Utilisateur</p>
                </div>
                <DropdownMenuItem onClick={handleLogout} className="gap-3 p-3 rounded-xl hover:bg-red-500/10 hover:text-red-500 cursor-pointer text-sm font-bold transition-colors">
                  <LogOut className="h-4 w-4" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-8 pb-20">
            {children}
          </div>
        </main>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  )
}
