-- ============================================================================
--  VAPE KAYAK (handheld / LÖVE port) — every balance number lives in this file.
--  A line-for-line port of src/config.js from the browser game. Values match;
--  arrays are 1-based here.  Units: pixels (logical 360-wide play column),
--  seconds, px/s unless noted.
-- ============================================================================
local C = {}

local function hex(h) return { tonumber(h:sub(2, 3), 16) / 255, tonumber(h:sub(4, 5), 16) / 255, tonumber(h:sub(6, 7), 16) / 255 } end
C.hex = hex

C.VIEW = {
  W = 360,              -- logical width of the play column (same as the browser game)
  SCREEN_W = 640,       -- the handheld screen; the river banks fill the extra width
  SCREEN_H = 480,
  PLAYER_Y = 0.68,      -- kayak sits this far down the screen
}
C.VIEW.OX = (C.VIEW.SCREEN_W - C.VIEW.W) / 2   -- where the play column starts on screen

C.COLORS = { BG = hex('#000000'), FG = hex('#ffffff'), GINGER = hex('#ff5a1f'), ENEMY = hex('#ff1a2e'), VAPE = hex('#a9d6f5') }

C.WORLD = { PX_PER_M = 20 }

C.PLAYER = {
  SPEED_START = 105, SPEED_MAX = 190, SPEED_RAMP_M = 2600,
  NUDGE = 250, NUDGE_FRICTION = 7, HOLD_REPEAT = 0.15,
  TILT_SPEED = 230,        -- the analog stick steers like the phone's tilt: full lean = this lateral speed
  STICK_DEADZONE = 0.22,
  HIT_W = 4, HIT_H = 12,
  HP = 100, HIT_DMG = 34,
  INVULN_HIT = 1.3, INVULN_LEVELUP = 1.2,
  PICKUP_R = 13, MAGNET_R = 34, MAGNET_PULL = 320,
}

C.ENGINE = {
  SPEED_MULT = 1.1, TUNING_SPEED = 0.02,
  BURST_ADD = { 24, 28, 33, 38, 45, 52 },     -- indexed by Engine Tuning level + 1
  BURST_CAP = { 80, 100, 120, 140, 165, 190 },
  BURST_DECAY = 1.5, SHAKE = 0.75,
}

C.VAPING = { EVERY = { 3.5, 7 }, DRAG = 0.6, EXHALE = 1.0, PUFF_EVERY = 0.11 }

C.XP = { FIRST = 50, STEP = 20, CURVE = 1.5, VAPE = 1, BIG_VAPE = 5 }
function C.XP.need(l) return math.floor(C.XP.FIRST + C.XP.STEP * (l - 1) + C.XP.CURVE * (l - 1) * (l - 1) + 0.5) end

C.PICKUPS = {
  BIG_MULT = 5, BIG_CHANCE = 0.05, SPIN_BASE = 5, SPIN_BIG = 2.5, SPIN_ACCEL = 2.2,
  TEA_CHUNK_CHANCE = 0.07, TEA_HURT_MULT = 3, TEA_HEAL = 34, TEA_FULL_XP = 5,
  CASH_VALUE = 5, CASH_CHUNK_CHANCE = 0.3, DENSITY_PER_M = 0.00012,
}

C.BIOMES = {
  NAMES = { 'BRITISH CANAL', 'DESERT CANAL', 'VOLCANO CANAL' },
  EDGE_MARGIN = 50,
  BANK_COLORS = { { hex('#4dff6a'), hex('#1f9a3c') }, { hex('#ffe04a'), hex('#c9871c') }, { hex('#ff5a3c'), hex('#b0161f') } },
  BANK_FADE = { { 0, 12, 1 }, { 12, 24, 0.5 }, { 36, 36, 0.25 } },   -- solid, chequered, sparse, then black to the screen edge
  BANK_DITHER_PX = 3,
  DESERT_AT = 650, JUNGLE_AT = 1700, BLEND = 220,
  WIDTH = { 186, 236, 172 }, MEANDER = 52, CHUNK_GAP = { 150, 130, 105 },
  -- pattern weights per biome { canal, desert, volcano }; the order is fixed so runs pick like the browser game
  CHUNK_ORDER = { 'snake', 'lanes', 'cluster', 'barge', 'bridge', 'lock', 'debris', 'vortex', 'sandbars', 'vines' },
  CHUNKS = {
    snake = { 5, 3, 3 }, lanes = { 3, 2, 1 }, cluster = { 1, 5, 2 }, barge = { 3, 2, 1 }, bridge = { 2, 1, 0.5 },
    lock = { 1.5, 0.5, 0 }, debris = { 2, 1, 1 }, vortex = { 0.6, 1.5, 4 }, sandbars = { 0, 4, 0 }, vines = { 0, 0, 5 },
  },
}

