-- Draws the world and the in-run HUD. Port of src/render.js. Everything is drawn in the
-- 360-wide play column's coordinates (translated to the middle of the 640-wide screen); the
-- river banks keep going out to the real screen edges, dithering to black.
local C = require('config')
local Gx = require('gfx')
local GM = require('game')
local P = require('platform')
local lg = love.graphics
local BIOMES, VAPING, JUICE, IMMUNITY, PLAYER = C.BIOMES, C.VAPING, C.JUICE, C.IMMUNITY, C.PLAYER
local BG, FG = C.COLORS.BG, C.COLORS.FG
local W, OX = C.VIEW.W, C.VIEW.OX
local H = C.VIEW.SCREEN_H
local rect, box, text, textO, textW, draw, drawDisc, hash = Gx.rect, Gx.box, Gx.text, Gx.textO, Gx.textW, Gx.draw, Gx.drawDisc, Gx.hash
local trunc, round = Gx.trunc, Gx.round
local floor, min, max, sin, cos = math.floor, math.min, math.max, math.sin, math.cos
local G, vapes, enemies, hazards, clouds, parts, floaters, orbs = GM.G, GM.vapes, GM.enemies, GM.hazards, GM.clouds, GM.parts, GM.floaters, GM.orbs
local biomeAt, dangerAt, leftAt, rightAt, playerY, metres = GM.biomeAt, GM.dangerAt, GM.leftAt, GM.rightAt, GM.playerY, GM.metres

local R = {}
R.BAR_H = 64
local PY, D = 0, 0
local function sy(wy) return PY - round(wy - D) end
local SPR

local function drawWater(lo, hi)
  for j = floor(lo / 16), floor(hi / 16) do
    local y = sy(j * 16)
    for i = -9, 31 do                    -- the browser game's 23 columns, plus the extra screen width
      local h = hash(j * 131 + i * 7919)
      if h < 0.05 then rect(i * 16 + h * 200, y, h < 0.02 and 5 or 3, 1) end
    end
  end
end
local function bankGlyph(bi, x, y, j, c)
  if bi == 0 then rect(x, y + 3, 6, 1, c); rect(x + ((j % 2 == 1) and 1 or 4), y + 4, 1, 3, c)
  elseif bi == 1 then rect(x + 1, y + 2, 1, 1, c); rect(x + 5, y + 5, 1, 1, c)
  else rect(x + 1, y + 3, 4, 1, c); rect(x + 2, y + 2, 2, 1, c); rect(x + 3, y + 4, 2, 1, c) end
end
-- drawn in passes (land + edges, then each dither density, then props) so each pass batches
local bankRows = {}
local function drawBanks(lo, hi)
  local lp, rp, n = nil, nil, 0
  for j = floor(lo / 8) - 1, floor(hi / 8) + 1 do
    local wy = j * 8
    local y = sy(wy + 8)
    local l, r = round(leftAt(wy) / 4) * 4, round(rightAt(wy) / 4) * 4
    local b = biomeAt(wy)
    local bi = min(2, floor(b) + (hash(j * 53) < b % 1 and 1 or 0))
    n = n + 1
    local row = bankRows[n] or {}; bankRows[n] = row
    row.j, row.y, row.l, row.r, row.bi = j, y, l, r, bi
    local edge, land = BIOMES.BANK_COLORS[bi + 1][1], BIOMES.BANK_COLORS[bi + 1][2]
    rect(-OX, y, l + OX, 8, BG); rect(r, y, W + OX - r, 8, BG)            -- land, out to the real screen edges
    for _, f in ipairs(BIOMES.BANK_FADE) do
      if f[3] >= 1 then rect(l - 3 - f[1] - f[2], y, f[2], 8, land); rect(r + 3 + f[1], y, f[2], 8, land) end
    end
    -- late game: the bank edge flickers red and white, and bites
    local c = dangerAt(wy) and ((floor(G.t * 6) % 2 == 1) and FG or C.COLORS.ENEMY) or edge
    local t = 3
    rect(l - t, y, t, 8, c); rect(r, y, t, 8, c)
    if lp ~= nil and lp ~= l then rect(min(l, lp) - t, y + 7, math.abs(l - lp) + t, 2, c) end
    if rp ~= nil and rp ~= r then rect(min(r, rp), y + 7, math.abs(r - rp) + t, 2, c) end
    lp, rp = l, r
    for k = 1, 4 do
      if hash(j * 977 + k * 31) < 0.45 / k then bankGlyph(bi, l - 4 - k * 8, y, j + k, edge) end
      if hash(j * 613 + k * 17) < 0.45 / k then bankGlyph(bi, r - 2 + k * 8, y, j + k, edge) end
    end
  end
  for _, f in ipairs(BIOMES.BANK_FADE) do                                   -- coloured land, dithering out to black
    if f[3] < 1 then
      for i = 1, n do
        local row = bankRows[i]
        local img = Gx.ditherFill(BIOMES.BANK_COLORS[row.bi + 1][2], f[3])
        Gx.patternRect(img, row.l - 3 - f[1] - f[2], row.y, f[2], 8); Gx.patternRect(img, row.r + 3 + f[1], row.y, f[2], 8)
      end
    end
  end
  for i = 1, n do
    local row = bankRows[i]
    local dh = hash(row.j * 271)
    if dh < 0.045 then
      local bi, l, r, y = row.bi, row.l, row.r, row.y
      local s = bi == 0 and (dh < 0.011 and SPR.signs[floor(dh * 9973) % 2 + 1] or (dh < 0.025 and SPR.lamp or SPR.bollard)) or (bi == 1 and SPR.cactus or SPR.palm)
      if (dh * 1000) % 2 < 1 then if l > s.w + 20 then Gx.drawAt(s, l - s.w - 10, y) end
      elseif r < W - s.w - 20 then Gx.drawAt(s, r + 11, y) end
    end
  end
