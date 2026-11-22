// ============================================================================
//  VAPE KAYAK — every balance number lives in this file.
//  Units: pixels (logical 360-wide screen), seconds, px/s unless noted.
// ============================================================================

export const VERSION = '0.2.0';
// Developer options: tap the version number on the title screen, then enter this code.
export const DEV_CODE = '1980';

export const VIEW = {
  W: 360,            // logical width (fixed)
  H_MIN: 640,        // 9:16
  H_MAX: 800,        // taller phones get more river instead of black bars
  PLAYER_Y: 0.68,    // kayak sits this far down the screen
};

export const COLORS = { BG: '#000000', FG: '#ffffff', GINGER: '#ff5a1f', ENEMY: '#ff1a2e', VAPE: '#a9d6f5', CASH: '#38d65a', TEA: '#9b5a2a' };   // ENEMY = thin outline on hostiles

export const WORLD = { PX_PER_M: 20 };

export const PLAYER = {
  SPEED_START: 105,       // scroll speed at 0 m
  SPEED_MAX: 190,         // scroll speed at SPEED_RAMP_M
  SPEED_RAMP_M: 2600,
  NUDGE: 250,             // lateral impulse per tap
  NUDGE_FRICTION: 7,      // higher = shorter, sharper nudge
  HOLD_REPEAT: 0.15,      // holding a side repeats the nudge
  TILT_SPEED: 230,        // max lateral speed from tilt
  TILT_FULL_DEG: 22,      // tilt angle for full speed
  HIT_W: 4, HIT_H: 12,    // half-size of the (forgiving) hitbox
  HP: 100,                // starting health; shown as a percentage of this
  HIT_DMG: 34,            // health lost per hit (enemy, debris, sandbar, vortex core, red bank)
  INVULN_HIT: 1.3,
  INVULN_LEVELUP: 1.2,
  PICKUP_R: 13,
  MAGNET_R: 34,
  MAGNET_PULL: 320,
};

export const ENGINE = {      // Vape Engine (meta unlock)
  SPEED_MULT: 1.1,
  TUNING_SPEED: 0.02,                    // extra base speed per Engine Tuning level
  BURST_ADD: [24, 28, 33, 38, 45, 52],   // per vape, indexed by Engine Tuning level (0 = engine only)
  BURST_CAP: [80, 100, 120, 140, 165, 190], // top speed reached at the fifth tuning level
  BURST_DECAY: 1.5,              // exponential decay rate
  SHAKE: 0.75,
};

// cosmetic: every so often she takes a drag and the cloud drifts off behind
export const VAPING = { EVERY: [3.5, 7], DRAG: 0.6, EXHALE: 1.0, PUFF_EVERY: 0.11 };

export const XP = {
  // vapes-worth of XP to clear level `lvl`. First level-up lands at FIRST vapes, then each level costs more.
  FIRST: 50, STEP: 20, CURVE: 1.5,
  need: (lvl) => Math.round(XP.FIRST + XP.STEP * (lvl - 1) + XP.CURVE * (lvl - 1) * (lvl - 1)),
  VAPE: 1, BIG_VAPE: 5,
};

export const PICKUPS = {
  BIG_MULT: 5,
  BIG_CHANCE: 0.05,          // chance a pattern vape is upgraded to a big one
  SPIN_BASE: 5, SPIN_BIG: 2.5,
  SPIN_ACCEL: 2.2,           // rad/s gained per second on screen
  TEA_CHUNK_CHANCE: 0.07,    // chance a chunk has a cup of tea (heals a heart)...
  TEA_HURT_MULT: 3,          // ...multiplied when you're below full health
  TEA_HEAL: 34,
  TEA_FULL_XP: 5,            // XP instead, if already at full health
  CASH_VALUE: 5,
  CASH_CHUNK_CHANCE: 0.3,    // chance a chunk hides a cash bag
  DENSITY_PER_M: 0.00012,    // extra vapes in patterns per metre travelled
};

