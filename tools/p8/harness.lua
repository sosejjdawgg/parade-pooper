-- Headless PICO-8 API stand-in for testing the cart on a PC (no PICO-8 or
-- Fake-08 needed). Runs the cart, plays it with a bot, dumps frames and stats.
--   lua5.2 tools/p8/harness.lua <cart.p8> <outdir> <script>
-- script: "shots" (screens to look at) | "soak:<seconds>" (balance/perf run)
local cartpath, outdir, script = arg[1], arg[2], arg[3] or "shots"

-------------------------------------------------------------------- memory
local fb, sheet = {}, {}
for i = 0, 128 * 128 - 1 do fb[i] = 0; sheet[i] = 0 end
local dpal, tpal, spal = {}, {}, {}
local function resetpal()
  for c = 0, 15 do dpal[c] = c; tpal[c] = (c == 0) end
end
resetpal()
for c = 0, 15 do spal[c] = c end
local camx, camy, fillpat, filltr = 0, 0, 0, false
local stats = { calls = 0 }

local P = {}   -- the API, injected as cart globals

local function bit(p, x, y) return math.floor(p / 2 ^ (15 - (y % 4) * 4 - (x % 4))) % 2 end
local function setpx(x, y, c)
  x, y = math.floor(x) - camx, math.floor(y) - camy
  if x < 0 or y < 0 or x > 127 or y > 127 then return end
  if fillpat ~= 0 and bit(fillpat, x, y) == 1 then if filltr then return end end
  fb[y * 128 + x] = dpal[math.floor(c) % 16]