end
local function drawHazards(top)
  for i = 1, hazards.n do
    local h = hazards.items[i]
    local y = sy(h.wy)
    local upper = h.type == 'deck' or h.type == 'pier'
    if y >= -80 and y <= H + 80 and upper == top then
      if h.type == 'barge' then
        local s = SPR.barge[h.len]
        if h.fake then       -- heat haze: wobbly scanlines
          local x0, y0, ph = round(h.x - s.w / 2), y - floor(s.h / 2), floor(G.t * 10)
          for row = ph % 2, s.h - 1, 2 do Gx.drawRow(s, row, x0 + round(sin(G.t * 7 + row * 0.35) * 2), y0 + row) end
        else draw(s, h.x, y) end
      elseif h.type == 'sandbar' then draw(SPR.sandbar[h.seed % 3], h.x, y)
      elseif h.type == 'debris' then draw(SPR[h.kind], h.x, y + round(sin(G.t * 3 + h.seed) * 1))
      elseif h.type == 'gate' then
        local x, w = round(h.x - h.hw), round(h.hw * 2)
        rect(x, y - 5, w, 10)
        for gx = x + 3, x + w - 2, 5 do rect(gx, y - 3, 1, 6, BG) end
        local inner = h.side < 0 and x + w or x   -- gap-side post
        rect(inner - 3, y - 8, 6, 16); rect(inner - 1, y - 6, 2, 12, BG)
      elseif h.type == 'vine' then
        local x0 = h.side < 0 and h.x - h.hw or h.x + h.hw
        for k = 0, trunc(h.len / 4) - 1 do
          local x, yy = x0 - h.side * k * 4, y + round(sin(k * 0.7 + h.seed) * 3)
          rect(x - 2, yy - 1, 4, 2)
          if k % 3 == 1 then rect(x - 1, yy - 5, 3, 3); rect(x - 3, yy + 2, 3, 3) end
        end
      elseif h.type == 'vortex' then
        for arm = 0, 2 do for k = 0, 12 do
          local a, rad, s = -G.t * 4 + arm * 2.094 + k * 0.42, 3 + k * 2.6, k > 8 and 3 or 2
          rect(round(h.x + cos(a) * rad), round(y + sin(a) * rad * 0.9), s, s)
        end end
      elseif h.type == 'deck' then
        local l, r = round(leftAt(h.wy)) - 6, round(rightAt(h.wy)) + 6
        rect(l, y - 11, r - l, 22, BG); Gx.dither(l, y - 9, r - l, 18)
        rect(l, y - 12, r - l, 3); rect(l, y + 9, r - l, 3)
      elseif h.type == 'pier' then draw(SPR.pier, h.x, y) end
    end
  end
