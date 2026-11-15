pico-8 cartridge // http://www.pico-8.com
version 41
__lua__
-- angela rayner's: vape kayak
-- pico-8 edition for retro handhelds
-- (r36s / rs36 pro on arkos: put the
-- .p8 in roms/pico-8)
-- a free, non-commercial parody.
-- not affiliated with anyone.
-- controls: d-pad or stick to steer,
-- any face button to select.

---- balance (px per frame, frames, metres)
-- px/metre, start+max scroll, metres to max,
-- kayak y, damage per hit, base health,
-- steer accel/max/glide, xp curve (first,
-- step, curve), desert m, jungle m, blend m,
-- red banks m, max enemies, enemy hp/km,
-- boost needed to ram
ppm,spd0,spd1,rampm,py,hitd,hp0,sac,smax,sfric,xpf,xps,xpc,desm,junm,blendm,redm,maxe,hpgrow,ramb=unpack(split"7,.62,1.12,2600,84,34,100,.3,1.7,.8,50,20,1.5,650,1700,220,1500,36,.35,.18")
cwid,cgap,erate=split"66,84,61",split"54,46,37",split".55,1.2,3.2"
-- vape engine: burst per vape, cap (by tuning)
badd,bcap,immcd=split".14,.17,.2,.23,.27,.31",split".47,.59,.71,.83,.98,1.13",split"600,480,300,180,120"
-- weapons by level 1-6; entry 7 is the
-- evolved form
cdir,cdmg,crad,clife,ccd=split"1,1,3,3,4,6,8",split"9,12,14,17,21,26,40",split"4.7,5.4,6.1,6.8,7.5,8.2,11",split"33,36,39,42,45,48,57",split"57,51,45,39,33,27,22"
tdmg,trad,tlife=split"5,7,9,11,13,0,18",split"4.7,5.4,6.1,6.8,7.5,0,12",split"96,120,144,168,192,0,240"
ndmg,nrad,ncd=split"12,18,24,32,42,0,95",split"39,48,57,66,75,0,120",split"324,288,252,216,180,0,168"
sn,sdmg,sorb,srad,sres=split"2,3,3,4,5,0,7",split"10,12,15,18,22,0,34",split"15,17,20,22,24,0,28",split"3.6,3.9,4.3,4.6,5,0,5.7",split"210,180,156,132,108,0,60"
rdmg,rrad,rlife,rcd=split"10,14,18,24,30",split"19,24,28,32,37",split"90,96,102,108,114",split"174,156,138,120,102"
dx4,dy4=split"-1,1,0,0",split"0,0,-1,1"

-- "a|b" -> {split a, split b}
function parse(s,sep,conv)
 local o={} for p in all(split(s,"|",false)) do add(o,split(p,sep,conv)) end return o
end
-- name,hp,r,speed,mode(0 drift,1 chase,
-- 2 bounce),xp,drop,turn,stamina,sprite
ed={}
for v in all(parse"swan,6,3,.13,0,1,.4,.05,0,3|pap,8,3,.27,1,2,.5,.0024,5,4|tumble,11,3,.18,2,1,.4,.42,0,5|piranha,15,3,.39,1,2,.45,.0034,6,6|mozzie,3,2,.5,1,1,.25,.0053,7,7|croc,70,4,.15,0,8,1,.08,0,8") do ed[v[1]]=v end
etab=parse"swan,swan,swan,swan,swan,pap,pap|swan,pap,pap,pap,pap,tumble,tumble,tumble,tumble,croc|pap,pap,piranha,piranha,piranha,piranha,piranha,mozzie,mozzie,mozzie,mozzie,mozzie,mozzie,croc"
packc,packn,behc=split".05,.15,.45",split"3,5,9",split"0,.1,.25"
-- river patterns per biome (repeats = weight)
cks=parse"snake,snake,snake,snake,snake,snake,snake,snake,cluster,barge,barge,barge,bridge,bridge,bridge,debris,debris,vortex|snake,snake,snake,snake,snake,cluster,cluster,cluster,cluster,cluster,barge,barge,bridge,debris,vortex,vortex,sand,sand,sand,sand|snake,snake,snake,snake,cluster,cluster,barge,bridge,debris,vortex,vortex,vortex,vortex,vine,vine,vine,vine,vine"
-- name;costs;effect;flavour
shop=parse("vape engine;40;every vape = speed burst;the desert island essential|engine tuning;70,140,240,360,500;faster, bigger speed bursts;deputy no more|warm-up puff;80,220;start with a stronger cloud;a cheeky one before conference|fast learner;30,60,100,160,240;+10% xp;left school at 16. learnt anyway|expenses;30,60,100,160,240;+20% cash;airpods sold separately|magnetic hair;25,50,90,140,200;+15% pickup range;attracts vapes and headlines|thick skin;60,120,200,300;+25% max health;for when the sunday papers call|political immunity;80,150,250,400,600;shield kills on touch;recharge 10s, then 8,5,3,2",";",false)
-- id;name;max;level descriptions
ups=parse("cloud;vape cloud;6;more damage, faster/three directions/bigger, stronger/four directions/six directions|trail;vapetrail;5;hurts enemies/thicker trail/stronger trail/longer trail/much thicker|nova;big vape clouds;5;blasts the area clear/bigger cloud/faster, stronger/bigger cloud/huge cloud|storm;vape storm;5;orbiting clouds pop on enemies/+1 orbiter/wider, stronger/+1 orbiter/+1 orbiter|rings;vape rings;5;growing hoops cut through enemies/bigger hoops/stronger hoops/faster hoops/huge hoops|bat;bigger vape battery;5;+20% size, every cloud|extra;+1 cloud;3;+1 cloud, every weapon but the trail|chain;chain vaper;5;-8% cooldowns|thick;thicker clouds;5;+15% cloud duration|duty;duty free;5;+30% pickup range|hivis;hi-vis vest;3;+34% max health and a full heal",";",false)
for v in all(shop) do v[2]=split(v[2]) end
for v in all(ups) do v[3],v[4]=tonum(v[3]),split(v[4],"/",false) end
evos=parse("cloud,bat,pea souper,eight directions. enormous.|storm,chain,hurricane ange,a ring of angry weather.|nova,rings,mushroom cloud,clears the whole screen.|trail,thick,chemtrail,a vast lingering wake of fog.",",",false)
dtitles=split"sunk!,sunk!,resigned!,reshuffled!"
tips=split("always check which home is your main home.|stamp duty cannot be dodged. barges can.|specialist advice is cheaper than resigning.|airpods go on expenses. vapes do not.|free clothes are not a power-up. declare them.|save the dancing for the ibiza dj booth.|do not call the swans scum. they remember.|a kayak is not a second home. probably.","|")
causes={}
for v in all(parse("barge:rammed someone's second home|pier:hit a low bridge|vortex:down the plughole|debris:sunk by fly-tipping|sandbar:ran aground|bank:hit the red wall|swan:a swan took it personally|pap:papped mid-puff|tumble:tumbleweeded|piranha:nibbled by the backbenches|mozzie:bitten to bits|croc:snapped up",":",false)) do causes[v[1]]=v[2] end

