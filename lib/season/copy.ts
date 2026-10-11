import { t } from "@/lib/i18n";
import { POSITION_CODES, POSITION_LABELS, type PositionCode } from "@/lib/positions";
import {
  PLAYER_PLAN_STATUS_LABELS,
  PLAYER_PLAN_STATUSES,
  PRIORITY_LABELS,
  RECRUITMENT_STATUS_LABELS,
  RECRUITMENT_STATUSES,
  type PlayerPlanStatus,
  type RecruitmentStatus,
} from "./squad";
import { GOAL_SOURCE_LABELS, GOAL_SOURCES, type GoalSource } from "./summary";

// All copy for Säsong's client components, through t() so club text overrides
// apply. Each screen's texts live under its own key prefix.

function translate<T extends Record<string, string>>(prefix: string, texts: T): T {
  return Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, t(`${prefix}.${k}`, v)])) as T;
}

export function positionLabels(): Record<PositionCode, string> {
  return Object.fromEntries(POSITION_CODES.map((c) => [c, t(`position.${c}`, POSITION_LABELS[c])])) as Record<
    PositionCode,
    string
  >;
}

export function goalSourceLabels(): Record<GoalSource, string> {
  return Object.fromEntries(GOAL_SOURCES.map((s) => [s, t(`season.goalSource.${s}`, GOAL_SOURCE_LABELS[s])])) as Record<
    GoalSource,
    string
  >;
}

export const common = () =>
  translate("season.common", {
    save: "Spara",
    saving: "Sparar …",
    saved: "Sparat",
    unsaved: "Inte sparat",
    remove: "Ta bort",
    cancel: "Avbryt",
    removeTitle: "Ta bort {name}?",
    removeBody: "Det går inte att ångra.",
    error: "Det gick inte att spara. Försök igen.",
  });

export const evaluationCopy = () =>
  translate("season.evaluation", {
    score: "Betyg",
    scoreUnknown: "Vet ej",
    training: "Tränade vi tillräckligt på det?",
    comment: "Kommentar",
    commentPlaceholder: "En mening räcker",
    strengthsTitle: "Tre styrkor",
    weaknessesTitle: "Tre svagheter",
    strength: "Styrka {n}",
    weakness: "Svaghet {n}",
    outlookTitle: "Framåt",
    outlookLevel: "Lagets nivå nästa säsong jämfört med serien (1–10)",
    outlookPosition: "Var hamnar vi nästa säsong om vi inte ändrar något? (placering)",
    outlookKeyFactor: "Det viktigaste som avgör hur nästa säsong går",
    notSet: "Inte satt",
    answered: "{done} av {total} områden betygsatta",
    submit: "Skicka in",
    resubmit: "Skicka in igen",
    submitting: "Skickar …",
    submittedNote: "Du har skickat in. Ändringar sparas när du skickar in igen.",
    unsent: "Du har ändringar som inte är inskickade.",
    needOne: "Betygsätt minst ett område innan du skickar in.",
    tooLittle: "För lite",
    right: "Lagom",
    tooMuch: "För mycket",
  });

export const resultsCopy = () =>
  translate("season.results", {
    matchesTitle: "Matcher",
    matchesHint: "En rad per seriematch. Lämna målen tomma för matcher som inte är spelade. Poängen räknas fram.",
    round: "Omg",
    date: "Datum",
    opponent: "Motståndare",
    venue: "Plats",
    home: "Hemma",
    away: "Borta",
    half: "Halva",
    spring: "Vår",
    autumn: "Höst",
    goalsFor: "Gjorda",
    goalsAgainst: "Insläppta",
    comment: "Kommentar",
    result: "Resultat",
    win: "Vinst",
    draw: "Oavgjort",
    loss: "Förlust",
    notPlayed: "Ej spelad",
    addMatch: "+ Lägg till match",
    newMatch: "Ny match",
    noMatches: "Inga matcher inlagda än.",
    reviewTitle: "Säsongen i övrigt",
    finalPosition: "Slutplacering i serien",
    goalSourcesTitle: "Hur kom målen?",
    goalSourcesHint: "Frivilligt, ungefärligt räcker.",
    source: "Typ",
    scored: "Gjorda",
    conceded: "Insläppta",
    manualTitle: "Utan matchlogg",
    manualHint: "För en säsong utan inlagda matcher, till exempel förra säsongen som jämförelse. Används bara när matchloggen är tom.",
    manualMatches: "Matcher",
    manualPoints: "Poäng",
    manualGoalsFor: "Gjorda mål",
    manualGoalsAgainst: "Insläppta mål",
    saveReview: "Spara",
  });

