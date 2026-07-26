/* ---------- CONSOLE LOG ---------- */
let logN = 0;
function log(text, isErr){
  logN++;
  document.getElementById('logCount').textContent = logN + " evenements";
  const el = document.getElementById('log');
  const p = document.createElement('p');
  if(isErr) p.className = 'err';
  const t = new Date().toLocaleTimeString('fr-FR');
  p.innerHTML = `<span class="tag2">[${t}]</span>${text}`;
  el.appendChild(p);
  el.scrollTop = el.scrollHeight;
}

/* ---------- CLOCK ---------- */
function tickClock(){
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('fr-FR');
}
setInterval(tickClock, 1000); tickClock();

/* ---------- NAV ---------- */
const heads = {
  profiler: ["Profileur — avis de recherche publics", "INTERPOL Notices API"],
  reseau: ["Reseau electrique — France en direct", "RTE eco2mix"],
  cameras: ["Cameras routieres en direct", "Digitraffic / Fintraffic (UE)"],
  signal: ["Signal — ouverture directe", "signal.me"],
  marches: ["Marches — taux de change reels", "Frankfurter / BCE"]
};
document.querySelectorAll('#navList li').forEach(li=>{
  li.addEventListener('click', ()=>{
    document.querySelectorAll('#navList li').forEach(x=>x.classList.remove('active'));
    li.classList.add('active');
    const target = li.dataset.target;
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    document.getElementById('sec-'+target).classList.add('active');
    const h = heads[target];
    document.getElementById('mainHead').innerHTML = h[0] + '<small>'+h[1]+'</small>';
  });
});

/* ---------- PROFILEUR ---------- */
let profType = 'red';
document.querySelectorAll('.tag').forEach(t=>{
  t.addEventListener('click', ()=>{
    document.querySelectorAll('.tag').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    profType = t.dataset.type;
  });
});

