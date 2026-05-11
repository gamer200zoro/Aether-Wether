/* ═══════════════════════════════════════════════════════
   AETHER WEATHER — app.js (v2 interactive)
═══════════════════════════════════════════════════════ */

const API_KEY = 'd1d35a2a7a6bf4462115da89f58657d3'; // ← Replace this!
const BASE    = 'https://api.openweathermap.org';

// ── State ─────────────────────────────────────────────
let unit          = 'metric';
let history       = JSON.parse(localStorage.getItem('wHistory') || '[]');
let pinnedCities  = JSON.parse(localStorage.getItem('wPinned')  || '[]');
let currentCity   = '';
let currentLat    = null;
let currentLon    = null;
let currentData   = null;  // full current weather object
let forecastData  = null;  // full forecast object
let rainChart     = null;
let trendChart    = null;
let weatherMap    = null;
let mapLayer      = null;
let activeMapLayer = 'temp_new';
let activeTrendGraph = 'temp';
let activeHourlyIdx  = null;
let activeDayKey     = null;

// ── DOM ───────────────────────────────────────────────
const $ = id => document.getElementById(id);
const loader       = $('loaderOverlay');
const toast        = $('toast');
const searchInput  = $('searchInput');
const suggestions  = $('suggestions');
const alertBanner  = $('alertBanner');
const statModal    = $('statModal');

// ══════════════════════════════════════════════════════
// CANVAS ANIMATION ENGINE
// ══════════════════════════════════════════════════════
const canvas = $('weatherCanvas');
const ctx    = canvas.getContext('2d');
let particles = [];
let currentWeatherType = 'clear';

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { resizeCanvas(); buildParticles(); });
resizeCanvas();

class Raindrop {
  constructor() { this.reset(true); }
  reset(init=false) {
    this.x=Math.random()*canvas.width; this.y=init?Math.random()*canvas.height:-20;
    this.len=Math.random()*18+8; this.speed=Math.random()*12+10;
    this.angle=12+Math.random()*6; this.alpha=Math.random()*0.4+0.2; this.width=Math.random()*1+0.4;
  }
  update() { const r=this.angle*Math.PI/180; this.x+=Math.sin(r)*this.speed*0.5; this.y+=this.speed; if(this.y>canvas.height+20)this.reset(); }
  draw() {
    const r=this.angle*Math.PI/180;
    ctx.save(); ctx.strokeStyle=`rgba(130,190,255,${this.alpha})`; ctx.lineWidth=this.width;
    ctx.beginPath(); ctx.moveTo(this.x,this.y); ctx.lineTo(this.x-Math.sin(r)*this.len,this.y-this.len); ctx.stroke(); ctx.restore();
  }
}

class Bubble {
  constructor() { this.reset(true); }
  reset(init=false) {
    this.x=Math.random()*canvas.width; this.y=init?Math.random()*canvas.height:canvas.height+20;
    this.r=Math.random()*18+5; this.speed=Math.random()*1.5+0.4; this.alpha=Math.random()*0.3+0.05;
    this.drift=(Math.random()-0.5)*0.6; this.pulse=Math.random()*Math.PI*2; this.hue=Math.random()*40+190;
  }
  update() { this.y-=this.speed; this.x+=this.drift+Math.sin(this.pulse)*0.3; this.pulse+=0.02; if(this.y<-30)this.reset(); }
  draw() {
    const pr=this.r+Math.sin(this.pulse)*1.5;
    ctx.save(); ctx.beginPath(); ctx.arc(this.x,this.y,pr,0,Math.PI*2);
    ctx.strokeStyle=`hsla(${this.hue},80%,75%,${this.alpha*1.5})`; ctx.lineWidth=1.5; ctx.stroke();
    const g=ctx.createRadialGradient(this.x-pr*0.3,this.y-pr*0.3,pr*0.05,this.x,this.y,pr);
    g.addColorStop(0,`hsla(${this.hue},80%,95%,${this.alpha*0.6})`); g.addColorStop(1,`hsla(${this.hue},70%,60%,0)`);
    ctx.fillStyle=g; ctx.fill(); ctx.restore();
  }
}

class Snowflake {
  constructor() { this.reset(true); }
  reset(init=false) {
    this.x=Math.random()*canvas.width; this.y=init?Math.random()*canvas.height:-10;
    this.r=Math.random()*5+1; this.speed=Math.random()*2+0.5; this.drift=(Math.random()-0.5)*1.5;
    this.alpha=Math.random()*0.6+0.3; this.angle=0; this.spin=(Math.random()-0.5)*0.04;
  }
  update() { this.y+=this.speed; this.x+=this.drift; this.angle+=this.spin; if(this.y>canvas.height+10)this.reset(); }
  draw() {
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle);
    for(let i=0;i<6;i++){
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-this.r*2.5);
      ctx.strokeStyle=`rgba(220,235,255,${this.alpha})`; ctx.lineWidth=1; ctx.stroke(); ctx.rotate(Math.PI/3);
    }
    ctx.beginPath(); ctx.arc(0,0,this.r,0,Math.PI*2);
    ctx.fillStyle=`rgba(220,235,255,${this.alpha})`; ctx.fill(); ctx.restore();
  }
}

