-- Desktop test script: `love . --shots` walks every screen, plays with the bot, and saves
-- screenshots (shot_*.png) into LÖVE's save folder, then quits. Not used on the handheld.
local T = {}
local ctx, t, step, steps = nil, 0, 1, nil
local function press(what) return function() ctx.input[what] = true end end
local function nav(dir) return function() ctx.input.nav = dir end end
function T.start(c)
  ctx = c
  local G, GM = c.G, c.GM
  steps = {
    { 1.0, function() c.capture('01_title') end },
    { 0.2, nav('down') }, { 0.2, nav('down') }, { 0.3, press('ok') },         -- how to play
    { 2.0, function() c.capture('02_howto') end },
    { 1.5, function() c.capture('03_howto_scrolled') end },
    { 0.3, press('ok') },                                                      -- first time: starts a run
    { 0.5, function() G.bot = true; G.god = true end },
    { 8.0, function() c.capture('04_canal') end },
    { 0.1, function() G.bot = false; G.xp = G.xpNeed end },
    { 0.8, function() c.capture('05_levelup') end },
    { 0.3, press('ok') },
    { 0.2, function() G.bot = true; G.dist = 900 * 20; G.genY = G.dist + 300 end },
    { 7.0, function() c.capture('06_desert') end },
    { 0.1, function() G.weapons = { cloud = 6, trail = 4, nova = 4, storm = 4 }; G.passives = { rings = 4, extra = 2, lungs = 3, chain = 2 }; GM.calcStats(); G.dist = 2100 * 20; G.genY = G.dist + 300 end },
    { 9.0, function() c.capture('07_volcano_chaos') end },
    { 0.1, function() G.burst = 120 end },
    { 0.4, function() c.capture('08_boost') end },
    { 0.1, press('pause') },
    { 0.5, function() c.capture('09_pause') end },
    { 0.2, press('pause') },
    { 0.2, function() G.god = false; G.bot = false; G.inv = 0; G.hp = 1; G.px = -100 end },
    { 2.5, function() c.capture('10_dead') end },
    { 0.2, nav('down') }, { 0.3, press('ok') },                                -- shop
    { 0.8, function() c.capture('11_shop') end },
    { 0.2, nav('down') }, { 0.2, nav('down') }, { 0.2, nav('down') }, { 0.2, nav('down') }, { 0.2, nav('down') },
    { 0.8, function() c.capture('12_shop_scrolled') end },
    { 0.2, function() G.mode = 'settings' end },
    { 0.8, function() c.capture('13_settings') end },
    { 0.2, function() G.mode = 'legal' end },
    { 0.8, function() c.capture('14_legal') end },
    { 0.5, function() love.event.quit() end },
  }
end
function T.frame(dt)
  t = t + dt
  local s = steps[step]
  if s and t >= s[1] then t = 0; step = step + 1; s[2]() end
end
return T