export const BIOMES = {
  NAMES: ['BRITISH CANAL', 'DESERT CANAL', 'VOLCANO CANAL', 'THE OPEN SEA'],
  EDGE_MARGIN: 50,           // the water never comes closer than this to the screen edge, so some bank always shows
  // riverbanks: [bright edge, land colour] per biome. The land fades to black towards the screen edges
  // through ordered dither. FADE rows are [distance from the edge, band width, pixel density].
  BANK_COLORS: [['#4dff6a', '#1f9a3c'], ['#ffe04a', '#c9871c'], ['#ff5a3c', '#b0161f'], ['#ff5a3c', '#b0161f']],
  BANK_FADE: [[0, 12, 1], [12, 24, 0.5], [36, 36, 0.25]],   // like the PICO-8 cart: solid, chequered, sparse
  BANK_DITHER_PX: 3,         // size of one dither square (a PICO-8 pixel is about 3 of ours)
  DESERT_AT: 650,            // metres where the blend into desert starts
  JUNGLE_AT: 1700,
  SEA_AT: 2500,              // the red river opens out into the sea (level 4)
  BLEND: 220,                // metres a transition takes
  WIDTH: [186, 236, 172, 3600],   // canal width per biome (the sea is so wide the banks leave the screen)
  MEANDER: 52,               // max sideways wander of the canal centre
  CHUNK_GAP: [150, 130, 105, 90],// clear water between chunks
  // chunk pattern weights per biome [canal, desert, jungle]
  CHUNKS: {
    snake:    [5, 3, 3],
    lanes:    [3, 2, 1],
    cluster:  [1, 5, 2],
    barge:    [3, 2, 1],
    bridge:   [2, 1, 0.5],
    lock:     [1.5, 0.5, 0],
    debris:   [2, 1, 1],
    vortex:   [0.6, 1.5, 4],
    sandbars: [0, 4, 0],
    vines:    [0, 0, 5],
  },
};

// Shield from the shop: recharge time in seconds per level. Big enemies (crocs) ignore it.
// Ramming: while boosting, the very tip of the kayak destroys any enemy it hits, at the cost of some boost.
// The rest of the kayak stays vulnerable. (Boost comes from the Vape Engine.)
export const RAM = { MIN_BURST: 30, TIP_Y: 17, TIP_W: 3, TIP_H: 4, BOOST_KEEP: 0.5, BOOST_KEEP_BIG: 0.2 };