C.RAM = { MIN_BURST = 30, TIP_Y = 17, TIP_W = 3, TIP_H = 4, BOOST_KEEP = 0.5, BOOST_KEEP_BIG = 0.2 }
C.IMMUNITY = { COOLDOWN = { 10, 8, 5, 3, 2 }, RADIUS = 21 }
C.BANKS = { DANGER_AT_M = 1500, PUSH = 170, SIDE_DEBRIS_CHANCE = 0.7, SIDE_BARGE_CHANCE = 0.25 }

C.HAZARDS = {
  DEBRIS = { trolley = { 12, 9 }, barrel = { 6, 5 }, cone = { 6, 5 } },
  VORTEX_R = 64, VORTEX_PULL = 300, VORTEX_CORE = 9, VORTEX_JUNGLE_MULT = 1.6,
  SANDBAR_SLOW = 0.45, VINE_SLOW = 0.55, VINE_STEER = 0.35, SLOW_RECOVER = 0.3,
  BARGE_MOVE_CHANCE_PER_KM = 0.3, BARGE_VX = 18, FAKE_REVEAL = 120,
}

C.ENEMIES = {
  swan    = { hp = 6,  r = 6, speed = 22, steer = 9,  mode = 'drift',  xp = 1, drop = 0.4 },
  pap     = { hp = 8,  r = 6, speed = 46, steer = 0,  mode = 'chase',  xp = 2, drop = 0.5, turn = 0.9, stamina = 5 },
  tumble  = { hp = 11, r = 6, speed = 30, steer = 70, mode = 'bounce', xp = 1, drop = 0.4 },
  piranha = { hp = 15, r = 5, speed = 66, steer = 0,  mode = 'chase',  xp = 2, drop = 0.45, turn = 1.3, stamina = 6 },
  mozzie  = { hp = 3,  r = 3, speed = 84, steer = 0,  mode = 'chase',  xp = 1, drop = 0.25, turn = 2.0, stamina = 7 },
  croc    = { hp = 70, r = 9, speed = 26, steer = 14, mode = 'drift',  xp = 8, drop = 1, big = true, tea = 0.3 },
}

C.SPAWN = {
  START_M = 50, RATE = { 0.55, 1.2, 3.2 }, RATE_GROWTH_PER_KM = 0.7,
  LEVEL_BASE = 0.55, LEVEL_PER = 0.045, LEVEL_MAX = 1.8,
  MAX_ALIVE = 150, HP_GROWTH_PER_KM = 0.35,
  PACK_CHANCE = { 0.05, 0.15, 0.45 }, PACK_SIZE = { 3, 5, 9 }, BEHIND_CHANCE = { 0, 0.1, 0.25 },
  CHASE_RANGE = 240,
  TABLE = {   -- { name, weight } per biome, in the browser game's order
    { { 'swan', 5 }, { 'pap', 2 } },
    { { 'swan', 1 }, { 'pap', 4 }, { 'tumble', 4 }, { 'croc', 0.4 } },
    { { 'pap', 2 }, { 'piranha', 5 }, { 'mozzie', 6 }, { 'croc', 0.8 } },
  },
}

