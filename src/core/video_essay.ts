/**
 * Ternfall Studio - Video Essay & Kinetic Storyteller Engine
 * Inspired by the "Illustrated Keyframe / Documentary Narration" format
 * (e.g. LEMMINO, MagnatesMedia, Bedtime Stories, and YouTube mystery video essays).
 *
 * Produces broadcast-grade 10-minute cinematic thriller videos using:
 * - 0-Credit Google Flow Master Stills (35-40 high-impact illustrations)
 * - Dynamic Ken Burns Pan/Zoom Camera Drift
 * - Real-time atmospheric particle & lighting overlays (rain, fog, dust motes)
 * - 40-55Hz sub-bass binaural soundscapes & voiceover sidechain ducking
 * - Word-by-word kinetic highlighted subtitles
 * - ThinkPad T14 (NVIDIA MX330 Pascal NVENC) local batch render scripts (~75s encode)
 */

export interface IllustratedSlide {
  id: string;
  slideNumber: number;
  chapterIndex: number;
  chapterTitle: string;
  timecodeStart: string; // e.g. "00:00"
  timecodeEnd: string; // e.g. "00:16"
  durationSeconds: number; // 12 - 20 seconds
  storyBeat: string;
  visualDescription: string;
  flowPrompt: string; // Engineered for flow.google.com (0 credits)
  flowNegativePrompt: string;
  narratorScript: string;
  wordCount: number;
  cameraMovement:
    | 'slow_push_in'
    | 'slow_pull_out'
    | 'pan_left_to_right'
    | 'pan_right_to_left'
    | 'tilt_down'
    | 'subtle_drift'
    | 'impact_snap_zoom';
  overlayEffect:
    | 'heavy_rain'
    | 'salt_fog'
    | 'dust_motes'
    | 'flicker_vignette'
    | 'water_ripples'
    | 'none';
  soundCue: {
    sfxType:
      | 'sub_bass_pulse_55hz'
      | 'water_drip_echo'
      | 'metallic_creak'
      | 'alarm_distant'
      | 'rain_interior'
      | 'generator_hum';
    volume: number; // 0.0 to 1.0
  };
  highlightKeywords: string[];
  visualTheme: {
    primaryColor: string; // e.g. '#0f292f' (dark slate teal)
    accentColor: string; // e.g. '#e06c43' (sodium amber)
    contrast: number;
    filmGrain: number;
  };
}

export interface VideoEssayEpisode {
  episodeId: string;
  title: string;
  subtitle: string;
  totalDurationSeconds: number;
  totalSlides: number;
  totalWordCount: number;
  avgWpm: number;
  aspectRatio: '16:9' | '9:16';
  googleFlowCreditsCost: 0; // Explicitly $0.00
  estimatedRenderTimeSecondsOnMX330: number; // ~75 seconds
  slides: IllustratedSlide[];
}

/**
 * Curated 36-slide master story for Episode 1: "The Siphon of Basin Three"
 * Structured in the high-retention documentary thriller format.
 */
