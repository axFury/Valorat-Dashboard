"use client"

import { ArrowRight, Bot, Shield, Music, Trophy, Target } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const features = [
  {
    icon: Shield,
    title: "Modération",
    description: "Outils puissants de modération pour garder votre serveur propre et sûr",
  },
  {
    icon: Music,
    title: "Musique",
    description: "Lecteur de musique avec file d'attente et contrôles avancés",
  },
  {
    icon: Trophy,
    title: "Leaderboards",
    description: "Classements automatiques pour messages et temps vocal",
  },
  {
    icon: Target,
    title: "Valorant",
    description: "Intégration Valorant avec suivi des rangs et statistiques",
  },
]

export default function LandingPage() {
  const handleDiscordLogin = () => {
    // Redirect to Discord OAuth
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "YOUR_CLIENT_ID"
    const redirectUri = encodeURIComponent(
      process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI || `${window.location.origin}/api/auth/callback`,
    )
    const scope = "identify guilds"
    window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Image src="/valoratbot-logo.png" alt="Valoratbot" width={32} height={32} className="h-8 w-8" background="transparent"/>
            <span className="text-xl font-bold text-foreground">Valoratbot</span>
          </div>
          <Button onClick={handleDiscordLogin} className="gap-2">
            <Bot className="h-4 w-4" />
            Se connecter avec Discord
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Bot className="h-4 w-4" />
            Bot Discord tout-en-un
          </div>
          <h1 className="text-5xl font-bold leading-tight text-foreground lg:text-6xl">
            Gérez votre serveur Discord avec{" "}
            <span className="bg-gradient-to-r from-primary to-red-400 bg-clip-text text-transparent">Valoratbot</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Modération, musique, leaderboards, intégration Valorant et bien plus. Tout ce dont vous avez besoin pour
            votre communauté Discord.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" onClick={handleDiscordLogin} className="gap-2 px-8">
              Commencer
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" asChild className="bg-transparent">
              <Link href="#features">Découvrir les fonctionnalités</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-foreground">Fonctionnalités</h2>
          <p className="mt-2 text-muted-foreground">Tout ce qu'il faut pour gérer votre serveur</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="border-border bg-card transition-all hover:border-primary/50">
              <CardContent className="p-6">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-red-500/10">
          <CardContent className="flex flex-col items-center gap-6 p-12 text-center">
            <Image src="/valoratbot-logo.png" alt="Valoratbot" width={64} height={64} className="h-16 w-16" />
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-foreground">Prêt à améliorer votre serveur ?</h2>
              <p className="text-muted-foreground">Connectez-vous avec Discord et accédez au tableau de bord</p>
            </div>
            <Button size="lg" onClick={handleDiscordLogin} className="gap-2 px-8">
              <Bot className="h-5 w-5" />
              Se connecter maintenant
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 Valoratbot. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  )
}