end
local function drawClouds()
  for i = 1, clouds.n do
    local c = clouds.items[i]
    local y, t = sy(c.wy), c.age / c.life
    if c.kind == 'nova' then
      local n = max(20, trunc(c.r * 0.55))
      for k = 0, n - 1 do
        local a = k / n * 6.283 + c.id
        rect(round(c.x + cos(a) * c.r) - 3, round(y + sin(a) * c.r) - 3, 6, 6)
        if k % 2 == 1 then rect(round(c.x + cos(a + 0.1) * c.r * 0.86) - 1, round(y + sin(a + 0.1) * c.r * 0.86) - 1, 3, 3) end
      end
      if c.r < 150 then drawDisc(c.x, y, c.r - 6, t < 0.6 and 1 or 2) end
    elseif y >= -c.r and y <= H + c.r then
      if c.kind == 'ring' then
        if t < 0.85 or floor(G.t * 20) % 2 == 1 then drawDisc(c.x, y, c.r, 3); drawDisc(c.x, y, c.r - 2, 3); if c.r > 12 then drawDisc(c.x, y, c.r - 5, 3) end end
      else
        local st
        if c.kind == 'puff' or c.kind == 'poof' then st = t < 0.1 and 0 or (t < 0.7 and 1 or 2) else st = t < 0.65 and 1 or 2 end
        drawDisc(c.x, y, c.r, st)
      end
    end
  end
end
local function drawPickups()
  for i = 1, vapes.n do
    local v = vapes.items[i]
    local y = sy(v.wy)
    if y >= -20 and y <= H + 20 then
      if v.kind == 'tea' then draw(SPR.tea, v.x, y + round(sin(G.t * 4 + v.ang) * 1.5))
      elseif v.kind == 'cash' then draw(SPR.cash, v.x, y + round(sin(G.t * 5 + v.ang) * 1.5))
      else
        local fr = v.kind == 'big' and SPR.bigVape or SPR.vape
        draw(fr[trunc(v.ang / 6.283 * 16) % 16], v.x, y)
      end
    end
  end
end
local function drawEnemies()
  for i = 1, enemies.n do
    local e = enemies.items[i]
    local y = sy(e.wy)
    if y >= -24 and y <= H + 24 then
      local bob = e.type == 'mozzie' and 0 or round(sin(G.t * 6 + e.seed) * 1)
      if e.flash > 0 then drawDisc(e.x, y, e.r + 2, 0) else draw(SPR[e.type], e.x, y + bob) end
    end
  end
end
local function drawFx()
  for i = 1, parts.n do
    local p = parts.items[i]
    local y = sy(p.wy)
    if p.spr == 3 then local t = p.age / p.life; local r = p.size * (1 + t * 1.8); if t < 0.55 then drawDisc(p.x, y, r, 3) end; drawDisc(p.x, y, r - 1, 2)
    elseif p.spr ~= 0 then local fr = p.spr == 2 and SPR.bigVape or SPR.vape; draw(fr[floor(p.age * 70) % 16], p.x, y)
    else rect(p.x, y, p.size, p.size) end
  end
  for i = 1, floaters.n do
    local f = floaters.items[i]
    if not (f.age > f.life * 0.75 and floor(f.age * 30) % 2 == 1) then textO(f.txt, f.x, sy(f.wy) - 14, f.scale, FG, 0.5) end
  end
end

