-- Angela Rayner's: Vape Kayak — handheld edition (LÖVE). Boot, main loop and every screen.
-- Port of src/main.js. The browser game's tap buttons become a focus you move with the
-- d-pad or stick and press with A (B goes back, START pauses). Screens taller than the
-- handheld's 480 px (how-to-play, shop) scroll.
--
-- Test switches (desktop): love . --bot [--god] [--fast N] [--shots] [--soak SECONDS]
local C = require('config')
local Gx = require('gfx')
local P = require('platform')
local GM = require('game')
local R = require('render')
local Mu = require('music')
local lg = love.graphics
local BG, FG, GINGER = C.COLORS.BG, C.COLORS.FG, C.COLORS.GINGER
local W, H, OX = C.VIEW.W, C.VIEW.SCREEN_H, C.VIEW.OX
local SCREEN_W = C.VIEW.SCREEN_W
local rect, box, text, textO, textW, wrap, draw, round = Gx.rect, Gx.box, Gx.text, Gx.textO, Gx.textW, Gx.wrap, Gx.draw, Gx.round
local floor, min, max, sin, cos = math.floor, math.min, math.max, math.sin, math.cos
local G, SPR = GM.G, nil
local save, sfx, input = P.save, P.sfx, P.input
local STEP = 1 / 60

local args = {}
local FAST, canvas = 1, nil
local acc, modeT, prevMode, backTo, toast, toastT, resetArm, introThenPlay = 0, 0, '', 'title', '', 0, -10, false
local introScroll, shopScroll = 0, 0