// Level 4: the open sea. The river widens until the banks are gone, the camera follows the kayak sideways,
// and enemies close in from every side in growing waves until you sink. Lighthouses dot the sea: each one's
// fixed beam points at the next. Reaching one (it is not a vape shop) adds damage to every weapon.
export const SEA = {
  SPEED_MULT: 0.5,            // forward drift is slower out here: it's an arena, not a race
  CAM_FOLLOW: 3,              // how quickly the camera catches the kayak
  // free roam: in open water you paddle any direction with a floating analog stick (or arrows / WASD)
  ROAM_SPEED: 135,            // top paddling speed (x Big Paddle; the Vape Engine's boost adds on top)
  ROAM_ACCEL: 14,             // snappy, like DOGPARK: she's at the stick's speed almost at once...
  ROAM_STOP: 12,              // ...and stops almost at once when you let go
  JOY_DEAD: 0.16, JOY_MIN: 0.34, JOY_CURVE: 1.5,   // DOGPARK's throttle: a dead zone, a slow creep, then up to full
  CURRENT: 0,
  DASH_MUL: 2.6, DASH_T: 0.24, DASH_CD: 1.1,       // dash: tap (or a second finger / Space): a burst you can't be hurt during
  AREA: 0.85,                 // her weapons reach a little less far out here
  TURN: 9,                    // how fast the kayak swings round to face her heading
  PLAYER_Y: 0.55,             // the kayak sits nearer the middle of the screen at sea
  CAM_LEAD: 0.4, CAM_LEAD_MAX: 90,   // the camera looks ahead in the direction you paddle
  PICKUP_EVERY: 1.3,          // a patch of vapes appears off screen around you this often
  CULL: 1000,                 // pickups and hazards this far away are tidied up
  RATE: 2.4,                  // enemies/sec when the sea starts...
  RATE_GROWTH: 0.045,         // ...growing by this fraction every second you survive
  WAVE_EVERY: 16,             // seconds between surround waves
  WAVE_BASE: 18, WAVE_GROW: 6, // a wave is a full ring of this many (+ GROW per wave)
  ENEMY_SPEED: 1.3,           // everything homes in on you, at this multiple of its normal speed...
  SPEED_GROWTH: 0.003,        // ...plus this much faster per second at sea
  HP_TAU: 50,                 // enemy health grows x2.7 every this many seconds at sea: the sea always wins in the end
  DESPAWN: 950,               // enemies this far away give up
  MAX_ALIVE: 280,
  TABLE: { swan: 2, pap: 3, piranha: 3, mozzie: 3, croc: 0.5, puffer: 1 },
  HP_MULT: 1,                 // sea enemy health x (1 + (build power / POWER_REF)^2): barely tougher for an ordinary build,
  POWER_REF: 13,              // much tougher for a stacked one (build power = weapon levels + 3 per evolution + half passive levels)
  VAPE_CLUSTERS: 3,           // vape patches scattered per sea chunk
  LIGHT_FIRST_M: 60,          // the first lighthouse, this far into the sea (nearly dead ahead)
  LIGHT_GAP_M: [120, 170],     // forward distance between lighthouses
  LIGHT_SIDE: [180, 460],     // and sideways
  LIGHT_R: 44,                // paddle this close to visit
  LIGHT_DMG: 0.1,             // +10% damage to every weapon per lighthouse visited
  BEAM_LEN: 1200, BEAM_SPREAD: 0.11,
  // killer whale pods: can't be vaped. Warned by a dotted line, then a pod sweeps across, surfacing and diving.
  // Only surfaced whales can hit you, and a hit capsizes the kayak. Political immunity doesn't help.
  ORCA_FIRST: 14, ORCA_EVERY: [9, 14], ORCA_EVERY_MIN: 5,   // seconds; the gap shrinks the longer you survive
  ORCA_WARN: 1.5, ORCA_SPEED: 250, ORCA_GAP: 62, ORCA_HIT_LEN: 26, ORCA_HIT_W: 11,
  ORCA_POD: [3, 8], ORCA_POD_GROW: 45,                     // pod size: +1 whale per this many seconds at sea
  ORCA_HIT: 1.6, ORCA_KNOCK: 330, ORCA_FLIP: 0.8,         // damage (x a normal hit), shove, seconds spinning
  GULL_FIRST: 25, GULL_EVERY: [7, 11], GULL_FLOCK: [5, 9],
  VORTEX_CHANCE: 0.12,        // whirlpools out at sea, per chunk
};

export const IMMUNITY = { COOLDOWN: [10, 8, 5, 3, 2], RADIUS: 21 };

// Late game: the banks turn red and hurt on contact, and extra hazards hug the sides.
export const BANKS = {
  DANGER_AT_M: 1500,          // distance where the banks go live
  PUSH: 170,                  // shove back toward the middle after touching one
  SIDE_DEBRIS_CHANCE: 0.7,    // per chunk: debris tucked against a bank
  SIDE_BARGE_CHANCE: 0.25,    // per chunk: a moored barge against a bank
};

export const HAZARDS = {
  DEBRIS: { trolley: [12, 9], barrel: [6, 5], cone: [6, 5] },   // collision half-sizes [w, h] per kind
  VORTEX_R: 64, VORTEX_PULL: 300, VORTEX_CORE: 9,
  VORTEX_JUNGLE_MULT: 1.6,
  SANDBAR_SLOW: 0.45, VINE_SLOW: 0.55, VINE_STEER: 0.35,
  SLOW_RECOVER: 0.3,           // after a snag, speed climbs back steadily: this much of full speed per second
  BARGE_MOVE_CHANCE_PER_KM: 0.3,
  BARGE_VX: 18,
  FAKE_REVEAL: 120,            // heat-haze fakes vanish this close
};

