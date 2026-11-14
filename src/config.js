// ============================================================================
//  VAPE KAYAK — every balance number lives in this file.
//  Units: pixels (logical 360-wide screen), seconds, px/s unless noted.
// ============================================================================

export const VIEW = {
  W: 360,            // logical width (fixed)
  H_MIN: 640,        // 9:16
  H_MAX: 800,        // taller phones get more river instead of black bars
  PLAYER_Y: 0.68,    // kayak sits this far down the screen
};

export const COLORS = { BG: '#000000', FG: '#ffffff', GINGER: '#ff5a1f', ENEMY: '#ff1a2e', VAPE: '#a9d6f5' };   // ENEMY = thin outline on hostiles

// Bezel-style border: a static strip of the key art down each side of the screen. The image is split down the
// middle of the face and the split sits at the screen edges, as if the picture wrapped round behind the game.
export const SIDE_ART = { SRC: 'art/side.jpg', BORDER: 36, GAP: 4, LINE: 2, LAND_MIN: 14,
  VIGNETTE: 0.85, VIGNETTE_ENDS: 0.3, VIGNETTE_SIDE: 0.55 };   // LINE = white inner border; VIGNETTE = darkness at top/bottom (0..1), ENDS = how far it reaches (fraction of height), SIDE = shading across the strip   // BORDER = strip width incl. GAP (black strip on its inner side); LAND_MIN = least bank left showing

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
  NAMES: ['BRITISH CANAL', 'DESERT CANAL', 'JUNGLE CANAL'],
  DESERT_AT: 650,            // metres where the blend into desert starts
  JUNGLE_AT: 1700,
  BLEND: 220,                // metres a transition takes
  WIDTH: [186, 236, 172],    // canal width per biome
  MEANDER: 52,               // max sideways wander of the canal centre
  CHUNK_GAP: [150, 130, 105],// clear water between chunks
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
export const IMMUNITY = { COOLDOWN: [10, 8, 5, 3, 2], RADIUS: 21 };

// Late game: the banks turn red and hurt on contact, and extra hazards hug the sides.
export const BANKS = {
  DANGER_AT_M: 1500,          // distance where the banks go live
  PUSH: 170,                  // shove back toward the middle after touching one
  SIDE_DEBRIS_CHANCE: 0.7,    // per chunk: debris tucked against a bank
  SIDE_BARGE_CHANCE: 0.25,    // per chunk: a moored barge against a bank
};

export const HAZARDS = {
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
  swan:    { hp: 7,  r: 6, speed: 22, steer: 9,  mode: 'drift',  xp: 1, drop: 0.4 },
  pap:     { hp: 12, r: 6, speed: 46, steer: 0,  mode: 'chase',  xp: 2, drop: 0.5, turn: 0.9, stamina: 5 },
  tumble:  { hp: 9,  r: 6, speed: 30, steer: 70, mode: 'bounce', xp: 1, drop: 0.4 },
  piranha: { hp: 11, r: 5, speed: 66, steer: 0,  mode: 'chase',  xp: 2, drop: 0.45, turn: 1.3, stamina: 6 },
  mozzie:  { hp: 3,  r: 3, speed: 84, steer: 0,  mode: 'chase',  xp: 1, drop: 0.25, turn: 2.0, stamina: 7 },
  croc:    { hp: 60, r: 9, speed: 26, steer: 14, mode: 'drift',  xp: 8, drop: 1, big: true, tea: 0.3 },   // tea: chance to drop a cuppa
};

export const SPAWN = {
  START_M: 50,                       // no enemies before this
  RATE: [0.55, 1.2, 3.2],             // enemies/sec per biome at biome start
  RATE_GROWTH_PER_KM: 0.7,           // multiplicative growth: rate *= 1 + km * this
  // enemy numbers also follow the player's level, so slow levellers aren't swamped and strong builds get a horde
  LEVEL_BASE: 0.55, LEVEL_PER: 0.045, LEVEL_MAX: 1.8,
  MAX_ALIVE: 150,
  HP_GROWTH_PER_KM: 0.3,            // enemy hp *= 1 + km * this
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
    name: 'VAPE CLOUD', maxLvl: 6, tick: 0.2, speed: 95,
    levels: [
      { dirs: 1, dmg: 4,  cd: 1.05, size: 13, life: 0.5, prox: 95 },
      { dirs: 1, dmg: 6,  cd: 0.9,  size: 15, life: 0.55, prox: 115 },
      { dirs: 3, dmg: 6,  cd: 0.85, size: 16, life: 0.6 },
      { dirs: 3, dmg: 8,  cd: 0.75, size: 18, life: 0.65 },
      { dirs: 4, dmg: 10, cd: 0.7,  size: 20, life: 0.7 },
      { dirs: 6, dmg: 12, cd: 0.6,  size: 22, life: 0.75 },
    ],
    evo: { dirs: 8, dmg: 20, cd: 0.36, size: 30, life: 0.95 },
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
    name: 'VAPE STORM', maxLvl: 5, tick: 0.2, spin: 3.2,
    levels: [
      { n: 2, dmg: 4, r: 9, orbit: 36 }, { n: 3, dmg: 5, r: 10, orbit: 40 }, { n: 3, dmg: 7, r: 11, orbit: 46 },
      { n: 4, dmg: 8, r: 12, orbit: 52 }, { n: 5, dmg: 10, r: 13, orbit: 58 },
    ],
    evo: { n: 7, dmg: 17, r: 16, orbit: 66, outer: 6 },
    desc: ['CLOUDS ORBIT THE KAYAK', 'THIRD CLOUD', 'WIDER, STRONGER', 'FOURTH CLOUD', 'FIFTH CLOUD'],
  },
};

// ---- In-run passives. Value is per level. -----------------------------------
export const PASSIVES = {
  lungs:  { name: 'BIGGER VAPE BATTERY', maxLvl: 5, per: 0.12, desc: '+12% CLOUD SIZE' },
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
  BIOME_TRACKS: ['ufo', 'arab', 'ufo'],   // canal, desert, jungle: the track changes when the scenery does
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