end
-------------------------------------------------------------------- maths
local flr = math.floor
P.flr = function(x) return flr(x or 0) end
P.ceil = function(x) return math.ceil(x or 0) end
P.abs, P.sqrt = math.abs, function(x) return x > 0 and math.sqrt(x) or 0 end
P.max = function(a, b) return math.max(a or 0, b or 0) end
P.min = function(a, b) return math.min(a or 0, b or 0) end
P.mid = function(a, b, c) local t = { a, b, c } table.sort(t) return t[2] end
P.sgn = function(x) return x < 0 and -1 or 1 end
P.sin = function(t) return -math.sin(t * 2 * math.pi) end
P.cos = function(t) return math.cos(t * 2 * math.pi) end
P.atan2 = function(dx, dy) return (math.atan2(-dy, dx) / (2 * math.pi)) % 1 end
P.rnd = function(x) if type(x) == "table" then return x[math.random(#x)] end return math.random() * (x or 1) end
P.srand = function(s) math.randomseed(s) end
P.tostr = function(v) if type(v) == "number" and v == flr(v) then return string.format("%d", v) end return tostring(v) end
P.tonum = tonumber
P.sub = function(s, i, j) return string.sub(s, i, j) end
P.split = function(s, sep, conv)
  s = tostring(s); sep = sep or ","
  local out, start = {}, 1
  while true do
    local i = string.find(s, sep, start, true)
    local piece = string.sub(s, start, (i or 0) - 1)
    if i == nil then piece = string.sub(s, start) end
    if conv ~= false and tonumber(piece) then piece = tonumber(piece) end
    out[#out + 1] = piece
    if not i then break end
    start = i + #sep
  end
  return out
end
P.unpack = table.unpack or unpack
P.add = function(t, v) t[#t + 1] = v return v end
P.del = function(t, v) for i = 1, #t do if t[i] == v then table.remove(t, i) return v end end end
P.count = function(t) return #t end
P.all = function(t) local i = 0 return function() i = i + 1 return t[i] end end
P.foreach = function(t, f) for _, v in ipairs(t) do f(v) end end
-------------------------------------------------------------------- input
local held, prev = {}, {}
P.btn = function(i) return held[i] == true end
P.btnp = function(i) return held[i] == true and not prev[i] end
-------------------------------------------------------------------- sound, save, misc
local sfxlog, musiclog = {}, {}
P.sfx = function(n) sfxlog[#sfxlog + 1] = n end
P.music = function(n) musiclog[#musiclog + 1] = n end
local cart = {}
P.cartdata = function() end
P.dget = function(i) return cart[i] or 0 end
P.dset = function(i, v) cart[i] = v end
P.menuitem = function() end
P.stat = function() return 0 end
local frames = 0
P.t = function() return frames / 60 end
P.time = P.t
-------------------------------------------------------------------- graphics
P.cls = function(c) for i = 0, 128 * 128 - 1 do fb[i] = c or 0 end camx, camy = 0, 0 end
P.camera = function(x, y) camx, camy = flr(x or 0), flr(y or 0) end
P.pal = function(a, b, p)
  if a == nil then resetpal() return end
  if p == 1 then spal[a] = b else dpal[a] = b % 16 end
end
P.palt = function(c, t) if c == nil then for i = 0, 15 do tpal[i] = i == 0 end else tpal[c] = t end end
P.fillp = function(p)
  p = p or 0
  filltr = (p % 1) ~= 0
  fillpat = flr(p) % 65536
end
P.pset = function(x, y, c) stats.calls = stats.calls + 1 setpx(x, y, c or 6) end
P.pget = function(x, y) x, y = flr(x), flr(y) if x < 0 or y < 0 or x > 127 or y > 127 then return 0 end return fb[y * 128 + x] end
P.rectfill = function(x0, y0, x1, y1, c)
  stats.calls = stats.calls + 1
  x0, y0, x1, y1 = flr(x0), flr(y0), flr(x1), flr(y1)
  if x0 > x1 then x0, x1 = x1, x0 end
  if y0 > y1 then y0, y1 = y1, y0 end
  for y = math.max(y0, camy - 1), math.min(y1, camy + 128) do for x = math.max(x0, camx - 1), math.min(x1, camx + 128) do setpx(x, y, c) end end
end
P.rect = function(x0, y0, x1, y1, c)
  stats.calls = stats.calls + 1
  P.line(x0, y0, x1, y0, c) P.line(x0, y1, x1, y1, c) P.line(x0, y0, x0, y1, c) P.line(x1, y0, x1, y1, c)
end
P.line = function(x0, y0, x1, y1, c)
  stats.calls = stats.calls + 1
  x0, y0, x1, y1 = flr(x0), flr(y0), flr(x1), flr(y1)
  local dx, dy = math.abs(x1 - x0), -math.abs(y1 - y0)
  local sx, sy = x0 < x1 and 1 or -1, y0 < y1 and 1 or -1
  local err = dx + dy
  for _ = 1, 400 do
    setpx(x0, y0, c)
    if x0 == x1 and y0 == y1 then break end
    local e2 = 2 * err
    if e2 >= dy then err = err + dy; x0 = x0 + sx end
    if e2 <= dx then err = err + dx; y0 = y0 + sy end
  end
end
P.circfill = function(cx, cy, r, c)
  stats.calls = stats.calls + 1
  cx, cy, r = flr(cx), flr(cy), flr(r or 4)
  if r < 0 then return end
  for dy = -r, r do
    local w = flr(math.sqrt(math.max(0, r * r - dy * dy)) + .5)
    for x = cx - w, cx + w do setpx(x, cy + dy, c) end
  end
end
P.circ = function(cx, cy, r, c)
  stats.calls = stats.calls + 1
  cx, cy, r = flr(cx), flr(cy), flr(r or 4)
  if r < 0 then return end
  for a = 0, 359, math.max(1, flr(60 / math.max(1, r))) do
    setpx(cx + flr(math.cos(math.rad(a)) * r + .5), cy + flr(math.sin(math.rad(a)) * r + .5), c)
  end
end
P.sget = function(x, y) if x < 0 or y < 0 or x > 127 or y > 127 then return 0 end return sheet[flr(y) * 128 + flr(x)] end
P.sset = function(x, y, c) sheet[flr(y) * 128 + flr(x)] = c end
P.sspr = function(sx, sy, sw, sh, dx, dy, dw, dh)
  stats.calls = stats.calls + 1
  dw, dh = dw or sw, dh or sh
  for y = 0, flr(dh) - 1 do for x = 0, flr(dw) - 1 do
    local c = P.sget(sx + flr(x * sw / dw), sy + flr(y * sh / dh))
    if not tpal[c] then setpx(dx + x, dy + y, c) end
  end end
end
P.spr = function(n, x, y, w, h)
  w, h = w or 1, h or 1
  P.sspr((n % 16) * 8, flr(n / 16) * 8, w * 8, h * 8, flr(x), flr(y))
end
-- 3x5 font, 4px advance
local GL = {
  A='010101111101101', B='110101110101110', C='011100100100011', D='110101101101110', E='111100110100111', F='111100110100100',
  G='011100101101011', H='101101111101101', I='111010010010111', J='001001001101010', K='101101110101101', L='100100100100111',
  M='101111111101101', N='110101101101101', O='010101101101010', P='110101110100100', Q='010101101110011', R='110101110101101',
  S='011100010001110', T='111010010010010', U='101101101101111', V='101101101101010', W='101101111111101', X='101101010101101',
  Y='101101010010010', Z='111001010100111', ['0']='111101101101111', ['1']='010110010010111', ['2']='110001010100111',
  ['3']='110001010001110', ['4']='101101111001001', ['5']='111100110001110', ['6']='011100111101111', ['7']='111001010010010',
  ['8']='111101111101111', ['9']='111101111001110', ['+']='000010111010000', ['-']='000000111000000', ['.']='000000000000010',
  [',']='000000000010100', ['!']='010010010000010', ['?']='110001010000010', [':']='000010000010000', ["'"]='010010000000000',
  ['/']='001001010100100', ['%']='101001010100101', ['>']='100010001010100', ['<']='001010100010001', ['(']='010100100100010',
  [')']='010001001001010', ['*']='000101010101000', ['=']='000111000111000', ['#']='101111101111101', ['$']='011110010011110',
}
P.print = function(s, x, y, c)
  stats.calls = stats.calls + 1
  s = string.upper(P.tostr(s)); x, y = flr(x or 0), flr(y or 0)
  for i = 1, #s do
    local g = GL[string.sub(s, i, i)]
    if g then for p = 0, 14 do if string.sub(g, p + 1, p + 1) == '1' then setpx(x + (i - 1) * 4 + p % 3, y + flr(p / 3), c or 6) end end end
  end
  return x + #s * 4
end
-- memory: 0x0000 sprite sheet, 0x6000 screen (2 pixels per byte, low nibble = left)
local function peekb(a)
  if a >= 0x6000 and a < 0x8000 then local i = (a - 0x6000) * 2 return fb[i] + fb[i + 1] * 16 end
  if a < 0x2000 then local i = a * 2 return sheet[i] + sheet[i + 1] * 16 end
  return 0
end
local function pokeb(a, v)
  if a >= 0x6000 and a < 0x8000 then local i = (a - 0x6000) * 2 fb[i] = v % 16 fb[i + 1] = flr(v / 16) end
  if a < 0x2000 then local i = a * 2 sheet[i] = v % 16 sheet[i + 1] = flr(v / 16) end
end
P.peek, P.poke = peekb, pokeb
P.memcpy = function(d, s, n) for i = 0, n - 1 do pokeb(d + i, peekb(s + i)) end end

-------------------------------------------------------------------- load cart
local src = io.open(cartpath):read("*a")
local lua = src:match("__lua__\n(.-)\n__gfx__")
local gfx = src:match("__gfx__\n(.-)\n__")
local y = 0
for line in gfx:gmatch("[^\n]+") do
  for x = 0, 127 do sheet[y * 128 + x] = tonumber(line:sub(x + 1, x + 1), 16) end
  y = y + 1
end
local env = setmetatable({}, { __index = function(t, k) return P[k] or _G[k] end })
local chunk, err = load(lua, "=cart", "t", env)
if not chunk then print("COMPILE ERROR: " .. err) os.exit(1) end
chunk()
local C = env

-------------------------------------------------------------------- output
local function dump(name)
  local f = io.open(outdir .. "/" .. name .. ".hex", "w")
  for yy = 0, 127 do local row = {} for xx = 0, 127 do row[#row + 1] = string.format("%x", fb[yy * 128 + xx]) end f:write(table.concat(row), "\n") end
  f:close()
end

-------------------------------------------------------------------- the bot
local function bot()
  for k in pairs(held) do held[k] = nil end
  if C.mode ~= "play" or C.dead then return end
  local l, r = C.rL(C.py - 20) + 5, C.rR(C.py - 20) - 5
  local best, bc = C.px, 1e9
  for k = 0, 14 do
    local x = l + (r - l) * k / 14
    local cost = math.abs(x - C.px) * .2
    for _, h in ipairs(C.hz) do
      local dy = C.py - h.y
      if h.k ~= "deck" and h.k ~= "vine" and dy > -10 - h.h and dy < 70 + h.h then
        local pad = h.k == "vortex" and 18 or h.w + 6
        if math.abs(x - h.x) < pad then cost = cost + ((h.k == "junk" or h.k == "sand") and 300 or 2000) * (1.2 - math.max(0, dy) / 80) end
      end
    end
    for _, e in ipairs(C.es) do
      local dy = C.py - e.y
      if dy > -12 and dy < 40 and math.abs(x - e.x) < 8 then cost = cost + 120 end
    end
    for _, p in ipairs(C.pk) do
      local dy = C.py - p.y
      if dy > 0 and dy < 60 and math.abs(x - p.x) < 5 then cost = cost - (p.k == 1 and 30 or 90) * (1 - dy / 80) end
    end
    if cost < bc then bc = cost best = x end
  end
  if best < C.px - 2 then held[0] = true elseif best > C.px + 2 then held[1] = true end
end

-------------------------------------------------------------------- run
-- count cart Lua VM instructions per frame (sampled every 50 instructions)
local samples = 0
debug.sethook(function() local info = debug.getinfo(2, "S") if info and info.source == "=cart" then samples = samples + 1 end end, "", 50)
C._init()
local function step(input)
  for k, v in pairs(held) do prev[k] = v end
  for k in pairs(prev) do if not held[k] then prev[k] = nil end end
  if input then input() end
  C._update60() C._draw()
  frames = frames + 1
end
local function press(b, n) for _ = 1, n or 1 do step(function() for k in pairs(held) do held[k] = nil end held[b] = true end) step(function() held[b] = nil end) end end
local function wait(n) for _ = 1, n do step(function() for k in pairs(held) do held[k] = nil end end) end end

local function report(tag) print(string.format("%-10s mode=%s m=%d lv=%s vapes=%s hp=%s enemies=%d clouds=%d", tag, tostring(C.mode), flr(C.dist or 0), tostring(C.lvl), tostring(C.vapes), tostring(C.hp), #C.es, #C.cl)) end

if script == "shots" then
  wait(40) dump("01_title")
  press(3) wait(5) dump("02_title_sel")
  press(2) press(4) wait(30) dump("03_howto")
  press(4) wait(240) bot() dump("04_play_start")
  local hurt0, die0 = C.hurt, C.die
  C.hurt, C.die = function() end, function() end
  for _ = 1, 60 * 40 do step(bot) if C.mode == "lvl" then wait(20) dump("05_levelup") C.choose(1) end end
  dump("06_play_40s") report("40s")
  C.dist = 900 for _ = 1, 60 * 10 do step(bot) if C.mode == "lvl" then C.choose(math.random(#C.choices)) end end
  dump("07_desert") report("desert")
  C.lv.storm, C.lv.rings, C.lv.nova, C.lv.extra, C.lv.cloud = 3, 3, 3, 2, 5 C.stats()
  C.dist = 1900 for _ = 1, 60 * 12 do step(bot) if C.mode == "lvl" then C.choose(math.random(#C.choices)) end end
  dump("08_jungle_red") report("jungle")
  C.burst = .6 C.dragt = 80 wait(3) dump("09_boost")
  C.hurt, C.die = hurt0, die0 C.inv = 0 C.hp = 1 C.hurt("swan") for _ = 1, 120 do step() end dump("10_over")
  press(3) press(4) wait(20) dump("11_shop")
  print("sfx played:", #sfxlog, "music calls:", table.concat(musiclog, ","))
elseif script:sub(1, 4) == "soak" then
  local secs = tonumber(script:sub(6)) or 300
  wait(30) press(4) wait(40) press(4) wait(20)
  if C.mode ~= "play" then C.new_run() end
  C.hurt, C.die = function() end, function() end
  local worst, total, n, worstdraw = 0, 0, 0, 0
  local bucket = 0
  for f = 1, secs * 60 do
    samples = 0 stats.calls = 0
    step(bot)
    if C.mode == "lvl" then C.choose(math.random(#C.choices)) end
    local instr = samples * 50
    worst = math.max(worst, instr) total = total + instr n = n + 1
    worstdraw = math.max(worstdraw, stats.calls)
    bucket = math.max(bucket, instr)
    if f % (30 * 60) == 0 then
      print(string.format("%4ds %5dm lv%-3d vapes%-5d kills%-5d enemies%-3d clouds%-3d  cart-instr/frame avg %6d peak(30s) %6d  draw-calls peak %d",
        flr(f / 60), flr(C.dist), C.lvl, C.vapes, C.kills, #C.es, #C.cl, flr(total / n), bucket, worstdraw))
      bucket = 0
    end
  end
  print(string.format("overall: avg %d, worst %d cart VM instructions per frame", flr(total / n), worst))
end
