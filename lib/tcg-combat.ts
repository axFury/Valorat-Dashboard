import { getCardAttacks } from "./card-attacks"

export type CombatStats = {
    hp: number
    maxHp: number
    attacks: {
        name: string
        cost: number
        damage: number
        accuracy: number
    }[]
}

const RARITY_BASE_STATS: Record<string, { hp: number; dmgBasic: number; dmgSpecial: number; dmgUlt: number }> = {
    COMMON: { hp: 100, dmgBasic: 15, dmgSpecial: 35, dmgUlt: 60 },
    RARE: { hp: 130, dmgBasic: 20, dmgSpecial: 45, dmgUlt: 80 },
    EPIC: { hp: 170, dmgBasic: 27, dmgSpecial: 60, dmgUlt: 110 },
    LEGENDARY: { hp: 220, dmgBasic: 37, dmgSpecial: 85, dmgUlt: 150 },
    MYTHIC: { hp: 300, dmgBasic: 50, dmgSpecial: 115, dmgUlt: 200 },
}

export function generateCardStats(cardModel: any): CombatStats {
    const base = RARITY_BASE_STATS[cardModel.rarity] || RARITY_BASE_STATS.COMMON
    const attacksConf = getCardAttacks(cardModel.id, cardModel.collection)

    return {
        hp: base.hp,
        maxHp: base.hp, // Convenient to have it here
        attacks: [
            { name: attacksConf[0].name, cost: attacksConf[0].cost, damage: base.dmgBasic, accuracy: 100 }, // Safe auto-attack
            { name: attacksConf[1].name, cost: attacksConf[1].cost, damage: base.dmgSpecial, accuracy: 85 }, // Medium attack
            { name: attacksConf[2].name, cost: attacksConf[2].cost, damage: base.dmgUlt, accuracy: 75 }, // Risky Ultimate
        ]
    }
}
