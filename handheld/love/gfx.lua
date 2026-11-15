-- Canvas, pixel font, sprites, discs, dither. Port of src/gfx.js.
-- Sprites and HUD faces are the browser game's own pixels (assets/atlas.png, exported by
-- tools/love/export_assets.cjs); the font, discs and dither are rebuilt here exactly.
local C = require('config')
local lg = love.graphics
local G = {}
local atlasImg
local discShader, discOn, white1 = nil, false, nil   -- disc-shader state, checked by every draw call

local BG, FG = C.COLORS.BG, C.COLORS.FG
G.W, G.H = C.VIEW.W, C.VIEW.SCREEN_H
G.OX = C.VIEW.OX

-- ---- 32-bit hash, identical to the JS one (Math.imul + unsigned shifts) ------------------
local bit = require('bit')
local band, bxor, rshift, tobit = bit.band, bit.bxor, bit.rshift, bit.tobit
local function imul(a, b)
  local ah, al = band(rshift(a, 16), 0xffff), band(a, 0xffff)
  local bh, bl = band(rshift(b, 16), 0xffff), band(b, 0xffff)
  return tobit(al * bl + tobit((ah * bl + al * bh) * 65536))
end
function G.hash(n)
  n = tobit(math.floor(n))
  n = imul(bxor(n, rshift(n, 15)), 0x2c1b3c6d)
  n = imul(bxor(n, rshift(n, 12)), 0x297a2d39)
  n = bxor(n, rshift(n, 15))
  return (n % 4294967296) / 4294967296
end

local function trunc(v) return v >= 0 and math.floor(v) or math.ceil(v) end   -- JS `x | 0`
G.trunc = trunc
local function round(v) return math.floor(v + 0.5) end                         -- JS Math.round
G.round = round

function G.color(c, a) if discOn then lg.setShader(); discOn = false end lg.setColor(c[1], c[2], c[3], a or 1) end
local whiteQ
function G.rect(x, y, w, h, c)
  G.color(c or FG)
  lg.draw(atlasImg, whiteQ, trunc(x), trunc(y), 0, trunc(w), trunc(h))
end
function G.box(x, y, w, h, c, t)
  t = t or 1; c = c or FG
  G.rect(x, y, w, t, c); G.rect(x, y + h - t, w, t, c); G.rect(x, y, t, h, c); G.rect(x + w - t, y, t, h, c)
end

-- ---- 3x5 pixel font -------------------------------------------------------------------------
local GL = {
  A = '010101111101101', B = '110101110101110', C = '011100100100011', D = '110101101101110',
  E = '111100110100111', F = '111100110100100', G = '011100101101011', H = '101101111101101',
  I = '111010010010111', J = '001001001101010', K = '101101110101101', L = '100100100100111',
  M = '101111111101101', N = '110101101101101', O = '010101101101010', P = '110101110100100',
  Q = '010101101110011', R = '110101110101101', S = '011100010001110', T = '111010010010010',
  U = '101101101101111', V = '101101101101010', W = '101101111111101', X = '101101010101101',
  Y = '101101010010010', Z = '111001010100111',
  ['0'] = '111101101101111', ['1'] = '010110010010111', ['2'] = '110001010100111', ['3'] = '110001010001110',
  ['4'] = '101101111001001', ['5'] = '111100110001110', ['6'] = '011100111101111', ['7'] = '111001010010010',
  ['8'] = '111101111101111', ['9'] = '111101111001110',
  ['+'] = '000010111010000', ['-'] = '000000111000000', ['.'] = '000000000000010', [','] = '000000000010100',
  ['!'] = '010010010000010', ['?'] = '110001010000010', [':'] = '000010000010000', ["'"] = '010010000000000',
  ['/'] = '001001010100100', ['%'] = '101001010100101', ['£'] = '011010111010111', ['>'] = '100010001010100',
  ['<'] = '001010100010001', ['('] = '010100100100010', [')'] = '010001001001010', ['*'] = '000101010101000',
  ['='] = '000111000111000', ['#'] = '101111101111101',
}
G.GLYPHS = GL
local glyphQuad = {}