// mode: drift = floats down, steering at you. chase = hunts you once close.
// turn = how sharply a chaser can change heading (rad/s): low = easy to side-step.
// stamina = seconds of chasing before it gives up and drifts off.
export const ENEMIES = {
  // hp: one level-1 vape cloud (9 damage) kills a swan or pap in the British canal. Desert and jungle enemies
  // are tougher, and every enemy gains HP_GROWTH_PER_KM, so damage upgrades are needed to keep one-shotting.
  swan:    { hp: 6,  r: 6, speed: 22, steer: 9,  mode: 'drift',  xp: 1, drop: 0.4 },
  pap:     { hp: 8,  r: 6, speed: 46, steer: 0,  mode: 'chase',  xp: 2, drop: 0.5, turn: 0.9, stamina: 5 },
  tumble:  { hp: 11, r: 6, speed: 30, steer: 70, mode: 'bounce', xp: 1, drop: 0.4 },
  piranha: { hp: 15, r: 5, speed: 66, steer: 0,  mode: 'chase',  xp: 2, drop: 0.45, turn: 1.3, stamina: 6 },
  mozzie:  { hp: 3,  r: 3, speed: 84, steer: 0,  mode: 'chase',  xp: 1, drop: 0.25, turn: 2.0, stamina: 7 },
  croc:    { hp: 70, r: 9, speed: 26, steer: 14, mode: 'drift',  xp: 8, drop: 1, big: true, tea: 0.3 },   // tea: chance to drop a cuppa
  // open sea only. resist: fraction of vape damage shrugged off
  puffer:  { hp: 16, r: 7, speed: 30, steer: 0,  mode: 'drift',  xp: 5, drop: 1, resist: 0.65 },   // puffs up when hit
  gull:    { hp: 6,  r: 5, speed: 190, steer: 0, mode: 'dive',   xp: 1, drop: 0.2 },                // dive-bombs in V flocks
};

export const SPAWN = {
  START_M: 50,                       // no enemies before this
  RATE: [0.55, 1.2, 3.2],             // enemies/sec per biome at biome start
  RATE_GROWTH_PER_KM: 0.7,           // multiplicative growth: rate *= 1 + km * this
  // enemy numbers also follow the player's level, so slow levellers aren't swamped and strong builds get a horde
  LEVEL_BASE: 0.55, LEVEL_PER: 0.045, LEVEL_MAX: 1.8,
  MAX_ALIVE: 150,
  HP_GROWTH_PER_KM: 0.35,           // enemy hp *= 1 + km * this
  PACK_CHANCE: [0.05, 0.15, 0.45],   // chance a spawn is a pack
  PACK_SIZE: [3, 5, 9],
  BEHIND_CHANCE: [0, 0.1, 0.25],     // chasers that come from behind
  CHASE_RANGE: 240,
  TABLE: [                           // weights per biome
    { swan: 5, pap: 2 },
    { swan: 1, pap: 4, tumble: 4, croc: 0.4 },
    { pap: 2, piranha: 5, mozzie: 6, croc: 0.8 },
  ],
};

