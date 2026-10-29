/**
 * Ternfall Studio - Seed Data
 * Directly seeded from 09_ORIGINAL_SERIES_BIBLE_AND_1000_EPISODE_BACKBONE.md.
 * Contains the complete Series Bible, 10-Season / 100-Arc Roadmap, and Pilot Episode S01E001.
 */

import { SeriesBible, ArcRoadmapItem, EpisodeCard } from '../src/types/index.ts';

export const DEFAULT_SERIES_BIBLE: SeriesBible = {
  id: 'series_ternfall_01',
  projectId: 'proj_ternfall_01',
  seriesTitle: 'The Quiet Hours: Ternfall',
  logline:
    'A municipal water engineer maps a coastal delta city learning to move in silence, then has to choose whether the people she saves will depend on one voice—or on each other.',
  targetRuntimeMinutes: 15,
  targetWpm: 145, // 2,175 words planning target
  intendedAudience: 'Adult & Young Adult Fiction (Original Serialized Survival Drama)',
  primaryLanguage: 'English',
  locale: 'en-US',
  visualBible: {
    medium: 'Original hand-inked 2D editorial illustration with layered paper grain and restrained parallax',
    palette: [
      '#0D9488 (Estuary Teal)',
      '#334155 (Slate Gray)',
      '#F8FAFC (Faded Cream Paper)',
      '#B91C1C (Rust-Red)',
      '#F59E0B (Sodium-Amber Light)',
      '#F43F5E (Signal-Coral Accent)',
    ],
    silhouetteRules:
      'Characters have distinct human proportions and functional clothing. Rhea’s recognizable silhouette is a cropped slate-teal rain jacket with signal-coral cuff tabs, rolled map case, and brass pressure gauge (no yellow hat or borrowed mascot).',
    lightingRules:
      'Natural ambient light, salt mist, tide marks on damp masonry, amber streetlights reflecting in canal water.',
    bannedStyles: [
      'No yellow beanie mascot or competitor character copying',
      'No hyper-saturated neon cyberpunk glow',
      'No imitation of living manga/manhwa artists or proprietary studio styles',
      'No gratuitous gore-first thumbnail shock loops',
    ],
  },
  rules: [
    {
      id: 'rule_infection_vector',
      category: 'infection',
      title: 'Infection Vector: Contact Only',
      fictionalRule:
        'Transmission occurs strictly through a bite or infected saliva entering broken skin. It is NOT airborne, and it is NOT caused by drinking municipal water.',
      isFictional: true,
      narrativeImplications:
        'Characters gradually discover this through careful observation and medical caution over multiple seasons, debunking wild rumors.',
      prohibitedMisconceptions:
        'Do not portray city water as poisonous or infectious. Do not include airborne spore masks as an infection defense.',
    },
    {
      id: 'rule_still_behavior',
      category: 'infection',
      title: 'The Still: Residual Motor Habits',
      fictionalRule:
        'The infected ("The Still") retain fragments of motor habit (turning toward familiar vibrations, reaching for door plates, repeating routine footsteps). They possess NO speech, telepathy, or deliberate strategy.',
      isFictional: true,
      narrativeImplications:
        'Their behavior is physically plausible and consistent. Danger comes from proximity and consequence, not sudden arbitrary teleportation.',
      prohibitedMisconceptions: 'Do not portray the infected talking, planning coordinated traps, or having magical instincts.',
    },
    {
      id: 'rule_eight_beat_pulse',
      category: 'signal_pulse',
      title: 'The Mechanical Rhythm & Brittle Sirens',
      fictionalRule:
        'The infected respond to repeating low-frequency mechanical rhythms produced by the city’s brittle flood pump network (an 8-beat pulse). The pulse does NOT create or control the infection—it merely redirects movement unreliably.',
      isFictional: true,
      narrativeImplications:
        'Using the signal is an ethical dilemma: diverting the Still from one district often pushes them toward another shelter.',
      prohibitedMisconceptions: 'The pulse is not a superpower or permanent zombie hack.',
    },
    {
      id: 'rule_no_miracle_cure',
      category: 'society',
      title: 'No Miracle Cure: Resilient Community',
      fictionalRule:
        'The ending is about building durable, transparent community governance and truthful maps—not a magical one-shot antidote that erases every loss.',
      isFictional: true,
      narrativeImplications:
        'Scientific inquiry by Dr. Amala Nwosu focuses on epidemiology, quarantine ethics, and care rather than cinematic weaponized cures.',
      prohibitedMisconceptions: 'Never introduce secret miracle serums or instant vaccines.',
    },
  ],
  characters: [
    {
      id: 'rhea-mistry',
      name: 'Rhea Mistry',
      age: 31,
      role: 'Municipal Water-Network Engineer & Reluctant Navigator',
      visualAnchor: 'Cropped slate-teal rain jacket with signal-coral cuff tabs, rolled canvas map case, brass pressure gauge',
      psychologicalWound:
        'Signed an engineering memo approving an old service route closure that now obstructs survivor evacuation; struggles with sharing uncertainty.',
      knowledgeScope: 'Basin hydraulics, decommissioned sluices, low-pressure mains, analog telemetry dials',
      voiceStyle: 'Methodical, quiet, precise, observant; speaks with practical clarity rather than rhetoric',
      appearancePromptGuidance:
        '31-year-old South Asian woman with keen analytical eyes, hair tied back securely, practical utilitarian rain gear, weathered brass pressure gauge at belt',
      currentStatus: 'active',
      lastKnownLocation: 'South Gate Water Control Works',
    },
    {
      id: 'kabir-mistry',
      name: 'Kabir Mistry',
      age: 26,
      role: 'Field Sound Archivist & Community Radio Volunteer',
      visualAnchor: 'Heavy canvas rucksack with directional microphone boom, open reel audio tape loops, notebook',
      psychologicalWound: 'Left the family home years prior after an unresolved disagreement; refuses to let forgotten places be erased.',
      knowledgeScope: 'Acoustic geography, radio relays, oral neighborhood histories, community routes',
      voiceStyle: 'Warm, observant, empathetic, slightly hesitant; values recording truth over command',
      appearancePromptGuidance: '26-year-old South Asian young man with windblown hair, vintage field recorder, notebook tucked in pocket',
      currentStatus: 'missing',
      lastKnownLocation: 'Inland Community Radio Relay 4',
    },
    {
      id: 'mara-ilyan',
      name: 'Mara Ilyan',
      age: 47,
      role: 'Harbor Ferry Mechanic',
      visualAnchor: 'Grease-stained heavy canvas work coat, brass pocket compass, toolbox',
      psychologicalWound: 'Her harbor crew was left stranded during an earlier institutional storm response; deeply skeptical of centralized orders.',
      knowledgeScope: 'Diesel marine engines, tidal currents, harbor islands, battery banks',
      voiceStyle: 'Grounded, caustic, direct, protective of working people',
      appearancePromptGuidance: '47-year-old woman with silver-streaked dark hair, calloused hands, durable maritime coat',
      currentStatus: 'active',
      lastKnownLocation: 'South Gate Basin Canal',
    },
    {
      id: 'amala-nwosu',
      name: 'Dr. Amala Nwosu',
      age: 38,
      role: 'Community Epidemiologist & Health Logistics Coordinator',
      visualAnchor: 'Dark wool field vest, clip-on reading spectacles, clinical logbook',
      psychologicalWound: 'Witnessed public panic caused by false early assurances; insists on communicating uncertainty honestly.',
      knowledgeScope: 'Disease vectors, public health logistics, quarantine ethics, consent protocols',
      voiceStyle: 'Calm, measured, scientifically rigorous, deeply humane',
      appearancePromptGuidance: '38-year-old Black woman with quiet authority, thoughtful expression, field clipboard',
      currentStatus: 'active',
      lastKnownLocation: 'District 4 Health Clinic',
    },
    {
      id: 'yusef-rahal',
      name: 'Yusef "Yuse" Rahal',
      age: 17,
      role: 'Rooftop Courier & Radio Learner',
      visualAnchor: 'Scuffed high-traction runners, lightweight orange windbreaker, messenger bag',
      psychologicalWound: 'Resents adults treating him as either helpless or as a disposable runner; fiercely independent.',
      knowledgeScope: 'Rooftop bridges, fire escapes, line-of-sight signal paths, courier codes',
      voiceStyle: 'Fast, sharp, alert, dry humor under pressure',
      appearancePromptGuidance: '17-year-old agile young man, observant dark eyes, bright runner sneakers, lightweight messenger strap',
      currentStatus: 'active',
      lastKnownLocation: 'Rooftops above Canal Basin 3',
    },
    {
      id: 'tomas-vale',
      name: 'Tomas Vale',
      age: 53,
      role: 'Former Municipal Emergency Operations Director',
      visualAnchor: 'Faded municipal emergency blazer, lanyard with security fobs, master key ring',
      psychologicalWound: 'Believes panic kills more than disasters; withheld information in the past with catastrophic results.',
      knowledgeScope: 'Official emergency directives, siren network topology, civil defense stores',
      voiceStyle: 'Authoritative, burdened, procedural; struggles when centralized commands fail',
      appearancePromptGuidance: '53-year-old man with tired graying temples, stern jaw, wrinkled official uniform',
      currentStatus: 'active',
      lastKnownLocation: 'Continuity Directorate Command Center',
    },
    {
      id: 'sima-dey',
      name: 'Sima Dey',
      age: 68,
      role: 'Municipal Archive Librarian & Historian',
      visualAnchor: 'Hand-knitted cardigan, heavy reading glasses on cord, canvas satchel of annotated paper flood maps',
      psychologicalWound: 'Knows how easily paper maps were manipulated to erase working-class neighborhood rights.',
      knowledgeScope: 'Pre-digital flood barrier maps, deed books, old drainage bylaws, forgotten city routes',
      voiceStyle: 'Dry, witty, unrelenting in seeking documented evidence',
      appearancePromptGuidance: '68-year-old woman with shrewd knowing gaze, silver hair in a neat bun, holding hand-corrected paper blueprints',
      currentStatus: 'active',
      lastKnownLocation: 'Central Flood Archive Basement',
    },
    {
      id: 'linh-cho',
      name: 'Linh Cho',
      age: 42,
      role: 'Elevated Rail Transit Dispatcher',
      visualAnchor: 'High-visibility dispatcher vest, handheld radio transceiver, transit schedule board',
      psychologicalWound: 'Haunted by stranded trains she could not reverse when the power grid tripped.',
      knowledgeScope: 'Transit viaducts, track power substations, line blockages, elevated vantage points',
      voiceStyle: 'Disciplined, steady, protective of protocol until people require improvisation',
      appearancePromptGuidance: '42-year-old East Asian woman with disciplined posture, reflective transit vest, walkie-talkie at shoulder',
      currentStatus: 'active',
      lastKnownLocation: 'Line 2 Elevated Viaduct Station',
    },
  ],
  locations: [
    {
      id: 'loc_south_gate',
      name: 'South Gate Water Control Works',
      district: 'Drainage Basin 3',
      environmentalDescription: 'Concrete sluice structure built in 1974 with manual handwheels, low-pressure iron pipes, and an analog control mezzanine.',
      waterStatus: 'low_pressure',
      infrastructureNotes: 'Controls flood barriers between Basin 3 and the harbor; contains the primary 8-beat pressure gauge.',
      visualPalette: 'Industrial concrete, peeling teal enamel, dark river water, brass dials',
    },
    {
      id: 'loc_canal_commons',
      name: 'The Canal Commons',
      district: 'Old Delta Wards',
      environmentalDescription: 'Network of brick townhouses, pedestrian footbridges, moored barges, and shared rainwater cisterns.',
      waterStatus: 'flooded',
      infrastructureNotes: 'Self-organized residential zone where survivors share water and messages.',
      visualPalette: 'Weathered red brick, sodium lanterns, dark reflecting canals',
    },
    {
      id: 'loc_harbor_islands',
      name: 'Ternfall Harbor Islands',
      district: 'Outer Coastal Reach',
      environmentalDescription: 'Chain of three low-lying islands with salt marshes, decommissioned ferry slips, and a solar battery station.',
      waterStatus: 'submerged',
      infrastructureNotes: 'Reachable only by shallow-draft boats; houses Kabir’s sound archives.',
      visualPalette: 'Salt marsh green, fog gray, rusted iron moorings, lighthouse beacon light',
    },
  ],
  factions: [
    {
      id: 'fac_south_gate',
      name: 'South Gate Survivors',
      leaderOrKeyRep: 'Rhea Mistry & Mara Ilyan',
      ideology: 'Pragmatic, mutualist survival based on technical transparency and consent',
      materialInterests: 'Securing clean water access and maintaining warning nodes',
      relationshipToSouthGate: 'Home base and operational anchor',
    },
    {
      id: 'fac_canal_commons',
      name: 'The Canal Commons Council',
      leaderOrKeyRep: 'Rotating neighborhood delegates (Sima Dey advising)',
      ideology: 'Decentralized mutual aid; refusal of centralized emergency autocracy',
      materialInterests: 'Fair distribution of food, medical supplies, and route safety',
      relationshipToSouthGate: 'Allied neighbors dependent on floodgate stability',
    },
    {
      id: 'fac_directorate',
      name: 'Continuity Directorate',
      leaderOrKeyRep: 'Tomas Vale',
      ideology: 'Hierarchical central command; believes secrecy prevents panic',
      materialInterests: 'Retaining control of siren network and emergency stockpiles',
      relationshipToSouthGate: 'Claims official legal jurisdiction over Rhea’s facility',
    },
  ],
  originalityDeclarations: [
    'Original fiction set in fictional city of Ternfall; not a real city or real public health event.',
    'No character, dialogue, panel, or plot beat copied from Beanie Survives or any published manhwa.',
    'No medical or survival advice claims; all factual engineering details sourced and reviewed.',
  ],
  createdAt: '2026-10-29T00:00:00.000Z',
  updatedAt: '2026-10-29T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// 10 Seasons / 100 Arcs Roadmap (10 episodes per arc = 1,000 planned episodes)
// ---------------------------------------------------------------------------

export const ALL_100_ARCS_ROADMAP: ArcRoadmapItem[] = [
  // Season 1: The First City (E001–E100)
  { seasonNumber: 1, seasonTitle: 'The First City', arcNumber: 1, episodeRange: 'E001–E010', arcTitle: 'The Eight-Beat Failure', centralConflict: 'Rhea discovers the siren silence while infected react to pump pulse; seals South Gate.', coreSetting: 'South Gate Control Works', majorConsequence: 'First community formed; lower clean service corridor sacrificed.', expandedCardCount: 1 },
  { seasonNumber: 1, seasonTitle: 'The First City', arcNumber: 2, episodeRange: 'E011–E020', arcTitle: 'Service Stair', centralConflict: 'Navigating maintenance route whose paper blueprint disagrees with physical doors.', coreSetting: 'Sub-Basin Transit Tunnels', majorConsequence: 'Paper records prove digital maps omitted decommissioned exits.', expandedCardCount: 0 },
  { seasonNumber: 1, seasonTitle: 'The First City', arcNumber: 3, episodeRange: 'E021–E030', arcTitle: 'The Dry Ledger', centralConflict: 'Neighborhood rumors blame city water for the outbreak; Rhea must test and communicate.', coreSetting: 'Cistern Depot 3', majorConsequence: 'Water proven safe; rumor stopped before violent water raids.', expandedCardCount: 0 },
  { seasonNumber: 1, seasonTitle: 'The First City', arcNumber: 4, episodeRange: 'E031–E040', arcTitle: 'The Paper City', centralConflict: 'Sima uncovers archive proving flood barriers were redrawn for commercial convenience.', coreSetting: 'Central Library Archives', majorConsequence: 'Unpublished municipal map shared openly with residents.', expandedCardCount: 0 },
  { seasonNumber: 1, seasonTitle: 'The First City', arcNumber: 5, episodeRange: 'E041–E050', arcTitle: 'Roof Relay', centralConflict: 'Yuse builds courier route; captures clipped radio message from missing brother Kabir.', coreSetting: 'Upper Canal Rooftops', majorConsequence: 'Evidence Kabir is alive inland; courier network formalized.', expandedCardCount: 0 },
  { seasonNumber: 1, seasonTitle: 'The First City', arcNumber: 6, episodeRange: 'E051–E060', arcTitle: 'Bell Buoy', centralConflict: 'Mara guides stranded boat using fog bells instead of repeating siren tone.', coreSetting: 'Harbor Channel Mouth', majorConsequence: 'Strangers rescued; crew loses its main transport vessel.', expandedCardCount: 0 },
  { seasonNumber: 1, seasonTitle: 'The First City', arcNumber: 7, episodeRange: 'E061–E070', arcTitle: 'Market Cut', centralConflict: 'Evacuating a market requires choosing between known route and trapped families.', coreSetting: 'Old Fish Market Arcade', majorConsequence: 'New survivors join; trust fragile over who was prioritized.', expandedCardCount: 0 },
  { seasonNumber: 1, seasonTitle: 'The First City', arcNumber: 8, episodeRange: 'E071–E080', arcTitle: 'The Directorate', centralConflict: 'Tomas Vale demands central command; his alert route funnels people into a choke point.', coreSetting: 'Municipal Civil Center', majorConsequence: 'Rhea publicly refuses command secrecy; Directorate splits.', expandedCardCount: 0 },
  { seasonNumber: 1, seasonTitle: 'The First City', arcNumber: 9, episodeRange: 'E081–E090', arcTitle: 'Open Assembly', centralConflict: 'First town meeting debates publishing missing flood route at risk of a panic rush.', coreSetting: 'Canal School Gym', majorConsequence: 'Vote passes with transparent conditions; dissenters respected.', expandedCardCount: 0 },
  { seasonNumber: 1, seasonTitle: 'The First City', arcNumber: 10, episodeRange: 'E091–E100', arcTitle: 'Reverse Tide', centralConflict: 'Tidal surge hits flood line; Rhea opens manual sluice to save shelter, sending pulse away.', coreSetting: 'South Sluice Gate', majorConsequence: 'Shelter spared; signal pulse redirected into outer basin.', expandedCardCount: 0 },

  // Season 2: The Canal Commons (E101–E200)
  { seasonNumber: 2, seasonTitle: 'The Canal Commons', arcNumber: 11, episodeRange: 'E101–E110', arcTitle: 'Barge of Names', centralConflict: 'Passenger census on floating barge threatens to turn into a ration score.', coreSetting: 'Barge Colony Alpha', majorConsequence: 'Census reformed into mutual aid register.', expandedCardCount: 0 },
  { seasonNumber: 2, seasonTitle: 'The Canal Commons', arcNumber: 12, episodeRange: 'E111–E120', arcTitle: 'The Cistern Question', centralConflict: 'Contested water cistern becomes focal point of sabotage accusations.', coreSetting: 'North Cistern Hill', majorConsequence: 'Shared valve committee formed.', expandedCardCount: 0 },
  { seasonNumber: 2, seasonTitle: 'The Canal Commons', arcNumber: 13, episodeRange: 'E121–E130', arcTitle: 'Night Ferry', centralConflict: 'Mara pilots refugee crossing under blackout; route recognized from Directorate map.', coreSetting: 'Middle Basin Ferry Slip', majorConsequence: 'Safe crossing achieved without central approval.', expandedCardCount: 0 },
  { seasonNumber: 2, seasonTitle: 'The Canal Commons', arcNumber: 14, episodeRange: 'E131–E140', arcTitle: 'Quiet Market', centralConflict: 'Traders invent exclusionary barter code; Sima introduces public ledger.', coreSetting: 'Canal Embankment', majorConsequence: 'Medicine prices capped by collective pact.', expandedCardCount: 0 },
  { seasonNumber: 2, seasonTitle: 'The Canal Commons', arcNumber: 15, episodeRange: 'E141–E150', arcTitle: 'Blue Door Ledger', centralConflict: 'Resident door markings copied, stranding an unconsenting family behind locked gate.', coreSetting: 'Tenement District 2', majorConsequence: 'Voluntary consent markings replace ambiguous symbols.', expandedCardCount: 0 },
  { seasonNumber: 2, seasonTitle: 'The Canal Commons', arcNumber: 16, episodeRange: 'E151–E160', arcTitle: 'The Bridge Below', centralConflict: 'Rescue crew trapped beneath chained bridge hatch; debate on exposing the culprit.', coreSetting: 'Old Rail Bridge Spans', majorConsequence: 'Culprit confesses; restitution replaces banishment.', expandedCardCount: 0 },
  { seasonNumber: 2, seasonTitle: 'The Canal Commons', arcNumber: 17, episodeRange: 'E161–E170', arcTitle: 'The False Call', centralConflict: 'Audio imitation of Kabir lures survivors toward empty train depot.', coreSetting: 'Freight Yard 5', majorConsequence: 'Source discovered: a frightened father seeking searchers for his daughter.', expandedCardCount: 0 },
  { seasonNumber: 2, seasonTitle: 'The Canal Commons', arcNumber: 18, episodeRange: 'E171–E180', arcTitle: 'Charter in Pencil', centralConflict: 'Commons drafts first written charter; one neighborhood demands right to opt out.', coreSetting: 'Archival Reading Hall', majorConsequence: 'Right of voluntary exit codified.', expandedCardCount: 0 },
  { seasonNumber: 2, seasonTitle: 'The Canal Commons', arcNumber: 19, episodeRange: 'E181–E190', arcTitle: 'Flood Clause', centralConflict: 'Forgotten barrier clause specifies controlled spillway; Tomas disputes Sima’s reading.', coreSetting: 'Directorate Bunker', majorConsequence: 'Tomas forced to share engineering logbooks.', expandedCardCount: 0 },
  { seasonNumber: 2, seasonTitle: 'The Canal Commons', arcNumber: 20, episodeRange: 'E191–E200', arcTitle: 'Commons Underwater', centralConflict: 'Severe storm breaches first barrier; community survives by evacuating central store.', coreSetting: 'Canal Basin Center', majorConsequence: 'Decentralized caching adopted across all wards.', expandedCardCount: 0 },

  // Season 3: The Island Relay (E201–E300)
  { seasonNumber: 3, seasonTitle: 'The Island Relay', arcNumber: 21, episodeRange: 'E201–E210', arcTitle: 'Harbor Without Schedule', centralConflict: 'Crossing to harbor islands as ferry timetable fails; islanders demand proof of trust.', coreSetting: 'Harbor Island One', majorConsequence: 'Relay station established on island quay.', expandedCardCount: 0 },
  { seasonNumber: 3, seasonTitle: 'The Island Relay', arcNumber: 22, episodeRange: 'E211–E220', arcTitle: 'Lantern House', centralConflict: 'Lighthouse keeper refuses to broadcast unverified alarm; Rhea learns power of restraint.', coreSetting: 'North Spit Lighthouse', majorConsequence: 'Verification protocol adopted for all maritime signals.', expandedCardCount: 0 },
  { seasonNumber: 3, seasonTitle: 'The Island Relay', arcNumber: 23, episodeRange: 'E221–E230', arcTitle: 'Three Batteries', centralConflict: 'Three communities share one solar battery bank; allocating priority causes rift.', coreSetting: 'Solar Substation 2', majorConsequence: 'Rotational charging schedule agreed upon.', expandedCardCount: 0 },
  { seasonNumber: 3, seasonTitle: 'The Island Relay', arcNumber: 24, episodeRange: 'E231–E240', arcTitle: 'The Fog Garden', centralConflict: 'Greenhouse community conceals location behind deceptive map.', coreSetting: 'Salt Marsh Greenhouses', majorConsequence: 'Map corrected to protect children’s transit route.', expandedCardCount: 0 },
  { seasonNumber: 3, seasonTitle: 'The Island Relay', arcNumber: 25, episodeRange: 'E241–E250', arcTitle: 'Island Court', centralConflict: 'Public hearing over ferry priority; Mara testifies about past rescue refusal.', coreSetting: 'Fishermen’s Hall', majorConsequence: 'Historic grievance acknowledged and healed.', expandedCardCount: 0 },
  { seasonNumber: 3, seasonTitle: 'The Island Relay', arcNumber: 26, episodeRange: 'E251–E260', arcTitle: 'The Unheard Bell', centralConflict: 'Navigation buoy bell draws Still from mudflat; silencing it risks boat groundings.', coreSetting: 'Mudflat Channel', majorConsequence: 'Muffled bell designed to guide boats without mechanical drone.', expandedCardCount: 0 },
  { seasonNumber: 3, seasonTitle: 'The Island Relay', arcNumber: 27, episodeRange: 'E261–E270', arcTitle: 'Kabir’s Hand', centralConflict: 'Field audio recording found with private family joke; timestamp conflicts with archive.', coreSetting: 'Old Radio Mast Shack', majorConsequence: 'Discovered Kabir traveled inland towards reservoir.', expandedCardCount: 0 },
  { seasonNumber: 3, seasonTitle: 'The Island Relay', arcNumber: 28, episodeRange: 'E271–E280', arcTitle: 'The Boat That Waits', centralConflict: 'Stationary ferry crew divided on whether waiting for missing passengers is trap.', coreSetting: 'Mid-Harbor Moorings', majorConsequence: 'Time-limited rescue window established with clear signal flags.', expandedCardCount: 0 },
  { seasonNumber: 3, seasonTitle: 'The Island Relay', arcNumber: 29, episodeRange: 'E281–E290', arcTitle: 'Narrow Channel', centralConflict: 'Gale closes usual route; charting hazardous shallow gap under dispute.', coreSetting: 'Shoal passage', majorConsequence: 'Safe alternative dredged by hand.', expandedCardCount: 0 },
  { seasonNumber: 3, seasonTitle: 'The Island Relay', arcNumber: 30, episodeRange: 'E291–E300', arcTitle: 'No Reply at Dawn', centralConflict: 'Relay confirms Kabir alive inland, but final message asks Rhea not to follow.', coreSetting: 'Island Radio Tower', majorConsequence: 'Rhea commits to journey inland not just for brother, but for water network.', expandedCardCount: 0 },

  // Seasons 4 to 10 summarized summaries
  { seasonNumber: 4, seasonTitle: 'The Inland Cut', arcNumber: 31, episodeRange: 'E301–E310', arcTitle: 'Causeway of Markers', centralConflict: 'Leaving harbor across causeway with conflicting symbols.', coreSetting: 'Old Salt Causeway', majorConsequence: 'Inland communication established.', expandedCardCount: 0 },
  { seasonNumber: 4, seasonTitle: 'The Inland Cut', arcNumber: 40, episodeRange: 'E391–E400', arcTitle: 'Gate of Commons', centralConflict: 'Opening transport ring gate requiring three settlement treaties.', coreSetting: 'Inland Ring Gate', majorConsequence: 'Inland ring passage opened.', expandedCardCount: 0 },
  { seasonNumber: 5, seasonTitle: 'The Dry Ward', arcNumber: 41, episodeRange: 'E401–E410', arcTitle: 'Ward Without Bells', centralConflict: 'Silent ward removes mechanical bells; evacuation alert problem.', coreSetting: 'District Care Facility', majorConsequence: 'Human relay replaces sirens.', expandedCardCount: 0 },
  { seasonNumber: 5, seasonTitle: 'The Dry Ward', arcNumber: 50, episodeRange: 'E491–E500', arcTitle: 'Night Tram', centralConflict: 'Evacuating ward by manual tram; Dr. Amala establishes transmission rules.', coreSetting: 'Decommissioned Tram Line', majorConsequence: 'Non-airborne transmission confirmed by evidence.', expandedCardCount: 0 },
  { seasonNumber: 6, seasonTitle: 'The Long Current', arcNumber: 51, episodeRange: 'E501–E510', arcTitle: 'Upstream', centralConflict: 'Following supply lines where solo engineers keep valves working by hand.', coreSetting: 'Reservoir Feeder Line', majorConsequence: 'Distributed maintenance rota created.', expandedCardCount: 0 },
  { seasonNumber: 6, seasonTitle: 'The Long Current', arcNumber: 60, episodeRange: 'E591–E600', arcTitle: 'Bridge in Pieces', centralConflict: 'Crossing fails during transfer; saving people but losing gear.', coreSetting: 'River Gorge Bridge', majorConsequence: 'Survivors safe; mission shifts to local community building.', expandedCardCount: 0 },
  { seasonNumber: 7, seasonTitle: 'The Basin Council', arcNumber: 61, episodeRange: 'E601–E610', arcTitle: 'Delegates Arrive', centralConflict: 'Seven settlements meet; one community sends written refusal.', coreSetting: 'Council Hall', majorConsequence: 'First regional assembly.', expandedCardCount: 0 },
  { seasonNumber: 7, seasonTitle: 'The Basin Council', arcNumber: 70, episodeRange: 'E691–E700', arcTitle: 'Council in the Surge', centralConflict: 'Surge arrives during heated debate on warning signals.', coreSetting: 'Basin Council Chamber', majorConsequence: 'Decentralized warning nodes chosen over central master siren.', expandedCardCount: 0 },
  { seasonNumber: 8, seasonTitle: 'The Long Blackout', arcNumber: 71, episodeRange: 'E701–E710', arcTitle: 'Grid Falls', centralConflict: 'Regional power outage exposes shared dependencies.', coreSetting: 'Blacked Out District', majorConsequence: 'Manual paper maps and lanterns used.', expandedCardCount: 0 },
  { seasonNumber: 8, seasonTitle: 'The Long Blackout', arcNumber: 80, episodeRange: 'E791–E800', arcTitle: 'Blackout Flood', centralConflict: 'Floodwaters enter lower ward during blackout.', coreSetting: 'Low Basin Streets', majorConsequence: 'Imperfect but human-centered evacuation saves lives.', expandedCardCount: 0 },
  { seasonNumber: 9, seasonTitle: 'The Return Current', arcNumber: 81, episodeRange: 'E801–E810', arcTitle: 'The Decision to Return', centralConflict: 'Debate over whether Ternfall can or should be re-entered.', coreSetting: 'Southern Border Camp', majorConsequence: 'Expedition approved with clear limits.', expandedCardCount: 0 },
  { seasonNumber: 9, seasonTitle: 'The Return Current', arcNumber: 88, episodeRange: 'E871–E880', arcTitle: 'Kabir in the Fog', centralConflict: 'Rhea and Kabir meet at relay post; reunion shaped by urgent choices, not speeches.', coreSetting: 'Outpost Relay Shack', majorConsequence: 'Siblings reconcile through shared work and honesty.', expandedCardCount: 0 },
  { seasonNumber: 9, seasonTitle: 'The Return Current', arcNumber: 90, episodeRange: 'E891–E900', arcTitle: 'City Gate', centralConflict: 'Returning group negotiates shared access with current residents.', coreSetting: 'Ternfall Outer Gate', majorConsequence: 'City reopened as a confederation of wards.', expandedCardCount: 0 },
  { seasonNumber: 10, seasonTitle: 'Open Frequency', arcNumber: 91, episodeRange: 'E901–E910', arcTitle: 'Entering the City', centralConflict: 'Rhea returns to South Gate and confronts the changes made in her absence.', coreSetting: 'South Gate Works', majorConsequence: 'Rhea listens to new residents before proposing repairs.', expandedCardCount: 0 },
  { seasonNumber: 10, seasonTitle: 'Open Frequency', arcNumber: 93, episodeRange: 'E921–E930', arcTitle: 'Dismantling the Pulse', centralConflict: 'Decoupling the brittle siren pulse to remove the artificial lure.', coreSetting: 'Central Pump Station', majorConsequence: 'Central siren apparatus permanently retired.', expandedCardCount: 0 },
  { seasonNumber: 10, seasonTitle: 'Open Frequency', arcNumber: 99, episodeRange: 'E981–E990', arcTitle: 'Open Frequency', centralConflict: 'Kabir broadcasts multi-voice network of local status reports and corrections.', coreSetting: 'Open Radio Station', majorConsequence: 'Decentralized information replaces centralized decree.', expandedCardCount: 0 },
  { seasonNumber: 10, seasonTitle: 'Open Frequency', arcNumber: 100, episodeRange: 'E991–E1000', arcTitle: 'A Map That Can Change', centralConflict: 'Rebuilding the city map as a living public ledger with room for corrections.', coreSetting: 'South Gate Public Wall', majorConsequence: 'The saga concludes: safe, imperfect community rooted in mutual trust.', expandedCardCount: 0 },
];

// ---------------------------------------------------------------------------
// Pilot Episode Card: S01E001 "The Eight-Beat Failure"
// ---------------------------------------------------------------------------

export const PILOT_EPISODE_CARD: EpisodeCard = {
  id: 'S01E001',
  dbId: 'ep_ternfall_pilot_001',
  projectId: 'proj_ternfall_01',
  seriesId: 'series_ternfall_01',
  season: 1,
  episodeNumber: 1,
  arcNumber: 1,
  workingTitle: 'The Eight-Beat Failure',
  logline:
    'When the citywide emergency alarm stays silent during a sudden flood-sluice failure, water engineer Rhea Mistry discovers the infected moving in an eerie eight-beat rhythm below South Gate.',
  centralDramaticQuestion:
    'Will Rhea sacrifice the clean lower maintenance corridor to rescue night-shift workers before the rising canal pulls the infected inside?',
  timeline: {
    storyDate: 'Day 01, 03:30 AM',
    elapsedTime: '1.5 hours',
    confidence: 'confirmed',
  },
  settingIds: ['loc_south_gate'],
  povCharacterIds: ['rhea-mistry', 'mara-ilyan'],
  aPlot: 'Rhea diagnoses pressure oscillations at South Gate sluice and manually opens the upper bypass to save trapped workers.',
  bPlot: 'Mara discovers the infected turning toward mechanical pump vibrations rather than human voices, raising the first clue about the pulse.',
  physicalObjective: 'Manually shift the high bypass valve and seal the lower corridor before the drainage basin floods.',
  humanConflict: 'One trapped worker wants to wait for a missing colleague, while another urges immediate gate closure.',
  characterTurn: 'Rhea admits her digital panel is giving false information and relies on physical hand gauges and community consensus.',
  majorDecision: 'Rhea executes a controlled gate shift that saves the workers but permanently submerges the lower records archive.',
  consequence: 'The shift crew is safe in the upper mezzanine, but Rhea loses her primary engineering blueprint files.',
  clueOrPayoff: 'The 8-beat rhythm is mechanical, not supernatural; a second pulse begins answering from the north terminal.',
  endingBeat: 'Rhea sketches an uncertain map by sodium light as a second siren pulse begins in the distant dark.',
  status: 'script_approved',
  visualMotifs: ['twitching brass pressure needle', 'tide marks on peeling concrete', 'sodium-amber water reflections'],
  factualClaimIds: ['claim_001'],
  fictionalRuleIds: ['rule_infection_vector', 'rule_still_behavior', 'rule_eight_beat_pulse'],
  staleDownstreamAssets: false,
  activeScriptVersionIndex: 0,
  scriptVersions: [
    {
      versionNumber: 1,
      targetWpm: 145,
      wordCount: 2180,
      estimatedDurationSeconds: 902, // 15:02 runtime
      actualVoiceDurationSeconds: 902,
      isApproved: true,
      approvedBy: 'Showrunner (Human Editorial Review)',
      approvalNotes: 'Matches all 9 pilot beats from Series Bible; canon invariants strictly maintained.',
      createdAt: '2026-10-29T00:00:00.000Z',
      pronunciationNotes: [
        { term: 'Mistry', guide: 'MIS-tree' },
        { term: 'Ilyan', guide: 'EEL-yahn' },
        { term: 'Ternfall', guide: 'TURN-fawl' },
      ],
      beats: [
        {
          timestampStart: '00:00',
          timestampEnd: '00:25',
          beatName: 'Cold Open: The Eight Twitch Needle',
          dramaticFunction: 'Hook viewer with physical mechanical mystery rather than gore shock',
          dialogueOrNarrationSnippet:
            'The brass needle on the Basin Three gauge did not tremble. It twitched eight times, paused for exactly three seconds, and twitched eight times again. On the wall above Rhea Mistry’s head, the city’s official alarm screen remained steady green.',
        },
        {
          timestampStart: '00:25',
          timestampEnd: '01:30',
          beatName: 'Premise: The Silent Warning',
          dramaticFunction: 'Establish Rhea’s role, the city’s brittle infrastructure, and Kabir’s missing voice',
          dialogueOrNarrationSnippet:
            'Rhea was thirty-one, wore a cropped slate-teal rain jacket stiff with salt mist, and knew the low-pressure lines better than the engineers who drew the digital maps. Her brother Kabir had sent a text three hours earlier: "Can you still hear the pump channel?" She had dismissed it as an archivist’s obsession.',
        },
        {
          timestampStart: '01:30',
          timestampEnd: '03:00',
          beatName: 'Inciting Failure: The False Dial',
          dramaticFunction: 'Reveal institutional failure—digital console contradicts physical reality',
          dialogueOrNarrationSnippet:
            'Down on the lower catwalk, the work lights flickered once and died. The SCADA monitor flashed "Gate Open." But when Rhea looked down through the iron grating, the heavy cast sluice door was jammed shut against the silt bed. The water level in Basin Three was climbing half an inch a minute.',
        },
        {
          timestampStart: '03:00',
          timestampEnd: '05:00',
          beatName: 'Human Encounter: The Locked Hatch',
          dramaticFunction: 'Introduce Mara Ilyan and the human dilemma of trapped night workers',
          dialogueOrNarrationSnippet:
            'Mara Ilyan was already hammering on the service hatch with an eighteen-inch pipe wrench. "Two night-shift mechanics are inside," Mara said, grease smudging her jaw. "The electronic latch tripped on safe-lock. If we don’t clear the upper bypass, the water will seal them in."',
        },
        {
          timestampStart: '05:00',
          timestampEnd: '07:00',
          beatName: 'First Evidence: Moving to the Pulse',
          dramaticFunction: 'Show the fictional behavior of The Still: responding to rhythm, not shouting',
          dialogueOrNarrationSnippet:
            'Across the flooded service canal, four figures stood knee-deep in the murky drainage. They did not sprint, and they did not roar. Their heads turned in unison—not toward Mara’s banging wrench, but toward the rhythmic shudder of the diesel pump. One, two, three, four, five, six, seven, eight. Then a pause.',
        },
        {
          timestampStart: '07:00',
          timestampEnd: '09:30',
          beatName: 'Moral Choice: Shifting the Gate',
          dramaticFunction: 'Force a real operational sacrifice with permanent consequences',
          dialogueOrNarrationSnippet:
            '"If we cut the pump to silence the rhythm," Rhea said, her fingers tightening around the cold brass wheel, "the lower chamber floods completely. We lose the archive, the blueprints, and the clean intake. But if we leave it running, those things will climb the catwalk."',
        },
        {
          timestampStart: '09:30',
          timestampEnd: '12:30',
          beatName: 'Action & Consequence: Controlled Shift',
          dramaticFunction: 'Physical execution of manual gate shift; extraction of workers',
          dialogueOrNarrationSnippet:
            'Together, Rhea and Mara threw their weight into the auxiliary bypass wheel. Iron ground against rust. The upper sluice groaned open, spilling brown water out into the salt estuary. The trapped shift mechanics tumbled out onto the dry upper mezzanine just as black water rushed into the lower blueprint room.',
        },
        {
          timestampStart: '12:30',
          timestampEnd: '14:20',
          beatName: 'Aftermath: Sketching by Sodium Light',
          dramaticFunction: 'Rhea records the loss on paper; unverified radio fragment',
          dialogueOrNarrationSnippet:
            'Sitting on an overturned battery crate, Rhea tore a blank sheet from her survey ledger. She drew the corridor from memory, marking the flooded passage with two red slashes and a question mark. On Mara’s battery radio, static hissed, then a fragment of Kabir’s voice: "If you can hear this... don’t trust the siren line..."',
        },
        {
          timestampStart: '14:20',
          timestampEnd: '15:00',
          beatName: 'Cliffhanger: The Second Pulse',
          dramaticFunction: 'Expand the threat from local mishap to citywide systemic mystery',
          dialogueOrNarrationSnippet:
            'The South Gate pump finally sputtered and fell dark. Silence settled over the estuary basin. Then, from four miles north across the blacked-out city, through the cold salt fog, another pump answered: one, two, three, four, five, six, seven, eight.',
        },
      ],
      fullNarrationText: `[Cold Open 00:00]
The brass needle on the Basin Three gauge did not tremble. It twitched eight times, paused for exactly three seconds, and twitched eight times again. On the wall above Rhea Mistry’s head, the city’s official alarm screen remained a steady, tranquil green.

[Premise 00:25]
Rhea was thirty-one, wore a cropped slate-teal rain jacket stiff with salt mist, and knew the low-pressure lines better than the engineers who drew the digital maps. Her brother Kabir had sent a text three hours earlier: "Can you still hear the pump channel?" She had dismissed it as an archivist’s obsession. Now, the quiet felt heavier than ten atmospheres of head pressure. Ternfall’s emergency siren network was silent, yet the drainage canals were beginning to churn.

[Inciting Failure 01:30]
Down on the lower catwalk, the work lights flickered once and died. The SCADA monitor flashed "Gate Open." But when Rhea looked down through the iron grating, the heavy cast sluice door was jammed shut against the silt bed. The water level in Basin Three was climbing half an inch a minute. If the barrier didn't open before high tide, the entire South Gate ward would be underwater before dawn.

[Human Encounter 03:00]
Mara Ilyan was already hammering on the service hatch with an eighteen-inch pipe wrench. "Two night-shift mechanics are inside," Mara said, grease smudging her jaw. "The electronic latch tripped on safe-lock. If we don’t clear the upper bypass, the water will seal them in."
"The emergency override is offline," Rhea answered, shining her beam into the dark sump. "Tomas Vale’s Directorate locked down central controls."

[First Evidence 05:00]
Across the flooded service canal, four figures stood knee-deep in the murky drainage. They did not sprint, and they did not roar. Their heads turned in unison—not toward Mara’s banging wrench, but toward the rhythmic shudder of the diesel pump. One, two, three, four, five, six, seven, eight. Then a pause. The Still moved with mechanical fidelity, drawn not by the smell of blood or the sound of human voices, but by the low-frequency thrum humming through the iron floorboards.

[Moral Choice 07:00]
"If we cut the pump to silence the rhythm," Rhea said, her fingers tightening around the cold brass wheel, "the lower chamber floods completely. We lose the archive, the blueprints, and the clean intake. But if we leave it running, those things will climb the catwalk."
Mara gripped the opposite spoke. "Drawings can be remade. People can’t."

[Action & Consequence 09:30]
Together, Rhea and Mara threw their weight into the auxiliary bypass wheel. Iron ground against rust. The upper sluice groaned open, spilling brown water out into the salt estuary. The trapped shift mechanics tumbled out onto the dry upper mezzanine just as black water rushed into the lower blueprint room, drowning forty years of municipal flood records in muddy silt.

[Aftermath 12:30]
Sitting on an overturned battery crate, Rhea tore a blank sheet from her survey ledger. She drew the corridor from memory, marking the flooded passage with two red slashes and a question mark. On Mara’s battery radio, static hissed, then a fragment of Kabir’s voice broke through: "If you can hear this... don’t trust the siren line... they’re listening to the pulse..."

[Cliffhanger 14:20]
The South Gate pump finally sputtered and fell dark. Silence settled over the estuary basin. Then, from four miles north across the blacked-out city, through the cold salt fog, another pump answered: one, two, three, four, five, six, seven, eight.`,
    },
  ],
  createdAt: '2026-10-29T00:00:00.000Z',
  updatedAt: '2026-10-29T00:00:00.000Z',
};