--- mode: 'full' = everything, 'menu' = just water, banks and an idle kayak
function R.drawWorld(mode)
  SPR = Gx.SPR
  PY = playerY(); D = round(G.dist)
  local lo, hi = D - (H - PY), D + PY
  rect(-OX, 0, W + OX * 2, H, BG)
  lg.push()
  if G.shake > 0.3 then lg.translate(round((love.math.random() - 0.5) * G.shake * 2), round((love.math.random() - 0.5) * G.shake * 2)) end
  drawWater(lo, hi)
  local full = mode == 'full'
  if full then drawHazards(false); drawClouds() end
  drawBanks(lo, hi)
  if full then
    drawPickups(); drawEnemies()
    for _, o in ipairs(orbs) do local y = sy(o.wy); drawDisc(o.x, y, o.r, 1); drawDisc(o.x, y, o.r * 0.45, 0) end
  end
  if full and not G.dead then local x = round(G.px); rect(x - 7, PY - 23, 15, 47, BG); rect(x - 10, PY - 18, 21, 37, BG); rect(x - 13, PY - 11, 27, 23, BG) end   -- keep her readable inside the fog
  if not G.dead and not (full and G.inv > 0 and floor(G.t * 14) % 2 == 1) then draw(SPR.kayak[G.paddle + 1], G.px, PY) end
  if full and not G.dead and P.shopLvl('immunity') > 0 then              -- political immunity: solid ring when ready, dots filling in while it recharges
    local Rr, cd = IMMUNITY.RADIUS, IMMUNITY.COOLDOWN[P.shopLvl('immunity')]
    if G.shieldT <= 0 then drawDisc(G.px, PY, Rr + floor(G.t * 4) % 2, 3)
    else for i = 0, floor((1 - G.shieldT / cd) * 16) - 1 do local a = i / 16 * 6.283 - 1.571; rect(round(G.px + cos(a) * Rr), round(PY + sin(a) * Rr), 2, 2) end end
  end
  if full then drawHazards(true) end
  drawFx()
  if full and G.burst > 22 then
    local n, k = min(16, G.burst / 7) * JUICE.SPEED_FX, floor(G.t * 24)
    local i = 0
    while i < n do rect(hash(i * 13 + k * 7) * W, hash(i * 29 + k * 3) * H, 1, (20 + G.burst / 4) * JUICE.SPEED_FX); i = i + 1 end
  end
  lg.pop()
  if G.flash > 0 then Gx.dither(-OX, 0, W + OX * 2, H) end
end

local function fit(str, w, mx) local sc = mx; while sc > 1 and textW(str, sc) > w - 6 do sc = sc - 1 end; return sc end
local function stat(x, w, y0, value, label)
  box(x, y0 + 12, w, 52); box(x + 2, y0 + 14, w - 4, 48, FG, 1)
  local sc = fit(value, w - 6, 4)
  text(value, x + w / 2, y0 + 19 + (20 - sc * 5) / 2, sc, FG, 0.5)
  text(label, x + w / 2, y0 + 47, 2, FG, 0.5)
end
--- status bar across the bottom: everything about the player lives down here
function R.drawHud()
  local y0 = H - R.BAR_H
  rect(-OX, y0, W + OX * 2, R.BAR_H, BG); rect(0, y0, W, 2)
  box(3, y0 + 4, W - 6, 7); rect(5, y0 + 6, round((W - 10) * min(1, G.xp / G.xpNeed)), 3)   -- XP strip
  local frac = G.maxHp > 0 and max(0, G.hp) / G.maxHp or 0
  local pct = max(0, round(G.hp / PLAYER.HP * 100))
  stat(0, 92, y0, tostring(G.vapes), 'VAPES')
  stat(92, 78, y0, pct .. '%', 'HEALTH')
  stat(214, 68, y0, '£' .. G.cash, 'CASH')
  box(282, y0 + 12, 78, 52); box(284, y0 + 14, 74, 48, FG, 1)
  text('LV ' .. G.level, 321, y0 + 20, 3, FG, 0.5)
  text(metres() .. 'M', 321, y0 + 42, fit(metres() .. 'M', 72, 3), FG, 0.5)
  -- the face
  box(170, y0 + 12, 44, 52)
  local tier = frac > 0.8 and 0 or (frac > 0.6 and 1 or (frac > 0.4 and 2 or (frac > 0.2 and 3 or 4)))
  local look = hash(floor(G.t / 1.1))
  local mode = (G.dead or G.hp <= 0) and 'dead' or (G.hurtT > 0 and 'ouch' or (G.dragT > VAPING.EXHALE and 'drag' or (G.dragT > 0 and 'puff' or (G.grinT > 0 and 'grin' or (look < 0.25 and 'l' or (look < 0.5 and 'r' or 'c'))))))
  local jolt = G.hurtT > 0.35 and round(sin(G.t * 60) * 2) or 0
  Gx.drawAt(Gx.face(tier, mode), 174 + jolt, y0 + 17)
  if G.hurtT > 0.45 and floor(G.t * 20) % 2 == 1 then box(171, y0 + 13, 42, 50, FG, 3) end   -- hit flash
  if G.bannerT > 0 and not (G.bannerT < 0.8 and floor(G.t * 12) % 2 == 1) then textO(G.banner, W / 2, H * 0.2, 3, FG, 0.5) end
  if P.save.runs < 2 and G.t < 6 and not G.dead and floor(G.t * 3) % 2 == 1 then
    textO('< D-PAD', 20, PY + 70, 2); textO('D-PAD >', W - 20, PY + 70, 2, FG, 1)
  end
end

return R