-- ---- focus UI (replaces the browser game's tap buttons) --------------------------------------
local items, lastItems, focus = {}, {}, 1
local function uiBegin()
  lastItems = items; items = {}
  local nav = input.nav
  if nav and #lastItems > 0 then
    local cur = lastItems[focus] or lastItems[1]
    local cx, cy = cur[1] + cur[3] / 2, cur[2] + cur[4] / 2
    local best, bestD = nil, 1e9
    for i, it in ipairs(lastItems) do
      local x, y = it[1] + it[3] / 2, it[2] + it[4] / 2
      local dx, dy = x - cx, y - cy
      local ok = (nav == 'up' and dy < -4) or (nav == 'down' and dy > 4) or (nav == 'left' and dx < -4) or (nav == 'right' and dx > 4)
      if ok and i ~= focus then
        local d = (nav == 'up' or nav == 'down') and (math.abs(dy) + math.abs(dx) * 2) or (math.abs(dx) + math.abs(dy) * 2)
        if d < bestD then best, bestD = i, d end
      end
    end
    if best then focus = best; sfx.ui() end
  end
end
--- register a selectable area; returns focused, activated
local function focusable(x, y, w, h)
  items[#items + 1] = { x, y, w, h }
  local f = #items == focus
  return f, f and input.ok and modeT > 0.25
end
local function focusRing(x, y, w, h)
  if floor(love.timer.getTime() * 4) % 4 == 3 then return end
  box(x - 4, y - 4, w + 8, h + 8, GINGER, 2)
end
local function panel(x, y, w, h, inv) rect(x, y, w, h, inv and FG or BG); box(x, y, w, h, FG, 2); if not inv then box(x + 3, y + 3, w - 6, h - 6, FG, 1) end end
local function button(x, y, w, h, label, o)
  o = o or {}
  local s, inv = o.scale or 2, o.inv
  rect(x, y, w, h, inv and FG or BG); box(x, y, w, h, FG, 2)
  text(label, x + w / 2, y + (h - 5 * s) / 2, s, inv and BG or FG, 0.5)
  local f, hit = focusable(x, y, w, h)
  if f then focusRing(x, y, w, h) end
  if hit then
    if o.disabled then sfx.no(); return false end
    sfx.ui(); return true
  end
  return false
end
local function shade() Gx.color(BG); for y = 0, H - 1, 2 do lg.rectangle('fill', -OX, y, SCREEN_W, 1) end end
local function say(msg) toast = msg; toastT = 2 end

-- ---- screens -----------------------------------------------------------------------------------
local function play() if save.seenIntro then GM.newRun() else introThenPlay = true; G.mode = 'intro' end end
local function canAfford(it)
  local lvl = P.shopLvl(it.id)
  return lvl < #it.costs and save.cash >= it.costs[lvl + 1] and (not it.needs or P.shopLvl(it.needs) > 0)
end

local function titleScreen()
  local bob = round(sin(G.t * 2) * 3)
  textO("ANGELA RAYNER'S", W / 2, H * 0.1 + bob, 3, GINGER, 0.5)
  for _, wd in ipairs({ { 'VAPE', H * 0.1 + 28 }, { 'KAYAK', H * 0.1 + 88 } }) do
    text(wd[1], W / 2 + 4, wd[2] + bob + 4, 10, BG, 0.5); textO(wd[1], W / 2, wd[2] + bob, 10, FG, 0.5)
  end
  local by = round(H * 0.43)
  if button(W / 2 - 90, by, 180, 44, 'PLAY', { scale = 4, inv = true }) then play() end
  local canBuy = P.shopLvl('engine') == 0 and save.cash >= C.SHOP[1].costs[1] and floor(G.t * 3) % 2 == 1
  if button(W / 2 - 90, by + 54, 86, 30, canBuy and 'SHOP !' or 'SHOP', { inv = canBuy }) then backTo = 'title'; G.mode = 'shop' end
  if button(W / 2 + 4, by + 54, 86, 30, 'SETTINGS') then G.mode = 'settings' end
  if button(W / 2 - 90, by + 92, 180, 26, 'HOW TO PLAY') then introThenPlay = false; G.mode = 'intro' end
  textO('D-PAD OR STICK TO STEER', W / 2, H * 0.79, 2, FG, 0.5)
  textO('COLLECT VAPES. GET POWERFUL.', W / 2, H * 0.79 + 16, 2, FG, 0.5)
  textO('NO STAMP DUTY PAYABLE ON KAYAKS.', W / 2, H * 0.79 + 34, 2, FG, 0.5)
  if save.best > 0 then textO('BEST ' .. save.best .. ' VAPES   ' .. save.bestDist .. 'M   £' .. save.cash, W / 2, H * 0.9 + 6, 2, FG, 0.5) end
  textO('A FREE, NON-COMMERCIAL PARODY. NOT AFFILIATED WITH ANYONE.', W / 2, H - 10, 1, FG, 0.5)
end

-- how to play: the browser game's three panels, scrolling (up/down) above a fixed button
local function stepTitle(n, label, y)
  rect(22, y, 22, 22, FG); text(n, 33, y + 4, 3, BG, 0.5)
  text(label, 52, y + 4, 3, FG)
end
local function chevron(y) for i = 0, 4 do rect(W / 2 - 5 + i, y + i, 10 - i * 2, 1) end end
local function big(s, x, y) Gx.drawAt(s, round(x - s.w), round(y - s.h), 0, 2, 2) end
local function introScreen(dt)
  shade()
  local t, viewH = G.t, H - 64
  local maxScroll = 580 - viewH
  if input.nav == 'down' then introScroll = introScroll + 70 elseif input.nav == 'up' then introScroll = introScroll - 70 end
  if not input.nav and modeT > 1.5 then introScroll = introScroll + dt * 18 end        -- drifts down on its own
  introScroll = math.max(0, math.min(maxScroll, introScroll))
  rect(8, 0, W - 16, H, BG)
  lg.setScissor(OX + 8, 0, W - 16, viewH)
  lg.push(); lg.translate(0, -round(introScroll))
  local top = 2
  text('HOW TO PLAY', W / 2, top + 10, 5, FG, 0.5)
  -- 1 ---- kayak down the river
  local y = top + 42
  panel(12, y, W - 24, 136); stepTitle(1, 'KAYAK DOWN THE RIVER', y + 10)
  local sx, sy0, sw, sh = 24, y + 40, 150, 86
  local kx, goingLeft = sx + sw / 2 + sin(t * 1.5) * 34, cos(t * 1.5) < 0
  local tx, ty = lg.transformPoint(sx, sy0)
  lg.setScissor(math.max(tx, OX + 8), math.max(ty, 0), sw, math.max(0, math.min(sh, viewH - ty)))
  rect(sx, sy0, sw, sh, BG)
  for i = 0, 8 do rect(sx + 22 + ((i * 53) % 104), sy0 + ((t * 60 + i * 37) % (sh + 6)) - 3, 3, 1) end
  for row = -1, 12 do
    local yy, off = sy0 + row * 8 + ((t * 60) % 8), (((row - floor(t * 60 / 8)) % 5 + 5) % 5 < 2) and 4 or 0
    rect(sx + 12 + off, yy, 2, 8); rect(sx + sw - 14 - off, yy, 2, 8)
  end
  for i = 0, 2 do local vy = ((t * 60 + i * 40) % 120) - 12; if vy < 52 then draw(SPR.vape[floor(t * 9 + i * 3) % 16], sx + sw / 2 + sin((t - (60 - vy) / 60) * 1.5) * 34, sy0 + vy) end end
  draw(SPR.kayak[floor(t * 3) % 2 + 1], kx, sy0 + 62)
  lg.setScissor(OX + 8, 0, W - 16, viewH)
  box(sx, sy0, sw, sh)
  text('PRESS LEFT OR', 186, y + 42, 2); text('RIGHT ON THE', 186, y + 55, 2); text('D-PAD OR STICK', 186, y + 68, 2); text('TO STEER.', 186, y + 81, 2)
  rect(186, y + 100, 70, 24, goingLeft and FG or BG); box(186, y + 100, 70, 24); text('< LEFT', 221, y + 107, 2, goingLeft and BG or FG, 0.5)
  rect(262, y + 100, 74, 24, goingLeft and BG or FG); box(262, y + 100, 74, 24); text('RIGHT >', 299, y + 107, 2, goingLeft and FG or BG, 0.5)
  chevron(y + 139)
  -- 2 ---- collect vapes
  y = y + 146
  panel(12, y, W - 24, 130); stepTitle(2, 'COLLECT VAPES', y + 10)
  local its = { { SPR.vape[floor(t * 9) % 16], '+1' }, { SPR.bigVape[floor(t * 5) % 16], '+5' }, { SPR.tea, 'HEALS' }, { SPR.cash, 'CASH' } }
  for i, it in ipairs(its) do local x = 58 + (i - 1) * 82; big(it[1], x, y + 56 + (i > 2 and round(sin(t * 4 + i - 1) * 2) or 0)); text(it[2], x, y + 80, 2, FG, 0.5) end
  text('VAPES LEVEL YOU UP. EACH LEVEL', W / 2, y + 98, 2, FG, 0.5); text('GIVES YOU A NEW POWER.', W / 2, y + 111, 2, FG, 0.5)
  chevron(y + 133)
  -- 3 ---- avoid the dangers
  y = y + 140
  panel(12, y, W - 24, 248); stepTitle(3, 'AVOID THE DANGERS', y + 10)
  text('ENEMIES: A TOUCH COSTS HEALTH', 24, y + 38, 2)
  for i, k in ipairs({ 'swan', 'pap', 'tumble', 'piranha', 'mozzie', 'croc' }) do big(SPR[k], 46 + (i - 1) * 54, y + 74 + round(sin(t * 6 + i - 1) * 2)) end
  text('YOUR VAPE CLOUDS DESTROY THEM', 24, y + 100, 2)
  rect(24, y + 115, W - 48, 1)
  text('THESE SINK YOU INSTANTLY', 24, y + 122, 2)
  local bs = SPR.barge[70]
  Gx.drawAt(bs, 80, y + 154, math.pi / 2, 1, 1, bs.w / 2, bs.h / 2)
  text('BARGE', 80, y + 174, 1, FG, 0.5)
  Gx.dither(150, y + 145, 70, 18); rect(150, y + 143, 70, 2); rect(150, y + 163, 70, 2); draw(SPR.pier, 185, y + 154); text('LOW BRIDGE', 185, y + 174, 1, FG, 0.5)
  rect(250, y + 149, 34, 10); rect(304, y + 149, 30, 10); rect(281, y + 146, 6, 16); rect(301, y + 146, 6, 16); text('LOCK GATE', 292, y + 174, 1, FG, 0.5)
  rect(24, y + 185, W - 48, 1)
  text('THESE HURT OR SLOW YOU', 24, y + 192, 2)
  draw(SPR.trolley, 44, y + 224); big(SPR.barrel, 80, y + 224); big(SPR.cone, 108, y + 224)
  draw(SPR.sandbar[0], 158, y + 224)
  for arm = 0, 2 do for k = 0, 7 do local a, r = -t * 4 + arm * 2.094 + k * 0.5, 2 + k * 2; rect(round(214 + cos(a) * r), round(y + 224 + sin(a) * r * 0.9), 2, 2) end end
  rect(244, y + 211, 3, 26, C.COLORS.ENEMY); for i = 0, 2 do rect(250 + (i % 2) * 4, y + 214 + i * 8, 5, 1, C.COLORS.ENEMY) end
  text('RED BANKS', 302, y + 213, 2, FG, 0.5); text('LATER ON', 302, y + 226, 2, FG, 0.5)
  lg.pop(); lg.setScissor()
  if introScroll < maxScroll and floor(G.t * 3) % 2 == 1 then text('MORE: DOWN', W - 14, viewH - 12, 1, GINGER, 1) end
  if button(40, H - 54, W - 80, 46, save.seenIntro and 'GOT IT' or "LET'S GO", { scale = 4, inv = true }) or (input.back and save.seenIntro and modeT > 0.25) then
    local first = not save.seenIntro; save.seenIntro = true; P.writeSave()
    if first or introThenPlay then GM.newRun() else G.mode = 'title' end
  end
end

local function levelUpScreen()
  shade()
  textO('LEVEL UP!', W / 2, 34, 5, FG, 0.5)
  textO('LEVEL ' .. (G.level - G.pending + 1) .. ' - CHOOSE ONE', W / 2, 68, 2, FG, 0.5)
  local ch, gap = 112, 12
  local y0 = max(92, round((H - 3 * ch - 2 * gap) / 2) + 20)
  for i, c in ipairs(G.choices) do
    local y, inv = y0 + (i - 1) * (ch + gap), c.kind == 'evo'
    local fg = inv and BG or FG
    local pop = max(0, 1 - (modeT - (i - 1) * 0.06) * 6)
    local x = 20 + round(pop * 40)
    panel(x, y, W - 40, ch, inv)
    text(c.title, x + 14, y + 14, 3, fg)
    if c.tag ~= '' then local tw = textW(c.tag, 2) + 10; rect(x + W - 40 - tw - 10, y + 12, tw, 18, fg); text(c.tag, x + W - 40 - 15, y + 16, 2, inv and FG or BG, 1) end
    for k, l in ipairs(wrap(c.desc, 36)) do text(l, x + 14, y + 44 + (k - 1) * 14, 2, fg) end
    text('A TO TAKE', x + 14, y + ch - 16, 1, fg)
    local f, hit = focusable(20, y, W - 40, ch)
    if f then focusRing(20, y, W - 40, ch) end
    if hit then GM.choose(i); return end
  end
end

local function deadScreen()
  shade()
  local r = G.result
  local y = round(H / 2 - 222)
  panel(20, y, W - 40, 444)
  text(r.title, W / 2, y + 14, min(8, floor(300 / (#r.title * 4))), FG, 0.5)
  text(C.FLAVOUR.CAUSES[G.cause] or '', W / 2, y + 60, 2, FG, 0.5)
  draw(SPR.bigVape[floor(G.t * 10) % 16], W / 2, y + 90)
  text(r.vapes, W / 2, y + 106, 8, FG, 0.5)
  text(r.newBest and 'NEW BEST!' or 'VAPES', W / 2, y + 150, 2, (r.newBest and floor(G.t * 4) % 2 == 1) and BG or FG, 0.5)
  local rows = { { 'DISTANCE', r.m .. 'M' }, { 'LEVEL', r.level }, { 'MELTED', r.kills }, { 'TAX ADVICE TAKEN', 'NONE' }, { 'CASH BANKED', '+£' .. r.cash } }
  for i, row in ipairs(rows) do text(row[1], 44, y + 174 + (i - 1) * 16, 2); text(row[2], W - 44, y + 174 + (i - 1) * 16, 2, FG, 1) end
  rect(44, y + 256, W - 88, 1)
  text('WALLET £' .. save.cash, W / 2, y + 262, 2, FG, 0.5)
  if button(40, y + 282, W - 80, 44, 'GO AGAIN', { scale = 4, inv = true }) then GM.newRun(); return end
  local canBuy = false
  for _, it in ipairs(C.SHOP) do if canAfford(it) then canBuy = true end end
  canBuy = canBuy and floor(G.t * 3) % 2 == 1
  if button(40, y + 334, 134, 34, canBuy and 'SHOP !' or 'SHOP', { inv = canBuy }) then backTo = 'dead'; G.mode = 'shop' end
  if button(186, y + 334, 134, 34, 'TITLE') or (input.back and modeT > 0.25) then G.mode = 'title'; G.dead = false end
  for k, l in ipairs(wrap('TIP: ' .. r.tip, 36)) do text(l, W / 2, y + 380 + (k - 1) * 13, 2, FG, 0.5) end
  text('A PARODY. NO KAYAKS WERE HARMED.', W / 2, y + 426, 1, FG, 0.5)
end

local function shopScreen(dt)
  shade()
  local rowH, top = 62, 8
  local viewTop, viewBot = top + 48, H - 52
  textO('SHOP', 14, top + 6, 6)
  textO('£' .. save.cash, W - 14, top + 14, 4, FG, 1)
  -- keep the focused row on screen
  local fy = (focus <= #C.SHOP) and ((focus - 1) * rowH) or (#C.SHOP * rowH)
  local want = math.max(0, math.min(#C.SHOP * rowH - (viewBot - viewTop), fy - (viewBot - viewTop) / 2 + rowH / 2))
  shopScroll = shopScroll + (want - shopScroll) * math.min(1, dt * 12)
  lg.setScissor(OX, viewTop - 4, W, viewBot - viewTop + 4)
  for i, it in ipairs(C.SHOP) do
    local y = round(viewTop + (i - 1) * rowH - shopScroll)
    local lvl = P.shopLvl(it.id)
    local maxed, locked = lvl >= #it.costs, it.needs and P.shopLvl(it.needs) == 0
    panel(8, y, W - 16, rowH - 4)
    text(it.name, 18, y + 9, 2)
    for k = 0, #it.costs - 1 do local px = 22 + textW(it.name, 2) + k * 8; if k < lvl then rect(px, y + 9, 6, 10) else box(px, y + 9, 6, 10) end end
    for k, l in ipairs(wrap(it.desc, 31)) do text(l, 18, y + 25 + (k - 1) * 12, 2) end
    if it.flavour then text(it.flavour, 18, y + 47, 1) end
    local label = maxed and 'MAX' or (locked and 'LOCKED' or ('£' .. it.costs[lvl + 1]))
    local ok = not maxed and not locked and save.cash >= it.costs[lvl + 1]
    if button(W - 86, y + 12, 68, 32, label, { inv = ok, disabled = not ok }) then
      save.cash = save.cash - it.costs[lvl + 1]; save.shop[it.id] = lvl + 1; P.writeSave(); sfx.buy(); say(it.name .. ' UPGRADED')
    end
  end
  lg.setScissor()
  local y = H - 44
  if backTo == 'dead' then
    if button(8, y, 130, 36, 'BACK') or (input.back and modeT > 0.25) then G.mode = 'dead' end
    if button(146, y, W - 154, 36, 'GO AGAIN', { inv = true }) then GM.newRun() end
  elseif button(8, y, W - 16, 36, 'BACK') or (input.back and modeT > 0.25) then G.mode = 'title' end
end

local function settingsScreen()
  shade()
  local y = round(H / 2 - 170)
  panel(20, y, W - 40, 340)
  text('SETTINGS', W / 2, y + 20, 5, FG, 0.5)
  if button(40, y + 64, W - 80, 40, 'SOUND: ' .. (save.sound and 'ON' or 'OFF'), { scale = 3 }) then save.sound = not save.sound; P.writeSave() end
  if button(40, y + 114, W - 80, 40, 'STICK STEER: ' .. (save.stick and 'ON' or 'OFF'), { scale = 3 }) then save.stick = not save.stick; P.writeSave() end
  local armed = G.t - resetArm < 3
  if button(40, y + 164, W - 80, 40, armed and 'PRESS AGAIN TO WIPE' or 'RESET PROGRESS', { scale = 2, inv = armed }) then
    if armed then P.resetSave(); GM.calcStats(); resetArm = -10; say('PROGRESS RESET') else resetArm = G.t end
  end
  if button(40, y + 214, W - 80, 40, 'ABOUT AND LEGAL', { scale = 2 }) then G.mode = 'legal' end
  if button(40, y + 276, W - 80, 44, 'BACK', { scale = 3, inv = true }) or (input.back and modeT > 0.25) then G.mode = 'title' end
end

local function legalScreen()
  shade()
  local x0, wdt = -OX + 10, SCREEN_W - 20          -- the handheld screen is wide: use all of it
  rect(x0, 10, wdt, H - 20, BG); box(x0, 10, wdt, H - 20, FG, 2)
  text('ABOUT AND LEGAL', W / 2, 22, 4, FG, 0.5)
  local y = 50
  for i, block in ipairs(C.LEGAL) do
    if i % 2 == 1 then text(block, x0 + 14, y, 2, GINGER); y = y + 15
    else
      if C.LEGAL[i - 1] == 'MUSIC' and love.filesystem.getInfo('assets/music/river.ogg') then block = block .. ' OPENING TRACK: RIVER (8 BIT TRIBUTE) BY 8 BIT UNIVERSE, PRIVATE BUILD ONLY.' end
      for _, l in ipairs(wrap(block, 74)) do text(l, x0 + 14, y, 2); y = y + 12 end
      y = y + 8
    end
  end
  if button(40, H - 62, W - 80, 44, 'BACK', { scale = 3, inv = true }) or (input.back and modeT > 0.25) then G.mode = 'settings' end
end

local function pauseScreen()
  shade()
  local y = round(H / 2 - 100)
  panel(40, y, W - 80, 200)
  text('PAUSED', W / 2, y + 22, 6, FG, 0.5)
  if button(60, y + 76, W - 120, 44, 'RESUME', { scale = 4, inv = true }) or ((input.pause or input.back) and modeT > 0.1) then G.mode = 'play' end
  if button(60, y + 132, W - 120, 36, 'QUIT RUN') then G.mode = 'title'; G.dead = false end
end

-- ---- test scripts (desktop only) ----------------------------------------------------------------
local shots, shotDir, soak = nil, nil, nil
local function capture(name) lg.captureScreenshot(function(img) img:encode('png', 'shot_' .. name .. '.png') end) end

-- ---- main loop ---------------------------------------------------------------------------------
function love.load(arg)
  for i, a in ipairs(arg) do args[a] = arg[i + 1] or true end
  FAST = tonumber(args['--fast']) or 1
  love.mouse.setVisible(false)
  Gx.load(); SPR = Gx.SPR
  P.loadSave()
  P.loadSounds(); Mu.load()
  canvas = lg.newCanvas(SCREEN_W, H); canvas:setFilter('nearest', 'nearest')
  GM.newRun(); G.mode = 'title'; G.banner = ''; G.inv = 0
  if args['--bot'] then GM.newRun(); G.bot = true; G.god = args['--god'] and true or false end
  if args['--soak'] then soak = { left = tonumber(args['--soak']) or 60, n = 0, sum = 0, peak = 0, upd = 0, t0 = 0 }; GM.newRun(); G.bot = true; G.god = true; FAST = 1 end
  if args['--shots'] then shots = require('testshots'); shots.start({ G = G, GM = GM, P = P, capture = capture, input = input }) end
end

local musicErr = false
function love.update(dt)
  dt = math.min(0.1, dt)
  P.pollStick(C.PLAYER.STICK_DEADZONE)
  if shots then shots.frame(dt) end
  if soak then          -- worst-case load: everything maxed in the volcano, timing Lua work per frame
    soak.left = soak.left - dt
    if soak.n == 60 then G.weapons = { cloud = 6, trail = 5, nova = 5, storm = 5 }; G.evo = { cloud = true, storm = true, nova = true, trail = true }; G.passives = { rings = 5, extra = 3, lungs = 3, chain = 3, linger = 2, magnet = 3 }; GM.calcStats(); G.dist = 2200 * 20; G.genY = G.dist + 300 end
    if soak.left <= 0 then print(string.format('DRAWCALLS avg %.0f peak %d, shader switches avg %.0f', soak.dc / soak.n, soak.dcp, soak.sw / soak.n)); print(string.format('SOAK frames=%d  lua update avg %.2f ms  draw avg %.2f ms  worst frame %.2f ms  enemies %d clouds %d parts %d', soak.n, soak.upd / soak.n * 1000, (soak.sum - soak.upd) / soak.n * 1000, soak.peak * 1000, GM.enemies.n, GM.clouds.n, GM.parts.n)); love.event.quit() end
  end
  if G.mode ~= prevMode then prevMode = G.mode; modeT = 0; acc = 0; introScroll = 0; focus = 1; items = {} end
  modeT = modeT + dt
  if G.mode == 'play' then
    for _, t in ipairs(input.taps) do GM.nudge(t.dir) end
    if input.pause and not G.dead then G.mode = 'pause'; input.pause = false
    else
      acc = acc + dt * FAST
      local u0 = os.clock()
      while acc >= STEP and G.mode == 'play' do GM.update(STEP); acc = acc - STEP end
      if soak then soak.upd = soak.upd + (os.clock() - u0); soak.ft = os.clock() - u0 end
    end
  elseif G.mode == 'title' or G.mode == 'shop' or G.mode == 'settings' or G.mode == 'legal' or G.mode == 'intro' then GM.idle(dt)
  else G.t = G.t + dt end
  if G.bot then
    if G.mode == 'levelup' then
      local rank = { evo = 0, weapon = 1, passive = 2 }
      local bi = 1
      for i, c in ipairs(G.choices) do if (rank[c.kind] or 3) < (rank[G.choices[bi].kind] or 3) then bi = i end end
      GM.choose(love.math.random() < 0.6 and bi or love.math.random(1, #G.choices))
    end
    if G.mode == 'dead' then GM.newRun(); G.bot = true end
  end
  local onTitle = G.mode == 'title' or G.mode == 'settings' or G.mode == 'legal' or G.mode == 'intro' or (G.mode == 'shop' and backTo == 'title')
  if not musicErr then
    local ok, err = pcall(Mu.frame, dt, (not Mu.openerFinished()) and C.MUSIC.OPENER or (onTitle and 'menu' or C.MUSIC.BIOME_TRACKS[(G.biomeIdx or 0) + 1]), G.mode ~= 'play' and G.mode ~= 'title')
    if not ok then musicErr = true; print('music disabled: ' .. tostring(err)) end
  end
end

function love.draw()
  local dt = love.timer.getDelta()
  local d0 = os.clock()
  lg.setCanvas(canvas)
  lg.clear(0, 0, 0, 1)
  lg.push(); lg.translate(OX, 0)
  uiBegin()
  local menu = G.mode == 'title' or G.mode == 'settings' or G.mode == 'legal' or G.mode == 'intro' or G.mode == 'shop'
  R.drawWorld(menu and 'menu' or 'full')
  if not menu then R.drawHud() end
  if G.mode == 'title' then titleScreen()
  elseif G.mode == 'levelup' then levelUpScreen()
  elseif G.mode == 'dead' then deadScreen()
  elseif G.mode == 'shop' then shopScreen(dt)
  elseif G.mode == 'settings' then settingsScreen()
  elseif G.mode == 'legal' then legalScreen()
  elseif G.mode == 'intro' then introScreen(dt)
  elseif G.mode == 'pause' then pauseScreen() end
  if toastT > 0 then toastT = toastT - dt; local tw = textW(toast, 2) + 20; rect(W / 2 - tw / 2, H - 96, tw, 22, FG); text(toast, W / 2, H - 90, 2, BG, 0.5) end
  lg.pop()
  Gx.plain()
  lg.setCanvas()
  -- scale the 640x480 canvas to the screen: whole pixels when possible, centred
  local ww, wh = lg.getDimensions()
  local s = math.min(ww / SCREEN_W, wh / H)
  if s >= 1 then s = floor(s) end
  lg.setColor(1, 1, 1)
  lg.draw(canvas, floor((ww - SCREEN_W * s) / 2), floor((wh - H * s) / 2), 0, s, s)
  P.endFrame()
  if soak then local st = lg.getStats(); soak.dc = (soak.dc or 0) + st.drawcalls; soak.dcp = math.max(soak.dcp or 0, soak.n > 120 and st.drawcalls or 0); soak.sw = (soak.sw or 0) + st.shaderswitches
    local f = (soak.ft or 0) + os.clock() - d0; soak.n = soak.n + 1; soak.sum = soak.sum + f; if soak.n > 120 then soak.peak = math.max(soak.peak, f) end end
end

function love.keypressed(k, sc, rep) P.keypressed(k, rep) end
function love.keyreleased(k) P.keyreleased(k) end
function love.gamepadpressed(j, b) P.gamepadpressed(j, b) end
function love.gamepadreleased(j, b) P.gamepadreleased(j, b) end
function love.focus(f) if not f and G.mode == 'play' and not G.dead and not G.bot then G.mode = 'pause' end end