// ---- In-run weapons. Each array entry is one level. -------------------------
export const WEAPONS = {
  cloud: {
    // each puff hits each enemy ONCE for `dmg`. Level 1 one-shots the canal's swans and paps;
    // tougher biomes (and enemy health growth with distance) need the upgrades.
    name: 'VAPE CLOUD', maxLvl: 6, speed: 95,
    levels: [
      { dirs: 1, dmg: 9,  cd: 1.05, size: 13, life: 0.5, prox: 95 },
      { dirs: 1, dmg: 12, cd: 0.9,  size: 15, life: 0.55, prox: 115 },
      { dirs: 3, dmg: 14, cd: 0.85, size: 16, life: 0.6 },
      { dirs: 3, dmg: 17, cd: 0.75, size: 18, life: 0.65 },
      { dirs: 4, dmg: 21, cd: 0.7,  size: 20, life: 0.7 },
      { dirs: 6, dmg: 26, cd: 0.6,  size: 22, life: 0.75 },
    ],
    evo: { dirs: 8, dmg: 40, cd: 0.36, size: 30, life: 0.95 },
    desc: ['', 'MORE DAMAGE, FASTER', 'THREE DIRECTIONS, ALWAYS ON', 'BIGGER, STRONGER', 'FOUR DIRECTIONS', 'SIX DIRECTIONS'],
  },
  trail: {
    name: 'VAPETRAIL', maxLvl: 5, tick: 0.25, every: 0.1,
    levels: [
      { dmg: 3, r: 11, life: 1.2 }, { dmg: 4, r: 13, life: 1.5 }, { dmg: 6, r: 15, life: 1.8 },
      { dmg: 8, r: 17, life: 2.2 }, { dmg: 10, r: 20, life: 2.6 },
    ],
    evo: { dmg: 18, r: 34, life: 4 },
    desc: ['HURTS ENEMIES', 'THICKER TRAIL', 'STRONGER TRAIL', 'LONGER TRAIL', 'MUCH THICKER TRAIL'],
  },
  nova: {
    name: 'BIG VAPE CLOUDS', maxLvl: 5, expand: 300,
    levels: [
      { dmg: 12, cd: 6, r: 85 }, { dmg: 18, cd: 5.4, r: 105 }, { dmg: 24, cd: 4.8, r: 125 },
      { dmg: 32, cd: 4.2, r: 150 }, { dmg: 42, cd: 3.6, r: 175 },
    ],
    evo: { dmg: 95, cd: 2.8, r: 440 },
    desc: ['A BIG VAPE CLOUD BILLOWS OUT AND CLEARS THE AREA', 'BIGGER CLOUD', 'FASTER, STRONGER', 'BIGGER CLOUD', 'HUGE CLOUD'],
  },
  storm: {
    // each orbiting cloud pops on the first enemy it touches (one hit for `dmg`), then regrows after `respawn` seconds
    name: 'VAPE STORM', maxLvl: 5, spin: 3.2, grow: 0.25,
    levels: [
      { n: 2, dmg: 10, r: 9,  orbit: 36, respawn: 3.5 }, { n: 3, dmg: 12, r: 10, orbit: 40, respawn: 3.0 },
      { n: 3, dmg: 15, r: 11, orbit: 46, respawn: 2.6 }, { n: 4, dmg: 18, r: 12, orbit: 52, respawn: 2.2 },
      { n: 5, dmg: 22, r: 13, orbit: 58, respawn: 1.8 },
    ],
    evo: { n: 7, dmg: 34, r: 16, orbit: 66, outer: 6, respawn: 1.0 },
    desc: ['CLOUDS ORBIT THE KAYAK AND POP ON ENEMIES', 'THIRD CLOUD', 'WIDER, STRONGER', 'FOURTH CLOUD', 'FIFTH CLOUD'],
  },
};

// ---- In-run passives. Value is per level. -----------------------------------
export const PASSIVES = {
  lungs:  { name: 'BIGGER VAPE BATTERY', maxLvl: 5, per: 0.2, desc: '+20% SIZE FOR EVERY CLOUD, RING AND TRAIL' },
  extra:  { name: '+1 CLOUD', maxLvl: 3, desc: '+1 CLOUD FOR EVERY WEAPON EXCEPT VAPETRAIL',
            novaGap: 0.3, miniRing: { size: 0.55, side: 55, up: 1.4 } },   // extra Big Vape Clouds follow 0.3s apart; extra rings are small, drift sideways and forward
  rings:  { name: 'VAPE RINGS',  maxLvl: 5, desc: 'BLOWS LARGE GROWING HOOPS THAT CUT THROUGH ENEMIES', speed: 60, band: 7,
            levels: [{ dmg: 10, cd: 3.2, r: 42, life: 1.4 }, { dmg: 14, cd: 2.9, r: 52, life: 1.5 }, { dmg: 18, cd: 2.6, r: 62, life: 1.6 },
                     { dmg: 24, cd: 2.3, r: 74, life: 1.7 }, { dmg: 30, cd: 2.0, r: 88, life: 1.8 }] },
  chain:  { name: 'CHAIN VAPER', maxLvl: 5, per: 0.08, desc: '-8% COOLDOWNS' },
  linger: { name: 'THICKER CLOUDS',     maxLvl: 5, per: 0.15, desc: '+15% CLOUD DURATION' },
  magnet: { name: 'DUTY FREE',   maxLvl: 5, per: 0.3,  desc: '+30% PICKUP RANGE' },
  paddle: { name: 'BIG PADDLE',  maxLvl: 3, per: 0.12, desc: '+12% STEERING' },
  hivis:  { name: 'HI-VIS VEST', maxLvl: 3, per: 34,   desc: '+34% MAX HEALTH AND A FULL HEAL' },
};