---- helpers
function sl(i) return dget(9+i) end
function pick(t) return t[flr(rnd(#t))+1] end
function lerp3(a,b) if b<=1 then return a[1]+(a[2]-a[1])*b end return a[2]+(a[3]-a[2])*(b-1) end
function smo(x) x=mid(0,x,1) return x*x*(3-2*x) end
function biome(m) return smo((m-desm)/blendm)+smo((m-junm)/blendm) end
function need(l) return xpf+xps*(l-1)+xpc*(l-1)^2 end
function sweep(t) for i=#t,1,-1 do if t[i].dead then t[i]=t[#t] t[#t]=nil end end end
function pc(s,y,c) print(s,64-#s*2,y,c or 7) end
function wrap(s,n)
 local o,l={},""
 for w in all(split(s," ",false)) do
  if #l+#w>=n then add(o,l) l="" end
  l=l..(#l>0 and " " or "")..w
 end
 add(o,l) return o
end
function song(n) if n!=cs then cs=n music(n*4,800,7) end end
function go(m) mode,sel,mt=m,1,0 end
function nav(n)
 if btnp(2) then sel=(sel-2)%n+1 sfx(8) end
 if btnp(3) then sel=sel%n+1 sfx(8) end
 return mt>12 and (btnp(4) or btnp(5))
end
-- weapon table index: level, or the evolved slot
function wi(id) return ev[id] and 7 or lv[id] end

---- canal: ring buffer of rows, made 190 rows ahead
function newrow(i)
 local w=lerp3(cwid,biome(dist))+3*sin(p3)
 local c=64+mid(0,(128-w)/2-8,18)*(.6*sin(p1)+.4*sin(p2))
 rl[i],rr[i],rg[i],rd[i]=flr((c-w/2)/2)*2,flr((c+w/2)/2)*2,flr(rnd(9)),dist>=redm
 p1,p2,p3=(p1+.0023)%1,(p2+.005)%1,(p3+.0017)%1
end
function row(y) return (top-flr(mid(-189,y,127)))%512 end
function rL(y) return rl[row(y)] end
function rR(y) return rr[row(y)] end
function lane(y,f,m) local l=rL(y)+m return l+(rR(y)-m-l)*f end
function move(s)
 sacc+=s sh=flr(sacc) sacc-=sh wsc=(wsc+sh)%110
 for i=1,sh do
  top=(top+1)%512 newrow((top+190)%512)
  if mode=="play" then gen-=1 if gen<=0 then chunk() end end
 end
end

function reset_world()
 rl,rr,rg,rd,es,pk,hz,cl,pt,fl,ob={},{},{},{},{},{},{},{},{},{},{}
 dist,p1,p2,p3,top,sacc,wsc,sh=0,rnd(),rnd(),rnd(),127,0,0,0
 for i=0,317 do newrow(i) end
 px,pvx,shake,flash,burst,fr,inv,dead=lane(py,.5,0),0,0,0,0,0,0,false
end
function stats()
 area,cdm,dur,mag=1+.2*lv.bat,.92^lv.chain,1+.15*lv.thick,(1+.3*lv.duty)*(1+.15*sl(6))
 maxhp,xpm,cashm=hp0+25*sl(7)+34*lv.hivis,1+.1*sl(4),1+.2*sl(5)
end
function new_run()
 reset_world()
 lv,ev,ost={},{},{}
 for u in all(ups) do lv[u[1]]=0 end
 lv.cloud=1+sl(3)
 stats()
 hp,inv,vapes,cash,xp,lvl,kills,pend,xpn,slow,snag,shield,spawna,gen,chunkn=maxhp,60,0,0,0,1,0,0,need(1),1,0,0,0,30,0
 cdc,cdt,cdn,cdr,nmore,ngap,oa,hurtt,dragt,vapet,deadt,hstop,danger,bi,banner,bant=30,0,90,30,0,0,0,0,0,150,0,0,false,0,"british canal",150
 go("play") song(0)
end

---- spawning
function addp(k,x,y) if #pk<40 then add(pk,{k=k,x=mid(rL(y)+4,x,rR(y)-4),y=y,a=rnd(),age=0}) end end
function addv(x,y,big) addp((big or rnd()<.05) and 2 or 1,x,y) end
function addh(k,x,y,w,h,j,vx) add(hz,{k=k,x=x,y=y,w=w,h=h,j=j,vx=vx or 0}) end
function junk(x,y) local j=flr(rnd(3)) addh("junk",x,y,j==0 and 6 or 3,j==0 and 4 or 3,j) end
function part(x,y,vx,vy,l,c) if #pt<70 then add(pt,{x=x,y=y,vx=vx,vy=vy,l=l,c=c or 7}) end end
function burstp(x,y,n,s,c) for i=1,n do local a=rnd() part(x,y,cos(a)*s*rnd(),sin(a)*s*rnd(),10+rnd(14),c) end end
function float(s,x,y) if #fl<10 then add(fl,{s=s,x=x,y=y,l=40}) end end
function addcl(k,x,y,vx,vy,r0,r1,life,dmg) if #cl<64 then add(cl,{k=k,x=x,y=y,vx=vx,vy=vy,r0=r0,r1=r1,r=r0,life=life,age=0,dmg=dmg,hit={}}) end end
function ring8(x,y,r) for i=0,7 do addv(x+cos(i/8)*r,y+sin(i/8)*r) end end

-- patterns spawn above the screen (negative
-- y) and return their height. hard hazards
-- never close the canal.
ck={
 snake=function(d)
  local n,ph,am=min(13,flr((10+rnd(6))*d)),rnd(),.2+rnd(.16)
  for i=0,n-1 do local y=-6-i*9 addv(lane(y,.5+am*sin(i*.07+ph),4),y) end
  return n*9 end,
 cluster=function()
  local x=lane(-24,.3+rnd(.4),14)
  addv(x,-24,true) ring8(x,-24,9)
  return 44 end,
 barge=function()
  local l,f=pick{25,32,39},pick{.12,.5,.88}
  local y=-l/2-6
  addh("barge",lane(y,f,7),y,5,l/2-1,0,rnd()<min(.6,dist*.0003) and pick{-.1,.1})
  local o=f<.4 and .75 or f>.6 and .25 or pick{.14,.86}
  for i=0,4 do local yy=y-l/2+i*l/4 addv(lane(yy,o,4),yy) end
  return l+10 end,
 -- low bridge: piers with gaps
 bridge=function()
  local k=rR(-12)-rL(-12)>80 and 3 or 2
  addh("deck",0,-12,0,4)
  for i=1,k do addh("pier",lane(-12,i/(k+1),0),-12,2,4) end
  for i=-3,2 do addv(lane(-12,(flr(rnd(k+1))+.5)/(k+1),0),-12+i*9) end
  return 40 end,
 debris=function(d)
  local n=4+flr(rnd(4))
  for i=0,n-1 do local y=-8-i*16+rnd(6)-3 junk(lane(y,rnd(),6),y) end
  for i=1,6*d do local y=-rnd(n*16) addv(lane(y,rnd(),4),y) end
  return n*16+8 end,
 vortex=function()
  local x=lane(-28,.3+rnd(.4),16)
  addh("vortex",x,-28,0,0) ring8(x,-28,14)
  if rnd()<.5 then addp(3,x+pick{-7,7},-28) end
  return 60 end,
 -- desert sandbars / jungle vines: alternate sides
 sand=function() return alt("sand",3,34) end,
 vine=function() return alt("vine",3+flr(rnd(2)),28) end,
}
function alt(k,n,gap)
 local f=flr(rnd(2))
 for i=0,n-1 do
  local y,lf=-14-i*gap,(i+f)%2==0
  local l,r=rL(y),rR(y)
  if k=="sand" then addh(k,lane(y,lf and .1+rnd(.18) or .72+rnd(.18),8),y,9,3) addv(lane(y-16,.5,4),y-16)
  else local w=(r-l)*(.45+rnd(.11))/2 addh(k,lf and l+w or r-w,y,w,1.5,lf and -1 or 1) end
  addv(lane(y,lf and .78 or .22,4),y,rnd()<.3)
 end
 return n*gap
end
function chunk()
 local b=biome(dist)
 local d=min(1.5,1+dist*.0012)
 if chunkn>=2 then
  local len=ck[pick(cks[flr(b+rnd())+1])](d)
  local y=-rnd(len)
  if rnd()<.3 then addp(3,lane(y,pick{0,1},5),y) end
  if rnd()<(hp<maxhp and .21 or .07) then addp(4,lane(y,.15+rnd(.7),4),y) end
  -- late game: trouble hugs the banks
  if danger then
   if rnd()<.7 then junk(lane(y,pick{0,1},7),y) end
   if rnd()<.25 then addh("barge",lane(-len-6,pick{0,1},7),-len-6,5,12) end
  end
  gen=len
 else gen=ck.snake(d) end
 chunkn+=1 gen=gen+lerp3(cgap,b)
end

-- biome blends by chance; chasers can come
-- in packs, or from behind in later biomes
function spawn_wave(b)
 local bi=flr(b+rnd())+1
 local d=ed[pick(etab[bi])]
 local ch=d[5]==1
 local beh=ch and rnd()<behc[bi]
 local y,x=beh and 116 or -6,rnd()
 for i=1,ch and rnd()<packc[bi] and packn[bi] or 1 do
  if #es<maxe then add(es,{d=d,x=lane(y,x,5)+rnd(i*4)-i*2,y=y+rnd(i*4)-i*2,hp=d[2]*(1+dist/1000*hpgrow),r=d[3],ch=beh,ct=0,vx=pick{-d[8],d[8]},ox=rnd(6)-3,oy=rnd(8)-4,a=.25,f=0}) end
 end
end

---- player events
function hurt(c)
 if inv>0 or dead then return end
 hp-=hitd hurtt,inv,shake,flash=40,78,6,6 sfx(3)
 burstp(px,py,12,1.2)
 if hp<=0 then die(c) end
end
function die(c)
 if dead then return end
 dead,deadt,cause,hp,hstop,shake,flash,sh,cs=true,0,c,0,27,12,10,0,-1
 sfx(9) music(-1,300)
 burstp(px,py,30,2.4) burstp(px,py,10,1.6,9)
 local tot=cash+flr((flr(dist/100)+lvl-1)*cashm)
 res={v=vapes,m=flr(dist),l=lvl,k=kills,c=tot,best=vapes>dget(1),t=pick(dtitles),tip=pick(tips)}
 dset(0,min(30000,dget(0)+tot)) dset(1,max(dget(1),vapes)) dset(2,max(dget(2),flr(dist)))
end
function gain(x)
 xp=xp+x*xpm
 while xp>=xpn do xp,lvl,pend=xp-xpn,lvl+1,pend+1 xpn=need(lvl) end
end
function collect(p)
 p.dead=true
 local k,n=p.k,p.k==2 and 5 or 1
 if k==4 then
  if hp<maxhp then hp=min(maxhp,hp+34) float("+health",p.x,p.y) else gain(5) float("lovely",p.x,p.y) end
  sfx(10)
 elseif k==3 then n=flr(5*cashm) cash+=n float("+"..n.." cash",p.x,p.y) sfx(2)
 else
  vapes=min(30000,vapes+n) gain(n) float("+"..n,p.x,p.y)
  burstp(p.x,p.y,n+3,.9,12) sfx(n==5 and 1 or 0)
  if sl(1)>0 then local t=sl(2)+1 burst=min(bcap[t],burst+badd[t]*(n==5 and 2 or 1)) shake=max(shake,.75) end
 end
end
function hite(e,d)
 if e.dead then return end
 e.hp-=d e.f=4
 if e.hp>0 then return end
 e.dead=true kills=min(30000,kills+1) gain(e.d[6])
 local big=e.d[1]=="croc"
 burstp(e.x,e.y,big and 14 or 6,big and 1.6 or 1.1)
 shake=max(shake,.6) sfx(4)
 if big and hp<maxhp and rnd()<.3 then addp(4,e.x,e.y) elseif rnd()<e.d[7] then addp(big and 2 or 1,e.x,e.y) end
end

---- level-up choices
function roll()
 local c,o={},{}
 for u in all(ups) do
  local id,l=u[1],lv[u[1]]
  if ev[id] then
  elseif l>=u[3] then
   for e in all(evos) do if e[1]==id and lv[e[2]]>0 then add(c,{w=8,k=2,id=id,t=e[3],d=e[4],g="evolve!"}) end end
  else add(c,{w=l>0 and 3 or 1,k=1,id=id,t=u[2],d=u[4][min(l+1,#u[4])],g=l>0 and "lv "..(l+1) or "new"}) end
 end
 while #o<3 and #c>0 do
  local tw=0 for x in all(c) do tw+=x.w end
  local r=rnd(tw)
  for i=1,#c do r-=c[i].w if r<=0 or i==#c then add(o,c[i]) c[i]=c[#c] c[#c]=nil break end end
 end
 if #o<3 then add(o,{k=3,g="",t="gift from a lord",d="+10 cash. fully declared, obviously."}) end
 if #o<3 then add(o,{k=4,g="",t="cup of tea",d="restore all health."}) end
 return o
end
function choose(i)
 local c=choices[i]
 if c.k==1 then lv[c.id]=lv[c.id]+1 if c.id=="hivis" then hp+=34 end
 elseif c.k==2 then ev[c.id],flash,shake=true,6,6
 elseif c.k==3 then cash+=10 else hp=maxhp end
 stats()
 sfx(6) inv,pend=max(inv,72),pend-1
 if pend>0 then choices,sel,mt=roll(),1,0 else mode="play" end
end

---- weapons
function near(r) for e in all(es) do if abs(e.x-px)<r and abs(e.y-py)<r then return true end end end
function nova()
 local i=wi"nova"
 local r=min(120,nrad[i]*area)
 addcl(3,px,py,0,0,3,r,r/1.78,ndmg[i]) shake=max(shake,3) sfx(7)
end
function weapons()
 local x=lv.extra
 -- vape cloud: forward fan up to 3, then all round
 cdc-=1
 if cdc<=0 then
  local i=wi"cloud"
  if i<3 and not near((34+7*i)*area) then cdc=3
  else
   local n,r=cdir[i]+x,crad[i]*area
   for j=1,n do
    local a=n>3 and .25+(j-1)/n or .25+(j-(n+1)/2)*.14
    addcl(1,px+cos(a)*3,py+sin(a)*6,cos(a)*.12*r,sin(a)*.12*r,r*.45,r,clife[i]*dur,cdmg[i])
   end
   cdc=ccd[i]*cdm
  end
 end
 -- vape rings (+1 cloud: mini rings peel off sideways)
 local i=lv.rings
 if i>0 then
  cdr-=1
  if cdr<=0 then
   cdr=rcd[i]*cdm
   for k=0,x do local s=k%2*2-1 addcl(4,px+s*k,py-7,s*.33*flr((k+1)/2),k>0 and -.5 or -.36,2,rrad[i]*area*(k>0 and .55 or 1),rlife[i]*dur,rdmg[i]) end
  end
 end
 i=wi"trail"
 if i>0 then
  cdt-=1
  if cdt<=0 then local r=trad[i]*area cdt=8 addcl(2,px+rnd(2)-1,py+6,0,0,r*.6,r,tlife[i]*dur,tdmg[i]) end
 end
 -- big vape clouds (+1 cloud: follow-up blasts)
 if lv.nova>0 then
  cdn-=1
  if cdn<=0 then cdn,nmore,ngap=ncd[wi"nova"]*cdm,x,18 nova() end
  if nmore>0 then ngap-=1 if ngap<=0 then nmore,ngap=nmore-1,18 nova() end end
 end
 -- vape storm: orbiters pop on a hit, then regrow
 ob={}
 i=wi"storm"
 if i>0 then
  local n,orb,rad=sn[i]+x,sorb[i]*area,srad[i]*area
  oa=(oa+.0085)%1
  for j=1,n do
   ost[j]=max(0,(ost[j] or 0)-1)
   if ost[j]==0 then
    local o={x=px+cos(oa+j/n)*orb,y=py+sin(oa+j/n)*orb,r=rad}
    add(ob,o)
    for t in all(es) do
     if not t.dead and abs(t.x-o.x)<rad+t.r and abs(t.y-o.y)<rad+t.r then
      hite(t,sdmg[i]) ost[j]=sres[i]*cdm del(ob,o)
      addcl(5,o.x,o.y,0,0,rad,rad*1.8,20,0) burstp(o.x,o.y,5,1) break
     end
    end
   end
  end
 end
end

---- update
function upd_clouds()
 for c in all(cl) do
  c.age+=1
  local t,k=c.age/c.life,c.k
  if t>=1 then c.dead=true else
   if k==1 then c.vx,c.vy=c.vx*.973,c.vy*.973 end
   if k==3 then c.x,c.y=px,py else c.x,c.y=c.x+c.vx,c.y+c.vy+(k==4 and 0 or sh) end
   c.r=c.r0+(c.r1-c.r0)*(k==1 and 1-(1-t)^2 or k==2 and min(1,t*4) or k==4 and sqrt(t) or t)
   -- the trail ticks 4x a second; the rest hit each enemy once
   if k<5 and (k!=2 or fr%15==0) then
    for e in all(es) do
     local dx,dy,rr=abs(e.x-c.x),abs(e.y-c.y),c.r+e.r
     if not c.hit[e] and dx<rr and dy<rr then
      local d2=dx*dx+dy*dy
      if (k==4 and abs(sqrt(d2)-c.r)<2.5+e.r) or (k!=4 and d2<rr*rr) then
       if k!=2 then c.hit[e]=true end hite(e,c.dmg)
      end
     end
    end
   end
  end
 end
end

function upd_enemies()
 for e in all(es) do
  local d=e.d
  local dx,dy,sp=px+e.ox-e.x,py+e.oy-e.y,d[4]
  e.f=max(0,e.f-1)
  if d[5]==1 then
   if not e.ch and not e.gu and abs(dx)+abs(dy)<85 then e.ch,e.a=true,atan2(dx,dy) end
   if e.ch then
    -- limited turn rate: side-step and they overshoot
    e.a=e.a+mid(-d[8],(atan2(dx,dy)-e.a+.5)%1-.5,d[8])
    e.x,e.y,e.ct=e.x+cos(e.a)*sp,e.y+sin(e.a)*sp,e.ct+1
    if e.ct>d[9]*60 then e.ch,e.gu=false,true end
   else e.y+=sh end
  else e.x,e.y=e.x+(d[5]==2 and e.vx or mid(-d[8],dx,d[8])),e.y+sh+sp end
  local l,r=rL(e.y)+e.r+1,rR(e.y)-e.r-1
  if e.x<l or e.x>r then e.x,e.vx=mid(l,e.x,r),-e.vx end
  if e.y>120 or e.y<-60 then e.dead=true end
  local ax=abs(e.x-px)
  if e.dead then
  elseif burst>=ramb and ax<e.r+1 and abs(e.y-py+7)<e.r+1.5 then
   -- boosting: the bow rams it, at the cost of boost
   burst=burst*(d[1]=="croc" and .2 or .5) hite(e,999) float("rammed!",e.x,e.y) shake,hstop=4,2 sfx(11)
  elseif inv<=0 and ax<e.r+1.5 and abs(e.y-py)<e.r+4 then
   if sl(8)>0 and shield<=0 and d[1]!="croc" then
    shield=immcd[sl(8)] hite(e,999) float("immune!",px,py-10) sfx(7)
   else hurt(d[1]) e.dead=true end
  end
 end
end

function upd_hazards()
 for h in all(hz) do
  h.x,h.y=h.x+h.vx,h.y+sh
  if h.y-h.h>118 then h.dead=true end
  if h.vx!=0 then
   local l,r=rL(h.y)+h.w+2,rR(h.y)-h.w-2
   if h.x<l or h.x>r then h.x,h.vx=mid(l,h.x,r),-h.vx end
  end
  local dx,dy,k=h.x-px,h.y-py,h.k
  if k=="vortex" then
   local d=sqrt(min(dx*dx+dy*dy,999))
   if d<23 and d>.3 then px=px+dx/d*(1.4+bi*.3)*(1-d/23) if d<3 then hurt(k) end end
  elseif k!="deck" and abs(dx)<h.w+1.2 and abs(dy)<h.h+4 then
   if k=="barge" or k=="pier" then die(k)
   elseif k=="junk" then if inv<=0 then hurt("debris") h.dead=true end
   elseif k=="sand" then hurt("sandbar") slow=min(slow,.45)
   else snag,slow=8,min(slow,.55) end
  end
 end
end

function upd_pickups()
 local mr=9*mag
 for p in all(pk) do
  local dx,dy=px-p.x,py-p.y
  p.y,p.age=p.y+sh,p.age+1
  p.a=p.a+.013+p.age*.00001
  if p.y>118 then p.dead=true end
  if abs(dx)<mr and abs(dy)<mr then p.m=true end
  if p.m then local d=max(1,abs(dx)+abs(dy))/2 p.x,p.y=p.x+dx/d,p.y+dy/d end
  if abs(dx)<5 and abs(dy)<6 then collect(p) end
 end
end

function upd_fx()
 for p in all(pt) do p.x,p.y,p.vx,p.vy,p.l=p.x+p.vx,p.y+p.vy+sh,p.vx*.95,p.vy*.95,p.l-1 p.dead=p.l<=0 end
 for f in all(fl) do f.y,f.l=f.y-.4,f.l-1 f.dead=f.l<=0 end
 sweep(pt) sweep(fl)
 shake,flash=max(0,shake-.5),max(0,flash-1)
end

function idle()
 fr=(fr+1)%32000
 move(.4)
 px=px+(lane(py,.5,0)-px)*.05
 upd_fx()
end

function upd_play()
 if hstop>0 then hstop-=1 return end
 fr=(fr+1)%32000
 if dead then deadt+=1 upd_fx() if deadt>66 then go("over") end return end
 local b=biome(dist)
 burst,slow=burst*.975,min(1,slow+.005)
 spd=(spd0+(spd1-spd0)*min(1,dist/rampm))*(sl(1)>0 and 1.1+.02*sl(2) or 1)
 spd=(spd+burst)*slow
 move(spd) dist=dist+spd/ppm
 -- steering: hold to paddle, let go to glide
 local d=(btn(1) and 1 or 0)-(btn(0) and 1 or 0)
 pvx=d!=0 and mid(-smax,pvx+d*sac,smax) or pvx*sfric
 snag,inv,shield,hurtt=max(0,snag-1),max(0,inv-1),max(0,shield-1),max(0,hurtt-1)
 px=px+pvx*(snag>0 and .35 or 1)
 local l,r=rL(py)+3,rR(py)-3
 if px<l or px>r then
  pvx=px<l and 1.2 or -1.2 px=mid(l,px,r)
  if danger then hurt("bank") else pvx=0 end
 end
 if not danger and dist>=redm then danger,banner,bant=true,"red wall: don't touch!",240 end
 -- the occasional drag: a cloud drifts off behind
 vapet-=1
 if vapet<=0 and dragt<=0 then dragt,vapet=96,210+rnd(210) end
 dragt=max(0,dragt-1)
 if dragt<60 and dragt%7==1 then addcl(5,px+2,py-2,0,0,1.5,3.5+rnd(2),80+rnd(40),0) end
 if flr(b+.5)!=bi then bi=flr(b+.5) banner,bant=({"british canal","desert canal","jungle canal"})[bi+1],180 song(bi) end
 bant=max(0,bant-1)
 if dist>50 then
  spawna=spawna+lerp3(erate,b)*(1+dist/1000*.7)*sqrt(spd/spd0)*min(1.8,.55+lvl*.045)/60
  while spawna>=1 do spawna-=1 if #es<maxe then spawn_wave(b) end end
 end
 weapons() upd_clouds() upd_enemies() upd_hazards() upd_pickups() upd_fx()
 sweep(es) sweep(pk) sweep(hz) sweep(cl)
 if pend>0 and not dead then choices=roll() go("lvl") sfx(5) end
end

function buy(i)
 local l=sl(i)
 local c=shop[i][2][l+1]
 if not c or (i==2 and sl(1)==0) or dget(0)<c then sfx(13) return end
 dset(0,dget(0)-c) dset(9+i,l+1) sfx(12)
end

function _update60()
 mt+=1
 if mode=="play" then upd_play() return end
 if mode!="lvl" and mode!="over" then idle() else upd_fx() end
 if mode=="title" and nav(3) then
  sfx(6) hplay=sel==1
  if sel==3 then from="title" go("shop") elseif hplay and dget(3)>0 then new_run() else go("how") end
 elseif mode=="how" and mt>20 and (btnp(4) or btnp(5)) then
  dset(3,1) sfx(6) if hplay then new_run() else go("title") end
 elseif mode=="lvl" and nav(#choices) then choose(sel)
 elseif mode=="over" and nav(3) then
  sfx(6)
  if sel==1 then new_run() elseif sel==2 then from="over" go("shop") else reset_world() go("title") song(0) end
 elseif mode=="shop" and nav(#shop+1) then
  if sel>#shop then go(from) else buy(sel) end
 end
end

---- drawing
function dhaz(h)
 local k,x,y=h.k,h.x,h.y
 if k=="barge" then sspr(32,80,11,24,x-5,y-h.h,11,h.h*2+1)
 elseif k=="deck" then
  local l,r=rL(y)-3,rR(y)+3
  rectfill(l,y-4,r,y+4,0) fillp(0x5a5a+.5) rectfill(l,y-3,r,y+3,7) fillp()
  rect(l,y-4,r,y+4,7)
 elseif k=="pier" then sspr(44,80,5,9,x-2,y-4)
 elseif k=="junk" then spr(h.j==0 and 11 or 12+h.j,x-(h.j==0 and 7 or 4),y-4,h.j==0 and 2 or 1,1)
 elseif k=="sand" then sspr(52,80,19,7,x-9,y-3)
 elseif k=="vortex" then
  for a=0,20 do local an=-fr/90+a/3+a%7*.08 pset(x+cos(an)*(2+a%7*2.5),y+sin(an)*(2+a%7*2.2),7) end
 elseif k=="vine" then
  for j=0,h.w*2,2 do local xx,yy=x+h.w*h.j-h.j*j,y+sin(j/14)*1.5 rectfill(xx,yy,xx+1,yy,7) if j%6==2 then pset(xx,yy-2,7) pset(xx+1,yy+2,7) end end
 end
end
function clouds()
 for c in all(cl) do
  local t,x,y,r=c.age/c.life,c.x,c.y,c.r
  if c.k>2 and c.k<5 then
   if t<.85 or fr%2==0 then circ(x,y,r,7) circ(x,y,r-1,c.k==3 and 7 or 6) end
   if c.k==3 and t<.6 and r<60 then fillp(0xa5a5+.5) circfill(x,y,r-2,7) end
  elseif t<.12 and c.k<5 then circfill(x,y,r,7)
  elseif t<.65 then circfill(x,y,r,7) fillp(0x5a5a+.5) circfill(x,y,r-1,0)
  else fillp(0xafaf+.5) circfill(x,y,r,7) end
  fillp()
 end
end
function banks()
 local pl,pr,st=0,0,flr(biome(dist)+.5)
 for y=0,109 do
  local i=(top-y)%512
  local l,r,g=rl[i],rr[i],rg[i]
  local c=rd[i] and 8 or 7
  rectfill(0,y,l-3,y,0) rectfill(r+2,y,127,y,0)
  line(l-2,y,l-1,y,c) line(r,y,r+1,y,c)
  if y>0 then line(min(l,pl)-2,y,max(l,pl)-1,y,c) line(min(r,pr),y,max(r,pr)+1,y,c) end
  pl,pr=l,r
  if g<2 then
   line(l-7-g*9,y,l-7-g*9+2-st,y,c) line(r+4+g*9,y,r+6+g*9-st,y,c)
  end
 end
end
function dvape(x,y,a,big)
 local L=big and 3.4 or 2
 local dx,dy=cos(a)*L,sin(a)*L
 line(x-dx,y-dy,x+dx,y+dy,12)
 if big then line(x-dx+1,y-dy,x+dx+1,y+dy,12) end
 pset(x+dx,y+dy,7)
end
-- thin red stroke on the outside only;
-- inner holes (colour 1) stay black
function outl(s,x,y,h)
 pal(7,8) pal(1,8)
 for i=1,4 do spr(s,x+dx4[i],y+dy4[i],1,h) end
 pal(7,7) pal(1,0)
 spr(s,x,y,1,h)
end
function kayak()
 if dead or inv>0 and fr%8<4 then return end
 local x,f=flr(px),flr(fr/14)%2*2-1
 line(x-5,py+f,x+5,py-f,7)
 rectfill(x-6,py+f-1,x-5,py+f+1,7) rectfill(x+5,py-f-1,x+6,py-f+1,7)
 spr(1,x-4,py-8,1,2)
 if mode=="play" and sl(8)>0 then
  for i=1,(1-shield/immcd[sl(8)])*12 do pset(x+cos(i/12)*9,py+sin(i/12)*9,7) end
 end
end
function draw_world(full)
 local s=shake>.3 and shake or 0
 camera(rnd(s)-s/2,rnd(s)-s/2)
 for i=0,9 do local y=(i*37+wsc)%110 local x=lane(y,(i*.37)%1,4) line(x,y,x+2,y,7) end
 if full then
  for h in all(hz) do if h.k!="deck" and h.k!="pier" then dhaz(h) end end
  clouds()
 end
 banks()
 if full then
  for p in all(pk) do if p.k<=2 then dvape(p.x,p.y,p.a,p.k==2) else spr(p.k==3 and 9 or 10,p.x-4,p.y-4+sin(fr/50+p.a)) end end
  for e in all(es) do local h=e.d[1]=="croc" and 2 or 1 if e.f>0 then circfill(e.x,e.y,e.r+1,7) else outl(e.d[10],e.x-4,e.y-4*h,h) end end
  for o in all(ob) do circfill(o.x,o.y,o.r,7) fillp(0x5a5a+.5) circfill(o.x,o.y,o.r-1,0) fillp() circfill(o.x,o.y,o.r*.45,7) end
 end
 kayak()
 if full then for h in all(hz) do if h.k=="deck" or h.k=="pier" then dhaz(h) end end end
 for p in all(pt) do pset(p.x,p.y,p.c) end
 for f in all(fl) do if f.l>8 or fr%2==0 then print(f.s,f.x-#f.s*2+1,f.y-9,0) print(f.s,f.x-#f.s*2,f.y-10,7) end end
 if full and burst>.13 then for i=1,min(8,burst*8) do local x,y=rnd(128),rnd(110) line(x,y,x,y+8+burst*12,7) end end
 camera()
 if flash>0 then fillp(0x5a5a+.5) rectfill(0,0,127,109,7) fillp() end
end

function hud()
 rectfill(0,110,127,127,0) line(0,110,127,110,7)
 line(0,111,127*min(1,xp/xpn),111,12)
 rect(0,112,54,127,7) rect(73,112,127,127,7)
 print(vapes.." vapes",3,114,7) print("hp "..max(0,flr(hp)).."%",3,121,hp<=hitd and 8 or 7)
 print("lv "..lvl,76,114,7) spr(15,103,114) print(cash,107,114,9) print(flr(dist).."m",76,121,7)
 local f=hp/maxhp
 palt(0,false) spr(32+2*((dead or hp<=0) and 5 or hurtt>0 and 3 or dragt>60 and 4 or f>.66 and 0 or f>.33 and 1 or 2),56,112,2,2) palt(0,true)
 if bant>0 and fr%8<6 then
  local x=64-#banner*2
  for i=1,4 do print(banner,x+dx4[i],26+dy4[i],0) end print(banner,x,26,7)
 end
end

function menu(o,y0)
 for i=1,#o do local y=y0+i*8 if sel==i then rectfill(36,y-1,91,y+5,7) end pc(o[i],y,sel==i and 0 or 7) end
end
function d_title()
 rectfill(20,1,107,55,0)
 pc("angela rayner's:",4,9)
 sspr(0,64,16,5,32,12,64,20) sspr(0,70,20,5,24,34,80,20)
 palt(0,false) sspr(0,16,16,16,48,57,32,32) palt(0,true)
 menu(split"play,how to play,shop",84)
 rectfill(0,116,127,127,0)
 if dget(1)>0 then pc("best "..dget(1).." vapes  "..dget(2).."m",117,6) end
 pc("a free non-commercial parody",123,5)
end
function d_how()
 cls()
 pc("how to play",2)
 for t in all(parse("1 kayak down the river,3,12,9|hold left/right to steer,3,19,7|2 collect vapes,3,31,9|3 avoid the dangers,3,61,9|enemies cost health on touch.,3,81,7|your vape clouds destroy them.,3,87,7|sink you,28,101,7|hurt,98,101,7|heals,62,50,7|cash,94,50,7")) do print(unpack(t)) end
 print("+1",8,50) print("+5",38,50)
 spr(1,116,9,1,2) dvape(12,44,fr/120) dvape(42,44,fr/120,true) spr(10,68,40) spr(9,98,40)
 for i=1,6 do outl(2+i,3+i*18,69-(i==6 and 4 or 0),i==6 and 2 or 1) end
 dhaz{k="barge",x=10,y=103,h=7} dhaz{k="pier",x=22,y=103} dhaz{k="junk",x=76,y=103,j=0} dhaz{k="junk",x=90,y=103,j=1}
 pc("press any button",120,flr(fr/20)%2==0 and 7 or 5)
end
function d_lvl()
 fillp(0x5a5a+.5) rectfill(0,0,127,109,0) fillp()
 rectfill(40,1,87,7,0) pc("level up!",2,9)
 for i=1,#choices do
  local c,y,s=choices[i],10+(i-1)*33,sel==i
  local fg=s and 0 or 7
  rectfill(3,y,124,y+30,7-fg) rect(3,y,124,y+30,7)
  print(c.t,7,y+3,c.k==2 and 9 or fg)
  print(c.g,122-#c.g*4,y+3,fg)
  for j,w in pairs(wrap(c.d,28)) do print(w,7,y+4+j*7,fg) end
 end
end
function d_over()
 cls() rect(1,1,126,126,7)
 pc(res.t,5) pc(causes[cause] or "",13,9) pc(res.v.." vapes",25)
 if res.best then pc("new best!",32,fr%30<15 and 9 or 7) end
 for i,r in pairs{{"distance",res.m.."m"},{"level",res.l},{"melted",res.k},{"tax advice taken","none"},{"cash banked","+"..res.c}} do
  local v=tostr(r[2]) print(r[1],8,41+i*6,6) print(v,120-#v*4,41+i*6,7)
 end
 pc("wallet "..dget(0),80,9)
 menu(split"go again,shop,title",82)
 for j,w in pairs(wrap("tip: "..res.tip,30)) do pc(w,106+j*6,5) end
end
function d_shop()
 cls()
 local w=tostr(dget(0))
 print("shop",3,3,7) spr(15,119-#w*4,3) print(w,124-#w*4,3,9)
 for i=1,#shop+1 do
  local y,s,it,l=3+i*9,sel==i,shop[i],sl(i)
  local fg=s and 0 or 7
  if s then rectfill(1,y-1,126,y+6,7) end
  print(it and it[1] or "back",4,y,fg)
  if it then for j=1,#it[2] do local x=120-(#it[2]-j)*4 rectfill(x,y,x+2,y+4,fg) if j>l then rectfill(x+1,y+1,x+1,y+3,7-fg) end end end
 end
 line(0,96,127,96,7)
 local it=shop[sel]
 if it then
  local c=it[2][sl(sel)+1]
  print(it[3],3,100,7) print(it[4],3,108,6)
  print(c and "cost "..c or "maxed",3,118,c and dget(0)>=c and 9 or 5)
 end
end

function _draw()
 cls(0)
 draw_world(mode=="play" or mode=="lvl" or mode=="over")
 if mode=="play" or mode=="lvl" then hud() end
 local f=({title=d_title,how=d_how,lvl=d_lvl,over=d_over,shop=d_shop})[mode]
 if f then f() end
end

function _init()
 cartdata("vapekayak_1")
 pal(1,0) pal(9,137,1)
 -- big title lettering: print it, copy it into
 -- the sprite sheet, then sspr it up
 print("vape",0,0,7) print("kayak",0,6,7)
 memcpy(0x1000,0x6000,704) cls()
 reset_world()
 menuitem(1,"quit to title",function() if mode!="title" then reset_world() go("title") song(0) end end)
 cs=-1 song(0) go("title")
end
__gfx__
00000000000700000000000007700000000770000077770000000000000000000077770000707000070070007000000000000000077777700007700009900000
00000000000700000000000071770000007777000717117007777007007070000717717000070000007007000777777777777000777777770007700009000000
00000000007170000000000007700000077117707171711777177077700700700777777000777000000000000071717171717000711111170077770099900000
00000000007170000000000007700770077117707117171777777770077777000077770007717700777777000077777777777700777777770071170009000000
00000000071117000000000007777770077777707171711771717777700700700717717007111700777777700071717171717000777777770777777099900000
00000000071117000000000077777777777777777117171707777007007070000077770007717700777777170007777777777000711111170711117000000000
0000000007191c000000000007777770711111170711717000000000000000000777777000777000777777700000700000700000777777777777777700000000
00000000079997000000000000000000077777700077770000000000000000007777777700000000077770000007700007700000077777700000000000000000
00000000079997000000000000000000000000000000000000000000000000000777777000000000000000000000000000000000000000000000000000000000
00000000077977000000000000000000000000000000000000000000000000000777777000000000000000000000000000000000000000000000000000000000
00000000071917000000000000000000000000000000000000000000000000007777777700000000000000000000000000000000000000000000000000000000
00000000071117000000000000000000000000000000000000000000000000000777777000000000000000000000000000000000000000000000000000000000
00000000007170000000000000000000000000000000000000000000000000000077770000000000000000000000000000000000000000000000000000000000
00000000007170000000000000000000000000000000000000000000000000000007700000000000000000000000000000000000000000000000000000000000
00000000000700000000000000000000000000000000000000000000000000000007700000000000000000000000000000000000000000000000000000000000
00000000000700000000000000000000000000000000000000000000000000000000700000000000000000000000000000000000000000000000000000000000
00009999999900000000999999990000000099999999000000009999999900000000999999990000000099999999000000000000000000000000000000000000
00999999999999000099999999999900009999999999990000999999999999000099999999999900009999999999990000000000000000000000000000000000
09999999999999900999999999999990099999999999799009999999999999900999999999999990099999999999799000000000000000000000000000000000
09999999999999900999999999999990099979999999999009999999999999900999999999999990099979999999999000000000000000000000000000000000
09999997999799900999999799979990099999979997999009999997999799900999999799979990099999979997999000000000000000000000000000000000
09997977779799900999797777979990099979777797999009997977779799900999797777979990099979777797999000000000000000000000000000000000
09997007700799900999700770079990099970077007999009997707707799900999777777779990099970077007999000000000000000000000000000000000
09997707707799900999770770779990099977077077999009997077700799900999700770079990099970077007999000000000000000000000000000000000
09997777777799900999777777779990090977777070999009997777777799900999777777779990090977777070999000000000000000000000000000000000
09997777077799900999777707079990099977770707909009997777077799900999777707779990099977770707909000000000000000000000000000000000
09997777777799900999707777779990099970777070999009997770077799900999777777779990099970777070999000000000000000000000000000000000
9999977007799999999997700779999999999707007999999999977007799999999997707c799999999997000079999900000000000000000000000000000000
99999977779999999999997777999999999999777799999999999977779999999999997777c99999999999777799999900000000000000000000000000000000
999999977999999999999997799999999999999779999999999999977999999999999997799c9999999999977999999900000000000000000000000000000000
9990070000700999999007000070099999900700007009999990070000700999999007000070c999999007000070099900000000000000000000000000000000
99900070070009999990007007000999999000700700099999900070070009999990007007000c99999000700700099900000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000077777777700777770000007777777777777000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000777777777770777770000777070707070707770000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000770000000770707070007707070707070707077000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000770000000770777770007070707070707070707000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700777770070077700007707070707070707077000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700707070070777770000777070707070707770000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700777770070707070000007777777777777000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700707070070777770000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700777770070777770000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700707070070000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700777770070000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700707070070000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700777770070000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700707070070000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700777770070000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700707070070000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700777770070000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700077700070000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700000000070000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000700077700070000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000770007000770000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000770000000770000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000777777777770000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000077777777700000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
__label__
0000000000000000000000000141044ffff949499f99499f994f99494999494994442249994449499944999ff944200000000000000000000000000000000000
000000000000000000000000140014ffff99949fff944fff944f944499999499994442449994499499944999fff9420000000000000000000000000000000000
00000000000000000000000221014fff9994499ff9449f99944f9424994f99994f44444449994449499944499fff942100000000000000000000000000000000
00000000000000000000001220029ffff99499fff449ff99f44f94249999f4999994949424f994449999944999fff94200000000000000000000000000000000
00000000000000000000004100049f994449994944999949944f442449949999449949442499942494499444499fff4200000000000000000000000000000000
0000000000000000000000101249ff94449999f942999994f44f94244494f9f944999494424999449999f99444999f9420000000000000000000000000000000
000000000000000000000000049f9944499944942949994494294422444999994449944442249944499949992449999942000000000000000000000000000000
00000000000000000000000049f9944499f449924944f444f44944424444f9f44449f4449224994424f999994444999994200000000000000000000000000000
000000000000000000000004499944449f444f422424924944494442244949942429942442024944049999994424494994420000000000000000000000000000
00000000000000000000000299944449944499224444929992494242444999f42424f422422249444249f9994492449999420000000000000000000000000000
0000000000000000000000049f4424499444990244444249444944222449499424249422220229444229f9499942444449442000000000000000000000000000
000000000000000000001149f94244999449f41442944299424942422444999424249422442029944244f9999942444449944210000000000000000000000000
00000000000000000000044f94244499444f940442942249422f4224244449442404442224200444222449949944222444994420000000000000000000000000
0000000000000000000024ff94224494444940144294224422494224244249942424942224201494224449949442224224999420000000000000000000000000
0000000000000000000004f942244944494f41242444044422294204244249422404422224210444222429944944222224449942000000000000000000000000
0000000000000000000049f440449f44449940424442244442444222224244422424424224202442224429994442224224449994100000000000000000000000
000000000000000000024f9420244949449922222422044421242202022224422224212224210222222404994442022222444944000000000000000000000000
00000000000000000044994420249499949442422442244220444212224244424222404222201242104424994442222242444499420000000000000000000000
000000000000000000149f4201444499449422222422242222242202222244222202222222010422022404494444220222442499420000000000000000000000
000000000000000000249942124244f9949442224222442222444212222242224222424222202220124224499444221122444499941000000000000000000000
0000000000000000004f944104422499444422222222222202242102210222222224222202022201022402499444020102224449992000000000000000000000
00000000000000000099944024424444449422222222402210442022202242222044404221222220124222449444401022224244944000000000000000000000
00000000000000000499440024024424444422022224222202242102010222220224242202222201222402249444212202242424494400000000000000000000
000000000000000144f4421024124424444242222244422212442122212222422244442222222210224422449444402221422244999420000000000000000000
000000000000000444f4220222022404444224022244212202440222022202220444242202220201224422244444200222222222499400000000000000000000
000000000000000249f4401022024022444222212442202222442220102122212444402244422021224422444494401024224222449420000000000000000000
00000000000000024f44210222022122242222222422212202442202010222022e22122444220102244404224444210002242422244942000000000000000000
000000000120002299442011200240224442222244222022224422101022222244422244422110224ee422424494420010222442449994100000000000000000
000000000240014249420001000220220442012422220224024400010122012442010244200202244ee404220494440000022444224944200000000000000000
000000004200420249410020000240422242102222221242224410101220124220422442121024e444fe24422492442244444492114494400000000000000000
00000004100001249420020001022222044422022222022222440100220124442444442222012444244e04420444442202011222022449200000000000000000
000000221014104994202100002022212244421242201222214410102222444444e4e4424110201020442ee21244422010001024202249421000000000000000
0000024000020249420200000021041102244402220002000044000202244444444e44420000012222020e420229420222220229210249940000000000000000
00000240000024f942200000002022202244e442222000001044002222444444e44442101022224242222442202e424220100024202244442000000000000000
00004200000024994200000000010221044eee420200000000440001222444444e4421012222222222244422220e440220000004100244294200000000000000
00002000000044f4421000001011202014eee220112021201022001022444444ee422222422010101222e444e204942022202024102244444200000000000000
00000000000149942200000000020001044e420102010000000100000222244e4e4222222100000000024444e402442202220104000244244400000000000000
0000000000149944200000100020001022e420202010000000101020102224eeee44224220102224401042e4e4424e4212422012101044449941000000000000
0000000000049944200000000100000004e2010200000001000001010002244fff442222011100010421024eeee24f2202022202000124224941000000000000
0000000000149944200000001010001024e221201000101011101010101024efff4242201210101000121124e9f49f4220124220100022424494200000000000
00000000000449240000000000000001144200000000000000010001000124efff44220100010000110000044ef9ef4400020220000122422494200000000000
00000000005f94420010001000000010244110000000100000111010101024ffff44422210510015155000224efff99420221020001022422494400000000000
00000000024944220000000000000001242101000001000001000000000024efff44212105500056055100004eefffe420000100000002422444440000000000
00000000024994421000000010000010444010000010000650501010101024ffffe4444015d01000156510244efffff420001010100022422244920000000000
00000000024944420000000000000001242100000111000100550000000124ffffee440115511001056d22444fffff9420000001000002420224440000000000
00000000024944421000000000000010442000000051110010d51010101144ff7ffee42225d51111166422ee9ffffff420100021001022422224442000000000
00000000044944020000000000000002240100000115011105d5000100012efffffe4e4424242515de2124ef9ffffff422000221000002422224494100000000
0000000049944422201000000000101144211010101151115d42201010114eff7ffff4444222224442244eff7ffffffe40104220101022444222494000000000
00000000299444020000000000000002242222010001122524220101010124effffffe442222000224444fffffff9ffe20024200000002242122442100000000
00000000499444222010000000000012444442211000001012512110102024ff7ffffffe44422224444efffffffffffe40444110001010444022444200000000
00000000994444042000000000000002444442220101021222242201010124efffefffeee44424444eeffffffffffff942240100010002244202244420000000
000000009944442420100000000000124ee444422122224244425112201024ff7ffefffffee44eeeffff7ffffffff9fee4422010102011244222449420000000
000000049944242420000000000000024e4444242224244444442202010224efffffefffffee4eefffffffffffffeffe44222200000002044402224940000000
000000149444224420100000000000124ee444424244444444422221201224ff7ffffffffffffefeffff7ffffff9fffe44202220002022244422424940000000
000000294444244421000000000000024e4444222444444444422221010224eff7ffffffffffffefefefffffffe99ffe44000220010002044402242940000000
000002994442444221101000000000124e4442224444444444424221102244ff77fffeff7ffffffffefffffffff9fff449501220102021224422244440000000
0000014994224442020000000000000224222222244444444422221101222eefffffee4effffefefeeefeeefefefefe44f400102000201024422242444000000
00000149944244411210000000000011224222224244444444422120122244efff7fff44ef7ffffffefeeefffef9ff9449401022101220224494224444100000
000002494424494202000000000000012422020222244444442422000222244eefffefd44fffffffefeeeeefe9e99f4449400222000102022444222449000000
0000129994449940111010000000101022212122224444444442211022202244effeef744efffffefeeefeeeee94f9e4ee401220101022102494424249100000
000024494424442100210000000000000222010222242424242200012201022224e424e4244eeeee4eee4eee4e4ee94e44102201000002020249424229200004
0000449994499420122000100000100022212021222242424222101020000022242012e42444eefee4eeeeeee4eef99ee2444210001010202244944244420002
00002994444944022200010000000000022202010222222222220100210001022400024424444eee4e4eee4e4e4eefee42442201000001220224492422420000
000049f4444492124110100000001000112221202222424222212010222000224442224ee2444efeeeeeeee4eeeefff44ee41020100010222144999442921000
0004024444494242000001000000000001220102012222220202010000000002224422efe42444ee444e4e4e4e49efe444440200000001022224449942242041
024002944249924010121000000010001022212120222122212110101010102244f44efff44244eee4eee4eeee9effe4e4444210000010122222449994444420
010005442449440001010000000000000102120202022202220102010100012224eeefffff44244eee4e4e4e4ee9ff44e4444200000000022422444449444900
000002944499421012200000000010001020222121212221212021202110114244fffffffff4444eeee4eee4eeffff44fee44100101010102442444499944400
000002444994220102000000000000000101020202020202020201010101024424efffffffff4444ee44ee4e4eefff144e442000000100010244224444942400
00140144499441112210000000000010001022212121202220212121102124e444fffffffffff444eee4eeeeeefffe1144421000001010001224444444944441
1002024449442102220000000000010001010202020201020202020102022ee42efffffffffffe4eefee4e4ee9efe40012000000000101000202442444494444
41000244f9424112400010000000001011201121222121212121212022224ef44fff7ffffffffeeefeeefeee99fff41000000010000021001021244444499244
00000149444402420000000000000000010101020202010201020222242222efee4eefffffffef4eefeeeeeeefff440000010000000002000002222449494424
0000019994424242101000000010000000201011212120212122222221202024e244e4fffffffffeeefeee9e99ffe21000101010000010100010224444999944
00000249444244000101000000000000000102011202020202022222000000022224224effefefeeefe9eee9efef400000000100000001000000044444499994
0000449994444210200010000010000000202120222121212222221010201000222244224ffeeefefffe9e99f9ffd00010101220101010212000122024449944
000049994444000200010000000000000001010101020212021200000000000002210222244e4eee4fe9eeefefef400000010221000000010000000222244949
000099994442101110111010000000000011202010222122222110000010001000100010102224e4eefe9ef9fff9400000111122101110101010002242424499
000499494422012100020000010000000002010101021202020000000000000000010200000144444feeefe9ffe9200001010102000200000000000004422499
0144f9499442201011201000100000000010212021212221211010001022244244eeffe44ee4e444eefefffef9f4501010102220210022101000101022449444
0449f4494422000002100001000000000001010101020202010100000224444e4eeffe4efeef44444eeee9efe9e4000000020201220002000000000100244444
449ff449944210102210000010000000000010201021212220222010102244ee4efffeeffefffe4444eefefffee1000010222010222010201010001010224994
0dff94494422010222000000000000000000020102010202020212010102222222244eee4feffe444e4ee9e99e40000102012202022000020100000002024999
46f99444944220124010002000001000100011202120222122212221201022222244e444effefee4e4eef9fef440001010124212124000002210100022114499
9f99994244220104200000000000000000000102010102120201011201010202222224444eee4e444449ef994400000000022202022100000200000002010449
f999f94242221042100000000010000000000021212120211021102122212020102224e4e4eeeee444eefef94200001000224012104420000021100010212244
499ff94244220421000000000000000000000001020111020101010101010100010224444e4eee4e4eeee9ee4100000001022202220420000001010001220224
49fff9424421242010001000100010001000001022212121212111201111201010112444eeeefeeeee9e9ee44000100010224212421420000000201010222142
4fff9442221242000000000000000000000000000202010201010101010101022212244e444e4eee4eeeee420000000000022202220222000000000100022122
fff994422244421010100010000000100000000010212021202110212022224444fee4feeeeefefeee9ee4421000000000124210422044000000001010122022
ff999942222412010000000000000000000000000102020102010212122224444fffefffee4eefeeeeee44250000000001024200242044000000000000022202
f99499422440220110000010100010100000000000102121212122212242444efefffffffefffffefee444421000100000114220244044201000001010124422
994499424421020100000000000000000000000000010102010201022224244e4eefefffffefffee4e4444420000000000014220044224410000000000012422
9999f444921022200000000000100010001000000000102221212022224444e4eefffffffffffe944444e4420000000000104240224244421010001010102442
499f9444420002000000000000000000000000000000010202020102122244444e4eefefffffee44222e44220000000000002420024424422100000001000244
49f994994010221010001010101000100010100000000011222121102222444444eeeefffffee44224eee4411000000000002440124442922210100011102144
49949944217777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777770000010024
99949444227000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000070000201024
94494449427000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000070000000124
44994499947000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000070010101012
2444499f447000000000000000000000009009900099099909000090000009900090090909900999099000900099000000000000000000000000070000010002
449499f9947000000000000000000000090909090900090009000909000009090909090909090900090900900900009000000000000000000000071000001012
94499f94997000000000000000000000099909090909099009000999000009900999009009090990099000000090000000000000000000000000070000000102
44999499997000000000000000000000090909090909090009000909000009090909009009090900090900000009009000000000000000000000072110001110
2499499f497000000000000000000000090909090099099909990909000009090909009009090999090900000990000000000000000000000000072200000100
249999f9947000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000072010000010
44249f99997000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000072200000000
44499999997000000000000007700770000770000777700007777770000000000770077000077000077007700007700007700770000000000000074221000011
1449449f947000000000000007700770000770000777700007777770000000000770077000077000077007700007700007700770000000000000074202000002
049449f9947000000000000007700770077007700770077007700000000000000770077007700770077007700770077007700770000000000000079422000012
49949f94447000000000000007700770077007700770077007700000000000000770077007700770077007700770077007700770000000000000074204000001
9999f994427000000000000007700770077777700777700007777000000000000777700007777770000770000777777007777000000000000000079224200001
999f9944227000000000000007700770077777700777700007777000000000000777700007777770000770000777777007777000000000000000074202210002
99f94494447000000000000007700770077007700770000007700000000000000770077007700770000770000770077007700770000000000000079200420001
ff949944447000000000000007700770077007700770000007700000000000000770077007700770000770000770077007700770000000000000074201220001
f9999444947000000000000000077000077007700770000007777770000000000770077007700770000770000770077007700770000000000000074220222000
99494449427000000000000000077000077007700770000007777770000000000770077007700770000770000770077007700770000000000000072200020001
99944994217000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000074210122001
49949942247000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000072200020000
4499ff94947000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000072210002005
244f9f99447000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000072201000016
249494444470000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000722101000fe
44244944447000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000072221000244
94424444447000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000072221101124
24242224447000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000070222000502
222110242277777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777722201056d1
0102222444244444224942420122010102210101000000000100000000000000242212222212110101000000000001022102000000000000020200022205d655
002242229442444444944141114112102220101120001000001000000010101014421112422110112010000010001012402220001000100010122012211d66d5
__sfx__
000200002d34034340393350000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000300002d3503135034350393503d345000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00030000344503b4503b4350000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000400001e27318663126550000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00020000286431e625000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0005000024350283502b3503035030335000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000400002b35032345000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000400001466014650136401263011625000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000200002813500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00080000242731e67018660126400c625000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000400001f05024050280502b04500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000200001867330355000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00040000283502d350343550000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000400001224011235000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000f0000284502845028450284202d4502d4502d4502d4202b4502b42028450284202445024450244502442026450264202445024420214502145021450214202445024450244502442029450294502945029420
000f00002112024120281202412021120241202812024120211202412028120241202112024120281202412021120241202912024120211202412029120241202112024120291202412021120241202912024120
000f0000150600000015060000001506000000210600000015060000001506000000150600000021060000001106000000110600000011060000001d060000001106000000110600000011060000001d06000000
000f00002b4502b4502b4502b4502b4502b42029450294202645026450264502642023450234502345023420284502845028450284202c4502c4502c4502c4202f4502f4502f4502f4202c4502c4202845028420
000f000023120261202b1202612023120261202b1202612023120261202b1202612023120261202b1202612023120281202c1202812023120281202c1202812023120281202c1202812023120281202c12028120
000f00001306000000130600000013060000001f060000001306000000130600000013060000001f060000001006000000100600000010060000001c060000001006000000100600000010060000001c06000000
000f00002d4502d4502d4502d420304503045030450304202f4502f4202d4502d4202845028450284502842029450294202d4502d420304503045030450304202d4502d4502d4502d42029450294502945029420
000f00002112024120281202412021120241202812024120211202412028120241202112024120281202412021120241202912024120211202412029120241202112024120291202412021120241202912024120
000f0000150600000015060000001506000000210600000015060000001506000000150600000021060000001106000000110600000011060000001d060000001106000000110600000011060000001d06000000
000f00002b4502b4502b4502b4202f4502f4502f4502f420324503245032450324202f4502f4202b4502b4202c4502c4202945029420284502842026450264202345023450234502342028450284502845028420
000f000023120261202b1202612023120261202b1202612023120261202b1202612023120261202b1202612023120281202c1202812023120281202c1202812023120281202c1202812023120281202c12028120
000f00001306000000130600000013060000001f060000001306000000130600000013060000001f060000001006000000100600000010060000001c060000001006000000100600000010060000001c06000000
001000002145021420224502242025450254502545025420264502642025450254202245022450224502242021450214502145021420284502845028450284202645026420254502542022450224202145021420
001000002102025020280202502021020250202802025020210202502028020250202102025020280202502021020250202802025020210202502028020250202102025020280202502021020250202802025020
001000001506000000150600000021060000001506000000150600000015060000002106000000150600000015060000001506000000210600000015060000001506000000150600000021060000001506000000
001000002245022450224502242026450264502645026420294502942028450284202645026450264502642025450254202645026420284502845028450284202245022450224502242021450214502145021420
001000002202026020290202602022020260202902026020220202602029020260202202026020290202602021020250202802025020210202502028020250202102025020280202502021020250202802025020
001000001606000000160600000022060000001606000000160600000016060000002206000000160600000015060000001506000000210600000015060000001506000000150600000021060000001506000000
00100000284502842029450294202b4502b4202945029420284502845028450284202645026450264502642025450254202645026420284502842026450264202545025450254502542022450224502245022420
001000002102026020290202602021020260202902026020210202602029020260202102026020290202602021020250202802025020210202502028020250202102025020280202502021020250202802025020
001000000e060000000e060000001a060000000e060000000e060000000e060000001a060000000e0600000015060000001506000000210600000015060000001506000000150600000021060000001506000000
0010000021450214202245022420254502542028450284202b4502b4502b4502b4202945029450294502942028450284202645026420254502542022450224202145021450214502145021450214502145021420
001000001f0202202026020220201f0202202026020220201f0202202026020220201f02022020260202202021020250202802025020210202502028020250202102025020280202502021020250202802025020
00100000130600000013060000001f060000001306000000130600000013060000001f06000000130600000015060000001506000000210600000015060000001506000000150600000021060000001506000000
000c0000283502835028350283202d3502d3502d3502d3202b3502b32028350283202435024350243502432026350263202435024320213502135021350213202435024350243502432029350293502935029320
000c00002122024220282202422021220242202822024220212202422028220242202122024220282202422021220242202922024220212202422029220242202122024220292202422021220242202922024220
000c0000150600000015060000001506000000210600000015060000001506000000150600000021060000001106000000110600000011060000001d060000001106000000110600000011060000001d06000000
000c00002b3502b3502b3502b3502b3502b32029350293202635026350263502632023350233502335023320283502835028350283202c3502c3502c3502c3202f3502f3502f3502f3202c3502c3202835028320
000c000023220262202b2202622023220262202b2202622023220262202b2202622023220262202b2202622023220282202c2202822023220282202c2202822023220282202c2202822023220282202c22028220
000c00001306000000130600000013060000001f060000001306000000130600000013060000001f060000001006000000100600000010060000001c060000001006000000100600000010060000001c06000000
000c00002d3502d3502d3502d320303503035030350303202f3502f3202d3502d3202835028350283502832029350293202d3502d320303503035030350303202d3502d3502d3502d32029350293502935029320
000c00002122024220282202422021220242202822024220212202422028220242202122024220282202422021220242202922024220212202422029220242202122024220292202422021220242202922024220
000c0000150600000015060000001506000000210600000015060000001506000000150600000021060000001106000000110600000011060000001d060000001106000000110600000011060000001d06000000
000c00002b3502b3502b3502b3202f3502f3502f3502f320323503235032350323202f3502f3202b3502b3202c3502c3202935029320283502832026350263202335023350233502332028350283502835028320
000c000023220262202b2202622023220262202b2202622023220262202b2202622023220262202b2202622023220282202c2202822023220282202c2202822023220282202c2202822023220282202c22028220
000c00001306000000130600000013060000001f060000001306000000130600000013060000001f060000001006000000100600000010060000001c060000001006000000100600000010060000001c06000000
000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
__music__
01 10111240
00 13141540
00 16171840
02 191a1b40
01 1c1d1e40
00 1f202140
00 22232440
02 25262740
01 28292a40
00 2b2c2d40
00 2e2f3040
02 31323340
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
00 40404040
