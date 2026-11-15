-- Simulation: canal, chunks, pickups, enemies, weapons, level-ups. No drawing here.
-- A line-for-line port of src/game.js.
local C = require('config')
local P = require('platform')
local VIEW, WORLD, PLAYER, ENGINE, XP, PICKUPS, BIOMES, HAZARDS, ENEMIES, SPAWN =
  C.VIEW, C.WORLD, C.PLAYER, C.ENGINE, C.XP, C.PICKUPS, C.BIOMES, C.HAZARDS, C.ENEMIES, C.SPAWN
local WEAPONS, PASSIVES, EVOLUTIONS, LEVELUP, REWARD, JUICE, VAPING, FLAVOUR, IMMUNITY, BANKS, RAM =
  C.WEAPONS, C.PASSIVES, C.EVOLUTIONS, C.LEVELUP, C.REWARD, C.JUICE, C.VAPING, C.FLAVOUR, C.IMMUNITY, C.BANKS, C.RAM
local save, shopLvl, sfx, input = P.save, P.shopLvl, P.sfx, P.input
local sin, cos, sqrt, abs, floor, min, max, exp, atan2 = math.sin, math.cos, math.sqrt, math.abs, math.floor, math.min, math.max, math.exp, math.atan2
local VIEW_H = VIEW.SCREEN_H

local M = {}

-- ---- pools (no allocation churn on the handheld) -----------------------------------------
local function Pool(maxN)
  local p = { items = {}, n = 0, max = maxN }
  function p.spawn()
    if p.n >= p.max then return nil end
    local o = p.items[p.n + 1]
    if not o then o = {}; p.items[p.n + 1] = o end
    p.n = p.n + 1; o.dead = false; return o
  end
  function p.sweep()
    local i = 1
    while i <= p.n do
      local o = p.items[i]
      if o.dead then p.items[i] = p.items[p.n]; p.items[p.n] = o; p.n = p.n - 1 else i = i + 1 end
    end
  end
  return p
end
M.vapes, M.enemies, M.hazards = Pool(400), Pool(SPAWN.MAX_ALIVE + 20), Pool(160)
M.clouds, M.parts, M.floaters = Pool(600), Pool(JUICE.MAX_PARTICLES), Pool(JUICE.MAX_FLOATERS)
local vapes, enemies, hazards, clouds, parts, floaters = M.vapes, M.enemies, M.hazards, M.clouds, M.parts, M.floaters
local pools = { vapes, enemies, hazards, clouds, parts, floaters }

local G = { mode = 'title', ph = { 0, 0, 0 }, dist = 0, t = 0, bot = false }
M.G = G
local S = { area = 1, dmg = 1, cd = 1, dur = 1, magnet = 1, nudge = 1, xp = 1, cash = 1 }
M.S = S
M.orbs = {}
local orbs = M.orbs

