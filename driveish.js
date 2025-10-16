(function(){
  var cvs=document.getElementById("cvs"),ctx=cvs.getContext("2d");
  var dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
  function fit(){var w=cvs.clientWidth||window.innerWidth,h=cvs.clientHeight||window.innerHeight;cvs.width=Math.floor(w*dpr);cvs.height=Math.floor(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)};window.addEventListener("resize",fit);fit();

  var keys={left:0,right:0,gas:0,rev:0},paused=false,noclip=false,started=false;
  var keymap={37:"left",65:"left",39:"right",68:"right",38:"gas",87:"gas",40:"rev",83:"rev",80:"pause"};
  window.addEventListener("keydown",function(e){var k=keymap[e.keyCode];if(k==="pause"){paused=!paused;return}if(k)keys[k]=1});
  window.addEventListener("keyup",function(e){var k=keymap[e.keyCode];if(k&&k!=="pause")keys[k]=0});

  var fsBtn=document.getElementById("fsBtn"),resetBtn=document.getElementById("reset"),ncBtn=document.getElementById("noColBtn");
  if(fsBtn)fsBtn.onclick=function(){var el=document.documentElement;if(el.requestFullscreen)el.requestFullscreen()}; 
  if(ncBtn)ncBtn.onclick=function(){noclip=!noclip;ncBtn.classList.toggle("active",noclip);ncBtn.textContent=noclip?"🌀 No Collision: ON":"🌀 No Collision: OFF"};
  if(resetBtn)resetBtn.onclick=function(){hardReset()};

  var TWO=Math.PI*2;
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function lerp(a,b,t){return a+(b-a)*t}

  function P(x,y){this.x=x;this.y=y;this.px=x;this.py=y;this.ax=0;this.ay=0;this.f=0.995}
  P.prototype.add=function(fx,fy){this.ax+=fx;this.ay+=fy}
  P.prototype.step=function(dt){var nx=this.x+(this.x-this.px)*this.f+this.ax*dt*dt;var ny=this.y+(this.y-this.py)*this.f+this.ay*dt*dt;this.px=this.x;this.py=this.y;this.x=nx;this.y=ny;this.ax=this.ay=0}

  function Stick(a,b,len,st){this.a=a;this.b=b;this.len=len;this.st=st||1}
  Stick.prototype.solve=function(){var dx=this.b.x-this.a.x,dy=this.b.y-this.a.y;var d=Math.hypot(dx,dy)||1;var diff=(d-this.len)/d;var off=0.5*this.st*diff;this.a.x+=dx*off;this.a.y+=dy*off;this.b.x-=dx*off;this.b.y-=dy*off}

  function Seg(ax,ay,bx,by,t){this.ax=ax;this.ay=ay;this.bx=bx;this.by=by;this.tag=t||""}

  function collideCircleSeg(p,r,s){
    var ax=s.ax,ay=s.ay,bx=s.bx,by=s.by,abx=bx-ax,aby=by-ay,apx=p.x-ax,apy=p.y-ay;
    var ab2=abx*abx+aby*aby,t=clamp((apx*abx+apy*aby)/ab2,0,1),cx=ax+abx*t,cy=ay+aby*t,dx=p.x-cx,dy=p.y-cy,d2=dx*dx+dy*dy; if(d2>r*r)return false;
    var d=Math.sqrt(d2)||1,nx=dx/d,ny=dy/d,pen=r-d;p.x+=nx*pen;p.y+=ny*pen;
    var tx=-ny,ty=nx,vx=p.x-p.px,vy=p.y-p.py,vt=vx*tx+vy*ty,vn=vx*nx+vy*ny,slip=0.86,stick=0.18,nvx=(vn<0?-vn*stick:vn*stick)*nx,nvy=(vn<0?-vn*stick:vn*stick)*ny,tvx=vt*slip*tx,tvy=vt*slip*ty;p.px=p.x-(nvx+tvx);p.py=p.y-(nvy+tvy);
    return true
  }

  var gravity=0.2,gravSign=1;
  function setGravity(normal){gravSign=normal?1:-1;gravity=0.2*gravSign}

  var floors=[],ceilings=[],props=[],allSegments=[];
  var lamp={x:565,on:false},plateLamp={x:520,w:26,h:6,pressed:false};
  var plateFlip={x:900,w:28,h:6,pressed:false},plateUnflip={x:900,yTop:-140,w:28,h:6,pressed:false};
  var ceilZone={x1:820,x2:1020,y:-120,thick:8};
  var testZoneStart=760;

  function groundYAt(px){
    var lastY=0,found=false;
    for(var i=0;i<floors.length;i++){var s=floors[i];if((px>=Math.min(s.ax,s.bx))&&(px<=Math.max(s.ax,s.bx))){var t=(px-s.ax)/((s.bx-s.ax)||1);lastY=s.ay+(s.by-s.ay)*t;found=true}}
    if(found)return lastY;return 0
  }

  function genTerrain(){
    floors.length=0;ceilings.length=0;props.length=0;allSegments.length=0;
    var x=0,y=0,step=8;function pushFloor(nx,ny){var s=new Seg(x,y,nx,ny,"floor");floors.push(s);allSegments.push(s);x=nx;y=ny}
    for(var i=0;i<40;i++)pushFloor(x+step,y);
    for(var k=1;k<=180;k++){var t=k/180;var nx=x+step;var ny=Math.sin(t*Math.PI)*70-Math.pow(t,2)*18;pushFloor(nx,ny)}
    for(i=0;i<90;i++)pushFloor(x+step,y-0.3);
    for(i=0;i<40;i++)pushFloor(x+step,y);
    var fenceStart=420,fenceLen=260,gap=20;
    for(var fx=fenceStart;fx<=fenceStart+fenceLen;fx+=gap){var gy=groundYAt(fx);var v=new Seg(fx,gy-2,fx,gy-35,"wall");props.push(v);allSegments.push(v)}
    for(fx=fenceStart;fx<=fenceStart+fenceLen-gap;fx+=gap){
      var gy1=groundYAt(fx)-18,gy2=groundYAt(fx+gap)-18,gy3=groundYAt(fx)-28,gy4=groundYAt(fx+gap)-28;
      var r1=new Seg(fx,gy1,fx+gap,gy2,"rail"),r2=new Seg(fx,gy3,fx+gap,gy4,"rail");props.push(r1);props.push(r2);allSegments.push(r1);allSegments.push(r2)
    }
    var base=0;for(i=0;i<60;i++)pushFloor(testZoneStart+i*step,base);
    var cx1=ceilZone.x1,cx2=ceilZone.x2,cy=ceilZone.y,th=ceilZone.thick;
    var c1=new Seg(cx1,cy,cx2,cy,"ceiling"),c2=new Seg(cx2,cy,cx2,cy+th,"ceiling"),c3=new Seg(cx2,cy+th,cx1,cy+th,"ceiling"),c4=new Seg(cx1,cy+th,cx1,cy,"ceiling");
    ceilings.push(c1,c2,c3,c4);allSegments.push(c1,c2,c3,c4);
    var wallL=new Seg(cx1,cy,cx1,500,"wall"),wallR=new Seg(cx2,cy,cx2,500,"wall");props.push(wallL);props.push(wallR);allSegments.push(wallL,wallR)
  }

  function Car(x,y){
    this.wr=9;this.power=0.19;this.traction=1;
    this.back=new P(x-11,y);this.front=new P(x+11,y);this.body=new P(x,y-10);
    this.sticks=[new Stick(this.back,this.front,22,0.8),new Stick(this.back,this.body,13,0.5),new Stick(this.front,this.body,13,0.5)];
    this.gL=0;this.gR=0;this.dead=false
  }
  Car.prototype.control=function(dt){
    var axx=this.front.x-this.back.x,axy=this.front.y-this.back.y,ad=Math.hypot(axx,axy)||1,tx=axx/ad,ty=axy/ad;
    var th=0;if(keys.gas)th=this.power;if(keys.rev)th=-this.power*0.8;
    var steer=(keys.right-keys.left),sx=tx*th*dt*60,sy=ty*th*dt*60,grounded=(this.gL>0||this.gR>0),grip=grounded?1:0.25;
    this.back.x-=sx*grip;this.back.y-=sy*grip;this.front.x+=sx*grip;this.front.y+=sy*grip;
    this.body.x+=(-ty*steer*0.55);this.body.y+=(tx*steer*0.55)
  }
  Car.prototype.step=function(dt){this.back.add(0,gravity);this.front.add(0,gravity);this.body.add(0,gravity*0.7);this.back.step(dt);this.front.step(dt);this.body.step(dt)}
  Car.prototype.solve=function(){for(var i=0;i<this.sticks.length;i++)this.sticks[i].solve()}
  Car.prototype.collide=function(){
    this.gL=0;this.gR=0;
    var collList=floors.concat(gravSign<0?ceilings:[]);
    var extra=(noclip?[]:props);
    for(var i=0;i<collList.length;i++){var s=collList[i];var by=this.back.y,fy=this.front.y;collideCircleSeg(this.back,this.wr,s);collideCircleSeg(this.front,this.wr,s);if(this.back.y<by-0.01)this.gL=4;if(this.front.y<fy-0.01)this.gR=4}
    for(i=0;i<extra.length;i++){var ss=extra[i];if(ss.tag!=="wall"&&ss.tag!=="rail")continue;collideCircleSeg(this.back,this.wr,ss);collideCircleSeg(this.front,this.wr,ss)}
    if(this.gL>0)this.gL--;if(this.gR>0)this.gR--
  }
  Car.prototype.pos=function(){return{x:(this.back.x+this.front.x+this.body.x)/3,y:(this.back.y+this.front.y+this.body.y)/3}}
  Car.prototype.draw=function(){
    ctx.lineWidth=2;ctx.strokeStyle="#b8c7ff";ctx.fillStyle="#0e1522";
    var wheels=[this.back,this.front];
    for(var i=0;i<wheels.length;i++){var w=wheels[i];ctx.beginPath();ctx.arc(w.x,w.y,this.wr,0,TWO);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(w.x,w.y);ctx.lineTo(w.x+this.wr*0.9,w.y);ctx.stroke()}
    ctx.strokeStyle="#8be9fd";ctx.fillStyle="#152135";ctx.beginPath();ctx.moveTo(this.back.x,this.back.y);ctx.lineTo(this.front.x,this.front.y);ctx.lineTo(this.body.x,this.body.y);ctx.closePath();ctx.fill();ctx.stroke()
  }

  var cam={x:0,y:-40,z:1};
  function applyCam(){var r=window.devicePixelRatio||1;ctx.setTransform(cam.z,0,0,cam.z,cvs.width/r/2,cvs.height/r/2);ctx.translate(-cam.x,-cam.y)}
  function drawBG(){
    var r=window.devicePixelRatio||1,w=cvs.width/r,h=cvs.height/r;ctx.setTransform(1,0,0,1,0,0);
    var g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,"#0b0f14");g.addColorStop(1,"#0a0e13");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    ctx.globalAlpha=0.25;ctx.fillStyle="#1b2740";for(var i=0;i<12;i++){var yy=50+i*18;ctx.fillRect(0,h-yy,w,2)}ctx.globalAlpha=1
  }
  function drawGround(){
    ctx.lineWidth=3;ctx.strokeStyle="#2b3a55";ctx.fillStyle="#0e1522";
    ctx.beginPath();var first=true;for(var i=0;i<floors.length;i++){var s=floors[i];if(first){ctx.moveTo(s.ax,s.ay);first=false}ctx.lineTo(s.bx,s.by)}
    var last=floors[floors.length-1];ctx.lineTo(last.bx,500);ctx.lineTo(floors[0].ax,500);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.lineWidth=2;ctx.strokeStyle="#41587e";
    for(i=0;i<props.length;i++){var p=props[i];var vert=Math.abs(p.ax-p.bx)<0.1&&Math.abs(p.ay-p.by)>8;if(vert){ctx.beginPath();ctx.moveTo(p.ax,p.ay);ctx.lineTo(p.bx,p.by);ctx.stroke()}}
    ctx.lineWidth=3;ctx.strokeStyle="#344a6e";for(i=0;i<ceilings.length;i++){var c=ceilings[i];ctx.beginPath();ctx.moveTo(c.ax,c.ay);ctx.lineTo(c.bx,c.by);ctx.stroke()}
  }

  function drawPlate(x,w,h,pressed){var py=groundYAt(x),yTop=py-1-h+(pressed?2:0);ctx.fillStyle=pressed?"#6dd37b":"#7b87a1";ctx.strokeStyle="#2b3a55";ctx.lineWidth=2;ctx.beginPath();ctx.rect(x-w/2,yTop,w,h);ctx.fill();ctx.stroke()}
  function platePressed(car,x,w,h){
    var py=groundYAt(x),top=py-1-h,left=x-w/2,right=x+w/2,ws=[car.back,car.front],wr=car.wr;
    for(var i=0;i<ws.length;i++){var wq=ws[i];if(wq.x+wr>left&&wq.x-wr<right&&wq.y>top&&wq.y<py+4)return true}
    return false
  }
  function drawLamp(){
    var gy=groundYAt(lamp.x);ctx.strokeStyle="#495f86";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(lamp.x,gy-2);ctx.lineTo(lamp.x,gy-60);ctx.stroke();
    ctx.fillStyle="#263650";ctx.beginPath();ctx.arc(lamp.x,gy-60,6,0,TWO);ctx.fill();
    if(lamp.on){var x=lamp.x,y=gy-60,len=170;ctx.save();ctx.globalCompositeOperation="lighter";var grad=ctx.createRadialGradient(x,y,0,x,y,len);grad.addColorStop(0,"rgba(255,255,220,.7)");grad.addColorStop(1,"rgba(255,255,220,0)");ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,len,Math.PI*0.65,Math.PI*0.35,true);ctx.closePath();ctx.fill();ctx.restore();ctx.fillStyle="#ffeeba";ctx.beginPath();ctx.arc(x,y,3,0,TWO);ctx.fill()}
  }

  function drawPlateFlip(){var py=groundYAt(plateFlip.x),t=py-1-plateFlip.h+(plateFlip.pressed?2:0);ctx.fillStyle=plateFlip.pressed?"#6dd37b":"#7b87a1";ctx.strokeStyle="#2b3a55";ctx.lineWidth=2;ctx.beginPath();ctx.rect(plateFlip.x-plateFlip.w/2,t,plateFlip.w,plateFlip.h);ctx.fill();ctx.stroke()}
  function drawPlateUnflip(){
    var y=ceilZone.y;var t=y-plateUnflip.h-(plateUnflip.pressed?2:0);
    ctx.fillStyle=plateUnflip.pressed?"#6dd37b":"#7b87a1";ctx.strokeStyle="#2b3a55";ctx.lineWidth=2;ctx.beginPath();ctx.rect(plateUnflip.x-plateUnflip.w/2,t,plateUnflip.w,plateUnflip.h);ctx.fill();ctx.stroke()
  }
  function plateFlipCheck(car){
    var py=groundYAt(plateFlip.x),top=py-1-plateFlip.h,left=plateFlip.x-plateFlip.w/2,right=plateFlip.x+plateFlip.w/2,ws=[car.back,car.front],wr=car.wr,hit=false;
    for(var i=0;i<ws.length;i++){var wq=ws[i];if(wq.x+wr>left&&wq.x-wr<right&&wq.y>top&&wq.y<py+5){hit=true;break}}plateFlip.pressed=hit;return hit
  }
  function plateUnflipCheck(car){
    var y=ceilZone.y,top=y-plateUnflip.h,left=plateUnflip.x-plateUnflip.w/2,right=plateUnflip.x+plateUnflip.w/2,ws=[car.back,car.front],wr=car.wr,hit=false;
    for(var i=0;i<ws.length;i++){var wq=ws[i];if(wq.x+wr>left&&wq.x-wr<right&&wq.y<y+5&&wq.y>top-5){hit=true;break}}plateUnflip.pressed=hit;return hit
  }

  var debris=[],dead=false,showRespawn=false,homeOverlay;
  function destroyCar(car){
    if(dead)return;dead=true;showRespawn=true;toggleRespawn(true);
    debris.length=0;
    var parts=[car.back,car.front,car.body];
    for(var i=0;i<parts.length;i++){var p=parts[i];debris.push({x:p.x,y:p.y,px:p.x-(Math.random()*2-1)*2,py:p.y-(Math.random()*2-1)*2,r:4+Math.random()*3})}
  }
  function drawDebris(){
    if(!debris.length)return;
    ctx.fillStyle="#9fb0c9";ctx.strokeStyle="#2b3a55";ctx.lineWidth=1.5;
    for(var i=0;i<debris.length;i++){var d=debris[i];ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,TWO);ctx.fill();ctx.stroke()}
  }
  function stepDebris(dt){
    for(var i=0;i<debris.length;i++){var d=debris[i];var vx=d.x-d.px,vy=d.y-d.py;var nx=d.x+vx*0.99,ny=d.y+vy*0.99+gravity*dt*dt;d.px=d.x;d.py=d.y;d.x=nx;d.y=ny}
  }

  var car,last=0,iters=8;
  function resetWorld(){
    genTerrain();
    car=new Car(40,groundYAt(40)-20);
    cam.x=car.pos().x+80;cam.y=car.pos().y-40;cam.z=1;
    lamp.on=false;plateLamp.pressed=false;plateFlip.pressed=false;plateUnflip.pressed=false;
    dead=false;showRespawn=false;debris.length=0
  }
  function hardReset(){started=true;toggleHome(false);toggleRespawn(false);setGravity(true);resetWorld()}

  function skyOut(p){
    if(gravSign>0)return p.y<-600;
    return p.y>1000
  }

  function topTouchFloor(car){
    if(gravSign>0){
      for(var i=0;i<floors.length;i++){if(collideCircleSeg(car.body,4,floors[i]))return true}
    }else{
      for(var j=0;j<ceilings.length;j++){if(collideCircleSeg(car.body,4,ceilings[j]))return true}
    }
    return false
  }

  function updatePlateLampState(car){
    var hit=platePressed(car,plateLamp.x,plateLamp.w,plateLamp.h);plateLamp.pressed=hit;lamp.on=hit
  }

  function ensureHomeOverlay(){
    if(homeOverlay)return;
    var stage=document.getElementById("stage");
    homeOverlay=document.createElement("div");homeOverlay.id="homeOverlay";
    homeOverlay.style.position="absolute";homeOverlay.style.inset="0";homeOverlay.style.display="grid";homeOverlay.style.placeItems="center";homeOverlay.style.background="rgba(0,0,0,.55)";homeOverlay.style.backdropFilter="blur(4px)";homeOverlay.style.zIndex="99";
    var card=document.createElement("div");card.className="card";
    var h=document.createElement("h2");h.textContent="Drive-ish Test Zone";
    var b=document.createElement("button");b.className="btn";b.textContent="Start";b.onclick=function(){started=true;toggleHome(false);hardReset()};
    card.appendChild(h);card.appendChild(b);homeOverlay.appendChild(card);stage.appendChild(homeOverlay)
  }
  function toggleHome(on){ensureHomeOverlay();homeOverlay.hidden=!on}
  function toggleRespawn(on){var el=document.getElementById("respawnOverlay");if(!el)return;el.hidden=!on}
  var respawnBtn=document.getElementById("respawnBtn");if(respawnBtn)respawnBtn.onclick=function(){hardReset()}

  function step(ts){
    var now=ts||performance.now(),dt=clamp((now-last)/16.666,0.5,1.5);last=now;
    if(!started){drawBG();ensureHomeOverlay();toggleHome(true);requestAnimationFrame(step);return}
    if(!paused){
      if(!dead){
        car.control(dt);car.step(dt);
        for(var i=0;i<iters;i++){car.solve();car.collide()}
        updatePlateLampState(car);
        if(plateFlipCheck(car))setGravity(false);
        if(plateUnflipCheck(car))setGravity(true);
        if(topTouchFloor(car))destroyCar(car);
        if(skyOut(car.pos()))destroyCar(car)
      }else{
        stepDebris(dt)
      }
      var cp=car.pos?car.pos():{x:0,y:0},lead=(car.front.x-car.back.x),tx=cp.x+80+lead*0.4,ty=cp.y-40;cam.x=lerp(cam.x,tx,0.08);cam.y=lerp(cam.y,ty,0.08)
    }
    draw();requestAnimationFrame(step)
  }

  function draw(){
    drawBG();applyCam();drawGround();drawLamp();drawPlate(plateLamp.x,plateLamp.w,plateLamp.h,plateLamp.pressed);drawPlateFlip();drawPlateUnflip();
    if(!dead){car.draw()}else{drawDebris()}
  }

  ensureHomeOverlay();toggleHome(true);requestAnimationFrame(step)
})();
