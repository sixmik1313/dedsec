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

/* ---------- PROFILEUR (INTERPOL, appel direct navigateur) ---------- */
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
  log(`Requete INTERPOL (${profType}, pays=${country}${name ? ', nom='+name : ''})...`);
  try{
    let url = `https://ws-public.interpol.int/notices/v1/${profType}?resultPerPage=8`;
    url += profType === 'red' ? `&arrestWarrantCountryId=${country}` : `&nationality=${country}`;
    if(name) url += '&name=' + encodeURIComponent(name);
    const res = await fetch(url);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const notices = (data._embedded && data._embedded.notices) || [];
    log(`Reponse INTERPOL recue — ${notices.length} avis.`);
    if(notices.length === 0){
      box.innerHTML = '<p class="hint">Aucun avis correspondant actuellement publie par INTERPOL pour ce filtre.</p>';
      return;
    }
    box.innerHTML = '<div class="card-list">' + notices.map(n=>{
      const fullName = [n.forename, n.name].filter(Boolean).join(' ') || 'Identite non communiquee';
      const nat = (n.nationalities && n.nationalities.length) ? n.nationalities.join(', ') : '\u2014';
      const dob = n.date_of_birth || '\u2014';
      const link = (n._links && n._links.self) ? n._links.self.href : '#';
      return `<div class="wanted-card">
        <div>
          <div class="name">${fullName}</div>
          <div class="meta">Nationalite(s) : ${nat} \u00b7 Ne(e) le ${dob}</div>
        </div>
        <a href="${link}" target="_blank" rel="noopener">Fiche INTERPOL</a>
      </div>`;
    }).join('') + '</div>';
  }catch(e){
    log('Echec de la requete INTERPOL : ' + e.message, true);
    box.innerHTML = `<div class="errbox">Impossible de joindre l'API INTERPOL depuis ce navigateur (${e.message}). Consultez directement <a href="https://www.interpol.int/en/How-we-work/Notices/View-Red-Notices" target="_blank" rel="noopener" style="color:var(--red)">les avis sur interpol.int</a>.</div>`;
  }
}
document.getElementById('profSearchBtn').addEventListener('click', loadProfiler);

/* ---------- RESEAU (RTE eco2mix) ---------- */
async function loadReseau(){
  const box = document.getElementById('reseauResults');
  box.innerHTML = '<p class="hint"><span class="loading">chargement des donnees RTE...</span></p>';
  log('Requete API RTE / eco2mix...');
  try{
    const url = 'https://odre.opendatasoft.com/api/records/1.0/search/?dataset=eco2mix-national-tr&rows=1&sort=-date_heure';
    const res = await fetch(url);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const f = data.records && data.records[0] && data.records[0].fields;
    if(!f) throw new Error('champ vide');
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
    log('Echec de la requete RTE : ' + e.message, true);
    box.innerHTML = `<div class="errbox">Impossible de charger les donnees RTE (${e.message}). Consultez <a href="https://www.rte-france.com/eco2mix" target="_blank" rel="noopener" style="color:var(--red)">rte-france.com/eco2mix</a>.</div>`;
  }
}
document.getElementById('reseauBtn').addEventListener('click', loadReseau);

/* ---------- CAMERAS (Digitraffic, images directes) ---------- */
async function loadCameras(){
  const grid = document.getElementById('camGrid');
  grid.innerHTML = '<p class="hint"><span class="loading">chargement des cameras en direct...</span></p>';
  log('Requete API Digitraffic (cameras)...');
  try{
    const res = await fetch('https://tie.digitraffic.fi/api/weathercam/v1/stations', {
      headers: { 'Digitraffic-User': 'dedsec-terminal-static/1.0' }
    });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const features = data.features || [];
    const out = [];
    for(const f of features){
      const props = f.properties || {};
      if(props.state !== 'OK') continue;
      for(const p of (props.presets || [])){
        if(p.inCollection === false) continue;
        const id = p.presetId;
        if(!id) continue;
        out.push({ id, name: props.name || id, dir: p.presetName1 || '' });
        if(out.length >= 12) break;
      }
      if(out.length >= 12) break;
    }
    log(`Cameras recues — ${out.length} flux en direct.`);
    grid.innerHTML = out.map(c => `
      <div class="cam-card">
        <img src="https://weathercam.digitraffic.fi/${c.id}.jpg?t=${Date.now()}" alt="${c.name}" loading="lazy">
        <div class="cam-name">${c.name}</div>
        <div class="cam-src">${c.dir || 'Digitraffic'} \u00b7 ${c.id}</div>
      </div>
    `).join('');
  }catch(e){
    log('Echec de la requete cameras : ' + e.message, true);
    grid.innerHTML = `<div class="errbox">Impossible de charger les cameras (${e.message}). Voir <a href="https://www.digitraffic.fi/en/road-traffic/" target="_blank" rel="noopener" style="color:var(--red)">digitraffic.fi</a>.</div>`;
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

/* ---------- MARCHES (Frankfurter / BCE) ---------- */
async function loadFx(){
  const box = document.getElementById('fxResults');
  box.innerHTML = '<p class="hint"><span class="loading">chargement des taux BCE...</span></p>';
  log('Requete API Frankfurter (BCE)...');
  try{
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CHF,JPY,CAD');
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    log('Taux BCE recus — date ' + data.date);
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
log('Terminal initialise. Toutes les donnees sont issues de sources publiques reelles, appelees directement depuis ce navigateur.');
loadProfiler();
loadReseau();
loadFx();
loadCameras();