async function loadProfiler(){
  const box = document.getElementById('profResults');
  const name = document.getElementById('profNameFilter').value.trim();
  const country = (document.getElementById('profCountryFilter').value.trim() || 'FR').toUpperCase();
  box.innerHTML = '<p class="hint"><span class="loading">interrogation en cours...</span></p>';
  log(`Requete backend /api/wanted (type=${profType}, pays=${country}${name ? ', nom='+name : ''})...`);
  try{
    const url = `/api/wanted?type=${profType}&country=${encodeURIComponent(country)}${name ? '&name='+encodeURIComponent(name) : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    if(!data.ok) throw new Error(data.error || 'erreur inconnue');
    log(`Reponse INTERPOL recue via backend — ${data.count} avis.`);
    if(data.count === 0){
      box.innerHTML = '<p class="hint">Aucun avis correspondant actuellement publie par INTERPOL pour ce filtre.</p>';
      return;
    }
    box.innerHTML = '<div class="card-list">' + data.notices.map(n=>{
      const nat = (n.nationalities && n.nationalities.length) ? n.nationalities.join(', ') : '\u2014';
      return `<div class="wanted-card">
        <div>
          <div class="name">${n.name}</div>
          <div class="meta">Nationalite(s) : ${nat} \u00b7 Ne(e) le ${n.date_of_birth || '\u2014'}</div>
        </div>
        <a href="${n.link || '#'}" target="_blank" rel="noopener">Fiche INTERPOL</a>
      </div>`;
    }).join('') + '</div>';
  }catch(e){
    log('Echec de la requete profileur : ' + e.message, true);
    box.innerHTML = `<div class="errbox">Impossible de charger les avis (${e.message}). Verifiez que le backend Flask tourne bien.</div>`;
  }
}
document.getElementById('profSearchBtn').addEventListener('click', loadProfiler);

/* ---------- RESEAU ---------- */
async function loadReseau(){
  const box = document.getElementById('reseauResults');
  box.innerHTML = '<p class="hint"><span class="loading">chargement des donnees RTE...</span></p>';
  log('Requete backend /api/grid (RTE eco2mix)...');
  try{
    const res = await fetch('/api/grid');
    const data = await res.json();
    if(!data.ok) throw new Error(data.error || 'erreur inconnue');
    const f = data.fields;
    log('Donnees RTE recues — horodatage ' + f.date_heure);
    const filieres = [
      ['Nucleaire', f.nucleaire], ['Eolien', f.eolien], ['Solaire', f.solaire],
      ['Hydraulique', f.hydraulique], ['Gaz', f.gaz], ['Charbon', f.charbon],
      ['Fioul', f.fioul], ['Bioenergies', f.bioenergies]
    ];
    box.innerHTML = `
      <div class="bignum">
        <div><div class="v">${f.consommation ? Math.round(f.consommation).toLocaleString('fr-FR') : '\u2014'}</div><div class="k">Consommation (MW)</div></div>
        <div><div class="v">${f.taux_co2 ?? '\u2014'}</div><div class="k">CO2 (g/kWh)</div></div>
      </div>
      <p class="hint" style="margin-top:12px;">Horodatage RTE : ${f.date_heure || '\u2014'}</p>
      <div class="mix-grid">
        ${filieres.map(([k,v])=>`<div class="mix-item"><div class="k">${k}</div><div class="v">${v!=null? Math.round(v).toLocaleString('fr-FR') : '\u2014'} MW</div></div>`).join('')}
      </div>`;
  }catch(e){
    log('Echec de la requete reseau : ' + e.message, true);
    box.innerHTML = `<div class="errbox">Impossible de charger les donnees RTE (${e.message}).</div>`;
  }
}
document.getElementById('reseauBtn').addEventListener('click', loadReseau);

/* ---------- CAMERAS ---------- */
async function loadCameras(){
  const grid = document.getElementById('camGrid');
  grid.innerHTML = '<p class="hint"><span class="loading">chargement des cameras en direct...</span></p>';
  log('Requete backend /api/cameras (Digitraffic)...');
  try{
    const res = await fetch('/api/cameras?limit=12');
    const data = await res.json();
    if(!data.ok) throw new Error(data.error || 'erreur inconnue');
    log(`Cameras recues — ${data.count} flux en direct.`);
    grid.innerHTML = data.cameras.map(c => `
      <div class="cam-card">
        <img src="${c.image}?t=${Date.now()}" alt="${c.name}" loading="lazy">
        <div class="cam-name">${c.name}</div>
        <div class="cam-src">${c.direction || 'Digitraffic'} \u00b7 ${c.id}</div>
      </div>
    `).join('');
  }catch(e){
    log('Echec de la requete cameras : ' + e.message, true);
    grid.innerHTML = `<div class="errbox">Impossible de charger les cameras (${e.message}).</div>`;
  }
}
document.getElementById('camBtn').addEventListener('click', loadCameras);

/* ---------- SIGNAL ---------- */
document.getElementById('signalBtn').addEventListener('click', ()=>{
  const raw = document.getElementById('signalNumber').value.trim();
  const out = document.getElementById('signalOut');
  const cleaned = raw.replace(/[^\d+]/g, '');
  if(!cleaned.startsWith('+') || cleaned.length < 8){
    out.textContent = "Entrez un numero au format international, ex: +33612345678";
    return;
  }
  const url = `https://signal.me/#p/${cleaned}`;
  log('Ouverture du lien signal.me pour ' + cleaned);
  window.open(url, '_blank');
  out.innerHTML = `Lien ouvert : <a href="${url}" target="_blank" rel="noopener" style="color:var(--white)">${url}</a>`;
});

/* ---------- MARCHES ---------- */
async function loadFx(){
  const box = document.getElementById('fxResults');
  box.innerHTML = '<p class="hint"><span class="loading">chargement des taux BCE...</span></p>';
  log('Requete backend /api/fx (Frankfurter / BCE)...');
  try{
    const res = await fetch('/api/fx');
    const data = await res.json();
    if(!data.ok) throw new Error(data.error || 'erreur inconnue');
    log('Taux BCE recus — date de reference ' + data.date);
    box.innerHTML = `
      <p class="hint">1 EUR — taux de reference BCE du ${data.date}</p>
      <div class="fx-grid">
        ${Object.entries(data.rates).map(([k,v])=>`<div class="fx-item"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}
      </div>`;
  }catch(e){
    log('Echec de la requete marches : ' + e.message, true);
    box.innerHTML = `<div class="errbox">Impossible de charger les taux (${e.message}).</div>`;
  }
}
document.getElementById('fxBtn').addEventListener('click', loadFx);

/* ---------- REFRESH ALL ---------- */
document.getElementById('refreshAll').addEventListener('click', ()=>{
  loadProfiler(); loadReseau(); loadFx(); loadCameras();
});

/* ---------- INIT ---------- */
log('Terminal initialise. Toutes les donnees passent par le backend Flask et proviennent de sources publiques reelles.');
loadProfiler();
loadReseau();
loadFx();
loadCameras();