export const planCopy = () =>
  translate("season.plan", {
    goal: "Målsättning",
    goalHint: "Vad vill ni uppnå? Till exempel placering, poäng eller hur ni vill spela.",
    strategy: "Spelidé och strategi",
    strategyHint: "Hur ska laget spela, och hur kommer ni dit under försäsongen och säsongen?",
    formation: "Grundformation",
    keepDoing: "Behåll också",
    keepDoingHint: "Det som fungerade bra och som ni inte vill tappa.",
    savePlan: "Spara strategin",
  });

export const prioritiesCopy = () =>
  translate("season.priorities", {
    area: "Område",
    goal: "Mål till säsongsslut",
    action: "Åtgärd",
    owner: "Ägare",
    followUp: "Följs upp",
    add: "+ Lägg till prioritering",
    empty: "Inga prioriteringar än.",
    tooMany: "Ni har fler än tre prioriteringar. Färre blir oftare gjorda.",
    priority: "Prioritering {n}",
    suggestionsTitle: "Förslag från utvärderingen av {season}",
    suggestionsHint: "Områden som ledarna markerade som svagast eller där ni tränat för lite.",
    useSuggestion: "Lägg till {area}",
    prioritiseFlag: "Prioritera?",
  });

export const squadCopy = () =>
  translate("season.squad", {
    positionsTitle: "Positioner",
    positionsHint: "Hur många spelare vill ni ha per position, och vilken roll? Klara räknar nyckelspelare, de som stannar och klara värvningar.",
    position: "Position",
    wanted: "Önskat antal",
    role: "Roll",
    rolePlaceholder: "Till exempel snabb och bra i djupled",
    secure: "Klara",
    uncertain: "Osäkra",
    inProgress: "På gång",
    missing: "Saknas",
    surplus: "{n} för många",
    complete: "Komplett",
    playersTitle: "Nuvarande spelare",
    playersHint: "Var passar varje spelare in nästa säsong? Spelare utan beslut räknas inte.",
    status: "Beslut",
    noStatus: "Inte bestämt",
    plannedPosition: "Position",
    noPosition: "Ingen position",
    note: "Notering",
    filterUndecided: "Visa bara spelare utan beslut",
    saveSquad: "Spara truppen",
    totals: "Önskat {wanted} · Klara {secure} · Osäkra {uncertain} · Saknas {missing}",
    noPlayers: "Laget har inga spelare än.",
  });

export const recruitsCopy = () =>
  translate("season.recruits", {
    name: "Namn",
    club: "Nuvarande klubb",
    position: "Position",
    noPosition: "Ingen position",
    priority: "Prioritet",
    status: "Läge",
    note: "Notering",
    add: "+ Lägg till spelare",
    empty: "Inga namn på listan än.",
    privacy: "Skriv bara det ledarna behöver, inga kontaktuppgifter. Listan syns för klubbens ledare men aldrig för spelarna.",
    newRecruit: "Ny spelare",
  });

export function statusLabels() {
  return {
    player: Object.fromEntries(
      PLAYER_PLAN_STATUSES.map((s) => [s, t(`season.playerStatus.${s}`, PLAYER_PLAN_STATUS_LABELS[s])]),
    ) as Record<PlayerPlanStatus, string>,
    recruit: Object.fromEntries(
      RECRUITMENT_STATUSES.map((s) => [s, t(`season.recruitStatus.${s}`, RECRUITMENT_STATUS_LABELS[s])]),
    ) as Record<RecruitmentStatus, string>,
    priority: {
      1: t("season.priority.1", PRIORITY_LABELS[1]),
      2: t("season.priority.2", PRIORITY_LABELS[2]),
      3: t("season.priority.3", PRIORITY_LABELS[3]),
    } as Record<1 | 2 | 3, string>,
  };
}

export type CommonCopy = ReturnType<typeof common>;
export type EvaluationCopy = ReturnType<typeof evaluationCopy>;
export type ResultsCopy = ReturnType<typeof resultsCopy>;
export type PlanCopy = ReturnType<typeof planCopy>;
export type PrioritiesCopy = ReturnType<typeof prioritiesCopy>;
export type SquadCopy = ReturnType<typeof squadCopy>;
export type RecruitsCopy = ReturnType<typeof recruitsCopy>;
export type StatusLabels = ReturnType<typeof statusLabels>;