class WindStreak {
  constructor() { this.reset(true); }
  reset(init=false) {
    this.x=init?Math.random()*canvas.width*1.5-canvas.width*0.25:-canvas.width*0.3;
    this.y=Math.random()*canvas.height; this.len=Math.random()*150+60;
    this.speed=Math.random()*8+5; this.alpha=0; this.maxAlpha=Math.random()*0.2+0.05;
    this.thickness=Math.random()*1.5+0.3; this.phase=Math.random()*100;
  }
  update() {
    this.x+=this.speed; this.phase++;
    if(this.phase<20) this.alpha=(this.phase/20)*this.maxAlpha;
    else if(this.x>canvas.width*0.8){ this.alpha-=this.maxAlpha/30; if(this.alpha<=0)this.reset(); }
    else this.alpha=this.maxAlpha;
  }
  draw() {
    const wave=Math.sin(this.phase*0.05)*8;
    ctx.save();
    const g=ctx.createLinearGradient(this.x,this.y,this.x+this.len,this.y+wave);
    g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.3,`rgba(255,255,255,${this.alpha})`);
    g.addColorStop(0.7,`rgba(255,255,255,${this.alpha})`); g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.strokeStyle=g; ctx.lineWidth=this.thickness; ctx.beginPath(); ctx.moveTo(this.x,this.y);
    ctx.bezierCurveTo(this.x+this.len*0.3,this.y+wave*0.5,this.x+this.len*0.7,this.y-wave*0.5,this.x+this.len,this.y+wave);
    ctx.stroke(); ctx.restore();
  }
}

class TornadoParticle {
  constructor() { this.cx=canvas.width*0.5; this.cy=canvas.height*0.6; this.reset(); }
  reset() {
    this.angle=Math.random()*Math.PI*2; this.height=Math.random()*canvas.height*0.7;
    this.r=(1-this.height/canvas.height)*120+10; this.speed=(Math.random()*0.05+0.02);
    this.alpha=Math.random()*0.4+0.05; this.size=Math.random()*4+1;
    this.hue=Math.random()*40+250;
  }
  update() { this.angle+=this.speed; this.height-=0.5; this.r=(1-this.height/canvas.height)*120+10; if(this.height<0)this.reset(); }
  get x(){ return this.cx+Math.cos(this.angle)*this.r; }
  get y(){ return this.cy+this.height-canvas.height/2; }
  draw() {
    ctx.save(); ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2);
    ctx.fillStyle=`hsla(${this.hue},50%,60%,${this.alpha})`; ctx.fill(); ctx.restore();
  }
}

class SunRay {
  constructor() { this.cx=canvas.width*0.25; this.cy=canvas.height*0.15; this.reset(); }
  reset() {
    this.angle=Math.random()*Math.PI*2; this.length=Math.random()*200+100;
    this.width=Math.random()*40+10; this.alpha=0; this.maxAlpha=Math.random()*0.08+0.02;
    this.speed=Math.random()*0.003+0.001; this.growing=true;
  }
  update() {
    this.angle+=this.speed;
    if(this.growing){ this.alpha+=this.maxAlpha/80; if(this.alpha>=this.maxAlpha)this.growing=false; }
    else{ this.alpha-=this.maxAlpha/120; if(this.alpha<=0)this.reset(); }
  }
  draw() {
    const x1=this.cx+Math.cos(this.angle-this.width*0.005)*60, y1=this.cy+Math.sin(this.angle-this.width*0.005)*60;
    const x2=this.cx+Math.cos(this.angle+this.width*0.005)*60, y2=this.cy+Math.sin(this.angle+this.width*0.005)*60;
    const xT=this.cx+Math.cos(this.angle)*(60+this.length), yT=this.cy+Math.sin(this.angle)*(60+this.length);
    ctx.save();
    const g=ctx.createLinearGradient(x1,y1,xT,yT);
    g.addColorStop(0,`rgba(255,200,80,${this.alpha})`); g.addColorStop(1,'rgba(255,150,50,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(xT,yT); ctx.closePath(); ctx.fill(); ctx.restore();
  }
}

class MistParticle {
  constructor() { this.reset(true); }
  reset(init=false) {
    this.x=Math.random()*canvas.width; this.y=init?Math.random()*canvas.height:canvas.height+50;
    this.w=Math.random()*300+150; this.h=Math.random()*80+40; this.alpha=0;
    this.maxA=Math.random()*0.06+0.02; this.speed=Math.random()*0.3+0.1;
    this.drift=(Math.random()-0.5)*0.5; this.phase=Math.random()*100;
  }
  update() {
    this.y-=this.speed; this.x+=this.drift+Math.sin(this.phase*0.01)*0.2; this.phase++;
    if(this.y>canvas.height*0.7) this.alpha=Math.min(this.alpha+0.001,this.maxA);
    else{ this.alpha=Math.max(this.alpha-0.002,0); if(this.alpha<=0)this.reset(); }
  }
  draw() {
    ctx.save();
    const g=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.w/2);
    g.addColorStop(0,`rgba(200,215,235,${this.alpha})`); g.addColorStop(1,'rgba(200,215,235,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(this.x,this.y,this.w/2,this.h/2,0,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
}

function buildParticles() {
  particles = [];
  switch(currentWeatherType) {
    case 'rain': case 'drizzle':
      for(let i=0;i<200;i++) particles.push(new Raindrop());
      for(let i=0;i<30;i++)  particles.push(new Bubble());
      for(let i=0;i<15;i++)  particles.push(new WindStreak());
      break;
    case 'storm': case 'thunderstorm':
      for(let i=0;i<280;i++) particles.push(new Raindrop());
      for(let i=0;i<60;i++)  particles.push(new TornadoParticle());
      for(let i=0;i<20;i++)  particles.push(new WindStreak());
      break;
    case 'snow':
      for(let i=0;i<120;i++) particles.push(new Snowflake());
      for(let i=0;i<10;i++)  particles.push(new WindStreak());
      break;
    case 'clouds':
      for(let i=0;i<25;i++) particles.push(new Bubble());
      for(let i=0;i<20;i++) particles.push(new WindStreak());
      break;
    case 'mist': case 'fog': case 'haze':
      for(let i=0;i<25;i++) particles.push(new MistParticle());
      for(let i=0;i<8;i++)  particles.push(new WindStreak());
      break;
    default: // clear
      for(let i=0;i<18;i++) particles.push(new SunRay());
      for(let i=0;i<20;i++) particles.push(new Bubble());
      for(let i=0;i<5;i++)  particles.push(new WindStreak());
  }
}

function animate() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  particles.forEach(p=>{ p.update(); p.draw(); });
  requestAnimationFrame(animate);
}

function setWeatherAnimation(type) { currentWeatherType=type; buildParticles(); }

function maybeFlash() {
  if(currentWeatherType!=='storm'&&currentWeatherType!=='thunderstorm') return;
  if(Math.random()<0.003) {
    const f=document.createElement('div');
    f.style.cssText='position:fixed;inset:0;background:rgba(200,200,255,0.18);z-index:5;pointer-events:none;animation:flashOut 0.25s ease forwards;';
    if(!document.getElementById('flashStyle')) {
      const s=document.createElement('style'); s.id='flashStyle';
      s.textContent='@keyframes flashOut{0%{opacity:1}100%{opacity:0}}'; document.head.appendChild(s);
    }
    document.body.appendChild(f); setTimeout(()=>f.remove(),300);
  }
  requestAnimationFrame(maybeFlash);
}

buildParticles();
animate();

// ══════════════════════════════════════════════════════
// SEARCH & SUGGESTIONS
// ══════════════════════════════════════════════════════
let suggestTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(suggestTimer);
  const q = searchInput.value.trim();
  if(q.length < 2) { hideSugg(); return; }
  suggestTimer = setTimeout(() => fetchSugg(q), 300);
});
searchInput.addEventListener('keydown', e => {
  if(e.key==='Enter') { hideSugg(); const q=searchInput.value.trim(); if(q) fetchWeather(q); }
});
document.addEventListener('click', e => { if(!e.target.closest('.search-box')) hideSugg(); });

