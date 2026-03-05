export function calculateElo(winnerTrophies: number, loserTrophies: number, isPyrrhic: boolean = false) {
    // Base Elo
    let winGained = 25
    let lossLost = 15

    // Merit modifiers based on difference
    const diff = loserTrophies - winnerTrophies
    if (diff > 50) {
        // Winner beat someone way stronger
        winGained += 10
        lossLost += 5
    } else if (diff < -50) {
        // Winner beat someone way weaker (less merit)
        winGained -= 10
        lossLost -= 5
    }

    // Pyrrhic Victory Bonus
    if (isPyrrhic) {
        winGained += 5
    }

    // Prevents negative trophies
    const finalLost = Math.max(0, Math.min(loserTrophies, lossLost))
    
    return {
        winnerGain: winGained,
        loserLoss: finalLost
    }
}
