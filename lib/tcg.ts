import { CARDS_BY_RARITY, CARDS, BOOSTER_PACKS, RARITIES } from "./card-catalog";

export const FREE_BOOSTERS_PER_DAY = 2;
export const CARDS_PER_BOOSTER = 5;
export const BOOSTER_PRICE = 500;

export function rollRarity() {
    const totalWeight = Object.values(RARITIES).reduce((s, r) => s + r.weight, 0);
    let roll = Math.floor(Math.random() * totalWeight);
    for (const [key, r] of Object.entries(RARITIES)) {
        roll -= r.weight;
        if (roll < 0) return key;
    }
    return "COMMON"; // fallback
}

export function rollCard(collectionsFilter: string[] | null = null) {
    const rarity = rollRarity();
    let pool = CARDS_BY_RARITY[rarity];
    if (collectionsFilter && collectionsFilter.length > 0) {
        pool = pool.filter((c: any) => collectionsFilter.includes(c.collection));
        if (pool.length === 0) pool = CARDS_BY_RARITY[rarity]; // fallback
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

export function rollBasicBooster(collectionsFilter: string[] | null = null) {
    const cards = [];
    for (let i = 0; i < CARDS_PER_BOOSTER; i++) {
        cards.push(rollCard(collectionsFilter));
    }
    return cards;
}

export function rollPremiumBooster() {
    const PREMIUM_WEIGHTS = {
        COMMON: 25, RARE: 35, EPIC: 25, LEGENDARY: 12, MYTHIC: 3,
    };
    const totalWeight = Object.values(PREMIUM_WEIGHTS).reduce((s, w) => s + w, 0);

    const cards = [];
    for (let i = 0; i < 5; i++) {
        let roll = Math.floor(Math.random() * totalWeight);
        let rarity = "COMMON";
        for (const [key, w] of Object.entries(PREMIUM_WEIGHTS)) {
            roll -= w;
            if (roll < 0) { rarity = key; break; }
        }
        const pool = CARDS_BY_RARITY[rarity];
        cards.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return cards;
}

export function rollPackDuellistes() {
    const valCards = CARDS.filter(c => c.collection === "valorant");
    const cards = [];
    for (let i = 0; i < 5; i++) {
        cards.push(valCards[Math.floor(Math.random() * valCards.length)]);
    }
    return cards;
}

export function rollPackLegendaire() {
    const legendaries = [...(CARDS_BY_RARITY["LEGENDARY"] || []), ...(CARDS_BY_RARITY["MYTHIC"] || [])];
    const card = legendaries[Math.floor(Math.random() * legendaries.length)];
    return [card];
}

export function generateBoosterCards(itemKey: string | null = null, packKey: string | null = null) {
    if (itemKey === "booster_premium") {
        return rollPremiumBooster();
    }
    if (itemKey === "pack_duellistes") {
        return rollPackDuellistes();
    }
    if (itemKey === "pack_legendaire") {
        return rollPackLegendaire();
    }

    // Basic booster (from catalog or free drops)
    const pack = packKey && BOOSTER_PACKS[packKey as keyof typeof BOOSTER_PACKS] ? BOOSTER_PACKS[packKey as keyof typeof BOOSTER_PACKS] : null;
    return rollBasicBooster(pack ? pack.collections : null);
}