async function fetchSugg(q) {
  try {
    const r = await fetch(`${BASE}/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${API_KEY}`);
    const d = await r.json();
    if(!Array.isArray(d)||!d.length) { hideSugg(); return; }
    suggestions.innerHTML = d.map(c=>`
      <div class="suggestion-item" data-lat="${c.lat}" data-lon="${c.lon}" data-name="${c.name}">
        <i class="fas fa-location-dot" style="color:var(--accent);margin-right:8px;font-size:0.8rem;"></i>
        ${c.name}${c.state?', '+c.state:''}, ${c.country}
      </div>`).join('');
    suggestions.classList.add('show');
    suggestions.querySelectorAll('.suggestion-item').forEach(el => {
      el.addEventListener('click', () => {
        searchInput.value = el.dataset.name; hideSugg();
        fetchWeatherByCoords(el.dataset.lat, el.dataset.lon, el.dataset.name);
      });
    });
  } catch { hideSugg(); }
}
function hideSugg() { suggestions.classList.remove('show'); suggestions.innerHTML=''; }

// ══════════════════════════════════════════════════════
// GEOLOCATION
// ══════════════════════════════════════════════════════
$('locBtn').addEventListener('click', () => {
  if(!navigator.geolocation) { showToast('Geolocation not supported','error'); return; }
  showLoader();
  navigator.geolocation.getCurrentPosition(
    p => fetchWeatherByCoords(p.coords.latitude, p.coords.longitude),
    _ => { hideLoader(); showToast('Location access denied','error'); }
  );
});

// ══════════════════════════════════════════════════════
// FETCH WEATHER
// ══════════════════════════════════════════════════════
async function fetchWeather(city) {
  showLoader();
  try {
    const gr = await fetch(`${BASE}/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`);
    const gd = await gr.json();
    if(!gd.length) { showToast('City not found','error'); hideLoader(); return; }
    await fetchWeatherByCoords(gd[0].lat, gd[0].lon, gd[0].name);
  } catch(e) { console.error(e); showToast('Network error','error'); hideLoader(); }
}

