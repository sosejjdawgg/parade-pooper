-- Save data, sound effects and input. Port of src/platform.js for a handheld:
-- sound effects are the browser game's own synth sounds (rendered to assets/sfx), and
-- input is a gamepad (d-pad, stick, buttons) with a keyboard fallback for desktop testing.
local P = {}

-- ---- save -------------------------------------------------------------------------------
local FILE = 'save.txt'
local function fresh() return { cash = 0, best = 0, bestDist = 0, runs = 0, shop = {}, sound = true, stick = true, seenIntro = false } end
P.save = fresh()
function P.loadSave()
  local s = love.filesystem.getInfo(FILE) and love.filesystem.read(FILE)
  if not s then return end
  for k, v in s:gmatch('([%w_%.]+)=([^\n]*)') do
    local val = v == 'true' or (v ~= 'false' and (tonumber(v) or v))
    if v == 'false' then val = false end
    local shopId = k:match('^shop%.(.+)$')
    if shopId then P.save.shop[shopId] = tonumber(v) or 0 else P.save[k] = val end
  end
end
function P.writeSave()
  local out = {}
  for k, v in pairs(P.save) do if k ~= 'shop' then out[#out + 1] = k .. '=' .. tostring(v) end end
  for k, v in pairs(P.save.shop) do out[#out + 1] = 'shop.' .. k .. '=' .. tostring(v) end
  love.filesystem.write(FILE, table.concat(out, '\n') .. '\n')
end
function P.resetSave()        -- wipe in place: other modules hold this table
  local f = fresh()
  for k in pairs(P.save) do P.save[k] = nil end
  for k, v in pairs(f) do P.save[k] = v end
  P.writeSave()
end
function P.shopLvl(id) return P.save.shop[id] or 0 end

-- ---- sound effects ---------------------------------------------------------------------------
local data, pools, lastKill = {}, {}, -1
local NAMES = { 'big', 'cash', 'puff', 'nova', 'kill', 'heal', 'hurt', 'level', 'pick', 'ui', 'no', 'buy', 'death' }
local function play(name)
  if not P.save.sound or not data[name] then return end
  local pool = pools[name]
  for _, s in ipairs(pool) do if not s:isPlaying() then s:play(); return end end
  if #pool < 6 then local s = love.audio.newSource(data[name], 'static'); pool[#pool + 1] = s; s:play() end
end
P.sfx = setmetatable({
  vape = function(combo) play('vape' .. math.min(combo, 14)) end,
  kill = function() local t = love.timer.getTime(); if t - lastKill < 0.05 then return end; lastKill = t; play('kill') end,
}, { __index = function(_, k) return function() play(k) end end })
function P.loadSounds()
  local names = { unpack(NAMES) }
  for c = 0, 14 do names[#names + 1] = 'vape' .. c end
  for _, n in ipairs(names) do
    local ok, sd = pcall(love.sound.newSoundData, 'assets/sfx/' .. n .. '.wav')
    if ok then data[n] = sd; pools[n] = {} end
  end
end

-- ---- input -----------------------------------------------------------------------------------
-- `taps` keeps the browser game's idea of a tap for steering (one nudge per press). Menus use
-- `nav` (up/down/left/right) and `ok` / `back`. The stick steers smoothly, like the phone's tilt.
P.input = { taps = {}, dir = 0, stick = 0, pause = false, nav = nil, ok = false, back = false }
local held = {}
local function refreshDir()
  local d = 0
  if held.left then d = -1 end
  if held.right then d = 1 end
  P.input.dir = d
end
local function press(what)
  local I = P.input
  if what == 'left' or what == 'right' then
    I.taps[#I.taps + 1] = { dir = what == 'left' and -1 or 1 }; held[what] = true; refreshDir()
    I.nav = what
  elseif what == 'up' or what == 'down' then I.nav = what
  elseif what == 'ok' then I.ok = true
  elseif what == 'back' then I.back = true
  elseif what == 'pause' then I.pause = true end
end
local function release(what) if what == 'left' or what == 'right' then held[what] = nil; refreshDir() end end

local KEYS = { left = 'left', a = 'left', right = 'right', d = 'right', up = 'up', w = 'up', down = 'down', s = 'down',
  ['return'] = 'ok', space = 'ok', z = 'ok', x = 'back', backspace = 'back', escape = 'pause', p = 'pause' }
local PAD = { dpleft = 'left', dpright = 'right', dpup = 'up', dpdown = 'down', a = 'ok', b = 'back', start = 'pause', back = 'back' }
function P.keypressed(k, isrepeat) if not isrepeat and KEYS[k] then press(KEYS[k]) end end
function P.keyreleased(k) if KEYS[k] then release(KEYS[k]) end end
function P.gamepadpressed(_, b) if PAD[b] then press(PAD[b]) end end
function P.gamepadreleased(_, b) if PAD[b] then release(PAD[b]) end end

-- the left stick: smooth steering in play, and up/down/left/right flicks in menus
local stickNav = { x = 0, y = 0 }
function P.pollStick(deadzone)
  local js = love.joystick.getJoysticks()
  local ax, ay = 0, 0
  for _, j in ipairs(js) do
    if j:isGamepad() then ax, ay = j:getGamepadAxis('leftx'), j:getGamepadAxis('lefty') break end
  end
  local I = P.input
  I.stick = math.abs(ax) > deadzone and (ax - deadzone * (ax > 0 and 1 or -1)) / (1 - deadzone) or 0
  local fx = ax > 0.6 and 1 or ax < -0.6 and -1 or 0
  local fy = ay > 0.6 and 1 or ay < -0.6 and -1 or 0
  if fx ~= stickNav.x and fx ~= 0 then I.nav = fx < 0 and 'left' or 'right' end
  if fy ~= stickNav.y and fy ~= 0 then I.nav = fy < 0 and 'up' or 'down' end
  stickNav.x, stickNav.y = fx, fy
end
function P.endFrame()
  local I = P.input
  I.taps = {}; I.pause = false; I.nav = nil; I.ok = false; I.back = false
end

return P