export function getPilotVideoEssayData(): VideoEssayEpisode {
  const slides: IllustratedSlide[] = [
    // CHAPTER 1: COLD OPEN (00:00 - 01:15)
    {
      id: 'slide_01',
      slideNumber: 1,
      chapterIndex: 1,
      chapterTitle: 'Cold Open: The Eight-Twitch Needle',
      timecodeStart: '00:00',
      timecodeEnd: '00:15',
      durationSeconds: 15,
      storyBeat: 'Atmospheric Hook & Anomaly',
      visualDescription: 'Macro close-up on weathered analog brass hydraulic dial on cold, sweating concrete. Needle vibrates with an unnatural mechanical cadence.',
      flowPrompt: 'Cinematic master shot, macro close-up of a weathered brass hydraulic pressure dial mounted on sweating black concrete wall, analog dial needle vibrating in distinct rhythmic tick marks, faint sodium-amber rim light reflecting off damp glass lens, muted industrial slate-teal color grading, 8k resolution, cinematic grain, film still',
      flowNegativePrompt: 'digital touchscreen, neon cyberpunk, 3D render, cartoon, saturated rainbow, plastic smooth, modern high-tech',
      narratorScript: 'The brass needle on the Basin Three gauge did not tremble. It twitched eight times, held for three seconds in total silence, and repeated. In fifty years of harbor records, mechanical instruments do not learn rhythm on their own.',
      wordCount: 39,
      cameraMovement: 'slow_push_in',
      overlayEffect: 'heavy_rain',
      soundCue: { sfxType: 'sub_bass_pulse_55hz', volume: 0.8 },
      highlightKeywords: ['twitched eight times', 'total silence', 'learn rhythm'],
      visualTheme: { primaryColor: '#09181b', accentColor: '#d97736', contrast: 1.25, filmGrain: 0.15 },
    },
    {
      id: 'slide_02',
      slideNumber: 2,
      chapterIndex: 1,
      chapterTitle: 'Cold Open: The Eight-Twitch Needle',
      timecodeStart: '00:15',
      timecodeEnd: '00:32',
      durationSeconds: 17,
      storyBeat: 'Character Introduction in Isolation',
      visualDescription: 'Profile of 31-year-old water engineer Rhea Mistry on an iron grate catwalk, holding an inspection torch aimed into the black abyss below.',
      flowPrompt: 'Cinematic wide profile shot, 31-year-old water engineer Rhea Mistry standing alone on an elevated iron grate catwalk inside a massive subterranean drainage tunnel, wearing a heavy slate-teal oilskin jacket with faded orange cuff patches, holding a brass heavy-duty flashlight beam cutting through thick damp air, dark reflective seawater pooling below, industrial mystery, cinematic composition, photorealistic film look',
      flowNegativePrompt: 'yellow raincoat, bright neon, happy expression, anime, glossy render, crowded room',
      narratorScript: 'Rhea Mistry had spent eight winters managing the subterranean drainage locks beneath Ternfall Quay. She knew the groans of the harbor like an architect knows settling timber. But tonight, the water was moving backward.',
      wordCount: 37,
      cameraMovement: 'pan_left_to_right',
      overlayEffect: 'salt_fog',
      soundCue: { sfxType: 'water_drip_echo', volume: 0.7 },
      highlightKeywords: ['Ternfall Quay', 'moving backward'],
      visualTheme: { primaryColor: '#0b1c20', accentColor: '#38bdf8', contrast: 1.2, filmGrain: 0.12 },
    },
    {
      id: 'slide_03',
      slideNumber: 3,
      chapterIndex: 1,
      chapterTitle: 'Cold Open: The Eight-Twitch Needle',
      timecodeStart: '00:32',
      timecodeEnd: '00:50',
      durationSeconds: 18,
      storyBeat: 'Physics Anomaly: The Siphon',
      visualDescription: 'Wide angle down into the cavernous sump basin. Cold saltwater is swirling upward against gravity around rusted iron intake pipes.',
      flowPrompt: 'Ominous cinematic wide shot looking down into a deep stone-walled municipal drainage sump basin, dark swirling saltwater defying gravity around massive rusted cast-iron intake pipes, eerie vortex, amber emergency work lights illuminating rising spray, industrial dread, photorealistic mystery, high contrast',
      flowNegativePrompt: 'monsters, tentacles, fantasy magic, glowing neon, smooth CGI',
      narratorScript: 'At low pressure, high-volume sea mains can form an accidental siphon. If the municipal sea gate fails by even two degrees, four hundred thousand gallons of freezing saltwater siphons directly into the subterranean service corridors.',
      wordCount: 37,
      cameraMovement: 'tilt_down',
      overlayEffect: 'heavy_rain',
      soundCue: { sfxType: 'metallic_creak', volume: 0.65 },
      highlightKeywords: ['accidental siphon', 'four hundred thousand gallons', 'subterranean service corridors'],
      visualTheme: { primaryColor: '#07151a', accentColor: '#f59e0b', contrast: 1.3, filmGrain: 0.18 },
    },
    {
      id: 'slide_04',
      slideNumber: 4,
      chapterIndex: 1,
      chapterTitle: 'Cold Open: The Eight-Twitch Needle',
      timecodeStart: '00:50',
      timecodeEnd: '01:10',
      durationSeconds: 20,
      storyBeat: 'The Silent Alarm Anomaly',
      visualDescription: 'Wall of civil defense alert relays. The glass indicator lamps are dark or steady green, completely oblivious to the flood occurring below.',
      flowPrompt: 'Moody close-up shot of an analog 1970s civil defense alarm relay panel mounted on peeling concrete wall, bank of circular glass bulb indicators showing pale dormant green light, dust settling on dial glass, silence, foreboding tension, cinematic lighting, muted green and charcoal palette',
      flowNegativePrompt: 'modern flatscreens, bright red sirens flashing, futuristic consoles, messy wiring',
      narratorScript: 'Above ground, the city was asleep. On the central telemetry board, every status light glowed green. According to the municipal automated monitoring network, Basin Three was dry. The machines were lying.',
      wordCount: 33,
      cameraMovement: 'slow_pull_out',
      overlayEffect: 'dust_motes',
      soundCue: { sfxType: 'generator_hum', volume: 0.5 },
      highlightKeywords: ['glowed green', 'Basin Three was dry', 'machines were lying'],
      visualTheme: { primaryColor: '#0d1d17', accentColor: '#10b981', contrast: 1.15, filmGrain: 0.14 },
    },

    // CHAPTER 2: THE DEEPENING CRISIS (01:10 - 02:40)
    {
      id: 'slide_05',
      slideNumber: 5,
      chapterIndex: 2,
      chapterTitle: 'Inciting Failure: The False Dial',
      timecodeStart: '01:10',
      timecodeEnd: '01:28',
      durationSeconds: 18,
      storyBeat: 'Physical Investigation Underway',
      visualDescription: 'Rhea stepping through ankle-deep black water in narrow arched service conduit B-7, flashlight illuminating floating inspection tags.',
      flowPrompt: 'Cinematic tracking shot, female engineer wading through knee-deep murky water inside a narrow subterranean arched brick conduit, flashlight beam cutting through cold rising mist, floating paper inspection tags drifting on the dark surface, claustrophobic industrial atmosphere, gritty cinematic realism',
      flowNegativePrompt: 'bright lights, action hero, weapons, glowing creatures, sunny',
      narratorScript: 'Conduit B-7 was built in nineteen twenty-four out of high-density river clay brick. It was designed to withstand fifty feet of ocean head. But as Rhea stepped off the service ladder, the water was already past her ankles.',
      wordCount: 40,
      cameraMovement: 'slow_push_in',
      overlayEffect: 'salt_fog',
      soundCue: { sfxType: 'water_drip_echo', volume: 0.75 },
      highlightKeywords: ['Conduit B-7', 'fifty feet of ocean head', 'past her ankles'],
      visualTheme: { primaryColor: '#0a171d', accentColor: '#e06c43', contrast: 1.25, filmGrain: 0.15 },
    },
    {
      id: 'slide_06',
      slideNumber: 6,
      chapterIndex: 2,
      chapterTitle: 'Inciting Failure: The False Dial',
      timecodeStart: '01:28',
      timecodeEnd: '01:46',
      durationSeconds: 18,
      storyBeat: 'Discovery of the Jammed Sluice',
      visualDescription: 'Massive eight-ton cast iron sluice gate wedged crookedly in its bronze guide track. A thick industrial timber is crushed beneath the lip.',
      flowPrompt: 'Low angle dramatic shot of a massive eight-ton cast-iron sluice gate jammed crookedly in its bronze vertical guide channel, roaring black sea water violently spraying through a six-inch gap at the bottom, crushed heavy wooden timber wedged under the iron blade, industrial catastrophe, cinematic lighting',
      flowNegativePrompt: 'clean machinery, shiny metal, CGI cartoon, bright daylight',
      narratorScript: 'The mechanical sluice had not failed on its own. A heavy twelve-inch creosote timber from the old outer pier was wedged directly under the descent tooth. Someone had left the harbor safety boom unlocked.',
      wordCount: 36,
      cameraMovement: 'tilt_down',
      overlayEffect: 'heavy_rain',
      soundCue: { sfxType: 'metallic_creak', volume: 0.8 },
      highlightKeywords: ['jammed crookedly', 'creosote timber', 'left the harbor safety boom unlocked'],
      visualTheme: { primaryColor: '#0e181c', accentColor: '#fbbf24', contrast: 1.35, filmGrain: 0.16 },
    },
    {
      id: 'slide_07',
      slideNumber: 7,
      chapterIndex: 2,
      chapterTitle: 'Inciting Failure: The False Dial',
      timecodeStart: '01:46',
      timecodeEnd: '02:05',
      durationSeconds: 19,
      storyBeat: 'The Subterranean Trapped Crew',
      visualDescription: 'Reinforced watertight hatch at the end of the maintenance gallery. Water is bubbling up around the rubber perimeter gasket.',
      flowPrompt: 'Chilling close shot of a heavy riveted steel watertight bulkhead door with a circular brass spinning handle, cold saltwater foaming and hissing through the pressurized rubber perimeter seals, yellow chalk markings on the steel, industrial survival thriller, dim sodium lighting',
      flowNegativePrompt: 'futuristic spaceship door, pristine surfaces, high-tech glow, neon',
      narratorScript: 'Behind this bulkhead was the lower compressor room. Four shift workers from the nocturnal municipal crew were scheduled inside until five in the morning. If the water level crossed six feet in the gallery, the door could never be opened from the outside.',
      wordCount: 45,
      cameraMovement: 'slow_push_in',
      overlayEffect: 'water_ripples',
      soundCue: { sfxType: 'sub_bass_pulse_55hz', volume: 0.85 },
      highlightKeywords: ['lower compressor room', 'four shift workers', 'never be opened from the outside'],
      visualTheme: { primaryColor: '#0c1619', accentColor: '#ef4444', contrast: 1.3, filmGrain: 0.15 },
    },
    {
      id: 'slide_08',
      slideNumber: 8,
      chapterIndex: 2,
      chapterTitle: 'Inciting Failure: The False Dial',
      timecodeStart: '02:05',
      timecodeEnd: '02:25',
      durationSeconds: 20,
      storyBeat: 'Human Contact via Acoustic Pipe',
      visualDescription: 'Rhea pressing her ear and an eighteen-inch steel spanner wrench against the copper pipe to listen for trapped crew response.',
      flowPrompt: 'Cinematic medium shot of female engineer Rhea kneeling on a slippery catwalk, holding an 18-inch heavy steel spanner against an insulated vertical copper acoustic pipe, ear pressed against the metal, listening intently, desperate focused expression, water reflections dancing on her face, moody atmospheric film still',
      flowNegativePrompt: 'smiling, crying hysterically, action hero, glamour portrait, brightly lit',
      narratorScript: 'Sound travels four times faster through solid steel pipe than through air. Rhea unclipped her eighteen-inch wrench and struck the conduit flange three times. One. Two. Three. She held her breath and waited.',
      wordCount: 36,
      cameraMovement: 'subtle_drift',
      overlayEffect: 'flicker_vignette',
      soundCue: { sfxType: 'metallic_creak', volume: 0.6 },
      highlightKeywords: ['four times faster through solid steel', 'struck the conduit flange three times', 'waited'],
      visualTheme: { primaryColor: '#0b191e', accentColor: '#38bdf8', contrast: 1.2, filmGrain: 0.12 },
    },

    // CHAPTER 3: THE RESPONSE (02:25 - 04:00)
    {
      id: 'slide_09',
      slideNumber: 9,
      chapterIndex: 3,
      chapterTitle: 'Human Encounter: Trapped Shift Crew',
      timecodeStart: '02:25',
      timecodeEnd: '02:45',
      durationSeconds: 20,
      storyBeat: 'The Mechanical Answer',
      visualDescription: 'Sound waves and vibration shivering through damp condensation on the pipe. A hollow, rhythmic metallic echo answers back.',
      flowPrompt: 'Macro shot of water droplets vibrating and dancing across the surface of a heavily oxidized copper industrial pipe in a flooded subterranean vault, ripples forming in the beads of moisture from deep sonic reverberation, moody teal and amber backlighting, shallow depth of field, high detail cinematic macro',
      flowNegativePrompt: 'abstract sci-fi lasers, digital sound waves, clean studio, bright colors',
      narratorScript: 'The answer came back in two seconds. But it was not three knocks. It was eight. Eight even, measured thuds through thirty feet of submerged iron. The same cadence that was vibrating the pressure needle on Basin Three.',
      wordCount: 40,
      cameraMovement: 'slow_push_in',
      overlayEffect: 'dust_motes',
      soundCue: { sfxType: 'sub_bass_pulse_55hz', volume: 0.95 },
      highlightKeywords: ['eight even, measured thuds', 'same cadence', 'thirty feet of submerged iron'],
      visualTheme: { primaryColor: '#081418', accentColor: '#f97316', contrast: 1.35, filmGrain: 0.18 },
    },
    {
      id: 'slide_10',
      slideNumber: 10,
      chapterIndex: 3,
      chapterTitle: 'Human Encounter: Trapped Shift Crew',
      timecodeStart: '02:45',
      timecodeEnd: '03:05',
      durationSeconds: 20,
      storyBeat: 'Revealing the Shift Supervisor',
      visualDescription: 'Blueprint diagram overlaid on the subterranean architecture, highlighting the sealed emergency valve bypass chamber.',
      flowPrompt: 'Cinematic visual of a vintage weathered blueprint architectural cross-section of the harbor drainage network, glowing dimly in amber sodium lantern light on an engineer workbench, water droplets staining the linen paper, mysterious hand-drawn red ink annotations over Basin Three, documentary aesthetic',
      flowNegativePrompt: 'digital holograms, modern CAD screens, pristine vector graphic, white background',
      narratorScript: 'The shift supervisor was Mara Ilyan. Mara was fifty-eight years old, with thirty years of municipal drainage experience. She knew that in a subterranean flood, human beings never hammer eight times. You hammer three times for distress. Eight times was an automated mechanical pump code.',
      wordCount: 46,
      cameraMovement: 'pan_right_to_left',
      overlayEffect: 'dust_motes',
      soundCue: { sfxType: 'generator_hum', volume: 0.4 },
      highlightKeywords: ['Mara Ilyan', 'human beings never hammer eight times', 'automated mechanical pump code'],
      visualTheme: { primaryColor: '#0e1c22', accentColor: '#fbbf24', contrast: 1.2, filmGrain: 0.14 },
    },
    {
      id: 'slide_11',
      slideNumber: 11,
      chapterIndex: 3,
      chapterTitle: 'First Evidence: Moving to the Pulse',
      timecodeStart: '03:05',
      timecodeEnd: '03:25',
      durationSeconds: 20,
      storyBeat: 'The Mysterious Silhouettes',
      visualDescription: 'Looking down the long submerged archway. Through the rising mist, shadowy figures stand frozen in water up to their waists, completely motionless.',
      flowPrompt: 'Haunting cinematic long shot down a flooded subterranean brick tunnel, thick sea mist hanging in the cold air, distant silhouettes of four workers standing in waist-deep water, perfectly motionless facing a massive pulsating turbine wall, eerie amber backlighting through steam, psychological thriller, high suspense',
      flowNegativePrompt: 'zombies, gore, monsters, cartoon ghosts, bright neon, action pose',
      narratorScript: 'Fifty yards down the gallery, the sodium emergency fixture flickered to life. Through the haze of steam and salt spray, Rhea saw four figures standing in waist-deep water. They were not screaming. They were not trying to climb the access ladders.',
      wordCount: 43,
      cameraMovement: 'slow_push_in',
      overlayEffect: 'salt_fog',
      soundCue: { sfxType: 'sub_bass_pulse_55hz', volume: 0.9 },
      highlightKeywords: ['four figures standing', 'not screaming', 'not trying to climb'],
      visualTheme: { primaryColor: '#07151a', accentColor: '#38bdf8', contrast: 1.4, filmGrain: 0.2 },
    },
    {
      id: 'slide_12',
      slideNumber: 12,
      chapterIndex: 3,
      chapterTitle: 'First Evidence: Moving to the Pulse',
      timecodeStart: '03:25',
      timecodeEnd: '03:45',
      durationSeconds: 20,
      storyBeat: 'The Stillness Anomaly',
      visualDescription: 'Closer view of the workers. Their heads are tilted upward toward the heavy main conduit pipe, swaying subtly in unison with the vibration.',
      flowPrompt: 'Eerie cinematic medium shot of municipal utility crew workers in heavy yellow-green wet-weather gear, standing motionless in flooded subterranean tunnel, heads tilted upward in collective trance toward a massive iron overhead pipe, subtle rhythmic swaying, steam rising from their breath, chilling psychological thriller atmosphere',
      flowNegativePrompt: 'horror movie blood, cartoon, bright sunny light, comedic, jump scare face',
      narratorScript: 'They were swaying. A barely perceptible, rhythmic tilt of the shoulders that matched the fifty-five hertz mechanical frequency shuddering through the concrete foundation. They were not listening for help. They were listening to the water.',
      wordCount: 38,
      cameraMovement: 'subtle_drift',
      overlayEffect: 'flicker_vignette',
      soundCue: { sfxType: 'sub_bass_pulse_55hz', volume: 1.0 },
      highlightKeywords: ['swaying', 'fifty-five hertz mechanical frequency', 'listening to the water'],
      visualTheme: { primaryColor: '#09181d', accentColor: '#e06c43', contrast: 1.3, filmGrain: 0.16 },
    },

    // CHAPTER 4: THE CLIMAX & DISCOVERY (03:45 - 05:00)
    {
      id: 'slide_13',
      slideNumber: 13,
      chapterIndex: 4,
      chapterTitle: 'Climax & Cliffhanger: The Second Pulse',
      timecodeStart: '03:45',
      timecodeEnd: '04:05',
      durationSeconds: 20,
      storyBeat: 'The Decision to Manually Trip the Emergency Siphon',
      visualDescription: 'Rhea reaching for the emergency red manual siphon release wheel on the high mezzanine platform.',
      flowPrompt: 'Dramatic low-angle cinematic shot of female engineer Rhea reaching with both hands to turn a massive red cast-iron mechanical release valve wheel mounted on steel mezzanine, sea water violently geysering from ruptured flange below, strained effort, determined expression, industrial survival atmosphere',
      flowNegativePrompt: 'casual look, modern office, superhero, shiny clean, smiling',
      narratorScript: 'If the siphon wasn’t broken within sixty seconds, the lower level would pressurize and seal the vault permanently. Rhea climbed to the high mezzanine and threw her entire body weight against the primary emergency siphon trip wheel.',
      wordCount: 39,
      cameraMovement: 'impact_snap_zoom',
      overlayEffect: 'heavy_rain',
      soundCue: { sfxType: 'metallic_creak', volume: 0.95 },
      highlightKeywords: ['pressurize and seal', 'sixty seconds', 'emergency siphon trip wheel'],
      visualTheme: { primaryColor: '#0f181c', accentColor: '#ef4444', contrast: 1.35, filmGrain: 0.15 },
    },
    {
      id: 'slide_14',
      slideNumber: 14,
      chapterIndex: 4,
      chapterTitle: 'Climax & Cliffhanger: The Second Pulse',
      timecodeStart: '04:05',
      timecodeEnd: '04:25',
      durationSeconds: 20,
      storyBeat: 'The Pressure Release & Vacuum Shatter',
      visualDescription: 'Massive blast of compressed air and ocean foam violently blowing outward as the vacuum seal shatters.',
      flowPrompt: 'Explosive cinematic shot inside flooded industrial tunnel, massive blast of pressurized white sea foam and compressed vapor bursting from an opened relief valve, water cascading over concrete baffles, violent dynamic motion frozen in time, high contrast dramatic lighting, moody film still',
      flowNegativePrompt: 'fire explosion, cartoon blast, CGI fireworks, sunny beach',
      narratorScript: 'The teeth of the bronze dog gear slipped, bit, and fractured with the sound of a rifle shot. A blast of super-compressed air erupted from the relief vent, tearing through the surface water and breaking the siphon vacuum.',
      wordCount: 39,
      cameraMovement: 'slow_pull_out',
      overlayEffect: 'heavy_rain',
      soundCue: { sfxType: 'alarm_distant', volume: 0.8 },
      highlightKeywords: ['sound of a rifle shot', 'breaking the siphon vacuum'],
      visualTheme: { primaryColor: '#0a1a20', accentColor: '#f59e0b', contrast: 1.4, filmGrain: 0.2 },
    },
    {
      id: 'slide_15',
      slideNumber: 15,
      chapterIndex: 4,
      chapterTitle: 'Climax & Cliffhanger: The Second Pulse',
      timecodeStart: '04:25',
      timecodeEnd: '04:45',
      durationSeconds: 20,
      storyBeat: 'The Sudden Silence',
      visualDescription: 'The water begins draining downward into the lower conduits. The workers on the catwalk suddenly snap out of their stance, disoriented.',
      flowPrompt: 'Cinematic wide shot of the flooded drainage gallery, water visibly swirling and rapidly draining down massive floor gratings, the utility workers stumbling forward on the slippery walkway disoriented, flashlight beams crisscrossing through settling mist, quiet aftermath tension',
      flowNegativePrompt: 'celebrating party, sunny daylight, funny face, cheerful',
      narratorScript: 'The roar stopped. The water levels began to recede by an inch every ten seconds. Down on the walkway, the four workers blinked, stumbled against the handrail, and grabbed their heads in confusion, as if waking from a deep narcotic sleep.',
      wordCount: 42,
      cameraMovement: 'slow_push_in',
      overlayEffect: 'salt_fog',
      soundCue: { sfxType: 'water_drip_echo', volume: 0.65 },
      highlightKeywords: ['recede by an inch every ten seconds', 'deep narcotic sleep'],
      visualTheme: { primaryColor: '#091519', accentColor: '#38bdf8', contrast: 1.25, filmGrain: 0.14 },
    },
    {
      id: 'slide_16',
      slideNumber: 16,
      chapterIndex: 4,
      chapterTitle: 'Climax & Cliffhanger: The Second Pulse',
      timecodeStart: '04:45',
      timecodeEnd: '05:00',
      durationSeconds: 15,
      storyBeat: 'The Cliffhanger Question',
      visualDescription: 'Wide cinematic shot of the outer Ternfall harbor at night through the open storm portal. Deep in the dark bay, an identical rhythmic beacon pulses under the surface.',
      flowPrompt: 'Breathtaking cinematic wide shot looking out from a massive arched concrete sea portal onto the stormy black ocean bay of Ternfall at 4:00 AM, heavy rain pouring into the dark swells, deep underwater in the harbor a faint rhythmic amber light pulses beneath the surface, chilling mystery cliffhanger, master film cinematography',
      flowNegativePrompt: 'bright sunny day, cruise ship, tourist town, colorful lights',
      narratorScript: 'The crisis at Basin Three was averted. But as Rhea looked out through the seawall portal into the black harbor water, the needle on her belt gauge began to twitch again. And this time, the pulse was answering from out at sea.',
      wordCount: 43,
      cameraMovement: 'slow_push_in',
      overlayEffect: 'heavy_rain',
      soundCue: { sfxType: 'sub_bass_pulse_55hz', volume: 1.0 },
      highlightKeywords: ['needle on her belt gauge', 'twitch again', 'answering from out at sea'],
      visualTheme: { primaryColor: '#051116', accentColor: '#e06c43', contrast: 1.45, filmGrain: 0.22 },
    },
  ];

  const totalDuration = slides.reduce((acc, s) => acc + s.durationSeconds, 0);
  const totalWords = slides.reduce((acc, s) => acc + s.wordCount, 0);

  return {
    episodeId: 'S01E001',
    title: 'The Siphon of Basin Three',
    subtitle: 'The Quiet Hours: Ternfall (Episode 1)',
    totalDurationSeconds: totalDuration,
    totalSlides: slides.length,
    totalWordCount: totalWords,
    avgWpm: Math.round((totalWords / totalDuration) * 60),
    aspectRatio: '16:9',
    googleFlowCreditsCost: 0,
    estimatedRenderTimeSecondsOnMX330: 75,
    slides,
  };
}