C.WEAPON_ORDER = { 'cloud', 'trail', 'nova', 'storm' }
C.WEAPONS = {
  cloud = {
    name = 'VAPE CLOUD', maxLvl = 6, speed = 95,
    levels = {
      { dirs = 1, dmg = 9,  cd = 1.05, size = 13, life = 0.5, prox = 95 },
      { dirs = 1, dmg = 12, cd = 0.9,  size = 15, life = 0.55, prox = 115 },
      { dirs = 3, dmg = 14, cd = 0.85, size = 16, life = 0.6 },
      { dirs = 3, dmg = 17, cd = 0.75, size = 18, life = 0.65 },
      { dirs = 4, dmg = 21, cd = 0.7,  size = 20, life = 0.7 },
      { dirs = 6, dmg = 26, cd = 0.6,  size = 22, life = 0.75 },
    },
    evo = { dirs = 8, dmg = 40, cd = 0.36, size = 30, life = 0.95 },
    desc = { '', 'MORE DAMAGE, FASTER', 'THREE DIRECTIONS, ALWAYS ON', 'BIGGER, STRONGER', 'FOUR DIRECTIONS', 'SIX DIRECTIONS' },
  },
  trail = {
    name = 'VAPETRAIL', maxLvl = 5, tick = 0.25, every = 0.1,
    levels = { { dmg = 3, r = 11, life = 1.2 }, { dmg = 4, r = 13, life = 1.5 }, { dmg = 6, r = 15, life = 1.8 }, { dmg = 8, r = 17, life = 2.2 }, { dmg = 10, r = 20, life = 2.6 } },
    evo = { dmg = 18, r = 34, life = 4 },
    desc = { 'HURTS ENEMIES', 'THICKER TRAIL', 'STRONGER TRAIL', 'LONGER TRAIL', 'MUCH THICKER TRAIL' },
  },
  nova = {
    name = 'BIG VAPE CLOUDS', maxLvl = 5, expand = 300,
    levels = { { dmg = 12, cd = 6, r = 85 }, { dmg = 18, cd = 5.4, r = 105 }, { dmg = 24, cd = 4.8, r = 125 }, { dmg = 32, cd = 4.2, r = 150 }, { dmg = 42, cd = 3.6, r = 175 } },
    evo = { dmg = 95, cd = 2.8, r = 440 },
    desc = { 'A BIG VAPE CLOUD BILLOWS OUT AND CLEARS THE AREA', 'BIGGER CLOUD', 'FASTER, STRONGER', 'BIGGER CLOUD', 'HUGE CLOUD' },
  },
  storm = {
    name = 'VAPE STORM', maxLvl = 5, spin = 3.2, grow = 0.25,
    levels = {
      { n = 2, dmg = 10, r = 9,  orbit = 36, respawn = 3.5 }, { n = 3, dmg = 12, r = 10, orbit = 40, respawn = 3.0 },
      { n = 3, dmg = 15, r = 11, orbit = 46, respawn = 2.6 }, { n = 4, dmg = 18, r = 12, orbit = 52, respawn = 2.2 },
      { n = 5, dmg = 22, r = 13, orbit = 58, respawn = 1.8 },
    },
    evo = { n = 7, dmg = 34, r = 16, orbit = 66, outer = 6, respawn = 1.0 },
    desc = { 'CLOUDS ORBIT THE KAYAK AND POP ON ENEMIES', 'THIRD CLOUD', 'WIDER, STRONGER', 'FOURTH CLOUD', 'FIFTH CLOUD' },
  },
}

C.PASSIVE_ORDER = { 'lungs', 'extra', 'rings', 'chain', 'linger', 'magnet', 'paddle', 'hivis' }
C.PASSIVES = {
  lungs  = { name = 'BIGGER VAPE BATTERY', maxLvl = 5, per = 0.2, desc = '+20% SIZE FOR EVERY CLOUD, RING AND TRAIL' },
  extra  = { name = '+1 CLOUD', maxLvl = 3, desc = '+1 CLOUD FOR EVERY WEAPON EXCEPT VAPETRAIL', novaGap = 0.3, miniRing = { size = 0.55, side = 55, up = 1.4 } },
  rings  = { name = 'VAPE RINGS', maxLvl = 5, desc = 'BLOWS LARGE GROWING HOOPS THAT CUT THROUGH ENEMIES', speed = 60, band = 7,
             levels = { { dmg = 10, cd = 3.2, r = 42, life = 1.4 }, { dmg = 14, cd = 2.9, r = 52, life = 1.5 }, { dmg = 18, cd = 2.6, r = 62, life = 1.6 },
                        { dmg = 24, cd = 2.3, r = 74, life = 1.7 }, { dmg = 30, cd = 2.0, r = 88, life = 1.8 } } },
  chain  = { name = 'CHAIN VAPER', maxLvl = 5, per = 0.08, desc = '-8% COOLDOWNS' },
  linger = { name = 'THICKER CLOUDS', maxLvl = 5, per = 0.15, desc = '+15% CLOUD DURATION' },
  magnet = { name = 'DUTY FREE', maxLvl = 5, per = 0.3, desc = '+30% PICKUP RANGE' },
  paddle = { name = 'BIG PADDLE', maxLvl = 3, per = 0.12, desc = '+12% STEERING' },
  hivis  = { name = 'HI-VIS VEST', maxLvl = 3, per = 34, desc = '+34% MAX HEALTH AND A FULL HEAL' },
}

C.EVOLUTIONS = {
  cloud = { needs = 'lungs',  name = 'PEA SOUPER',     desc = 'EIGHT DIRECTIONS. NON-STOP. ENORMOUS.' },
  storm = { needs = 'chain',  name = 'HURRICANE ANGE', desc = 'A DOUBLE RING OF ANGRY WEATHER.' },
  nova  = { needs = 'rings',  name = 'MUSHROOM CLOUD', desc = 'CLEARS THE WHOLE SCREEN.' },
  trail = { needs = 'linger', name = 'CHEMTRAIL',      desc = 'A VAST, LINGERING WAKE OF FOG.' },
}

C.LEVELUP = { OWNED_WEIGHT = 3, NEW_WEIGHT = 1, EVO_WEIGHT = 8, FILLER_CASH = 10 }