// weapon at max level + this passive (any level) => evolution offered
export const EVOLUTIONS = {
  cloud: { needs: 'lungs',  name: 'PEA SOUPER',     desc: 'EIGHT DIRECTIONS. NON-STOP. ENORMOUS.' },
  storm: { needs: 'chain',  name: 'HURRICANE ANGE', desc: 'A DOUBLE RING OF ANGRY WEATHER.' },
  nova:  { needs: 'rings',  name: 'MUSHROOM CLOUD', desc: 'CLEARS THE WHOLE SCREEN.' },
  trail: { needs: 'linger', name: 'CHEMTRAIL',      desc: 'A VAST, LINGERING WAKE OF FOG.' },
};

export const LEVELUP = { OWNED_WEIGHT: 3, NEW_WEIGHT: 1, EVO_WEIGHT: 8, FILLER_CASH: 10 };

// ---- Between-run shop. costs[] length = max level. --------------------------
export const SHOP = [
  { id: 'engine',  name: 'VAPE ENGINE',   costs: [40], desc: 'EVERY VAPE = SPEED BURST.', flavour: 'THE DESERT ISLAND ESSENTIAL.' },
  { id: 'turbo',   name: 'ENGINE TUNING', costs: [70, 140, 240, 360, 500], desc: 'FASTER, BIGGER SPEED BURSTS.', needs: 'engine', flavour: 'DEPUTY NO MORE. FULL STEAM AHEAD.' },
  { id: 'starter', name: 'WARM-UP PUFF',  costs: [80, 220], desc: 'START WITH A STRONGER CLOUD.', flavour: 'A CHEEKY ONE BEFORE CONFERENCE.' },
  { id: 'xp',      name: 'FAST LEARNER',  costs: [30, 60, 100, 160, 240], desc: '+10% XP.', per: 0.1, flavour: 'LEFT SCHOOL AT 16. LEARNT ANYWAY.' },
  { id: 'cash',    name: 'EXPENSES',      costs: [30, 60, 100, 160, 240], desc: '+20% CASH.', per: 0.2, flavour: 'AIRPODS SOLD SEPARATELY.' },
  { id: 'magnet',  name: 'MAGNETIC HAIR', costs: [25, 50, 90, 140, 200], desc: '+15% PICKUP RANGE.', per: 0.15, flavour: 'ATTRACTS VAPES AND HEADLINES.' },
  { id: 'heart',   name: 'THICK SKIN',    costs: [60, 120, 200, 300], desc: '+25% MAX HEALTH.', per: 25, flavour: 'FOR WHEN THE SUNDAY PAPERS CALL.' },
  { id: 'immunity', name: 'POLITICAL IMMUNITY', costs: [80, 150, 250, 400, 600], desc: 'SHIELD KILLS ENEMIES ON TOUCH.', flavour: 'RECHARGE 10S, THEN 8, 5, 3, 2.' },
];

// ---- flavour text (satire: sly nods to things on the public record) ---------
export const FLAVOUR = {
  DEATH_TITLES: ['SUNK!', 'SUNK!', 'RESIGNED!', 'RESHUFFLED!'],
  TIPS: [
    'ALWAYS CHECK WHICH HOME IS YOUR MAIN HOME.',
    'STAMP DUTY CANNOT BE DODGED. BARGES CAN.',
    'SPECIALIST ADVICE IS CHEAPER THAN RESIGNING.',
    'AIRPODS GO ON EXPENSES. VAPES DO NOT.',
    'FREE CLOTHES ARE NOT A POWER-UP. DECLARE THEM.',
    'SAVE THE DANCING FOR THE IBIZA DJ BOOTH.',
    'THE OPERA IS THE OTHER WAY. BRING CHAMPAGNE.',
    'DO NOT CALL THE SWANS SCUM. THEY REMEMBER.',
    'A KAYAK IS NOT A SECOND HOME. PROBABLY.',
  ],
  CAUSES: {
    dev: 'PULLED BY A DEVELOPER', orca: 'TOPPLED BY KILLER WHALES', puffer: 'SPIKED BY A PUFFERFISH', gull: 'DIVE-BOMBED BY GULLS',
    barge: "RAMMED SOMEONE'S SECOND HOME", pier: 'HIT A LOW BRIDGE', gate: 'HIT A LOCK GATE', vortex: 'DOWN THE PLUGHOLE',
    debris: 'SUNK BY FLY-TIPPING', bank: 'HIT THE RED WALL', sandbar: 'RAN AGROUND', swan: 'A SWAN TOOK IT PERSONALLY', pap: 'PAPPED MID-PUFF',
    tumble: 'TUMBLEWEEDED', piranha: 'NIBBLED BY THE BACKBENCHES', mozzie: 'BITTEN TO BITS', croc: 'SNAPPED UP',
  },
  BANK_SIGNS: ['SOLD', 'TO LET'],
};