async function fetchWeatherByCoords(lat, lon, nameOverride) {
  showLoader();
  try {
    const [cr, fr, ar] = await Promise.all([
      fetch(`${BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&units=${unit}&appid=${API_KEY}`),
      fetch(`${BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${unit}&cnt=40&appid=${API_KEY}`),
      fetch(`${BASE}/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
    ]);
    const [cur, fore, aqi] = await Promise.all([cr.json(), fr.json(), ar.json()]);
    if(cur.cod!==200) { showToast(cur.message||'Error','error'); hideLoader(); return; }

    currentCity = nameOverride || cur.name;
    currentLat  = lat; currentLon = lon;
    currentData = cur; forecastData = fore;

    addHistory(currentCity);
    updateHero(cur);
    updateStats(cur);
    updateSun(cur);
    updateHourly(fore);
    updateWeekly(fore);
    updateRainChart(fore);
    updateTrendChart(fore, activeTrendGraph);
    updateAQI(aqi);
    updateBg(cur.weather[0].main.toLowerCase());
    updateMapCenter(lat, lon);
    checkAlerts(cur, fore);
    updatePinnedTabTemp(currentCity, Math.round(cur.main.temp));

    hideLoader();
    showToast(`Updated: ${currentCity}`, 'success');
  } catch(e) { console.error(e); showToast('Network error','error'); hideLoader(); }
}

// ══════════════════════════════════════════════════════
// UPDATE UI SECTIONS
// ══════════════════════════════════════════════════════

// ── Hero ──────────────────────────────────────────────
function updateHero(d) {
  $('cityName').textContent    = currentCity;
  $('countryCode').textContent = d.sys.country;
  $('dateLine').textContent    = formatDate(new Date());
  $('mainTemp').textContent    = Math.round(d.main.temp);
  $('degUnit').textContent     = unit==='metric'?'°C':'°F';
  $('weatherDesc').textContent = d.weather[0].description;
  $('feelsLike').textContent   = Math.round(d.main.feels_like)+(unit==='metric'?'°C':'°F');
  $('highLow').textContent     = `H:${Math.round(d.main.temp_max)}° L:${Math.round(d.main.temp_min)}°`;
  $('bigIcon').textContent     = getEmoji(d.weather[0].id, d.weather[0].icon);
  document.title = `${Math.round(d.main.temp)}° ${currentCity} — Aether`;
}

// ── Stats ─────────────────────────────────────────────
function updateStats(d) {
  const hum = d.main.humidity;
  $('humidity').textContent  = hum+'%';
  $('humidityBar').style.width = hum+'%';

  const ws = unit==='metric' ? Math.round(d.wind.speed*3.6) : Math.round(d.wind.speed);
  $('windSpeed').textContent = ws+(unit==='metric'?' km/h':' mph');
  $('windDir').textContent   = degToCompass(d.wind.deg||0);
  $('compassNeedle').style.transform = `translate(-50%,-100%) rotate(${d.wind.deg||0}deg)`;

  $('pressure').textContent = d.main.pressure+' hPa';
  const pn = Math.min((d.main.pressure-970)/(1040-970),1);
  $('pressurePath').style.strokeDashoffset = 120-pn*120;

  const vis = unit==='metric'
    ? (d.visibility/1000).toFixed(1)+' km'
    : ((d.visibility/1000)*0.621).toFixed(1)+' mi';
  $('visibility').textContent = vis;

  const uv = estimateUV(d.clouds.all, new Date().getHours());
  $('uvIndex').textContent = uv;
  const uvEl = $('uvLabel');
  if(uv<=2)       { uvEl.textContent='Low';       uvEl.style.cssText='color:#43e97b;background:rgba(67,233,123,0.12);padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:600;'; }
  else if(uv<=5)  { uvEl.textContent='Moderate';  uvEl.style.cssText='color:#ffd60a;background:rgba(255,214,10,0.12);padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:600;'; }
  else if(uv<=7)  { uvEl.textContent='High';      uvEl.style.cssText='color:#fd7c3c;background:rgba(253,124,60,0.12);padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:600;'; }
  else if(uv<=10) { uvEl.textContent='Very High'; uvEl.style.cssText='color:#f033ab;background:rgba(240,51,171,0.12);padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:600;'; }
  else            { uvEl.textContent='Extreme';   uvEl.style.cssText='color:#c026d3;background:rgba(192,38,211,0.12);padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:600;'; }

  const rp = d.rain ? Math.min(Math.round((d.rain['1h']||0)/10*100),100) : 0;
  $('rainProb').textContent  = rp+'%';
  $('rainBar').style.width   = rp+'%';
}

// ── Sun ───────────────────────────────────────────────
function updateSun(d) {
  const rise=new Date(d.sys.sunrise*1000), set=new Date(d.sys.sunset*1000), now=new Date();
  $('sunriseTime').textContent = formatTime(rise);
  $('sunsetTime').textContent  = formatTime(set);
  const total=set-rise, elapsed=Math.min(Math.max(now-rise,0),total);
  const prog = total>0?elapsed/total:0;
  $('sunPath').style.strokeDashoffset = 450-prog*450;
  const b = bezier(20,150,-50,-10,300,300,280,150,prog);
  $('sunBall').setAttribute('cx',b.x.toFixed(1));
  $('sunBall').setAttribute('cy',b.y.toFixed(1));
}

// ── Hourly ────────────────────────────────────────────
function updateHourly(fore) {
  const items = fore.list.slice(0,8);
  $('hourlyScroll').innerHTML = items.map((h,i)=>`
    <div class="hourly-item ${i===0?'current-hour':''}" data-idx="${i}">
      <span class="hourly-time">${i===0?'Now':formatHour(new Date(h.dt*1000))}</span>
      <span class="hourly-icon">${getEmoji(h.weather[0].id,h.weather[0].icon)}</span>
      <span class="hourly-temp">${Math.round(h.main.temp)}°</span>
      <span class="hourly-rain">${Math.round((h.pop||0)*100)}%</span>
    </div>`).join('');

  $('hourlyScroll').querySelectorAll('.hourly-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      const h   = fore.list[idx];
      if(activeHourlyIdx===idx) {
        // collapse
        activeHourlyIdx=null;
        el.classList.remove('active');
        $('hourlyDetailPanel').classList.add('hidden');
        return;
      }
      // expand
      activeHourlyIdx=idx;
      $('hourlyScroll').querySelectorAll('.hourly-item').forEach(e=>e.classList.remove('active'));
      el.classList.add('active');
      showHourlyDetail(h);
    });
  });
}

function showHourlyDetail(h) {
  const ws = unit==='metric'?Math.round(h.wind.speed*3.6)+'km/h':Math.round(h.wind.speed)+'mph';
  $('hourlyDetailInner').innerHTML = `
    <div class="hdp-item"><i class="fas fa-droplet"></i><div><div class="hdp-label">Humidity</div><div class="hdp-val">${h.main.humidity}%</div></div></div>
    <div class="hdp-item"><i class="fas fa-wind"></i><div><div class="hdp-label">Wind</div><div class="hdp-val">${ws}</div></div></div>
    <div class="hdp-item"><i class="fas fa-temperature-half"></i><div><div class="hdp-label">Feels Like</div><div class="hdp-val">${Math.round(h.main.feels_like)}°</div></div></div>
    <div class="hdp-item"><i class="fas fa-gauge-high"></i><div><div class="hdp-label">Pressure</div><div class="hdp-val">${h.main.pressure} hPa</div></div></div>
    <div class="hdp-item"><i class="fas fa-cloud-rain"></i><div><div class="hdp-label">Rain Prob.</div><div class="hdp-val">${Math.round((h.pop||0)*100)}%</div></div></div>
    <div class="hdp-item"><i class="fas fa-cloud"></i><div><div class="hdp-label">Clouds</div><div class="hdp-val">${h.clouds.all}%</div></div></div>`;
  $('hourlyDetailPanel').classList.remove('hidden');
}

// ── Weekly ────────────────────────────────────────────
function updateWeekly(fore) {
  const days={};
  fore.list.forEach(h=>{
    const k=new Date(h.dt*1000).toDateString();
    if(!days[k]) days[k]={temps:[],pops:[],icons:[],descs:[],hours:[]};
    days[k].temps.push(h.main.temp); days[k].pops.push(h.pop||0);
    days[k].icons.push(h.weather[0]); days[k].descs.push(h.weather[0].description);
    days[k].hours.push(h);
  });
  const keys=Object.keys(days).slice(0,7);
  const allT=keys.flatMap(k=>days[k].temps);
  const tMin=Math.min(...allT), tMax=Math.max(...allT), tRange=tMax-tMin||1;

  $('weeklyList').innerHTML = keys.map(k=>{
    const day=days[k];
    const hi=Math.round(Math.max(...day.temps)), lo=Math.round(Math.min(...day.temps));
    const pop=Math.round(Math.max(...day.pops)*100);
    const icon=day.icons[Math.floor(day.icons.length/2)];
    const desc=day.descs[Math.floor(day.descs.length/2)];
    const barL=((lo-tMin)/tRange)*100, barW=((hi-lo)/tRange)*100;
    const date=new Date(k);
    const dayN=date.toDateString()===new Date().toDateString()?'Today':date.toLocaleDateString('en',{weekday:'short'});
    return `<div class="weekly-item" data-daykey="${k}">
      <span class="weekly-day">${dayN}</span>
      <span class="weekly-icon">${getEmoji(icon.id,icon.icon)}</span>
      <span class="weekly-desc">${desc}</span>
      <span class="weekly-rain-prob">${pop}%</span>
      <div class="weekly-temp-bar"><div class="weekly-temp-fill" style="left:${barL}%;width:${Math.max(barW,8)}%"></div></div>
      <div class="weekly-temps"><span class="weekly-high">${hi}°</span><span class="weekly-low">${lo}°</span></div>
    </div>`;
  }).join('');

  $('weeklyList').querySelectorAll('.weekly-item').forEach(el=>{
    el.addEventListener('click', ()=>{
      const k=el.dataset.daykey;
      if(activeDayKey===k){
        activeDayKey=null; el.classList.remove('active');
        $('dayDetailPanel').classList.add('hidden'); return;
      }
      activeDayKey=k;
      $('weeklyList').querySelectorAll('.weekly-item').forEach(e=>e.classList.remove('active'));
      el.classList.add('active');
      showDayDetail(k, days[k].hours, new Date(k));
    });
  });
}

function showDayDetail(key, hours, date) {
  const dayName = date.toDateString()===new Date().toDateString()?'Today':date.toLocaleDateString('en',{weekday:'long',month:'short',day:'numeric'});
  $('ddpTitle').textContent = `${dayName} — Hourly Breakdown`;
  $('dayHourlyScroll').innerHTML = hours.map(h=>`
    <div class="hourly-item" style="cursor:default;">
      <span class="hourly-time">${formatHour(new Date(h.dt*1000))}</span>
      <span class="hourly-icon">${getEmoji(h.weather[0].id,h.weather[0].icon)}</span>
      <span class="hourly-temp">${Math.round(h.main.temp)}°</span>
      <span class="hourly-rain">${Math.round((h.pop||0)*100)}%</span>
    </div>`).join('');
  $('dayDetailPanel').classList.remove('hidden');
}

// ── Rain Chart ────────────────────────────────────────
function updateRainChart(fore) {
  const items=fore.list.slice(0,12);
  const labels=items.map(h=>formatHour(new Date(h.dt*1000)));
  const data=items.map(h=>Math.round((h.pop||0)*100));
  const dark=document.documentElement.getAttribute('data-theme')!=='light';
  const tc=dark?'rgba(240,244,255,0.45)':'rgba(13,27,42,0.45)';
  if(!window.Chart){ loadChart(()=>drawRainChart(labels,data,tc)); return; }
  drawRainChart(labels,data,tc);
}

function loadChart(cb) {
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  s.onload=cb; document.head.appendChild(s);
}

function drawRainChart(labels,data,tc) {
  const c=$('rainChart');
  if(rainChart) rainChart.destroy();
  rainChart=new Chart(c,{
    type:'bar',
    data:{ labels, datasets:[{ label:'Rain %', data,
      backgroundColor:data.map(v=>`rgba(79,172,254,${0.2+v/100*0.65})`),
      borderColor:'rgba(79,172,254,0.8)', borderWidth:1, borderRadius:6, borderSkipped:false }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>`${c.raw}%`}} },
      scales:{
        x:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:tc,font:{family:"'Exo 2'"}} },
        y:{ min:0, max:100, grid:{color:'rgba(255,255,255,0.04)'},
          ticks:{color:tc,font:{family:"'Exo 2'"},callback:v=>v+'%'} }
      }}
  });
}

// ── Trend Chart ───────────────────────────────────────
function updateTrendChart(fore, type) {
  const items = fore.list.slice(0,12);
  const labels = items.map(h=>formatHour(new Date(h.dt*1000)));
  const dark = document.documentElement.getAttribute('data-theme')!=='light';
  const tc = dark?'rgba(240,244,255,0.45)':'rgba(13,27,42,0.45)';

  let data, label, color, yLabel;
  switch(type) {
    case 'humidity':
      data=items.map(h=>h.main.humidity); label='Humidity %'; color='#4facfe'; yLabel='%'; break;
    case 'pressure':
      data=items.map(h=>h.main.pressure); label='Pressure hPa'; color='#f093fb'; yLabel='hPa'; break;
    case 'wind':
      data=items.map(h=>unit==='metric'?Math.round(h.wind.speed*3.6):Math.round(h.wind.speed));
      label=unit==='metric'?'Wind km/h':'Wind mph'; color='#43e97b'; yLabel=unit==='metric'?'km/h':'mph'; break;
    default:
      data=items.map(h=>Math.round(h.main.temp)); label='Temperature °'; color='#fda085'; yLabel='°';
  }

  if(!window.Chart){ loadChart(()=>drawTrendChart(labels,data,label,color,tc,yLabel)); return; }
  drawTrendChart(labels,data,label,color,tc,yLabel);
}

function drawTrendChart(labels,data,label,color,tc,yLabel) {
  const c=$('trendChart');
  if(trendChart) trendChart.destroy();
  trendChart=new Chart(c,{
    type:'line',
    data:{ labels, datasets:[{ label, data,
      borderColor:color, backgroundColor:color.replace(')',',0.1)').replace('rgb','rgba'),
      borderWidth:2.5, pointBackgroundColor:color, pointRadius:4, pointHoverRadius:6,
      tension:0.4, fill:true }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>`${c.raw}${yLabel}`}} },
      scales:{
        x:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:tc,font:{family:"'Exo 2'"},maxTicksLimit:6} },
        y:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:tc,font:{family:"'Exo 2'"},callback:v=>`${v}${yLabel}`} }
      }}
  });
}

// Trend graph tab clicks
document.querySelectorAll('.graph-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.graph-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    activeTrendGraph=btn.dataset.graph;
    if(forecastData) updateTrendChart(forecastData, activeTrendGraph);
  });
});

// ── AQI ───────────────────────────────────────────────
function updateAQI(aqiData) {
  if(!aqiData?.list?.length) return;
  const item=aqiData.list[0], aqi=item.main.aqi;
  const labels=['','Good','Fair','Moderate','Poor','Very Poor'];
  const colors=['','#43e97b','#f9ca24','#fd7c3c','#e84393','#8b0000'];
  $('aqiNum').textContent=aqi; $('aqiLabel').textContent=labels[aqi]; $('aqiLabel').style.color=colors[aqi];
  $('aqiCircle').style.strokeDashoffset=201-((aqi-1)/4)*201;
  const c=item.components;
  $('aqiPollutants').innerHTML=[
    {name:'PM2.5',val:c.pm2_5?.toFixed(1)},{name:'PM10',val:c.pm10?.toFixed(1)},
    {name:'NO₂',val:c.no2?.toFixed(1)},{name:'O₃',val:c.o3?.toFixed(1)},
    {name:'CO',val:(c.co/1000)?.toFixed(2)+'k'},{name:'SO₂',val:c.so2?.toFixed(1)}
  ].map(p=>`<div class="pollutant-item"><span class="pollutant-name">${p.name}</span><span class="pollutant-val">${p.val??'--'}</span></div>`).join('');
}

// listen from service worker
navigator.serviceWorker.addEventListener("message", e => {

  if (e.data.type === "SAVE_WEATHER") {
    localStorage.setItem("lastWeather", JSON.stringify(e.data.payload));
  }

  if (e.data.type === "OFFLINE") {
    document.getElementById("offlineBadge").style.display = "block";

    const cached = localStorage.getItem("lastWeather");
    if (cached) {
      const data = JSON.parse(cached);
      renderWeather(data); // your existing function
    }
  }
});

// ── Background ────────────────────────────────────────
const wClasses=['weather-clear','weather-clouds','weather-rain','weather-storm','weather-snow','weather-mist'];
function updateBg(main) {
  let t='clear';
  if(/thunderstorm/.test(main)) t='storm';
  else if(/drizzle|rain/.test(main)) t='rain';
  else if(/snow|sleet|hail/.test(main)) t='snow';
  else if(/mist|fog|haze|smoke|dust|sand|ash|squall/.test(main)) t='mist';
  else if(/cloud/.test(main)) t='clouds';
  document.body.classList.remove(...wClasses);
  document.body.classList.add(`weather-${t}`);
  setWeatherAnimation(t);
  if(t==='storm'||t==='thunderstorm') maybeFlash();
}

// ══════════════════════════════════════════════════════
// WEATHER MAP (Leaflet)
// ══════════════════════════════════════════════════════
function initMap(lat, lon) {
  if(weatherMap) { weatherMap.remove(); weatherMap=null; }
  weatherMap = L.map('weatherMap', { zoomControl:true, attributionControl:false }).setView([lat,lon],7);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
    maxZoom:19, subdomains:'abcd'
  }).addTo(weatherMap);
  setMapLayer(activeMapLayer);
  L.circleMarker([lat,lon],{
    radius:8, fillColor:'#4facfe', color:'#fff', weight:2, fillOpacity:0.9
  }).addTo(weatherMap).bindPopup(`<b>${currentCity}</b>`).openPopup();
}

function setMapLayer(layer) {
  if(mapLayer) weatherMap.removeLayer(mapLayer);
  mapLayer = L.tileLayer(
    `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${API_KEY}`,
    { opacity:0.7, maxZoom:19 }
  ).addTo(weatherMap);
}

function updateMapCenter(lat, lon) {
  if(!weatherMap) { initMap(lat,lon); return; }
  weatherMap.setView([lat,lon],7);
  setMapLayer(activeMapLayer);
}

document.querySelectorAll('.map-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.map-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    activeMapLayer=btn.dataset.layer;
    if(weatherMap) setMapLayer(activeMapLayer);
  });
});

// ══════════════════════════════════════════════════════
// STAT MODAL
// ══════════════════════════════════════════════════════
const statInfo = {
  humidity: {
    icon:'💧', title:'Humidity',
    desc:'Humidity is the amount of water vapour in the air. High humidity makes heat feel worse and can indicate rain is coming.',
    context: (d) => [
      { label:'Current',   val: d.main.humidity+'%' },
      { label:'Comfort Zone', val: '30–60%' },
      { label:'Feels like', val: d.main.humidity>70?'Muggy':'Comfortable' },
      { label:'Dew Point',  val: calcDewPoint(d.main.temp, d.main.humidity).toFixed(1)+'°' }
    ]
  },
  wind: {
    icon:'💨', title:'Wind',
    desc:'Wind speed and direction affect how temperature feels (wind chill). Strong winds can indicate incoming weather changes.',
    context: (d) => {
      const ws=unit==='metric'?Math.round(d.wind.speed*3.6):Math.round(d.wind.speed);
      const bft=beaufort(ws);
      return [
        { label:'Speed',    val: ws+(unit==='metric'?' km/h':' mph') },
        { label:'Direction',val: degToCompass(d.wind.deg||0)+` (${d.wind.deg||0}°)` },
        { label:'Beaufort', val: bft.scale+' — '+bft.desc },
        { label:'Gust',     val: d.wind.gust ? Math.round(d.wind.gust*(unit==='metric'?3.6:1))+(unit==='metric'?' km/h':' mph') : 'No data' }
      ];
    }
  },
  pressure: {
    icon:'🌡️', title:'Pressure',
    desc:'Atmospheric pressure affects weather patterns. Falling pressure usually means storm/rain coming. Rising pressure means clearing up.',
    context: (d) => [
      { label:'Current',   val: d.main.pressure+' hPa' },
      { label:'Sea Level', val: d.main.sea_level ? d.main.sea_level+' hPa' : 'N/A' },
      { label:'Condition', val: d.main.pressure>1013?'High — Stable':'Low — Unstable' },
      { label:'Normal',    val: '1013 hPa' }
    ]
  },
  visibility: {
    icon:'👁️', title:'Visibility',
    desc:'Visibility is how far you can clearly see. It\'s reduced by fog, rain, smoke, or haze. Below 1km is considered foggy.',
    context: (d) => {
      const km=(d.visibility/1000).toFixed(1);
      const cond=km>8?'Clear':km>4?'Moderate':km>1?'Poor':'Very Poor (Fog)';
      return [
        { label:'Distance', val: km+' km' },
        { label:'Condition',val: cond },
        { label:'Max Possible',val: '10 km' },
        { label:'Driving',  val: km<1?'Hazardous':km<4?'Caution':'Safe' }
      ];
    }
  },
  uv: {
    icon:'☀️', title:'UV Index',
    desc:'UV Index measures ultraviolet radiation intensity. High UV can cause sunburn in minutes. Always use SPF 30+ when UV is 3 or above.',
    context: (d) => {
      const uv=estimateUV(d.clouds.all, new Date().getHours());
      const spf=uv<=2?'None needed':uv<=5?'SPF 15+':uv<=7?'SPF 30+':uv<=10?'SPF 50+':'Stay indoors';
      const time=uv<=2?'Safe all day':uv<=5?'Limit noon exposure':uv<=7?'10am-4pm risky':uv<=10?'Avoid midday':'Avoid outdoors';
      return [
        { label:'Index',      val: uv },
        { label:'Category',   val: uv<=2?'Low':uv<=5?'Moderate':uv<=7?'High':uv<=10?'Very High':'Extreme' },
        { label:'Protection', val: spf },
        { label:'Outdoors',   val: time }
      ];
    }
  },
  rain: {
    icon:'🌧️', title:'Precipitation',
    desc:'Rain probability is the likelihood of measurable rainfall in the current hour. Over 70% means you should carry an umbrella.',
    context: (d) => {
      const r=d.rain?d.rain['1h']||0:0;
      return [
        { label:'Last 1h',    val: r.toFixed(1)+' mm' },
        { label:'Intensity',  val: r===0?'None':r<2.5?'Light':r<10?'Moderate':'Heavy' },
        { label:'Umbrella',   val: r>0||d.main.humidity>80?'Yes 🌂':'Not needed' },
        { label:'Flood Risk', val: r>30?'High':r>10?'Moderate':'Low' }
      ];
    }
  }
};

document.querySelectorAll('.stat-item.clickable').forEach(el=>{
  el.addEventListener('click',()=>{
    const key=el.dataset.stat;
    if(!currentData||!statInfo[key]) return;
    const info=statInfo[key];
    $('statModalIcon').textContent=info.icon;
    $('statModalTitle').textContent=info.title;
    $('statModalDesc').textContent=info.desc;
    const ctx=info.context(currentData);
    $('statModalValue').textContent=el.querySelector('.stat-val').textContent;
    $('statModalContext').innerHTML=ctx.map(c=>`
      <div class="modal-context-item">
        <span class="modal-context-label">${c.label}</span>
        <span class="modal-context-val">${c.val}</span>
      </div>`).join('');
    statModal.classList.remove('hidden');
  });
});

$('statModalClose').addEventListener('click',()=>statModal.classList.add('hidden'));
statModal.addEventListener('click',e=>{ if(e.target===statModal) statModal.classList.add('hidden'); });

// ══════════════════════════════════════════════════════
// ALERT SYSTEM
// ══════════════════════════════════════════════════════
function checkAlerts(cur, fore) {
  const alerts=[];
  const wid=cur.weather[0].id;
  if(wid>=200&&wid<300) alerts.push('⛈️ Thunderstorm currently — stay indoors!');
  if(cur.wind.speed*3.6>60) alerts.push('💨 Strong winds detected ('+Math.round(cur.wind.speed*3.6)+' km/h)');
  if(cur.main.temp>40)  alerts.push('🌡️ Extreme heat warning: '+Math.round(cur.main.temp)+'°');
  if(cur.main.temp<-10) alerts.push('🥶 Extreme cold warning: '+Math.round(cur.main.temp)+'°');
  const nextRain=fore.list.slice(0,4).find(h=>(h.pop||0)>0.7);
  if(nextRain) alerts.push('🌧️ Heavy rain expected around '+formatHour(new Date(nextRain.dt*1000)));

  if(alerts.length) {
    $('alertText').textContent=alerts[0];
    alertBanner.classList.remove('hidden');
  } else {
    alertBanner.classList.add('hidden');
  }
}

$('alertClose').addEventListener('click',()=>alertBanner.classList.add('hidden'));

// ══════════════════════════════════════════════════════
// PINNED CITIES
// ══════════════════════════════════════════════════════
function renderCityTabs() {
  const tabs=$('cityTabs');
  tabs.innerHTML=pinnedCities.map(c=>`
    <div class="city-tab ${c.name===currentCity?'active':''}" data-name="${c.name}">
      <span>${c.name}</span>
      <span class="city-tab-temp">${c.temp!==null?c.temp+'°':''}</span>
      <span class="tab-remove" data-rm="${c.name}">✕</span>
    </div>`).join('');

  tabs.querySelectorAll('.city-tab').forEach(el=>{
    el.addEventListener('click',e=>{
      if(e.target.classList.contains('tab-remove')) {
        pinnedCities=pinnedCities.filter(c=>c.name!==e.target.dataset.rm);
        localStorage.setItem('wPinned',JSON.stringify(pinnedCities));
        renderCityTabs(); return;
      }
      fetchWeather(el.dataset.name);
      searchInput.value=el.dataset.name;
    });
  });
}

$('addCityBtn').addEventListener('click',()=>{
  if(!currentCity) { showToast('Search a city first','warning'); return; }
  if(pinnedCities.find(c=>c.name===currentCity)) { showToast('Already pinned!','warning'); return; }
  if(pinnedCities.length>=8) { showToast('Max 8 pinned cities','warning'); return; }
  pinnedCities.push({ name:currentCity, temp: currentData?Math.round(currentData.main.temp):null });
  localStorage.setItem('wPinned',JSON.stringify(pinnedCities));
  renderCityTabs();
  showToast(`📌 Pinned ${currentCity}`,'success');
});

function updatePinnedTabTemp(city, temp) {
  const pin=pinnedCities.find(c=>c.name===city);
  if(pin) { pin.temp=temp; localStorage.setItem('wPinned',JSON.stringify(pinnedCities)); }
  renderCityTabs();
}

// ══════════════════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════════════════
function addHistory(city) {
  history=[city,...history.filter(c=>c!==city)].slice(0,8);
  localStorage.setItem('wHistory',JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const el=$('historyChips');
  el.innerHTML=history.length
    ? history.map(c=>`<div class="history-chip" data-city="${c}">
        <i class="fas fa-city"></i><span>${c}</span>
        <i class="fas fa-xmark chip-remove" data-rm="${c}"></i>
      </div>`).join('')
    : '<span style="color:var(--text-muted);font-size:0.85rem;">No recent searches</span>';
  el.querySelectorAll('.history-chip').forEach(chip=>{
    chip.addEventListener('click',e=>{
      if(e.target.classList.contains('chip-remove')) {
        e.stopPropagation();
        history=history.filter(c=>c!==chip.dataset.city);
        localStorage.setItem('wHistory',JSON.stringify(history));
        renderHistory(); return;
      }
      fetchWeather(chip.dataset.city);
      searchInput.value=chip.dataset.city;
    });
  });
}

// ══════════════════════════════════════════════════════
// UNIT TOGGLE
// ══════════════════════════════════════════════════════
$('unitToggle').addEventListener('click',()=>{
  unit=unit==='metric'?'imperial':'metric';
  $('unitToggle').textContent=unit==='metric'?'°C / °F':'°F / °C';
  if(currentCity) fetchWeather(currentCity);
});

// ══════════════════════════════════════════════════════
// THEME TOGGLE
// ══════════════════════════════════════════════════════
$('themeBtn').addEventListener('click',()=>{
  const cur=document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme',cur==='dark'?'light':'dark');
});

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════
function formatDate(d) { return d.toLocaleDateString('en',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }
function formatTime(d) { return d.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'}); }
function formatHour(d) { return d.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit',hour12:false}); }

function degToCompass(deg) {
  const dirs=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg/22.5)%16];
}

function getEmoji(id, icon) {
  const n=icon?.includes('n');
  if(id>=200&&id<300) return '⛈️';
  if(id>=300&&id<400) return '🌦️';
  if(id>=500&&id<510) return '🌧️';
  if(id===511)        return '🌨️';
  if(id>=520&&id<600) return '🌧️';
  if(id>=600&&id<700) return '❄️';
  if(id===701)        return '🌫️';
  if(id===711)        return '💨';
  if(id===721)        return '🌤️';
  if(id>=700&&id<800) return '🌫️';
  if(id===800)        return n?'🌙':'☀️';
  if(id===801)        return n?'🌙':'🌤️';
  if(id===802)        return '⛅';
  if(id>=803)         return '☁️';
  return '🌡️';
}

function estimateUV(clouds, hour) {
  if(hour<6||hour>20) return 0;
  const t=Math.abs(hour-12)/6;
  return Math.max(0,Math.round(9*(1-t*t)*(1-clouds/100*0.6)));
}

function calcDewPoint(temp, hum) {
  const a=17.27, b=237.7;
  const gamma=(a*temp/(b+temp))+Math.log(hum/100);
  return (b*gamma)/(a-gamma);
}

function beaufort(kmh) {
  if(kmh<1)   return {scale:0,desc:'Calm'};
  if(kmh<6)   return {scale:1,desc:'Light Air'};
  if(kmh<12)  return {scale:2,desc:'Light Breeze'};
  if(kmh<20)  return {scale:3,desc:'Gentle Breeze'};
  if(kmh<29)  return {scale:4,desc:'Moderate Breeze'};
  if(kmh<39)  return {scale:5,desc:'Fresh Breeze'};
  if(kmh<50)  return {scale:6,desc:'Strong Breeze'};
  if(kmh<62)  return {scale:7,desc:'Near Gale'};
  if(kmh<75)  return {scale:8,desc:'Gale'};
  if(kmh<89)  return {scale:9,desc:'Strong Gale'};
  if(kmh<103) return {scale:10,desc:'Storm'};
  if(kmh<118) return {scale:11,desc:'Violent Storm'};
  return {scale:12,desc:'Hurricane'};
}

function bezier(x0,y0,x1,y1,x2,y2,x3,y3,t) {
  const u=1-t;
  return { x:u*u*u*x0+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3, y:u*u*u*y0+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3 };
}

function showLoader() { loader.classList.remove('hidden'); }
function hideLoader() { loader.classList.add('hidden'); }

let toastTimer;
function showToast(msg,type='') {
  toast.textContent=msg; toast.className='toast show '+type;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),3000);
}

// ══════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════
renderHistory();
renderCityTabs();
const startCity = history[0]||'New Delhi';
fetchWeather(startCity);
if(history.length) searchInput.value=startCity;