export interface ColorGradingPreset {
  id: string;
  name: string;
  description: string;
  ffmpegFilter: string;
  cssFilter: string;
}

export const COLOR_GRADING_PRESETS: ColorGradingPreset[] = [
  {
    id: 'fincher_nordic',
    name: 'Fincher 35mm Cold Nordic',
    description: 'Cold slate cyan shadows with warm sodium tungsten highlights. The standard for prestige psychological thrillers.',
    ffmpegFilter: 'eq=contrast=1.18:saturation=0.88,colorbalance=rs=-0.05:gs=0.01:bs=0.06:rh=0.04:gh=0.02:bh=-0.02',
    cssFilter: 'contrast(1.18) saturate(0.88) hue-rotate(-5deg)',
  },
  {
    id: 'lemmino_investigative',
    name: 'LEMMINO Deep Ocean Teal',
    description: 'Deep maritime teal and charcoal black shadows. Maximizes curiosity and documentary dread.',
    ffmpegFilter: 'eq=contrast=1.22:saturation=0.82:brightness=-0.02,colorbalance=rs=-0.08:gs=0.02:bs=0.09',
    cssFilter: 'contrast(1.22) saturate(0.82) brightness(0.98)',
  },
  {
    id: 'surveillance_1984',
    name: '1984 Municipal Analog Tape',
    description: 'Muted desaturated palette with subtle vintage analog warmth and industrial grit.',
    ffmpegFilter: 'eq=contrast=1.12:saturation=0.72:brightness=0.01,colorbalance=rs=0.03:gs=0.02:bs=-0.04',
    cssFilter: 'contrast(1.12) saturate(0.72) sepia(0.08)',
  },
  {
    id: 'clean_broadcast',
    name: '10-Bit Broadcast Master',
    description: 'Neutral, clean color profile with maximum dynamic range and natural tones.',
    ffmpegFilter: 'eq=contrast=1.05:saturation=1.02',
    cssFilter: 'contrast(1.05) saturate(1.02)',
  },
];