// ---- legal / about screen (Settings > About & Legal) -------------------------
export const LEGAL = [
  'PARODY',
  'THIS IS A WORK OF SATIRE AND PARODY. IT IS NOT AFFILIATED WITH, ENDORSED BY OR CONNECTED TO ANY POLITICIAN, PARTY, COMPANY OR VAPE MAKER. ANY RESEMBLANCE IS FOR COMIC EFFECT. NOTHING HERE IS A STATEMENT OF FACT.',
  'FREE. NO PROFIT.',
  'THIS GAME IS FREE AND NON-COMMERCIAL. NO SALES, NO ADS, NO DONATIONS, NO PROFIT.',
  'PRIVACY',
  'NO ACCOUNTS, NO TRACKING, NO DATA COLLECTED. YOUR PROGRESS IS SAVED ONLY ON THIS DEVICE.',
  'MUSIC',
  'RIDING A UFO AND ARABIAN DANCER BY HARAYU, USED UNDER CREATIVE COMMONS CC-BY 3.0. TRIMMED AND LOOPED FOR THIS GAME. LINKS ARE ON THE GAME PAGE.',
  'RIGHTS',
  'NAMES, LIKENESSES AND MUSIC BELONG TO THEIR OWNERS AND ARE USED WITHOUT ANY CLAIM OF OWNERSHIP. RIGHTS HOLDERS: GET IN TOUCH VIA THE GAME PAGE AND IT WILL BE REMOVED.',
];

export const REWARD = { CASH_PER_100M: 1, CASH_PER_LEVEL: 1 };

export const MUSIC = {
  VOLUME: 0.5,
  MUFFLE_HZ: 550,          // low-pass cutoff while a menu is up
  MUFFLE_GAIN: 0.75,       // and slightly quieter
  XFADE: 2.5,              // seconds to crossfade between tracks
  FADE_IN_FIRST: 5,        // the very first music of a session eases in this slowly
  FADE_IN: 3,              // every later track start
  OPENER: 'river',         // plays once from the main menu into the run; then the biome tracks take over
  BIOME_TRACKS: ['ufo', 'arab', 'ufo', 'arab'],   // canal, desert, volcano, sea: the track changes when the scenery does
  MENU_BPM: 124,
  // loop points are in seconds within the trimmed files; found by waveform matching
  TRACKS: {
    river: { src: 'music/river.mp3', once: true, gain: 1.7 },                  // 8-bit cover supplied by the owner; plays through once
    ufo:  { src: 'music/ufo.mp3',  loopStart: 23.690356, loopEnd: 62.607 },   // "Riding a UFO": intro once, then B + A' forever
    arab: { src: 'music/arab.mp3', loopStart: 19.12,     loopEnd: 51.12 },    // "Arabian Dancer": quiet lead-in once, then the 32 s body
  },
};

export const JUICE = {
  SPEED_FX: 0.5,           // 0..1: how many / how long the speed lines are (1 = original)
  SHAKE_HIT: 6, SHAKE_KILL: 0.6, SHAKE_NOVA: 3, SHAKE_DEATH: 12,
  HITSTOP_DEATH: 0.45, MAX_FLOATERS: 48, MAX_PARTICLES: 500,
};
