export type CombatStats = {
    hp: number
    attacks: {
        name: string
        damage: number
        accuracy: number
    }[]
}

const RARITY_BASE_STATS: Record<string, { hp: number; dmg1: number; dmg2: number }> = {
    COMMON: { hp: 50, dmg1: 15, dmg2: 25 },
    RARE: { hp: 80, dmg1: 25, dmg2: 40 },
    EPIC: { hp: 120, dmg1: 40, dmg2: 65 },
    LEGENDARY: { hp: 180, dmg1: 60, dmg2: 90 },
    MYTHIC: { hp: 250, dmg1: 85, dmg2: 130 },
}

const COLLECTION_ATTACK_NAMES: Record<string, [string, string]> = {
    valorant: ["Tir Précis", "Ultime Dévastateur"],
    lol: ["Coup de Base", "Capacité Ultime"],
    cars: ["Coup de Pare-chocs", "Dérapage Turbo"],
    cyberpunk: ["Piratage Rapide", "Surcharge Cybernétique"],
    breaking_bad: ["Jet d'Acide", "Explosion Chimique"],
    stranger_things: ["Coup de Batte", "Pouvoir Télékinétique"],
    porn_story: ["Charme Fatal", "Endurance Max"],
    crime: ["Coup Bas", "Évasion Spectaculaire"],
    f1: ["Aspiration", "Dépassement DRS"],
    cinema: ["Coup de Théâtre", "Scène d'Action"],
    politics: ["Débat Animé", "Loi Martiale"],
    fortune: ["Billet Moteur", "Rachat Hostile"],
    nageurs: ["Onde de Choc", "Tsunami"],
    artistes: ["Fausse Note", "Concert Somptueux"],
}

export function generateCardStats(cardModel: any): CombatStats {
    const base = RARITY_BASE_STATS[cardModel.rarity] || RARITY_BASE_STATS.COMMON
    const names = COLLECTION_ATTACK_NAMES[cardModel.collection] || ["Attaque Rapide", "Attaque Lourde"]

    return {
        hp: base.hp,
        attacks: [
            { name: names[0], damage: base.dmg1, accuracy: 95 }, // Safe attack
            { name: names[1], damage: base.dmg2, accuracy: 75 }, // Risky heavy attack
        ]
    }
}