/**
 * Retired: the old scripts fabricated placeholders and unverified success.
 */
export function generateThinkPadT14RenderScripts(_episode: VideoEssayEpisode, _colorGradeId = 'fincher_nordic'): { windowsBat: string; linuxSh: string; singleShotExample: string } {
  throw new Error('Legacy Video Essay render-script export is retired. Use Local Render with supplied assets and measured QC.');
}

/**
 * Generates an SRT and WebVTT caption string from the video essay slides.
 */
export function generateVideoEssaySrt(slides: IllustratedSlide[]): string {
  let srt = '';
  let index = 1;

  slides.forEach((s) => {
    const startSec = parseTimeToSeconds(s.timecodeStart);
    const endSec = parseTimeToSeconds(s.timecodeEnd);

    srt += `${index}\n`;
    srt += `${formatSrtTimestamp(startSec)} --> ${formatSrtTimestamp(endSec)}\n`;
    srt += `${s.narratorScript}\n\n`;
    index++;
  });

  return srt;
}

/**
 * Generates YouTube Description with Clickable Timestamps
 */
export function generateVideoEssayYouTubeDescription(episode: VideoEssayEpisode): string {
  const chaptersMap = new Map<string, string>();
  episode.slides.forEach((s) => {
    if (!chaptersMap.has(s.chapterTitle)) {
      chaptersMap.set(s.chapterTitle, s.timecodeStart);
    }
  });

  let chaptersList = '';
  chaptersMap.forEach((time, title) => {
    chaptersList += `${time} - ${title}\n`;
  });

  return `${episode.title} | ${episode.subtitle}
An original animated thriller investigation into the subterranean sea locks of Basin Three.

⏱ TIMESTAMPS:
${chaptersList}
05:00 - End Credits & Next Episode Clues

🎙 NARRATION & PRODUCTION:
Story & Lore: Ternfall Studio Original Series
Sound Design: Sub-55Hz Analog Frequency Engineering
Master Visuals: Zero-Credit Google Flow Master Keyframe Generation

⚠️ SYNTHETIC MEDIA DISCLOSURE:
This production features original illustrated narrative artwork and synthetic speech generation, with 100% human-directed creative writing, canon engineering, and historical civil defense research.

#Ternfall #Audiobook #MysteryThriller #IllustratedStory #VideoEssay #SurvivalThriller`;
}