C.SHOP = {
  { id = 'engine',   name = 'VAPE ENGINE',   costs = { 40 }, desc = 'EVERY VAPE = SPEED BURST.', flavour = 'THE DESERT ISLAND ESSENTIAL.' },
  { id = 'turbo',    name = 'ENGINE TUNING', costs = { 70, 140, 240, 360, 500 }, desc = 'FASTER, BIGGER SPEED BURSTS.', needs = 'engine', flavour = 'DEPUTY NO MORE. FULL STEAM AHEAD.' },
  { id = 'starter',  name = 'WARM-UP PUFF',  costs = { 80, 220 }, desc = 'START WITH A STRONGER CLOUD.', flavour = 'A CHEEKY ONE BEFORE CONFERENCE.' },
  { id = 'xp',       name = 'FAST LEARNER',  costs = { 30, 60, 100, 160, 240 }, desc = '+10% XP.', flavour = 'LEFT SCHOOL AT 16. LEARNT ANYWAY.' },
  { id = 'cash',     name = 'EXPENSES',      costs = { 30, 60, 100, 160, 240 }, desc = '+20% CASH.', flavour = 'AIRPODS SOLD SEPARATELY.' },
  { id = 'magnet',   name = 'MAGNETIC HAIR', costs = { 25, 50, 90, 140, 200 }, desc = '+15% PICKUP RANGE.', flavour = 'ATTRACTS VAPES AND HEADLINES.' },
  { id = 'heart',    name = 'THICK SKIN',    costs = { 60, 120, 200, 300 }, desc = '+25% MAX HEALTH.', flavour = 'FOR WHEN THE SUNDAY PAPERS CALL.' },
  { id = 'immunity', name = 'POLITICAL IMMUNITY', costs = { 80, 150, 250, 400, 600 }, desc = 'SHIELD KILLS ENEMIES ON TOUCH.', flavour = 'RECHARGE 10S, THEN 8, 5, 3, 2.' },
}

C.FLAVOUR = {
  DEATH_TITLES = { 'SUNK!', 'SUNK!', 'RESIGNED!', 'RESHUFFLED!' },
  TIPS = {
    'ALWAYS CHECK WHICH HOME IS YOUR MAIN HOME.', 'STAMP DUTY CANNOT BE DODGED. BARGES CAN.',
    'SPECIALIST ADVICE IS CHEAPER THAN RESIGNING.', 'AIRPODS GO ON EXPENSES. VAPES DO NOT.',
    'FREE CLOTHES ARE NOT A POWER-UP. DECLARE THEM.', 'SAVE THE DANCING FOR THE IBIZA DJ BOOTH.',
    'THE OPERA IS THE OTHER WAY. BRING CHAMPAGNE.', 'DO NOT CALL THE SWANS SCUM. THEY REMEMBER.',
    'A KAYAK IS NOT A SECOND HOME. PROBABLY.',
  },
  CAUSES = {
    barge = "RAMMED SOMEONE'S SECOND HOME", pier = 'HIT A LOW BRIDGE', gate = 'HIT A LOCK GATE', vortex = 'DOWN THE PLUGHOLE',
    debris = 'SUNK BY FLY-TIPPING', bank = 'HIT THE RED WALL', sandbar = 'RAN AGROUND', swan = 'A SWAN TOOK IT PERSONALLY', pap = 'PAPPED MID-PUFF',
    tumble = 'TUMBLEWEEDED', piranha = 'NIBBLED BY THE BACKBENCHES', mozzie = 'BITTEN TO BITS', croc = 'SNAPPED UP',
  },
}

C.LEGAL = {
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
}

C.REWARD = { CASH_PER_100M = 1, CASH_PER_LEVEL = 1 }

C.MUSIC = {
  VOLUME = 0.5, MUFFLE_HIGHGAIN = 0.12, MUFFLE_GAIN = 0.75,   -- menus: low-pass (OpenAL filter) and a touch quieter
  XFADE = 2.5, FADE_IN_FIRST = 5, FADE_IN = 3,
  OPENER = 'river', BIOME_TRACKS = { 'ufo', 'arab', 'ufo' },
  -- each looping track is split at its loop point into _intro.ogg (plays once) and _loop.ogg (repeats seamlessly)
  TRACKS = { river = { once = true, gain = 1.7 }, ufo = {}, arab = {}, menu = {} },
}

C.JUICE = {
  SPEED_FX = 0.5, SHAKE_HIT = 6, SHAKE_KILL = 0.6, SHAKE_NOVA = 3, SHAKE_DEATH = 12,
  HITSTOP_DEATH = 0.45, MAX_FLOATERS = 48, MAX_PARTICLES = 500,
}

return C