local function rnd(a, b) if b == nil then return love.math.random() * (a or 1) end return a + love.math.random() * (b - a) end
local function pick(arr) return arr[floor(love.math.random() * #arr) + 1] end
local function clamp(v, a, b) return v < a and a or (v > b and b or v) end
local function smooth(t) t = clamp(t, 0, 1); return t * t * (3 - 2 * t) end
local function lerp3(a, b) if b <= 1 then return a[1] + (a[2] - a[1]) * b end return a[2] + (a[3] - a[2]) * (b - 1) end
local function hypot(x, y) return sqrt(x * x + y * y) end
M.lerp3 = lerp3
function M.playerY() return floor(VIEW_H * VIEW.PLAYER_Y + 0.5) end
local playerY = M.playerY
function M.metres() return floor(G.dist / WORLD.PX_PER_M) end
local metres = M.metres

-- ---- canal shape: pure functions of world-y --------------------------------------------------
function M.biomeAt(wy)
  local m = wy / WORLD.PX_PER_M
  return smooth((m - BIOMES.DESERT_AT) / BIOMES.BLEND) + smooth((m - BIOMES.JUNGLE_AT) / BIOMES.BLEND)
end
local biomeAt = M.biomeAt
function M.widthAt(wy) return lerp3(BIOMES.WIDTH, biomeAt(wy)) + 10 * sin(wy * 0.0037 + G.ph[3]) end
local widthAt = M.widthAt
function M.centreAt(wy)
  local amp = clamp((VIEW.W - widthAt(wy)) / 2 - BIOMES.EDGE_MARGIN, 0, BIOMES.MEANDER)
  return VIEW.W / 2 + amp * (0.6 * sin(wy * 0.0052 + G.ph[1]) + 0.4 * sin(wy * 0.0113 + G.ph[2]))
end
local centreAt = M.centreAt
function M.dangerAt(wy) return wy / WORLD.PX_PER_M >= BANKS.DANGER_AT_M end
local dangerAt = M.dangerAt
function M.leftAt(wy) return centreAt(wy) - widthAt(wy) / 2 end
function M.rightAt(wy) return centreAt(wy) + widthAt(wy) / 2 end
local leftAt, rightAt = M.leftAt, M.rightAt
local function laneX(wy, f, margin) margin = margin or 18; local l, r = leftAt(wy) + margin, rightAt(wy) - margin; return l + (r - l) * f end

-- ---- run lifecycle -----------------------------------------------------------------------------
local function plvl(id) return G.passives[id] or 0 end
local function calcStats()
  S.area = 1 + plvl('lungs') * PASSIVES.lungs.per
  S.dmg = 1
  S.cd = (1 - PASSIVES.chain.per) ^ plvl('chain')
  S.dur = 1 + plvl('linger') * PASSIVES.linger.per
  S.magnet = (1 + plvl('magnet') * PASSIVES.magnet.per) * (1 + shopLvl('magnet') * 0.15)
  S.nudge = 1 + plvl('paddle') * PASSIVES.paddle.per
  S.xp = 1 + shopLvl('xp') * 0.1
  S.cash = 1 + shopLvl('cash') * 0.2
  G.maxHp = PLAYER.HP + shopLvl('heart') * 25 + plvl('hivis') * PASSIVES.hivis.per
end
M.calcStats = calcStats
function M.newRun()
  for _, p in ipairs(pools) do p.n = 0 end
  for i = #orbs, 1, -1 do orbs[i] = nil end
  local fresh = {
    t = 0, dist = 0, speed = PLAYER.SPEED_START, burst = 0, slow = 1, snag = 0, pvx = 0, holdT = 0, paddle = 0, paddleT = 0,
    hp = 0, maxHp = 0, inv = 1, vapes = 0, cash = 0, xp = 0, level = 1, xpNeed = XP.need(1), kills = 0, combo = 0, comboT = 0,
    weapons = { cloud = 1 + shopLvl('starter') }, passives = {}, evo = {},
    cd = { cloud = 0.5, trail = 0, nova = 1.5, rings = 0.5 }, orbA = 0, orbState = {}, cloudId = 0,
    genY = 240, chunkN = 0, spawnT = 0, shake = 0, flash = 0, hitstop = 0, dead = false, deadT = 0,
    banner = BIOMES.NAMES[1], bannerT = 2.5, biomeIdx = 0, pending = 0, choices = nil, cause = '', result = nil, puffT = 0,
    vapeT = 2.5, dragT = 0, hurtT = 0, grinT = 0, shieldT = 0, danger = false, novaMore = 0, novaGapT = 0,
  }
  for k, v in pairs(fresh) do G[k] = v end
  G.ph = { rnd(6.28), rnd(6.28), rnd(6.28) }
  G.px = centreAt(0)
  calcStats()
  G.hp = G.maxHp
  G.mode = 'play'
end
--- current stats of a weapon (evolved form if evolved)
local function wp(id)
  local w = WEAPONS[id]
  if G.evo[id] then
    local o = {}
    for k, v in pairs(w.levels[w.maxLvl]) do o[k] = v end
    for k, v in pairs(w.evo) do o[k] = v end
    o.prox = nil
    return o
  end
  return w.levels[G.weapons[id]]
end
M.wp = wp

-- ---- spawning helpers ----------------------------------------------------------------------
local function addPickup(kind, x, wy)
  local v = vapes.spawn(); if not v then return end
  v.kind = kind; v.wy = wy; v.x = clamp(x, leftAt(wy) + 10, rightAt(wy) - 10)
  v.age = 0; v.ang = rnd(6.28); v.mag = false
end
local function addVape(x, wy, big) addPickup((big or love.math.random() < PICKUPS.BIG_CHANCE) and 'big' or 'vape', x, wy) end
local function addHazard(kind, x, wy, hw, hh, extra)
  local h = hazards.spawn(); if not h then return nil end
  h.type = kind; h.x = x; h.wy = wy; h.hw = hw; h.hh = hh; h.vx = 0; h.fake = false; h.seed = floor(love.math.random() * 1e6); h.len = 0; h.side = 0; h.kind = nil
  if extra then for k, v in pairs(extra) do h[k] = v end end
  return h
end
local function addDebris(x, wy)
  local kind = pick({ 'trolley', 'barrel', 'cone' })
  local d = HAZARDS.DEBRIS[kind]
  addHazard('debris', x, wy, d[1], d[2], { kind = kind })
end
local function addPart(x, wy, vx, vwy, life, size, spr)
  local p = parts.spawn(); if not p then return end
  p.x = x; p.wy = wy; p.vx = vx; p.vwy = vwy; p.age = 0; p.life = life; p.size = size or 2; p.spr = spr or 0
end
M.addPart = addPart
local function burst(x, wy, n, speed, life, size)
  life = life or 0.4; size = size or 2
  for _ = 1, n do local a, s = rnd(6.28), rnd(0.3, 1) * speed; addPart(x, wy, cos(a) * s, sin(a) * s + G.speed, rnd(0.5, 1) * life, size) end
end
local function addFloater(txt, x, wy, scale)
  local f = floaters.spawn(); if not f then return end
  f.txt = tostring(txt); f.x = x + rnd(-4, 4); f.wy = wy; f.age = 0; f.life = 0.7; f.scale = scale or 1
end
local function addCloud(kind, x, wy, vx, vwy, r0, r1, life, dmg, tick)
  local c = clouds.spawn(); if not c then return end
  c.kind = kind; c.x = x; c.wy = wy; c.vx = vx; c.vwy = vwy; c.r0 = r0; c.r1 = r1; c.r = r0; c.life = life; c.age = 0
  c.dmg = dmg; c.tick = tick; c.tickT = 0; G.cloudId = G.cloudId + 1; c.id = G.cloudId
  if kind == 'puff' then c.hit = {} end            -- a puff damages each enemy once
end
local function addEnemy(kind, x, wy, behind)
  local e = enemies.spawn(); if not e then return end
  local d = ENEMIES[kind]
  e.type = kind; e.wy = wy; e.x = clamp(x, leftAt(wy) + d.r + 2, rightAt(wy) - d.r - 2)
  e.hp = d.hp * (1 + G.dist / WORLD.PX_PER_M / 1000 * SPAWN.HP_GROWTH_PER_KM); e.maxHp = e.hp
  e.r = d.r; e.chasing = not not behind; e.vx = (love.math.random() < 0.5 and -1 or 1) * d.steer; e.seed = rnd(100)
  e.ox = rnd(-9, 9); e.oy = rnd(-12, 12); e.novaId = -1; e.flash = 0; e.chaseT = 0; e.gaveUp = false
  e.ang = atan2(G.dist - wy, G.px - e.x)
end

-- ---- procedural chunks: every pattern leaves a clear route -----------------------------------
local CHUNKS = {}
function CHUNKS.snake(y, dens)
  local n, ph, amp = floor(rnd(10, 16) * dens + 0.5), rnd(6.28), rnd(0.2, 0.36)
  for i = 0, n - 1 do local wy = y + i * 24; addVape(laneX(wy, 0.5 + amp * sin(i * 0.45 + ph)), wy) end
  return n * 24
end
function CHUNKS.lanes(y, dens)
  local n, bigSide = floor(6 * dens + 0.5), love.math.random() < 0.5
  for i = 0, n - 1 do
    local wy, last = y + i * 26, i == n - 1
    addVape(laneX(wy, 0.2), wy, last and bigSide); addVape(laneX(wy, 0.8), wy, last and not bigSide)
  end
  return n * 26
end
function CHUNKS.cluster(y)
  local wy = y + 50
  local x = laneX(wy, rnd(0.3, 0.7), 40)
  addVape(x, wy, true)
  for i = 0, 7 do addVape(x + cos(i * 0.785) * 26, wy + sin(i * 0.785) * 26) end
  if love.math.random() < 0.4 then addVape(laneX(wy + 70, rnd(0.2, 0.8)), wy + 70, true) end
  return 120
end
function CHUNKS.barge(y, dens, m)
  local len, f = pick({ 70, 90, 110 }), pick({ 0.1, 0.5, 0.9 })
  local wy = y + len / 2 + 10
  local moving = love.math.random() < min(0.6, m / 1000 * HAZARDS.BARGE_MOVE_CHANCE_PER_KM)
  addHazard('barge', laneX(wy, f, 20), wy, 13, len / 2 - 3, { len = len, vx = moving and pick({ -1, 1 }) * HAZARDS.BARGE_VX or 0 })
  local open = f < 0.4 and 0.72 or (f > 0.6 and 0.28 or pick({ 0.14, 0.86 }))
  for i = 0, 4 do local vy = wy - len / 2 + i * (len / 4); addVape(laneX(vy, open), vy) end
  if f == 0.5 and love.math.random() < 0.5 then addPickup('cash', laneX(wy, 1 - open), wy) end
  return len + 30
end
function CHUNKS.bridge(y)
  local wy = y + 40
  local k = widthAt(wy) > 225 and 3 or 2
  addHazard('deck', 0, wy, 0, 11)
  for i = 1, k do addHazard('pier', laneX(wy, i / (k + 1), 0), wy, 6, 10) end
  local gx = laneX(wy, (floor(love.math.random() * (k + 1)) + 0.5) / (k + 1), 0)
  for i = -3, 2 do addVape(gx, wy + i * 24) end
  return 110
end
function CHUNKS.lock(y)
  local wy, gap = y + 110, 66
  local l, r = leftAt(wy), rightAt(wy)
  local gx = l + 10 + gap / 2 + rnd(r - l - gap - 20)
  addHazard('gate', (l - 12 + gx - gap / 2) / 2, wy, (gx - gap / 2 - l + 12) / 2, 5, { side = -1 })
  addHazard('gate', (r + 12 + gx + gap / 2) / 2, wy, (r + 12 - gx - gap / 2) / 2, 5, { side = 1 })
  for i = -4, 2 do addVape(gx, wy + i * 24) end
  return 180
end
function CHUNKS.debris(y, dens)
  local n = 4 + floor(love.math.random() * 4)
  for i = 0, n - 1 do local wy = y + 20 + i * 44 + rnd(-8, 8); addDebris(laneX(wy, rnd(), 16), wy) end
  local i = 0
  while i < 6 * dens do local wy = y + rnd(n * 44); addVape(laneX(wy, rnd()), wy); i = i + 1 end
  return n * 44 + 20
end
function CHUNKS.vortex(y)
  local wy = y + 80
  local x = laneX(wy, rnd(0.3, 0.7), 44)
  addHazard('vortex', x, wy, 0, 0)
  for i = 0, 7 do addVape(x + cos(i * 0.785) * 38, wy + sin(i * 0.785) * 38) end
  if love.math.random() < 0.5 then addPickup('cash', x + pick({ -20, 20 }), wy) end
  return 170
end
function CHUNKS.sandbars(y)
  local n, first = 3, love.math.random() < 0.5 and 0 or 1
  for i = 0, n - 1 do
    local wy, left = y + 40 + i * 95, (i + first) % 2 == 0
    addHazard('sandbar', laneX(wy, left and rnd(0.12, 0.3) or rnd(0.7, 0.88), 22), wy, 27, 7)
    addVape(laneX(wy, left and 0.75 or 0.25), wy, love.math.random() < 0.35)
    addVape(laneX(wy + 45, 0.5), wy + 45)
  end
  if love.math.random() < 0.45 then local wy = y + 40 + 95 * rnd(0.3, 1.7); addHazard('barge', laneX(wy, 0.5, 30), wy, 13, 32, { len = 70, fake = true }) end
  return n * 95 + 20
end
function CHUNKS.vines(y)
  local n, first = 3 + floor(love.math.random() * 2), love.math.random() < 0.5 and 0 or 1
  for i = 0, n - 1 do
    local wy, left = y + 40 + i * 100, (i + first) % 2 == 0
    local len = widthAt(wy) * rnd(0.45, 0.56)
    local l, r = leftAt(wy), rightAt(wy)
    addHazard('vine', left and l + len / 2 or r - len / 2, wy, len / 2, 4, { side = left and -1 or 1, len = len })
    for j = 0, 2 do addVape(laneX(wy - 20 + j * 20, left and 0.82 or 0.18), wy - 20 + j * 20) end
  end
  return n * 100
end
local function genChunk()
  local m, b = G.genY / WORLD.PX_PER_M, biomeAt(G.genY)
  local dens = 1 + m * PICKUPS.DENSITY_PER_M * 10
  local name = 'snake'
  if G.chunkN >= 2 then
    local total, w = 0, {}
    for _, k in ipairs(BIOMES.CHUNK_ORDER) do w[k] = lerp3(BIOMES.CHUNKS[k], b); total = total + w[k] end
    local r = love.math.random() * total
    for _, k in ipairs(BIOMES.CHUNK_ORDER) do r = r - w[k]; if r <= 0 then name = k; break end end
  end
  local len = CHUNKS[name](G.genY, dens, m)
  if G.chunkN >= 2 and love.math.random() < PICKUPS.CASH_CHUNK_CHANCE then
    local wy = G.genY + rnd(len)
    addPickup('cash', laneX(wy, pick({ 0, 1 }), 12), wy)     -- hugging the bank: a risk to grab
  end
  if G.chunkN >= 2 and love.math.random() < PICKUPS.TEA_CHUNK_CHANCE * (G.hp < G.maxHp and PICKUPS.TEA_HURT_MULT or 1) then
    local wy = G.genY + rnd(len); addPickup('tea', laneX(wy, rnd(0.15, 0.85)), wy)
  end
  if dangerAt(G.genY) then                                   -- late game: trouble hugs the sides
    local span = len + lerp3(BIOMES.CHUNK_GAP, b)
    if love.math.random() < BANKS.SIDE_DEBRIS_CHANCE then
      for _ = 1, 1 + floor(love.math.random() * 2) do local wy = G.genY + rnd(span); addDebris(laneX(wy, pick({ 0, 1 }), 18), wy) end
    end
    if love.math.random() < BANKS.SIDE_BARGE_CHANCE then
      local wy = G.genY + len + lerp3(BIOMES.CHUNK_GAP, b) * 0.5
      addHazard('barge', laneX(wy, pick({ 0, 1 }), 17), wy, 13, 32, { len = 70 })
    end
  end
  G.chunkN = G.chunkN + 1
  G.genY = G.genY + len + lerp3(BIOMES.CHUNK_GAP, b)
end

local function spawnWave(b)
  local bi = min(2, floor(b) + (love.math.random() < b % 1 and 1 or 0))
  local tbl = SPAWN.TABLE[bi + 1]
  local total = 0
  for _, e in ipairs(tbl) do total = total + e[2] end
  local r, kind = love.math.random() * total, 'swan'
  for _, e in ipairs(tbl) do r = r - e[2]; if r <= 0 then kind = e[1]; break end end
  local chase = ENEMIES[kind].mode == 'chase'
  local n = (chase and love.math.random() < SPAWN.PACK_CHANCE[bi + 1]) and SPAWN.PACK_SIZE[bi + 1] or 1
  local behind = chase and love.math.random() < SPAWN.BEHIND_CHANCE[bi + 1]
  local wy = behind and (G.dist - (VIEW_H - playerY()) - 20) or (G.dist + playerY() + 24)
  local x = laneX(wy, rnd(), 12)
  for i = 0, n - 1 do addEnemy(kind, x + (i > 0 and rnd(-26, 26) or 0), wy + (i > 0 and rnd(-30, 30) or 0), behind) end
end

-- ---- player actions ----------------------------------------------------------------------------
function M.nudge(dir)
  if G.mode ~= 'play' or G.dead then return end
  G.pvx = dir * PLAYER.NUDGE * S.nudge
  G.paddle = 1 - G.paddle
  addPart(G.px - dir * 9, G.dist - 4, -dir * 40, G.speed - 30, 0.3); addPart(G.px - dir * 10, G.dist - 8, -dir * 60, G.speed - 50, 0.25)
end
local nudge = M.nudge
local die
local function hurt(n, cause)
  if G.inv > 0 or G.dead then return end
  if G.god then G.hits = (G.hits or 0) + 1; G.inv = 0.5; return end
  G.hp = G.hp - n * PLAYER.HIT_DMG; G.hurtT = 0.7; G.inv = PLAYER.INVULN_HIT; G.shake = JUICE.SHAKE_HIT; G.flash = 0.12; sfx.hurt()
  burst(G.px, G.dist, 14, 120)
  if G.hp <= 0 then die(cause) end
end
die = function(cause)
  if G.dead then return end
  if G.god then if G.inv <= 0 then G.crashes = (G.crashes or 0) + 1; G.inv = 1 end return end
  G.dead = true; G.deadT = 0; G.cause = cause; G.hp = 0
  G.hitstop = JUICE.HITSTOP_DEATH; G.shake = JUICE.SHAKE_DEATH; G.flash = 0.2; sfx.death()
  for _ = 1, 70 do local a, s = rnd(6.28), rnd(20, 260); addPart(G.px + rnd(-6, 6), G.dist + rnd(-14, 14), cos(a) * s, sin(a) * s, rnd(0.4, 1.3), pick({ 2, 2, 3, 4 })) end
  local m = metres()
  local bonus = floor(m / 100) * REWARD.CASH_PER_100M + (G.level - 1) * REWARD.CASH_PER_LEVEL
  local total = G.cash + floor(bonus * S.cash + 0.5)
  G.result = { title = pick(FLAVOUR.DEATH_TITLES), tip = pick(FLAVOUR.TIPS), vapes = G.vapes, m = m, level = G.level, kills = G.kills, cash = total, newBest = G.vapes > save.best }
  save.cash = save.cash + total; save.runs = save.runs + 1; save.best = max(save.best, G.vapes); save.bestDist = max(save.bestDist, m)
  P.writeSave()
end
local function gainXp(x)
  G.xp = G.xp + x * S.xp
  while G.xp >= G.xpNeed do G.xp = G.xp - G.xpNeed; G.level = G.level + 1; G.xpNeed = XP.need(G.level); G.pending = G.pending + 1 end
end
local function collect(v)
  v.dead = true
  if v.kind == 'tea' then
    if G.hp < G.maxHp then G.hp = min(G.maxHp, G.hp + PICKUPS.TEA_HEAL); addFloater('+HEALTH', v.x, v.wy + 10, 2)
    else gainXp(PICKUPS.TEA_FULL_XP); addFloater('LOVELY', v.x, v.wy + 10, 1) end
    burst(v.x, v.wy, 12, 90); sfx.heal(); G.grinT = max(G.grinT, 1); return
  end
  if v.kind == 'cash' then
    local n = floor(PICKUPS.CASH_VALUE * S.cash + 0.5); G.cash = G.cash + n
    addFloater('+£' .. n, v.x, v.wy + 10, 2); burst(v.x, v.wy, 10, 90); sfx.cash(); return
  end
  local big = v.kind == 'big'
  local n = big and PICKUPS.BIG_MULT or 1
  G.vapes = G.vapes + n; gainXp(n * XP.VAPE)
  G.combo = G.comboT > 0 and G.combo + 1 or 0; G.comboT = 0.7
  addFloater('+' .. n, v.x, v.wy + 10, big and 2 or 1)
  burst(v.x, v.wy, big and 14 or 6, big and 110 or 80, 0.35)
  addPart(v.x, v.wy, 0, G.speed + 60, 0.28, 0, big and 2 or 1)          -- the spin-burst ghost
  if big then sfx.big(); G.grinT = max(G.grinT, 0.5) else sfx.vape(G.combo) end
  if shopLvl('engine') > 0 then
    local t = shopLvl('turbo') + 1
    G.burst = min(ENGINE.BURST_CAP[t], G.burst + ENGINE.BURST_ADD[t] * (big and 2 or 1))
    G.shake = max(G.shake, ENGINE.SHAKE)
  end
end
local function damageEnemy(e, dmg)
  if e.dead then return end
  dmg = dmg * S.dmg; e.hp = e.hp - dmg; e.flash = 0.08
  if floaters.n < 14 then addFloater(floor(dmg + 0.5), e.x, e.wy + e.r, 1) end
  if e.hp > 0 then return end
  local d = ENEMIES[e.type]
  e.dead = true; G.kills = G.kills + 1
  gainXp(d.xp)
  burst(e.x, e.wy, d.big and 16 or 6, d.big and 120 or 80, 0.35, d.big and 3 or 2)
  G.shake = max(G.shake, JUICE.SHAKE_KILL); sfx.kill()
  if d.tea and G.hp < G.maxHp and love.math.random() < d.tea then addPickup('tea', e.x, e.wy)
  elseif love.math.random() < d.drop then addPickup(d.big and 'big' or 'vape', e.x, e.wy) end
end

-- ---- level-up choices -----------------------------------------------------------------------------
local function rollChoices()
  local c = {}
  for _, id in ipairs(C.WEAPON_ORDER) do
    local w, lvl = WEAPONS[id], G.weapons[id] or 0
    if not G.evo[id] then
      if lvl >= w.maxLvl then
        local ev = EVOLUTIONS[id]
        if plvl(ev.needs) > 0 then c[#c + 1] = { kind = 'evo', id = id, title = ev.name, desc = ev.desc, tag = 'EVOLUTION', w = LEVELUP.EVO_WEIGHT } end
      else
        local d = w.desc[lvl + 1]; if d == nil or d == '' then d = 'STRONGER' end
        c[#c + 1] = { kind = 'weapon', id = id, title = w.name, desc = d, tag = lvl > 0 and ('LV ' .. (lvl + 1)) or 'NEW', w = lvl > 0 and LEVELUP.OWNED_WEIGHT or LEVELUP.NEW_WEIGHT }
      end
    end
  end
  for _, id in ipairs(C.PASSIVE_ORDER) do
    local p, lvl = PASSIVES[id], plvl(id)
    if lvl < p.maxLvl then c[#c + 1] = { kind = 'passive', id = id, title = p.name, desc = p.desc, tag = lvl > 0 and ('LV ' .. (lvl + 1)) or 'NEW', w = lvl > 0 and LEVELUP.OWNED_WEIGHT or LEVELUP.NEW_WEIGHT } end
  end
  local out = {}
  while #out < 3 and #c > 0 do
    local total = 0
    for _, o in ipairs(c) do total = total + o.w end
    local r, i = love.math.random() * total, 1
    while i < #c do r = r - c[i].w; if r <= 0 then break end; i = i + 1 end
    out[#out + 1] = table.remove(c, i)
  end
  if #out < 3 then out[#out + 1] = { kind = 'cash', title = 'GIFT FROM A LORD', desc = '+£' .. LEVELUP.FILLER_CASH .. '. FULLY DECLARED, OBVIOUSLY.', tag = '' } end
  if #out < 3 then out[#out + 1] = { kind = 'heal', title = 'CUP OF TEA', desc = 'RESTORE ALL HEALTH', tag = '' } end
  return out
end
function M.choose(i)
  local c = G.choices and G.choices[i]; if not c then return end
  if c.kind == 'weapon' then G.weapons[c.id] = (G.weapons[c.id] or 0) + 1
  elseif c.kind == 'passive' then G.passives[c.id] = plvl(c.id) + 1; if c.id == 'hivis' then calcStats(); G.hp = G.maxHp end
  elseif c.kind == 'evo' then G.evo[c.id] = true; G.flash = 0.2; G.shake = 8
  elseif c.kind == 'cash' then G.cash = G.cash + LEVELUP.FILLER_CASH
  elseif c.kind == 'heal' then G.hp = G.maxHp end
  calcStats(); sfx.pick(); G.grinT = c.kind == 'evo' and 3 or 1.2
  G.inv = max(G.inv, PLAYER.INVULN_LEVELUP)
  G.pending = G.pending - 1
  if G.pending > 0 then G.choices = rollChoices() else G.choices = nil; G.mode = 'play' end
end

-- ---- weapons ---------------------------------------------------------------------------------------
local DIRS = {}
local function dirsFor(n)
  if DIRS[n] then return DIRS[n] end
  local out
  if n == 1 then out = { 0 } elseif n == 2 then out = { -0.45, 0.45 } elseif n == 3 then out = { 0, -0.87, 0.87 }
  else out = {}; for i = 0, n - 1 do out[i + 1] = i / n * 6.283 end end
  DIRS[n] = out
  return out
end
local function extra() return G.passives.extra or 0 end
local function enemyWithin(range)
  local r2 = range * range
  for i = 1, enemies.n do local e = enemies.items[i]; local dx, dy = e.x - G.px, e.wy - G.dist; if dx * dx + dy * dy < r2 then return true end end
  return false
end
local function updateWeapons(dt)
  local cd = G.cd
  cd.cloud = cd.cloud - dt
  if cd.cloud <= 0 then
    local p = wp('cloud')
    if p.prox and not enemyWithin(p.prox * S.area) then cd.cloud = 0.05
    else
      local sp = WEAPONS.cloud.speed * p.size / 13 * S.area
      for _, a in ipairs(dirsFor(p.dirs + extra())) do
        local sx, sy = sin(a), cos(a)
        addCloud('puff', G.px + sx * 10, G.dist + sy * 16, sx * sp, sy * sp, p.size * 0.45 * S.area, p.size * S.area, p.life * S.dur, p.dmg, 0)
      end
      cd.cloud = p.cd * S.cd; sfx.puff()
    end
  end
  if G.passives.rings then
    cd.rings = cd.rings - dt
    if cd.rings <= 0 then
      local R = PASSIVES.rings
      local p = R.levels[G.passives.rings]; cd.rings = p.cd * S.cd
      addCloud('ring', G.px, G.dist + 18, 0, R.speed, 6, p.r * S.area, p.life * S.dur, p.dmg, 0)
      local Mr = PASSIVES.extra.miniRing
      for k = 0, extra() - 1 do                        -- +1 CLOUD: mini rings peel off to the sides and float forward
        local side, spread = (k % 2 == 1) and 1 or -1, 1 + floor(k / 2) * 0.6
        addCloud('ring', G.px + side * 8, G.dist + 14, side * Mr.side * spread, R.speed * Mr.up, 4, p.r * Mr.size * S.area, p.life * S.dur, p.dmg, 0)
      end
      sfx.puff()
    end
  end
  if G.weapons.trail then
    cd.trail = cd.trail - dt
    if cd.trail <= 0 then
      local p = wp('trail'); cd.trail = WEAPONS.trail.every
      addCloud('trail', G.px + rnd(-3, 3), G.dist - 16, 0, 0, p.r * 0.6 * S.area, p.r * S.area, p.life * S.dur, p.dmg, WEAPONS.trail.tick)
    end
  end
  if G.weapons.nova then
    cd.nova = cd.nova - dt
    if cd.nova <= 0 then
      local p = wp('nova'); cd.nova = p.cd * S.cd
      addCloud('nova', G.px, G.dist, 0, 0, 8, p.r * S.area, p.r * S.area / WEAPONS.nova.expand, p.dmg, 0)
      G.shake = max(G.shake, JUICE.SHAKE_NOVA); sfx.nova()
      G.novaMore = extra(); G.novaGapT = PASSIVES.extra.novaGap
    end
    if G.novaMore > 0 then
      G.novaGapT = G.novaGapT - dt
      if G.novaGapT <= 0 then                         -- +1 CLOUD: follow-up blasts
        local p = wp('nova'); G.novaMore = G.novaMore - 1; G.novaGapT = PASSIVES.extra.novaGap
        addCloud('nova', G.px, G.dist, 0, 0, 8, p.r * S.area, p.r * S.area / WEAPONS.nova.expand, p.dmg, 0)
        G.shake = max(G.shake, JUICE.SHAKE_NOVA * 0.6); sfx.nova()
      end
    end
  end
  for i = #orbs, 1, -1 do orbs[i] = nil end
  if G.weapons.storm then
    local p, Wst = wp('storm'), WEAPONS.storm
    G.orbA = G.orbA + Wst.spin * dt
    local n = p.n + extra()
    local total = n + (p.outer or 0)
    while #G.orbState < total do G.orbState[#G.orbState + 1] = { cd = 0, age = 1 } end
    for i = 0, total - 1 do
      local st = G.orbState[i + 1]
      if st.cd > 0 then st.cd = st.cd - dt; if st.cd <= 0 then st.age = 0 end   -- popped: regrowing
      else
        st.age = st.age + dt
        local outer = i >= n
        local k, m = outer and i - n or i, outer and p.outer or n
        local a = outer and (-G.orbA * 0.7 + k / m * 6.283) or (G.orbA + k / m * 6.283)
        local rad = p.orbit * (outer and 1.9 or 1) * S.area
        local o = { x = G.px + cos(a) * rad, wy = G.dist + sin(a) * rad, r = p.r * (outer and 1.2 or 1) * S.area * min(1, 0.3 + st.age / Wst.grow) }
        local hitE = nil
        for j = 1, enemies.n do
          local e = enemies.items[j]
          local dx, dy, rr = e.x - o.x, e.wy - o.wy, o.r + e.r
          if not e.dead and dx * dx + dy * dy < rr * rr then hitE = e; break end
        end
        if hitE then                                   -- poof: one hit, then it's gone for a while
          damageEnemy(hitE, p.dmg)
          st.cd = p.respawn * S.cd
          addCloud('poof', o.x, o.wy, 0, 0, o.r, o.r * 1.8, 0.35, 0, 0)
          for _ = 1, 6 do local pa = rnd(6.28); addPart(o.x, o.wy, cos(pa) * 70, sin(pa) * 70 + G.speed, 0.3, 2) end
        else orbs[#orbs + 1] = o end
      end
    end
  end
end
local function updateClouds(dt)
  for i = 1, clouds.n do
    local c = clouds.items[i]
    c.age = c.age + dt
    if c.age >= c.life then c.dead = true
    else
      local t = c.age / c.life
      local skipHits = false
      if c.kind == 'puff' then
        local drag = exp(-1.6 * dt); c.vx = c.vx * drag; c.vwy = c.vwy * drag
        c.x = c.x + c.vx * dt; c.wy = c.wy + (c.vwy + G.speed) * dt
        c.r = c.r0 + (c.r1 - c.r0) * (1 - (1 - t) * (1 - t))
      elseif c.kind == 'poof' then c.wy = c.wy + G.speed * dt; c.r = c.r0 + (c.r1 - c.r0) * t; skipHits = true   -- harmless smoke
      elseif c.kind == 'trail' then c.r = c.r0 + (c.r1 - c.r0) * min(1, t * 4)
      elseif c.kind == 'ring' then c.x = c.x + c.vx * dt; c.wy = c.wy + (c.vwy + G.speed) * dt; c.r = c.r0 + (c.r1 - c.r0) * sqrt(t)
      else c.x = G.px; c.wy = G.dist; c.r = c.r0 + (c.r1 - c.r0) * t end
      local ring, puff = c.kind == 'ring', c.kind == 'puff'
      local nova = c.kind == 'nova' or ring           -- these hit each enemy once
      if not skipHits and not nova and not puff then
        c.tickT = c.tickT - dt
        if c.tickT > 0 then skipHits = true else c.tickT = c.tickT + c.tick end
      end
      if not skipHits then
        for j = 1, enemies.n do
          local e = enemies.items[j]
          if not ((nova and e.novaId == c.id) or (puff and c.hit[e])) then
            local dx, dy, rr = e.x - c.x, e.wy - c.wy, c.r + e.r
            local d2 = dx * dx + dy * dy
            local inBand = true
            if ring then local band, dd = PASSIVES.rings.band + e.r, sqrt(d2) - c.r; inBand = not (dd > band or dd < -band) end
            if inBand and d2 < rr * rr + (ring and 1e6 or 0) then
              if nova then e.novaId = c.id end
              if puff then c.hit[e] = true end
              damageEnemy(e, c.dmg)
            end
          end
        end
      end
    end
  end
end

-- ---- per-frame updates ---------------------------------------------------------------------------
local function updateEnemies(dt)
  local below = G.dist - (VIEW_H - playerY()) - 60
  for i = 1, enemies.n do
    local e = enemies.items[i]
    local d = ENEMIES[e.type]
    local dx, dwy = G.px + e.ox - e.x, G.dist + e.oy - e.wy
    local dist = hypot(dx, dwy); if dist == 0 then dist = 1 end
    if e.flash > 0 then e.flash = e.flash - dt end
    if d.mode == 'chase' then
      if not e.chasing and not e.gaveUp and dist < SPAWN.CHASE_RANGE then e.chasing = true; e.ang = atan2(dwy, dx) end
      if e.chasing then
        -- a limited turn rate: they commit to a line, so a side-step makes them overshoot
        local diff = atan2(dwy, dx) - e.ang
        diff = atan2(sin(diff), cos(diff))
        e.ang = e.ang + clamp(diff, -d.turn * dt, d.turn * dt)
        e.x = e.x + cos(e.ang) * d.speed * dt; e.wy = e.wy + (G.speed + sin(e.ang) * d.speed) * dt
        if e.type == 'mozzie' then e.x = e.x + sin(G.t * 9 + e.seed) * 40 * dt end
        e.chaseT = e.chaseT + dt
        if e.chaseT > d.stamina then e.chasing = false; e.gaveUp = true end   -- knackered: drifts away downstream
      end
    elseif d.mode == 'bounce' then e.wy = e.wy - d.speed * dt; e.x = e.x + e.vx * dt
    else e.wy = e.wy - d.speed * dt; e.x = e.x + clamp(dx, -d.steer * dt, d.steer * dt) end
    local l, r = leftAt(e.wy) + e.r + 2, rightAt(e.wy) - e.r - 2
    if e.x < l then e.x = l; if e.vx < 0 then e.vx = -e.vx end elseif e.x > r then e.x = r; if e.vx > 0 then e.vx = -e.vx end end
    if e.wy < below then e.dead = true
    elseif G.burst >= RAM.MIN_BURST and abs(e.x - G.px) < e.r + RAM.TIP_W and abs(e.wy - (G.dist + RAM.TIP_Y)) < e.r + RAM.TIP_H then
      -- boosting: the tip of the kayak rams it. Obliterated, but it knocks the boost down
      G.burst = G.burst * (d.big and RAM.BOOST_KEEP_BIG or RAM.BOOST_KEEP)
      damageEnemy(e, 1e6); burst(e.x, e.wy, 16, 160, 0.45, 3); addFloater('RAMMED!', e.x, e.wy + 12, 1)
      G.shake = max(G.shake, 4); G.hitstop = max(G.hitstop, 0.04); sfx.kill()
    elseif abs(e.x - G.px) < e.r + PLAYER.HIT_W and abs(e.wy - G.dist) < e.r + PLAYER.HIT_H and G.inv <= 0 then
      if shopLvl('immunity') > 0 and G.shieldT <= 0 and not d.big then   -- political immunity: it dies, you don't
        G.shieldT = IMMUNITY.COOLDOWN[shopLvl('immunity')]
        damageEnemy(e, 1e6); burst(G.px, G.dist, 18, 150, 0.4); addFloater('IMMUNE!', G.px, G.dist + 26, 1); sfx.nova(); G.shake = max(G.shake, 3)
      else hurt(1, e.type); e.dead = true; burst(e.x, e.wy, 6, 80) end
    end
  end
end
local function updateHazards(dt)
  local below = G.dist - (VIEW_H - playerY()) - 80
  local jungle = clamp(biomeAt(G.dist) - 1, 0, 1)
  for i = 1, hazards.n do
    local h = hazards.items[i]
    if h.wy + h.hh < below then h.dead = true
    else
      local dy, dx = h.wy - G.dist, h.x - G.px
      if h.vx ~= 0 then
        h.x = h.x + h.vx * dt
        local l, r = leftAt(h.wy) + h.hw + 4, rightAt(h.wy) - h.hw - 4
        if h.x < l then h.x = l; h.vx = abs(h.vx) elseif h.x > r then h.x = r; h.vx = -abs(h.vx) end
        if love.math.random() < dt * 14 then addPart(h.x + rnd(-12, 12), h.wy - h.hh, rnd(-10, 10), -rnd(10, 30), 0.5) end
      end
      if h.fake then
        if dy < HAZARDS.FAKE_REVEAL then h.dead = true; burst(h.x, h.wy, 16, 70, 0.5); addFloater('HEAT HAZE!', h.x, h.wy, 1) end
      elseif h.type == 'vortex' then
        local d = hypot(dx, dy)
        if d < HAZARDS.VORTEX_R and d > 0.5 then
          G.px = G.px + dx / d * HAZARDS.VORTEX_PULL * (1 + jungle * (HAZARDS.VORTEX_JUNGLE_MULT - 1)) * (1 - d / HAZARDS.VORTEX_R) * dt
          if d < HAZARDS.VORTEX_CORE then hurt(1, 'vortex') end
        end
      elseif h.type ~= 'deck' and not (abs(dx) > h.hw + PLAYER.HIT_W or abs(dy) > h.hh + PLAYER.HIT_H) then
        if h.type == 'barge' or h.type == 'pier' or h.type == 'gate' then die(h.type)
        elseif h.type == 'debris' then if G.inv <= 0 then hurt(1, 'debris'); h.dead = true; burst(h.x, h.wy, 10, 90) end
        elseif h.type == 'sandbar' then hurt(1, 'sandbar'); G.slow = min(G.slow, HAZARDS.SANDBAR_SLOW)
        elseif h.type == 'vine' then
          G.snag = 0.12; G.slow = min(G.slow, HAZARDS.VINE_SLOW)
          if love.math.random() < dt * 20 then addPart(G.px + rnd(-6, 6), G.dist + 8, rnd(-30, 30), G.speed, 0.3) end
        end
      end
    end
  end
end
local function updatePickups(dt)
  local below, top = G.dist - (VIEW_H - playerY()) - 20, G.dist + playerY()
  local magR = PLAYER.MAGNET_R * S.magnet
  local magR2, pickR2 = magR * magR, PLAYER.PICKUP_R * PLAYER.PICKUP_R
  for i = 1, vapes.n do
    local v = vapes.items[i]
    if v.wy < below then v.dead = true
    elseif v.wy <= top then
      v.age = v.age + dt
      v.ang = v.ang + ((v.kind == 'big' and PICKUPS.SPIN_BIG or PICKUPS.SPIN_BASE) + v.age * PICKUPS.SPIN_ACCEL) * dt
      local dx, dy = G.px - v.x, G.dist - v.wy
      local d2 = dx * dx + dy * dy
      if d2 < magR2 then v.mag = true end
      if v.mag then
        local d = sqrt(d2); if d == 0 then d = 1 end
        local sp = PLAYER.MAGNET_PULL * dt
        v.x = v.x + dx / d * sp; v.wy = v.wy + dy / d * sp + G.speed * dt
      end
      if d2 < pickR2 then collect(v) end
    end
  end
end
local function updateFx(dt)
  for i = 1, parts.n do
    local p = parts.items[i]; p.age = p.age + dt
    if p.age >= p.life then p.dead = true else p.x = p.x + p.vx * dt; p.wy = p.wy + p.vwy * dt end
  end
  for i = 1, floaters.n do
    local f = floaters.items[i]; f.age = f.age + dt
    if f.age >= f.life then f.dead = true else f.wy = f.wy + (G.speed * 0.9 + 30) * dt end
  end
  parts.sweep(); floaters.sweep()
  if G.shake > 0 then G.shake = max(0, G.shake - dt * 30) end
  if G.flash > 0 then G.flash = G.flash - dt end
end

--- attract-mode scrolling for the title screen
function M.idle(dt)
  G.t = G.t + dt; G.speed = 70; G.dist = G.dist + G.speed * dt; G.px = centreAt(G.dist)
  G.paddleT = G.paddleT + dt; if G.paddleT > 0.6 then G.paddleT = 0; G.paddle = 1 - G.paddle end
  updateFx(dt)
end

local botSteer
function M.update(dt)
  if G.hitstop > 0 then G.hitstop = G.hitstop - dt; return end
  G.t = G.t + dt
  if G.dead then G.deadT = G.deadT + dt; G.hurtT = 0; updateFx(dt); if G.deadT > 1.1 then G.mode = 'dead' end; return end

  -- speed
  local m = G.dist / WORLD.PX_PER_M
  local base = PLAYER.SPEED_START + (PLAYER.SPEED_MAX - PLAYER.SPEED_START) * min(1, m / PLAYER.SPEED_RAMP_M)
  if shopLvl('engine') > 0 then base = base * (ENGINE.SPEED_MULT + shopLvl('turbo') * ENGINE.TUNING_SPEED) end
  G.burst = G.burst * exp(-ENGINE.BURST_DECAY * dt)
  G.slow = min(1, G.slow + HAZARDS.SLOW_RECOVER * dt)
  G.speed = (base + G.burst) * G.slow
  G.dist = G.dist + G.speed * dt

  -- steering: d-pad taps nudge (holding repeats, like the browser game); the stick steers smoothly like tilt
  if G.bot then botSteer(dt)
  elseif input.dir ~= 0 then G.holdT = G.holdT + dt; if G.holdT > PLAYER.HOLD_REPEAT then G.holdT = 0; nudge(input.dir) end
  else G.holdT = 0 end
  local steer = G.snag > 0 and HAZARDS.VINE_STEER or 1
  if G.snag > 0 then G.snag = G.snag - dt end
  G.pvx = G.pvx * exp(-PLAYER.NUDGE_FRICTION * dt)
  local vx = G.pvx
  if save.stick and not G.bot then vx = vx + clamp(input.stick, -1, 1) * PLAYER.TILT_SPEED * S.nudge end
  G.px = G.px + vx * steer * dt
  local l, r = leftAt(G.dist) + 9, rightAt(G.dist) - 9
  if G.px < l or G.px > r then
    if abs(vx) > 30 or love.math.random() < dt * 8 then addPart(G.px < l and l - 8 or r + 8, G.dist + rnd(-10, 10), 0, G.speed - 40, 0.3) end
    local leftSide = G.px < l
    G.px = clamp(G.px, l, r); G.pvx = 0
    if G.danger then hurt(1, 'bank'); G.pvx = (leftSide and 1 or -1) * BANKS.PUSH end
  end
  if G.inv > 0 then G.inv = G.inv - dt end
  if G.shieldT > 0 then G.shieldT = G.shieldT - dt end
  if not G.danger and dangerAt(G.dist) then G.danger = true; G.banner = "RED WALL: DON'T TOUCH!"; G.bannerT = 4 end
  if G.hurtT > 0 then G.hurtT = G.hurtT - dt end
  if G.grinT > 0 then G.grinT = G.grinT - dt end
  if G.comboT > 0 then G.comboT = G.comboT - dt end
  G.paddleT = G.paddleT + dt * G.speed / 100; if G.paddleT > 0.45 then G.paddleT = 0; G.paddle = 1 - G.paddle end
  -- the occasional drag: hold, then a cloud that drifts away behind her
  G.vapeT = G.vapeT - dt
  if G.vapeT <= 0 and G.dragT <= 0 then G.dragT = VAPING.DRAG + VAPING.EXHALE; G.vapeT = rnd(VAPING.EVERY[1], VAPING.EVERY[2]) end
  if G.dragT > 0 then
    G.dragT = G.dragT - dt; G.puffT = G.puffT - dt
    if G.dragT < VAPING.EXHALE and G.puffT <= 0 then G.puffT = VAPING.PUFF_EVERY; addPart(G.px + 4 + rnd(-3, 3), G.dist + 2, rnd(-16, 16), G.speed * rnd(0.3, 0.6), rnd(1.4, 2.3), rnd(4, 8), 3) end
  end

  -- world
  while G.genY < G.dist + playerY() + 60 do genChunk() end
  local b = biomeAt(G.dist)
  local bi = floor(b + 0.5)
  if bi ~= G.biomeIdx then G.biomeIdx = bi; G.banner = BIOMES.NAMES[bi + 1]; G.bannerT = 3 end
  if G.bannerT > 0 then G.bannerT = G.bannerT - dt end
  if m > SPAWN.START_M then
    G.spawnT = G.spawnT + lerp3(SPAWN.RATE, b) * (1 + m / 1000 * SPAWN.RATE_GROWTH_PER_KM) * sqrt(G.speed / PLAYER.SPEED_START)
      * min(SPAWN.LEVEL_MAX, SPAWN.LEVEL_BASE + G.level * SPAWN.LEVEL_PER) * dt
    while G.spawnT >= 1 do G.spawnT = G.spawnT - 1; if enemies.n < SPAWN.MAX_ALIVE then spawnWave(b) end end
  end

  updateWeapons(dt)
  updateClouds(dt)
  updateEnemies(dt)
  updateHazards(dt)
  updatePickups(dt)
  updateFx(dt)
  vapes.sweep(); enemies.sweep(); hazards.sweep(); clouds.sweep()

  if G.pending > 0 and not G.dead then G.choices = rollChoices(); G.mode = 'levelup'; G.pvx = 0; sfx.level() end
end

-- ---- autoplay bot (headless test runs: `love . --bot`) -----------------------------------------
local botT = 0
botSteer = function(dt)
  botT = botT - dt; if botT > 0 then return end
  local l, r = leftAt(G.dist + 40) + 14, rightAt(G.dist + 40) - 14
  local best, bestCost = G.px, 1e9
  for k = 0, 14 do
    local x = l + (r - l) * k / 14
    local cost = abs(x - G.px) * 0.25
    for i = 1, hazards.n do
      local h = hazards.items[i]; local dy = h.wy - G.dist
      if not (h.type == 'deck' or h.type == 'vine' or dy + h.hh < -16 or dy - h.hh > 210) then
        local pad = h.type == 'vortex' and 46 or h.hw + 17
        if abs(x - h.x) < pad then cost = cost + ((h.type == 'debris' or h.type == 'sandbar') and 300 or 2000) * (1.2 - max(0, dy) / 210) end
      end
    end
    for i = 1, enemies.n do local e = enemies.items[i]; local dy = e.wy - G.dist; if dy > -30 and dy < 110 and abs(x - e.x) < 22 then cost = cost + 120 end end
    for i = 1, vapes.n do local v = vapes.items[i]; local dy = v.wy - G.dist; if dy > 0 and dy < 170 and abs(x - v.x) < 14 then cost = cost - (v.kind == 'vape' and 30 or 90) * (1 - dy / 220) end end
    if cost < bestCost then bestCost = cost; best = x end
  end
  if abs(best - G.px) > 9 then nudge(best > G.px and 1 or -1); botT = 0.12 end
end

return M
