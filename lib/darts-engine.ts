export type DartValue =
    | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
    | 25 | 50 | 0;

export type DartMultiplier = 1 | 2 | 3;

export interface DartThrow {
    value: DartValue;
    multiplier: DartMultiplier;
    score: number; // valeur * multiplicateur
    isBust?: boolean;
}

export interface PlayerState {
    id: string;
    name: string;
    avatarUrl?: string; // Peut-être ajouté plus tard
    scoreLeft: number;
    legsWon: number;
    setsWon: number;
    cricketMarks?: Record<number, number>; // {15: 0-3, 16: 0-3...}
    cricketPoints?: number;
    stats: {
        dartsThrown: number;
        totalScore: number;
        highestCheckout: number;
        count180: number;
        count140: number;
        count100: number;
        bestTurn: number;
        misses: number;
        cricketMarks: number;
    };
    isGuest?: boolean;
}

export interface MatchRules {
    legsToWin: number;
    setsToWin: number;
    inRule: 'straight' | 'double';
    outRule: 'straight' | 'double' | 'master'; // master out = double ou treble
}

export interface MatchState {
    id: string;
    guildId: string;
    creatorId: string;
    status: 'setup' | 'playing' | 'finished';
    mode: 'local' | 'online';
    gameType: '501' | '301' | 'cricket';
    rules: MatchRules;
    players: PlayerState[];
    currentPlayerIndex: number;
    history: {
        playerId: string;
        throws?: DartThrow[]; // Optional array of throws if needed in future
        throwScore?: number; // Added to match what's actually pushed in api
        scoreBefore: number;
        scoreAfter: number;
        isBust: boolean;
    }[];
    winnerId?: string;
}

/**
 * Calcule si le joueur "bust" (brule) avec ce tir.
 */
export function isBust(scoreLeftBeforeThrow: number, throwScore: number, outRule: MatchRules['outRule'], isLastDartOfTurn: boolean = false, isClosingThrow: boolean = false): boolean {
    const remaining = scoreLeftBeforeThrow - throwScore;

    if (remaining < 0) return true;

    if (outRule === 'double') {
        if (remaining === 1) return true; // Impossible de finir sur un double
        if (remaining === 0 && !isClosingThrow) return true; // Doit finir sur un double
    }

    if (outRule === 'master') {
        if (remaining === 1) return true; // Master out veut dire Double ou Treble. Ex: D1, T1...
        if (remaining === 0 && !isClosingThrow) return true;
    }

    return false; // Straight out, tout est permis
}

/**
 * Suggestions de Checkouts (Fermetures)
 * Une version simplifiée pour le moment, basée sur un dictionnaire des meilleures fermetures
 */
export const CHECKOUT_SUGGESTIONS: Record<number, string> = {
    170: "T20 T20 Bull",
    167: "T20 T19 Bull",
    164: "T20 T18 Bull",
    161: "T20 T17 Bull",
    160: "T20 T20 D20",
    158: "T20 T20 D19",
    157: "T20 T19 D20",
    156: "T20 T20 D18",
    155: "T20 T19 D19",
    154: "T20 T18 D20",
    153: "T20 T19 D18",
    152: "T20 T20 D16",
    151: "T20 T17 D20",
    150: "T20 T18 D18",
    149: "T20 T19 D16",
    148: "T20 T16 D20",
    147: "T20 T17 D18",
    146: "T20 T18 D16",
    145: "T20 T15 D20",
    144: "T20 T20 D12",
    143: "T20 T17 D16",
    142: "T20 T14 D20",
    141: "T20 T15 D18",
    140: "T20 T20 D10",
    /* ... Beaucoup plus de fermetures peuvent être ajoutées logiciellement ou via dico ... */
    // Exemples communs:
    100: "T20 D20",
    90: "T20 D15",
    80: "T20 D10",
    60: "20 D20",
    50: "Bull",
    40: "D20",
    32: "D16",
};

export function getCheckoutSuggestion(score: number): string | null {
    if (score > 170) return null; // Impossible en 3 fléchettes
    if (CHECKOUT_SUGGESTIONS[score]) return CHECKOUT_SUGGESTIONS[score];

    // Fallback: Si on a un nombre pair <= 40, c'est directement un double
    if (score <= 40 && score % 2 === 0) {
        return `D${score / 2}`;
    }

    return null;
}
