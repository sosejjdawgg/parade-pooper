#!/usr/bin/env python3
"""Mix and encode the upgrades trailer from tools/trailer_upgrades.cjs output.
   python3 tools/trailer_upgrades_mix.py <framesDir> <out.mp4>
Audio: "Arabian Dancer" (quiet intro under the cute set-up, drop at 8.0 s), ducked to a breath before
the evolution, hard cut to silence for the duck button, then back in on the drop for the title card.
Sound effects are the game's own (handheld/love/assets/sfx), placed from the capture's cue sheet."""
import json, os, subprocess, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frames, out = sys.argv[1], sys.argv[2]
music = os.path.join(root, 'music', 'arab.mp3')
sfx = os.path.join(root, 'handheld', 'love', 'assets', 'sfx')
events = json.load(open(os.path.join(frames, 'events.json')))

# thin the kill clicks so a ring sweeping a flock reads as a crackle, not a wall of noise
cues, last = [], {}
for e in events:
    gap = 0.09 if e['name'] == 'kill' else 0.0
    if e['t'] - last.get(e['name'], -9) < gap: continue
    last[e['name']] = e['t']; cues.append(e)

inputs = ['-framerate', '30', '-i', os.path.join(frames, 'f_%05d.png'),
          '-i', music, '-ss', '8.0', '-i', music]
fl = [
    # part 1: 0-32 s, breath (duck to 15%) 23.0-23.95, hard stop at 32
    "[1:a]atrim=0:32,asetpts=PTS-STARTPTS,volume='if(between(t,23.0,23.95),0.15,1)':eval=frame,afade=t=out:st=31.95:d=0.05,volume=0.75[m1]",
    # part 2: from the drop, under the title card at 35 s
    "[2:a]atrim=0:5,asetpts=PTS-STARTPTS,afade=t=in:d=0.05,afade=t=out:st=3.4:d=1.6,volume=0.75,adelay=35000|35000[m2]",
]
mix = ['[m1]', '[m2]']
for i, c in enumerate(cues):
    k = 3 + i
    inputs += ['-i', os.path.join(sfx, c['name'] + '.wav')]
    vol = c.get('vol', 1) * (0.55 if c['name'] == 'kill' else 0.9)
    ms = int(c['t'] * 1000)
    fl.append(f"[{k}:a]aformat=channel_layouts=stereo,volume={vol:.2f},adelay={ms}|{ms}[s{i}]")
    mix.append(f'[s{i}]')
# low synthesized boom under the two slams (evolution at 24.0 s, the duck overkill at 33.4 s)
for j, (t, vol) in enumerate([(24.0, 0.7), (33.4, 1.0)]):
    k = 3 + len(cues) + j
    inputs += ['-f', 'lavfi', '-t', '1.2', '-i', "aevalsrc='0.9*sin(2*PI*(38*t+90*(1-exp(-6*t))/6))*exp(-3.2*t)+0.25*(random(0)-0.5)*exp(-14*t)':s=44100"]
    ms = int(t * 1000)
    fl.append(f"[{k}:a]aformat=channel_layouts=stereo,volume={vol},adelay={ms}|{ms}[b{j}]"); mix.append(f'[b{j}]')
fl.append(''.join(mix) + f"amix=inputs={len(mix)}:normalize=0:dropout_transition=0,alimiter=limit=0.95,atrim=0:40[a]")
fl.append("[0:v]scale=1080:1920:flags=neighbor,format=yuv420p[v]")
cmd = ['ffmpeg', '-y', '-loglevel', 'error'] + inputs + ['-filter_complex', ';'.join(fl), '-map', '[v]', '-map', '[a]',
       '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', '40', out]
subprocess.run(cmd, check=True)
print('wrote', out, len(cues), 'sfx cues')