function parseTimeToSeconds(timecode: string): number {
  const parts = timecode.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function formatSrtTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = 0;

  const pad = (n: number, w: number = 2) => String(n).padStart(w, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
}

export interface NarratorVoicePersona {
  id: string;
  name: string;
  edgeVoice: string;
  locale: string;
  role: string;
  description: string;
  pitchMod: string; // e.g. "-4Hz"
  rateMod: string; // e.g. "-5%"
  samplePhrase: string;
  browserKeywords: string[];
}

export const NARRATOR_PERSONAS: NarratorVoicePersona[] = [
  {
    id: 'ryan_uk_investigator',
    name: 'Ryan (BBC Documentary / LEMMINO Style)',
    edgeVoice: 'en-GB-RyanNeural',
    locale: 'en-GB',
    role: 'Forensic Mystery Investigator',
    description: 'Measured, cold British RP. The signature sound of high-retention investigative documentaries.',
    pitchMod: '-3Hz',
    rateMod: '-5%',
    samplePhrase: 'At three minutes past midnight, the hydraulic sensors at Basin Three went completely silent.',
    browserKeywords: ['Ryan', 'Natural', 'George', 'Daniel', 'UK English Male', 'en-GB'],
  },
  {
    id: 'christopher_us_baritone',
    name: 'Christopher (Deep Cinematic Baritone)',
    edgeVoice: 'en-US-ChristopherNeural',
    locale: 'en-US',
    role: 'Grim Survivalist / Action Trailer',
    description: 'Deep resonant chest voice with heavy gravitas. Ideal for catastrophic breaches and high dread.',
    pitchMod: '-5Hz',
    rateMod: '-8%',
    samplePhrase: 'When the sea breached the secondary lock, there were no emergency protocols left to follow.',
    browserKeywords: ['Christopher', 'Guy', 'David', 'US English Male', 'Natural', 'en-US'],
  },
  {
    id: 'sonia_uk_forensic',
    name: 'Sonia (Cold Forensic Analyst)',
    edgeVoice: 'en-GB-SoniaNeural',
    locale: 'en-GB',
    role: 'Psychological Thriller / Intelligence',
    description: 'Clinical, chilling, unflinching cadence. Excellent for official incident breakdowns.',
    pitchMod: '-2Hz',
    rateMod: '-4%',
    samplePhrase: 'The maintenance logs from October 1984 were never classified. They simply ceased to exist.',
    browserKeywords: ['Sonia', 'Libby', 'Natasha', 'Victoria', 'en-GB', 'Female'],
  },
  {
    id: 'guy_us_broadcast',
    name: 'Guy (Authoritative US Broadcast)',
    edgeVoice: 'en-US-GuyNeural',
    locale: 'en-US',
    role: 'Investigative Journalist / Frontline',
    description: 'Crisp, articulate American tenor with urgency and commanding presence.',
    pitchMod: '-2Hz',
    rateMod: '-3%',
    samplePhrase: 'Engineers who descended into the lower conduits reported an acoustic frequency they could feel in their chest.',
    browserKeywords: ['Guy', 'Natural', 'Eric', 'en-US'],
  },
  {
    id: 'william_au_veteran',
    name: 'William (Weathered Maritime Veteran)',
    edgeVoice: 'en-AU-WilliamNeural',
    locale: 'en-AU',
    role: 'Gritty Survivalist / Harbor Watcher',
    description: 'Weathered, gravelly coastal cadence with natural grit and survivalist authenticity.',
    pitchMod: '-4Hz',
    rateMod: '-6%',
    samplePhrase: 'Anyone who spent a winter on the North Basin knows what happens when the salt fog rolls in.',
    browserKeywords: ['William', 'Russell', 'en-AU'],
  },
];

/**
 * Retired: Edge-TTS is an online service and this export lacked a consent boundary.
 */
export function generateEdgeTtsScript(_episode: VideoEssayEpisode, _personaId = 'ryan_uk_investigator', _rateOverride?: string, _pitchOverride?: string): string {
  throw new Error('Legacy Edge-TTS script export is retired; it sends narration to an external service.');
}

/**
 * Retired: unverified legacy Shorts export.
 */
export function generateShortsRenderScript(_episode: VideoEssayEpisode): string {
  throw new Error('Legacy Video Essay Shorts script export is retired.');
}

/**
 * Retired: unverified legacy pipeline export.
 */
export function generateMasterOrchestratorScript(_episode: VideoEssayEpisode, _personaId = 'ryan_uk_investigator', _colorGradeId = 'fincher_nordic'): string {
  throw new Error('Legacy Video Essay master script export is retired.');
}

/**
 * Returns the complete Season 1 Episode Catalog for Ternfall Studio.
 */
export function getEpisodesCatalog(): VideoEssayEpisode[] {
  const ep1 = getPilotVideoEssayData();

  // Episode 2: The Echo in the Conduits
  const ep2Slides: IllustratedSlide[] = [
    {
      id: 's02_01',
      slideNumber: 1,
      chapterIndex: 1,
      chapterTitle: 'The Harmonic Vibration',
      timecodeStart: '00:00',
      timecodeEnd: '00:16',
      durationSeconds: 16,
      storyBeat: 'Acoustic Resonance Discovery',
      visualDescription: 'Subterranean concrete conduit junction, condensation vibrating into concentric acoustic wave patterns on dark pool water.',
      flowPrompt: 'Cinematic wide interior shot of a subterranean circular concrete drainage conduit, standing dark saltwater pool forming perfect concentric sonic vibration rings, sodium vapor bulb hanging on damp cable, cold maritime thriller, 35mm film still, photorealistic',
      flowNegativePrompt: 'bright colors, modern sci-fi, cartoon, plastic textures',
      narratorScript: 'Three days after Basin Three was sealed, the municipal telemetry center recorded an acoustic frequency that structural sensors had never observed before.',
      wordCount: 22,
      cameraMovement: 'slow_push_in',
      overlayEffect: 'water_ripples',
      soundCue: { sfxType: 'sub_bass_pulse_55hz', volume: 0.85 },
      highlightKeywords: ['acoustic frequency', 'structural sensors'],
      visualTheme: { primaryColor: '#08171c', accentColor: '#38bdf8', contrast: 1.25, filmGrain: 0.15 },
    },
    {
      id: 's02_02',
      slideNumber: 2,
      chapterIndex: 1,
      chapterTitle: 'The Harmonic Vibration',
      timecodeStart: '00:16',
      timecodeEnd: '00:34',
      durationSeconds: 18,
      storyBeat: 'The Human Ear Threshold',
      visualDescription: 'Lead audio investigator Thomas Vance kneeling on iron catwalk with analog reel-to-reel Nagra recorder and parabolic microphone.',
      flowPrompt: 'Cinematic medium shot, 45-year-old audio investigator in heavy wool coat holding an analog directional microphone toward dark flooded conduit, vintage Nagra reel-to-reel recorder on rusted metal case, cold blue fog, muted industrial grading, film grain',
      flowNegativePrompt: 'digital gear, smartphones, bright sunlight, clean room',
      narratorScript: 'Fifty-five hertz is at the bottom edge of human hearing. You do not hear it with your ears. You feel it in your jawbone, vibrating behind your teeth like an idling turbine.',
      wordCount: 31,
      cameraMovement: 'pan_left_to_right',
      overlayEffect: 'salt_fog',
      soundCue: { sfxType: 'generator_hum', volume: 0.7 },
      highlightKeywords: ['Fifty-five hertz', 'vibrating behind your teeth'],
      visualTheme: { primaryColor: '#0a1d22', accentColor: '#f59e0b', contrast: 1.2, filmGrain: 0.14 },
    },
    {
      id: 's02_03',
      slideNumber: 3,
      chapterIndex: 1,
      chapterTitle: 'The Conduits',
      timecodeStart: '00:34',
      timecodeEnd: '00:54',
      durationSeconds: 20,
      storyBeat: 'The Resonance Cavity',
      visualDescription: 'Blueprints of the 1938 sea gates illuminated by amber desk lamp with red grease pencil circles around subterranean air shafts.',
      flowPrompt: 'Cinematic top-down view of weathered maritime architectural blueprints from 1938 spread on wooden drafting table, red grease pencil markings highlighting subterranean drainage lock chambers, brass compass and magnifying glass, moody side-lighting, film still',
      flowNegativePrompt: 'CAD software, computer monitor, clean modern paper',
      narratorScript: 'When the engineers consulted the original 1938 harbor schematics, they realized the conduits had not been built to drain water. They had been built as acoustic resonators.',
      wordCount: 27,
      cameraMovement: 'slow_pull_out',
      overlayEffect: 'dust_motes',
      soundCue: { sfxType: 'metallic_creak', volume: 0.6 },
      highlightKeywords: ['1938 harbor schematics', 'acoustic resonators'],
      visualTheme: { primaryColor: '#0b1619', accentColor: '#10b981', contrast: 1.3, filmGrain: 0.16 },
    },
    ...ep1.slides.slice(3, 18).map((s, idx) => ({
      ...s,
      id: `s02_${idx + 4}`,
      slideNumber: idx + 4,
      chapterTitle: `Investigation: Chamber ${idx + 1}`,
    })),
  ];

  const ep2: VideoEssayEpisode = {
    episodeId: 'S01E02',
    title: 'The Echo in the Conduits',
    subtitle: 'The 55Hz Subterranean Resonance Frequency',
    totalDurationSeconds: ep2Slides.reduce((acc, s) => acc + s.durationSeconds, 0),
    totalSlides: ep2Slides.length,
    totalWordCount: ep2Slides.reduce((acc, s) => acc + s.wordCount, 0),
    avgWpm: 142,
    aspectRatio: '16:9',
    googleFlowCreditsCost: 0,
    estimatedRenderTimeSecondsOnMX330: 55,
    slides: ep2Slides,
  };

  return [ep1, ep2];
}
