'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function SettingsRedirectPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    redirectToGuildSettings()
  }, [])

  async function redirectToGuildSettings() {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Not authenticated, redirect to login
        router.push('/login')
        return
      }

      // Fetch user's guilds
      const { data: guilds, error: guildsError } = await supabase
        .from('user_guilds')
        .select('guild_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (guildsError || !guilds) {
        // No guilds found, redirect to dashboard
        router.push('/dashboard')
        return
      }

      // Redirect to first guild's settings
      router.push(`/dashboard/${guilds.guild_id}/settings`)
    } catch (err: any) {
      console.error('Error redirecting to guild settings:', err)
      setError('Erreur lors du chargement des paramètres')
      // Fallback to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    }
  }

  return (
    <div className="flex items-center justify-center h-[400px]">
      <Card className="p-6">
        <CardContent className="flex flex-col items-center gap-4 pt-6">
          {error ? (
            <>
              <p className="text-muted-foreground">{error}</p>
              <p className="text-sm text-muted-foreground">Redirection vers le tableau de bord...</p>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-muted-foreground">Chargement des paramètres...</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
