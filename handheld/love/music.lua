-- Music. Port of src/music.js: the opening track plays once, the biome tracks loop at the
-- same sample-exact points as the browser game, tracks crossfade, the first start eases in,
-- and menus muffle the music (OpenAL low-pass) and turn it down a touch.
--
-- Each looping track is two files: <id>_intro.ogg (played once, streamed) and <id>_loop.ogg
-- (decoded once into memory and fed round and round into a QueueableSource, so the loop is
-- seamless). The opener streams straight from its decoder.
local C = require('config')
local P = require('platform')
local M = {}
local RATE, CH, BUFS, CHUNK = 44100, 2, 8, 2048

local loops, active, fading = {}, nil, {}
local openerDone, started, curName = false, false, nil
local muffle, master = 0, 0
local ffi = (pcall(require, 'ffi')) and require('ffi') or nil

function M.openerFinished() return openerDone end
function M.state() return { cur = curName, opener = openerDone } end

local function exists(p) return love.filesystem.getInfo(p) ~= nil end
function M.load()
  for _, id in ipairs({ 'ufo', 'arab', 'menu' }) do
    local p = 'assets/music/' .. id .. '_loop.ogg'
    if id == 'menu' then p = 'assets/music/menu.ogg' end
    if exists(p) then loops[id] = love.sound.newSoundData(p) end
  end
  if not exists('assets/music/' .. C.MUSIC.OPENER .. '.ogg') then openerDone = true end
end

-- copy n frames from a looping SoundData into a fresh chunk, wrapping at the end
local function loopChunk(st)
  local sd, total = loops[st.id], loops[st.id]:getSampleCount()
  local out = love.sound.newSoundData(CHUNK, RATE, 16, CH)
  if ffi then
    local src = ffi.cast('int16_t*', sd:getFFIPointer())
    local dst = ffi.cast('int16_t*', out:getFFIPointer())
    local done = 0
    while done < CHUNK do
      local n = math.min(CHUNK - done, total - st.pos)
      ffi.copy(dst + done * CH, src + st.pos * CH, n * CH * 2)
      done = done + n; st.pos = (st.pos + n) % total
    end
  else
    for i = 0, CHUNK - 1 do
      for c = 1, CH do out:setSample(i, c, sd:getSample(st.pos, c)) end
      st.pos = (st.pos + 1) % total
    end
  end
  return out
end

local function newStream(id)
  local def = C.MUSIC.TRACKS[id] or {}
  local st = { id = id, src = love.audio.newQueueableSource(RATE, 16, CH, BUFS), pos = 0, vol = 0, t = 0,
    fadeIn = started and C.MUSIC.FADE_IN or C.MUSIC.FADE_IN_FIRST, gain = def.gain or 1, once = def.once }
  if def.once then st.dec = love.sound.newDecoder('assets/music/' .. id .. '.ogg', CHUNK * 4)
  elseif exists('assets/music/' .. id .. '_intro.ogg') then st.dec = love.sound.newDecoder('assets/music/' .. id .. '_intro.ogg', CHUNK * 4) end
  started = true
  return st
end
local function feed(st)
  while st.src:getFreeBufferCount() > 0 do
    local chunk
    if st.dec then
      chunk = st.dec:decode()
      if not chunk then st.dec = nil; if st.once then st.ended = true; return end end
    end
    if not chunk then
      if st.once then return end
      chunk = loopChunk(st)
    end
    st.src:queue(chunk)
  end
  if not st.src:isPlaying() and not st.ended then st.src:play() end
end
local function setFilter(st)
  if muffle < 0.01 then pcall(st.src.setFilter, st.src) else
    pcall(st.src.setFilter, st.src, { type = 'lowpass', volume = 1, highgain = 1 - (1 - C.MUSIC.MUFFLE_HIGHGAIN) * muffle })
  end
end

--- call every frame with the track that should be playing ('menu' | track id | nil)
function M.frame(dt, track, muffled)
  muffle = muffle + ((muffled and 1 or 0) - muffle) * math.min(1, dt * 10)
  local want = P.save.sound and (C.MUSIC.VOLUME * (1 - (1 - C.MUSIC.MUFFLE_GAIN) * muffle)) or 0
  master = master + (want - master) * math.min(1, dt * 12)
  if track ~= curName and (track == nil or track == 'menu' and loops.menu or track == C.MUSIC.OPENER or loops[track]) then
    if active then active.out = true; fading[#fading + 1] = active end
    curName = track
    active = track and newStream(track) or nil
  end
  if active then
    active.t = active.t + dt
    local k = math.min(1, active.t / active.fadeIn)
    active.vol = k ^ 2.2                         -- slow start, then swell (as in the browser game)
    feed(active)
    active.src:setVolume(master * active.vol * active.gain)
    setFilter(active)
    if active.ended and not active.src:isPlaying() then
      if active.id == C.MUSIC.OPENER then openerDone = true end
      active = nil
    end
  end
  for i = #fading, 1, -1 do
    local st = fading[i]
    st.vol = st.vol - dt / C.MUSIC.XFADE
    if st.vol <= 0 then st.src:stop(); table.remove(fading, i)
    else feed(st); st.src:setVolume(master * st.vol * st.gain); setFilter(st) end
  end
end

return M
