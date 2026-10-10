import { t, te } from "@/lib/i18n";
import { SQUAD_GROUP_LABELS, type SquadGroup } from "@/lib/players/squad-groups";
import { POSITION_LABELS, POSITION_LEVEL_LABELS, type PositionCode, type PositionLevel } from "@/lib/positions";

/**
 * All copy for Översikt, through t() so club text overrides apply. The
 * screen-friendly mode (for a big screen in front of the team) says "Lägst"
 * instead of "Svagast".
 */
export function overviewCopy({ screenFriendly = false }: { screenFriendly?: boolean } = {}) {
  return {
    // Headings and texts the club's admins can rewrite in place.
    editable: {
      pitch: te("overview.pitch", "Planen"),
      radar: te("overview.radar", "Laget och lagdelarna"),
      facts: te("overview.facts", "Fakta"),
      rankings: screenFriendly
        ? te("overview.rankingsLowest", "Lag, bäst och lägst")
        : te("overview.rankings", "Lag, bäst och svagast"),
      rankingsHint: screenFriendly
        ? te(
            "overview.rankings.hintLowest",
            "Lag visar alla spelare sorterade under Data. Bäst och Lägst visar spelarna.",
          )
        : te("overview.rankings.hint", "Lag visar alla spelare sorterade under Data. Bäst och Svagast visar spelarna."),
      waitingBody: te(
        "overview.waiting.body",
        "Planen, radarn och topplistorna visas när fler bedömningar har kommit in, så att de inte ger en missvisande bild. Under Data finns det som har kommit in hittills.",
      ),
    },
    tabs: {
      label: t("overview.tabs", "Visa"),
      overview: t("overview.tab.overview", "Översikt"),
      data: t("overview.tab.data", "Data"),
    },
    kpi: {
      label: t("overview.kpi", "Nyckeltal"),
      teamAverage: t("overview.kpi.teamAverage", "Lagets snitt"),
      players: t("overview.kpi.players", "Spelare"),
      submitted: t("overview.kpi.submitted", "Inskickade bedömningar"),
      submittedOf: t("overview.kpi.submittedOf", "av {total} möjliga"),
      goals: t("overview.kpi.goals", "Mål"),
      attendance: t("overview.kpi.attendance", "Träningsnärvaro"),
      disagreements: t("overview.kpi.disagreements", "Oeniga"),
      disagreementsHint: t("overview.kpi.disagreementsHint", "spelare att diskutera"),
    },
    waiting: {
      title: t("overview.waiting", "Väntar på bedömningar ({done} av {total})"),
      body: t(
        "overview.waiting.body",
        "Planen, radarn och topplistorna visas när fler bedömningar har kommit in, så att de inte ger en missvisande bild. Under Data finns det som har kommit in hittills.",
      ),
      toData: t("overview.waiting.toData", "Visa Data"),
    },
    pitch: {
      title: t("overview.pitch", "Planen"),
      hint: t("overview.pitch.hint", "Peka på eller tryck på en position för att se vilka spelare som kan spela där."),
      metrics: t("overview.pitch.metrics", "Visa på planen"),
      count: t("overview.pitch.count", "Antal"),
      countHint: t(
        "overview.pitch.countHint",
        "Antal: spelare som är naturliga eller funkar bra på positionen, mot hur många laget behöver.",
      ),
      attributeHint: t(
        "overview.pitch.attributeHint",
        "Snittbetyg för spelarna som kan spela positionen. Naturliga spelare väger tyngst.",
      ),
      legend: t("overview.pitch.legend", "Rött är svagt, gult mellan och grönt starkt. Siffran visas alltid."),
      coverage: t("overview.pitch.coverage", "{strong} av {target}"),
      spot: t("overview.pitch.spot", "{position}: {value}"),
      noPlayers: t("overview.pitch.noPlayers", "Ingen spelare kan spela här än."),
      close: t("common.close", "Stäng"),
    },
    radar: {
      title: t("overview.radar", "Laget och lagdelarna"),
      compare: t("overview.radar.compare", "Jämför med"),
      team: t("overview.radar.team", "Hela laget"),
      category: t("overview.radar.category", "Kategori"),
      caption: t("overview.radar.caption", "Snitt per kategori, hela laget och vald lagdel"),
      tooFew: t("overview.radar.tooFew", "Radarn behöver minst tre kategorier."),
    },
    facts: {
      title: t("overview.facts", "Fakta"),
      squad: t("overview.facts.squad", "Truppen: {list}"),
      withoutGroup: t("overview.facts.withoutGroup", "{n} utan lagdel"),
      thin: t("overview.facts.thin", "Tunt på: {list}"),
      thinNone: t("overview.facts.thinNone", "Alla positioner har så många spelare som laget behöver."),
      few: t("overview.facts.few", "{n} spelare har färre än 3 bedömningar"),
      fewNone: t("overview.facts.fewNone", "Alla spelare har minst 3 bedömningar"),
      lowAttendance: t("overview.facts.lowAttendance", "{n} spelare har under 60 % träningsnärvaro"),
      strongest: t("overview.facts.strongest", "Starkast som lag: {category} ({value})"),
      weakest: screenFriendly
        ? t("overview.facts.lowest", "Lägst som lag: {category} ({value})")
        : t("overview.facts.weakest", "Svagast som lag: {category} ({value})"),
      disputed: t("overview.facts.disputed", "Mest oenighet: {category} ({n} spelare)"),
    },
    rankings: {
      title: screenFriendly
        ? t("overview.rankingsLowest", "Lag, bäst och lägst")
        : t("overview.rankings", "Lag, bäst och svagast"),
      hint: screenFriendly
        ? t(
            "overview.rankings.hintLowest",
            "Lag visar alla spelare sorterade under Data. Bäst och Lägst visar spelarna.",
          )
        : t("overview.rankings.hint", "Lag visar alla spelare sorterade under Data. Bäst och Svagast visar spelarna."),
      rateNote: t(
        "overview.rankings.rateNote",
        "Per match räknas bara för spelare med minst 5 matcher. Mål och assist räknas inte för målvakter.",
      ),
      team: t("overview.rankings.team", "Lag"),
      best: t("overview.rankings.best", "Bäst"),
      worst: screenFriendly ? t("overview.rankings.lowest", "Lägst") : t("overview.rankings.worst", "Svagast"),
      players: t("overview.rankings.players", "{n} spelare"),
      teamLabel: t("overview.rankings.teamLabel", "Lag, {metric}: {value}. Visa alla spelare sorterade"),
      extremeLabel: t("overview.rankings.extremeLabel", "{kind}, {metric}: {value}, {who}"),
    },
    metric: {
      total: t("overview.metric.total", "Totalt snitt"),
      attendance: t("overview.metric.attendance", "Träningsnärvaro"),
      phase: t("overview.metric.phase", "Närvaro: {phase}"),
      matches: t("overview.metric.matches", "Matcher"),
      goals: t("overview.metric.goals", "Mål"),
      assists: t("overview.metric.assists", "Assist"),
      yellowCards: t("overview.metric.yellowCards", "Gula kort"),
      goalsPerMatch: t("overview.metric.goalsPerMatch", "Mål per match"),
      assistsPerMatch: t("overview.metric.assistsPerMatch", "Assist per match"),
      yellowCardsPerMatch: t("overview.metric.yellowCardsPerMatch", "Gula kort per match"),
      totalShort: t("overview.metric.totalShort", "Totalt"),
    },
    table: {
      caption: t("overview.table.caption", "Alla spelare"),
      sort: t("overview.table.sort", "Sortera efter"),
      descending: t("overview.table.descending", "Högst först"),
      ascending: t("overview.table.ascending", "Lägst först"),
      group: t("overview.table.group", "Lagdel"),
      allGroups: t("overview.table.allGroups", "Alla lagdelar"),
      number: t("overview.table.number", "Nr"),
      name: t("overview.table.name", "Namn"),
      mainPosition: t("overview.table.mainPosition", "Huvudposition"),
      assessments: t("overview.table.assessments", "Bedömningar"),
      empty: t("overview.table.empty", "Inga spelare i lagdelen."),
      scrollHint: t("overview.table.scrollHint", "Svep i tabellen för att se fler kolumner."),
    },
    player: {
      few: t("overview.player.few", "få bedömningar"),
      assessments: t("overview.player.assessments", "{n} bedömningar"),
      disagreement: t("overview.player.disagreement", "Oeniga – diskutera"),
      ratings: t("overview.player.ratings", "Betyg"),
      attendance: t("overview.player.attendance", "Träningsnärvaro"),
      stats: t("overview.player.stats", "Statistik"),
      mainPosition: t("overview.player.mainPosition", "Huvudposition"),
      openCombined: t("overview.player.openCombined", "Samlad bedömning"),
      openCard: t("overview.player.openCard", "Bedöm spelaren"),
      dialog: t("overview.player.dialog", "Spelare"),
      tied: t("overview.player.tied", "{n} spelare delar platsen"),
      close: t("common.close", "Stäng"),
    },
    groups: Object.fromEntries(
      Object.entries(SQUAD_GROUP_LABELS).map(([k, v]) => [k, t(`squadGroup.${k}`, v)]),
    ) as Record<SquadGroup, string>,
    positions: Object.fromEntries(
      Object.entries(POSITION_LABELS).map(([k, v]) => [k, t(`position.${k}`, v)]),
    ) as Record<PositionCode, string>,
    levels: Object.fromEntries(
      Object.entries(POSITION_LEVEL_LABELS).map(([k, v]) => [k, t(`positionLevel.${k}`, v)]),
    ) as Record<PositionLevel, string>,
  };
}

export type OverviewCopy = ReturnType<typeof overviewCopy>;