-- split a string into characters, keeping '£' (two bytes in UTF-8) as one
local function chars(s)
  local out, i = {}, 1
  while i <= #s do
    local b = s:byte(i)
    if b == 0xC2 and s:byte(i + 1) == 0xA3 then out[#out + 1] = '£'; i = i + 2
    else out[#out + 1] = s:sub(i, i); i = i + 1 end
  end
  return out
end
G.chars = chars

function G.textW(str, s) s = s or 1; return #chars(tostring(str)) * 4 * s - s end
--- align: 0 left, 0.5 centre, 1 right
function G.text(str, x, y, s, color, align)
  s = s or 1; align = align or 0
  local cs = chars(string.upper(tostring(str)))
  x = round(x - (#cs * 4 * s - s) * align); y = round(y)
  G.color(color or FG)
  for i = 1, #cs do
    local q = glyphQuad[cs[i]]
    if q then lg.draw(atlasImg, q, x + (i - 1) * 4 * s, y, 0, s, s) end
  end
end
--- text with a black outline so it reads over anything
function G.textO(str, x, y, s, color, align)
  for dx = -1, 1 do for dy = -1, 1 do if dx ~= 0 or dy ~= 0 then G.text(str, x + dx, y + dy, s, BG, align) end end end
  G.text(str, x, y, s, color, align)
end
function G.wrap(str, maxChars)
  local out, line = {}, ''
  for w in str:gmatch('%S+') do
    if line ~= '' and #(line .. ' ' .. w) > maxChars then out[#out + 1] = line; line = w
    else line = line ~= '' and (line .. ' ' .. w) or w end
  end
  if line ~= '' then out[#out + 1] = line end
  return out
end

-- ---- sprites from the atlas ----------------------------------------------------------------
G.SPR = {}
local function sprite(name)
  local r = G.ATLAS[name]
  return { q = lg.newQuad(r[1], r[2], r[3], r[4], atlasImg:getDimensions()), w = r[3], h = r[4] }
end
--- draw a sprite centred on x, y (like the JS draw())
function G.draw(s, x, y, sc)
  sc = sc or 1
  G.color(FG)
  lg.draw(atlasImg, s.q, round(x - s.w * sc / 2), round(y - s.h * sc / 2), 0, sc, sc)
end
function G.drawAt(s, x, y, r, sx, sy, ox, oy)
  G.color(FG); lg.draw(atlasImg, s.q, x, y, r or 0, sx or 1, sy or sx or 1, ox or 0, oy or 0)
end
--- one row of a sprite (for the heat-haze scanlines)
local rowQuad
function G.drawRow(s, row, x, y)
  local r = G.ATLAS[s.name]
  rowQuad:setViewport(r[1], r[2] + row, r[3], 1, atlasImg:getDimensions())
  G.color(FG); lg.draw(atlasImg, rowQuad, x, y)
end
function G.face(tier, mode) return G.SPR['face' .. tier .. mode] end

-- ---- hard-edged discs (shader: exact JS pixel patterns, no texture cache needed) ------------
-- style 0 solid, 1 checker + rim, 2 sparse dots, 3 rim only. Pattern is relative to the disc's own
-- top-left pixel, as in the browser game's cached canvases.
-- Radius and style travel in the vertex colour (red = radius/255, green = style/255), so
-- consecutive discs share one shader and LÖVE batches them into a single draw call.
local DISC_SRC = [[
vec4 effect(vec4 col, Image tex, vec2 tc, vec2 sc) {
  float rad = floor(col.r * 255.0 + 0.5), sty = floor(col.g * 255.0 + 0.5);
  vec2 p = floor(tc * (rad * 2.0 + 1.0));
  float dx = (p.x - rad) / rad, dy = (p.y - rad) / rad;
  float q = dx * dx + dy * dy;
  if (q > 1.0 + 0.8 / rad) discard;
  float rin = (rad - 1.2) / rad; rin = rin * rin;
  bool rim = q >= rin;
  float on = 0.0;
  if (sty < 0.5) on = 1.0;
  else if (sty < 1.5) { if (rim || mod(p.x + p.y, 2.0) < 0.5) on = 1.0; }
  else if (sty < 2.5) { if (mod(p.x, 2.0) < 0.5 && mod(p.y, 2.0) < 0.5 && mod(floor((p.x + p.y) / 2.0), 2.0) < 0.5) on = 1.0; }
  else { if (rim) on = 1.0; }
  if (on < 0.5) discard;
  return vec4(1.0);
}]]
--- leave disc mode before any ordinary drawing
local function plain() if discOn then lg.setShader(); discOn = false end end
G.plain = plain
function G.drawDisc(x, y, r, style)
  r = math.max(1, math.min(150, trunc(r)))
  local s = r * 2 + 1
  if not discOn then lg.setShader(discShader); discOn = true end
  lg.setColor(r / 255, style / 255, 0, 1)
  lg.draw(white1, round(x) - r, round(y) - r, 0, s, s)
end

-- ---- ordered dither fills (4x4 Bayer, BANK_DITHER_PX per dot) and the 2x2 checker -----------
local BAYER = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 }
local fills, fillQuad = {}, nil
local function fillImage(color, density, px)
  local key = table.concat(color, ',') .. density .. ':' .. px
  if fills[key] then return fills[key] end
  local d = love.image.newImageData(4 * px, 4 * px)
  for i = 0, 15 do
    if BAYER[i + 1] / 16 < density then
      for yy = 0, px - 1 do for xx = 0, px - 1 do d:setPixel((i % 4) * px + xx, math.floor(i / 4) * px + yy, color[1], color[2], color[3], 1) end end
    end
  end
  local img = lg.newImage(d); img:setFilter('nearest', 'nearest'); img:setWrap('repeat', 'repeat')
  fills[key] = img
  return img
end
--- fill a rectangle with a repeating pattern anchored to the current origin (like a canvas pattern)
function G.patternRect(img, x, y, w, h)
  x, y, w, h = trunc(x), trunc(y), trunc(w), trunc(h)
  if w <= 0 or h <= 0 then return end
  fillQuad:setViewport(x, y, w, h, img:getDimensions())
  G.color(FG); lg.draw(img, fillQuad, x, y)
end
function G.ditherFill(color, density) return fillImage(color, density, C.BIOMES.BANK_DITHER_PX) end
local checker
--- the white 1-px checker (flash, bridge decks)
function G.dither(x, y, w, h) G.patternRect(checker, x, y, w, h) end

function G.load()
  lg.setDefaultFilter('nearest', 'nearest')
  lg.setLineStyle('rough')
  -- font atlas
  local keys = {}
  for k in pairs(GL) do keys[#keys + 1] = k end
  table.sort(keys)
  -- one texture for everything that batches: the exported sprite atlas, plus the font glyphs
  -- painted into its empty lower half, plus its white pixel for rectangles
  local d = love.image.newImageData('assets/atlas.png')
  local FY = 1000
  for i, k in ipairs(keys) do
    local g = GL[k]
    for p = 0, 14 do if g:sub(p + 1, p + 1) == '1' then d:setPixel((i - 1) * 4 + p % 3, FY + math.floor(p / 3), 1, 1, 1, 1) end end
  end
  atlasImg = lg.newImage(d)
  for i, k in ipairs(keys) do glyphQuad[k] = lg.newQuad((i - 1) * 4, FY, 3, 5, atlasImg:getDimensions()) end
  G.ATLAS = require('assets.atlas')
  whiteQ = lg.newQuad(G.ATLAS.white[1], G.ATLAS.white[2], 1, 1, atlasImg:getDimensions())
  for name in pairs(G.ATLAS) do G.SPR[name] = sprite(name); G.SPR[name].name = name end
  local S = G.SPR
  S.kayak = { S.kayak0, S.kayak1 }
  S.vape, S.bigVape = {}, {}
  for i = 0, 15 do S.vape[i] = S['vape' .. i]; S.bigVape[i] = S['bigVape' .. i] end
  S.barge = { [70] = S.barge70, [90] = S.barge90, [110] = S.barge110 }
  S.sandbar = { [0] = S.sandbar0, S.sandbar1, S.sandbar2 }
  S.signs = { S.sign0, S.sign1 }
  rowQuad = lg.newQuad(0, 0, 1, 1, atlasImg:getDimensions())
  fillQuad = lg.newQuad(0, 0, 1, 1, 4, 4)
  local cd = love.image.newImageData(2, 2)
  cd:setPixel(0, 0, 1, 1, 1, 1); cd:setPixel(1, 1, 1, 1, 1, 1)
  checker = lg.newImage(cd); checker:setWrap('repeat', 'repeat')
  discShader = lg.newShader(DISC_SRC)
  local wd = love.image.newImageData(1, 1); wd:setPixel(0, 0, 1, 1, 1, 1); white1 = lg.newImage(wd)
end

return G
