// Auto-generated: serves public/agent.html inline (no filesystem dependency)
const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Two Travel · Sales</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root {
  --sand:#f7f4ef;--sand2:#efe9e0;--sand3:#e5ddd3;
  --ink:#1a1814;--ink2:#3d3a35;--ink3:#7a7570;
  --gold:#9a7d52;--gold2:#c4a272;--gold3:#e8d5b7;
  --white:#ffffff;
  --border:rgba(26,24,20,0.09);--border2:rgba(26,24,20,0.15);
  --green:#5cb87a;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:'Jost',sans-serif;background:var(--sand);color:var(--ink);font-weight:300}

#login-screen{position:fixed;inset:0;background:var(--white);display:flex;align-items:center;justify-content:center;z-index:100}
.login-box{width:320px;text-align:center}
.login-brand{font-family:'Cormorant Garamond',serif;font-size:30px;font-weight:400;letter-spacing:.06em;margin-bottom:4px}
.login-sub{font-size:10px;color:var(--ink3);letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px}
.demo-badge{display:inline-block;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);border:1px solid var(--gold3);padding:3px 10px;margin-bottom:28px;background:rgba(154,125,82,.05)}
.login-label{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);margin-bottom:10px}
.agent-btns{display:flex;flex-direction:column;gap:7px}
.agent-btn{padding:12px 16px;border:1px solid var(--border2);background:transparent;font-family:'Jost',sans-serif;font-size:13px;font-weight:400;color:var(--ink2);cursor:pointer;transition:all .12s;letter-spacing:.04em;display:flex;align-items:center;gap:12px}
.agent-btn:hover{background:var(--sand);border-color:var(--gold);color:var(--ink)}
.ag-av{width:28px;height:28px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:500;letter-spacing:.04em}

.app{display:grid;grid-template-columns:236px 254px 1fr;grid-template-rows:54px 1fr;height:100vh}
.header{grid-column:1/-1;background:var(--white);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 22px;gap:0}
.logo{font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:500;letter-spacing:.04em}
.hdiv{width:1px;height:14px;background:var(--border2);margin:0 13px}
.hls{font-size:10px;color:var(--ink3);letter-spacing:.12em;text-transform:uppercase}
.hright{margin-left:auto;display:flex;align-items:center;gap:14px}
.portfolio-badge{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--green);letter-spacing:.04em;border:1px solid rgba(92,184,122,.3);padding:4px 10px;background:rgba(92,184,122,.06)}
.online{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--ink3)}
.dot{width:5px;height:5px;border-radius:50%;background:var(--green)}
.agent-pill{display:flex;align-items:center;gap:7px;padding:4px 11px 4px 5px;border:1px solid var(--border2);font-size:11px;color:var(--ink2);cursor:pointer;transition:all .1s}
.agent-pill:hover{border-color:var(--gold);color:var(--gold)}
.lang-btn{padding:4px 10px;border:1px solid var(--border2);font-family:'Jost',sans-serif;font-size:10px;color:var(--ink3);cursor:pointer;background:transparent;letter-spacing:.08em;transition:all .1s}
.lang-btn:hover{border-color:var(--gold);color:var(--gold)}
.pill-av{width:22px;height:22px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:500}

.col-clients{background:var(--white);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
.col-hd{padding:14px 14px 10px;border-bottom:1px solid var(--border)}
.col-ttl{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);margin-bottom:9px}
.srch{width:100%;padding:7px 10px;background:var(--sand);border:1px solid var(--border);font-family:'Jost',sans-serif;font-size:12px;color:var(--ink);outline:none;transition:border .1s}
.srch:focus{border-color:var(--gold)}
.srch::placeholder{color:var(--ink3)}
.add-btn{width:100%;margin-top:7px;padding:7px;background:transparent;border:1px dashed var(--border2);font-family:'Jost',sans-serif;font-size:11px;color:var(--ink3);cursor:pointer;transition:all .1s;letter-spacing:.04em;display:flex;align-items:center;justify-content:center;gap:5px}
.add-btn:hover{border-color:var(--gold);color:var(--gold)}
.clist{flex:1;overflow-y:auto;padding:6px 0}
.clist::-webkit-scrollbar{width:3px}
.clist::-webkit-scrollbar-thumb{background:var(--sand3)}
.ci{padding:10px 14px;cursor:pointer;transition:background .1s;border-bottom:1px solid var(--border);position:relative}
.ci:hover{background:var(--sand)}
.ci.active{background:var(--sand);border-left:2px solid var(--gold);padding-left:12px}
.ci-name{font-size:13px;font-weight:400;color:var(--ink);margin-bottom:2px}
.ci-sub{font-size:10px;color:var(--ink3)}
.ci-tag{display:inline-block;font-size:9px;padding:2px 6px;letter-spacing:.06em;text-transform:uppercase}
.t-hot{background:rgba(201,162,114,.12);color:var(--gold);border:1px solid var(--gold3)}
.t-new{background:rgba(92,184,122,.08);color:#3a9960;border:1px solid rgba(92,184,122,.3)}
.t-cold{background:var(--sand2);color:var(--ink3);border:1px solid var(--border)}

.col-det{background:var(--sand);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
.det-empty{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:var(--ink3);opacity:.5}
.det-empty p{font-size:10px;letter-spacing:.08em;text-transform:uppercase}
.det-hd{padding:16px 16px 12px;border-bottom:1px solid var(--border);background:var(--white)}
.det-name{font-family:'Cormorant Garamond',serif;font-size:21px;font-weight:400;margin-bottom:3px}
.det-ag{font-size:10px;color:var(--ink3);letter-spacing:.06em;text-transform:uppercase}
.det-acts{display:flex;gap:6px;margin-top:10px}
.d-btn{padding:5px 11px;border:1px solid var(--border2);background:transparent;font-family:'Jost',sans-serif;font-size:10px;color:var(--ink3);cursor:pointer;transition:all .1s;letter-spacing:.04em}
.d-btn:hover{border-color:var(--gold);color:var(--gold)}
.d-btn.pri{background:var(--ink);color:var(--white);border-color:var(--ink)}
.d-btn.pri:hover{background:var(--gold);border-color:var(--gold)}
.det-body{flex:1;overflow-y:auto;padding:14px 16px}
.det-body::-webkit-scrollbar{width:3px}
.det-body::-webkit-scrollbar-thumb{background:var(--sand3)}
.fg{margin-bottom:16px}
.fl{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);margin-bottom:5px}
.fv{font-size:13px;color:var(--ink2);line-height:1.6}
.fv.em{color:var(--ink3);font-style:italic;font-size:12px}
.fg2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
.qitem{background:var(--white);border:1px solid var(--border);padding:9px 11px;font-size:12px;margin-bottom:5px}
.qitem-t{font-weight:500;color:var(--ink);margin-bottom:2px}
.qitem-d{font-size:10px;color:var(--ink3)}

.col-chat{display:flex;flex-direction:column;background:var(--sand);overflow:hidden}
.ctx-bar{padding:9px 24px;background:var(--white);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;font-size:11px;color:var(--ink3);min-height:36px}
.ctx-lbl{font-size:9px;letter-spacing:.14em;text-transform:uppercase}
.ctx-val{color:var(--ink2)}
.ctx-sep{color:var(--border2)}

.msgs{flex:1;overflow-y:auto;padding:26px 30px;display:flex;flex-direction:column;gap:18px;scroll-behavior:smooth}
.msgs::-webkit-scrollbar{width:3px}
.msgs::-webkit-scrollbar-thumb{background:var(--sand3)}
.msg{display:flex;gap:11px;align-items:flex-start;animation:ap .2s ease}
@keyframes ap{from{opacity:0;transform:translateY(4px)}to{opacity:1}}
.msg.user{flex-direction:row-reverse}
.mav{width:27px;height:27px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:500;flex-shrink:0;letter-spacing:.04em}
.mav.ag{background:var(--ink);color:var(--gold2);font-family:'Cormorant Garamond',serif;font-size:11px}
.mav.us{background:var(--sand3);color:var(--ink3)}
.bbl{max-width:70%;padding:11px 15px;font-size:13px;line-height:1.75;font-weight:300}
.bbl.ag{background:var(--white);border:1px solid var(--border);border-bottom-left-radius:0}
.bbl.us{background:var(--ink);color:rgba(255,255,255,.82);border-bottom-right-radius:0}
.bbl p{margin-bottom:7px}.bbl p:last-child{margin-bottom:0}
.bbl strong{color:var(--gold);font-weight:500}
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:7px;margin-top:11px}
.pcard{background:var(--sand);border:1px solid var(--border2);padding:10px 11px;cursor:pointer;transition:all .1s}
.pcard:hover{border-color:var(--gold);background:var(--white)}
.pc-n{font-size:12px;font-weight:500;color:var(--ink);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc-c{font-size:10px;color:var(--ink3);margin-bottom:6px}
.pc-ps{display:flex;flex-wrap:wrap;gap:3px}
.pc-p{font-size:9px;padding:2px 5px;border:1px solid var(--border2);color:var(--ink3)}
.pc-p.hl{border-color:var(--gold3);color:var(--gold);background:rgba(154,125,82,.05)}
.stag{font-size:9px;color:var(--ink3);letter-spacing:.08em;text-transform:uppercase;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);display:block}
.sq-btn{margin-top:9px;padding:5px 11px;background:transparent;border:1px solid var(--gold3);color:var(--gold);font-family:'Jost',sans-serif;font-size:10px;cursor:pointer;transition:all .1s;letter-spacing:.06em;text-transform:uppercase}
.sq-btn:hover{background:rgba(154,125,82,.08)}

.typi{display:flex;gap:4px;align-items:center;padding:5px 0}
.typi span{width:4px;height:4px;border-radius:50%;background:var(--sand3);animation:pu .9s infinite}
.typi span:nth-child(2){animation-delay:.18s}.typi span:nth-child(3){animation-delay:.36s}
@keyframes pu{0%,100%{background:var(--sand3)}50%{background:var(--gold2)}}

.iarea{padding:13px 30px 17px;background:var(--white);border-top:1px solid var(--border)}
.irow{display:flex;gap:8px;align-items:flex-end}
textarea{flex:1;background:var(--sand);border:1px solid var(--border2);padding:10px 13px;font-family:'Jost',sans-serif;font-size:13px;font-weight:300;color:var(--ink);resize:none;outline:none;transition:border .1s;line-height:1.6;max-height:100px}
textarea:focus{border-color:var(--gold);background:var(--white)}
textarea::placeholder{color:var(--ink3)}
.sbtn{width:38px;height:38px;background:var(--ink);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .1s}
.sbtn:hover{background:var(--gold)}.sbtn:disabled{background:var(--sand3);cursor:not-allowed}
.hints{display:flex;gap:5px;margin-top:8px;flex-wrap:wrap}
.hint{font-size:10px;padding:3px 9px;border:1px solid var(--border);color:var(--ink3);cursor:pointer;transition:all .1s;letter-spacing:.03em}
.hint:hover{border-color:var(--gold);color:var(--gold)}

.mbg{position:fixed;inset:0;background:rgba(26,24,20,.3);display:flex;align-items:center;justify-content:center;z-index:50}
.mbox{background:var(--white);width:390px;padding:26px;border:1px solid var(--border2)}
.mttl{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:400;margin-bottom:18px}
.mbox label{display:block;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);margin-bottom:4px;margin-top:12px}
.mbox input,.mbox select,.mbox textarea{width:100%;padding:8px 10px;background:var(--sand);border:1px solid var(--border2);font-family:'Jost',sans-serif;font-size:13px;color:var(--ink);outline:none}
.mbox input:focus,.mbox select:focus,.mbox textarea:focus{border-color:var(--gold)}
.macts{display:flex;gap:7px;margin-top:18px}
.mbtn{flex:1;padding:9px;border:1px solid var(--border2);background:transparent;font-family:'Jost',sans-serif;font-size:11px;cursor:pointer;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3)}
.mbtn.ok{background:var(--ink);color:var(--white);border-color:var(--ink)}
.mbtn.ok:hover{background:var(--gold);border-color:var(--gold)}
.hidden{display:none!important}
.toast{position:fixed;bottom:22px;right:22px;background:var(--ink);color:rgba(255,255,255,.85);padding:9px 15px;font-size:11px;letter-spacing:.04em;z-index:999;font-family:'Jost',sans-serif;animation:ap .2s ease}
</style>
</head>
<body>

<div id="login-screen">
  <div class="login-box">
    <div class="login-brand">Two Travel</div>
    <div class="login-sub" id="login-sub">Portal de ventas</div>
    <div class="demo-badge" id="demo-badge">Demo · Portafolio cargado</div>
    <div class="login-label" id="login-label">Selecciona tu perfil</div>
    <div class="agent-btns">
      <button class="agent-btn" onclick="login('Ray')">
        <div class="ag-av" style="background:#dceef7;color:#3a7ab8">RA</div> Ray
      </button>
      <button class="agent-btn" onclick="login('Ross')">
        <div class="ag-av" style="background:#f0e6d3;color:#9a7d52">RO</div> Ross
      </button>
    </div>
  </div>
</div>

<div class="app hidden" id="app">
  <header class="header">
    <span class="logo">Two Travel</span>
    <div class="hdiv"></div>
    <span class="hls">Sales</span>
    <div class="hright">
      <div class="portfolio-badge">
        <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        Portafolio cargado · 565 propiedades
      </div>
      <div id="int-status" style="display:flex;gap:5px;align-items:center"></div>
      <button class="lang-btn" id="lang-btn" onclick="toggleLang()">EN</button>
      <div class="online"><div class="dot"></div> <span id="hd-online">En línea</span></div>
      <div class="agent-pill" onclick="logout()">
        <div class="pill-av" id="pill-av"></div>
        <span id="pill-name"></span>
        <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
      </div>
    </div>
  </header>

  <div class="col-clients">
    <div class="col-hd">
      <div class="col-ttl" id="col-ttl-clients">Mis clientes</div>
      <input class="srch" id="srch" placeholder="Buscar..." oninput="filterClients(this.value)">
      <div style="display:flex;gap:4px;margin-top:6px">
        <select id="filter-stage" onchange="filterClients(document.getElementById('srch').value)" style="flex:1;padding:5px 7px;background:var(--sand);border:1px solid var(--border);font-family:'Jost',sans-serif;font-size:10px;color:var(--ink2);outline:none;letter-spacing:.03em">
          <option value="">— Todos los stages —</option>
          <optgroup label="Activos">
            <option value="requirementsreceived">📋 Requirements Received</option>
            <option value="callscheduled">📞 Call Scheduled</option>
            <option value="houseoptionssent">🏠 House Options Sent</option>
            <option value="boatoptionssent">⛵ Boat Options Sent</option>
            <option value="contractsent">📄 Contract Sent</option>
            <option value="conciergeSelling">🎯 Concierge Selling</option>
          </optgroup>
          <optgroup label="Cerrados">
            <option value="closedwon">✅ Closed Won</option>
            <option value="closedlost">❌ Closed Lost</option>
          </optgroup>
        </select>
        <button id="btn-refresh" onclick="loadClientsFromHubSpot(agent)" title="Recargar desde HubSpot" style="padding:5px 8px;border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--ink3);font-size:11px;transition:all .1s" onmouseover="this.style.borderColor='var(--gold)';this.style.color='var(--gold)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--ink3)'">↻</button>
      </div>
      <div id="pipeline-summary" style="display:flex;flex-wrap:wrap;gap:3px;margin-top:6px"></div>
      <button class="add-btn" onclick="openNewClient()" style="margin-top:6px">
        <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span id="add-client-txt">Nuevo cliente</span>
      </button>
    </div>
    <div class="clist" id="clist"></div>
  </div>

  <div class="col-det">
    <div class="det-empty" id="det-empty">
      <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
      <p id="det-empty-txt">Selecciona un cliente</p>
    </div>
    <div id="det-content" class="hidden" style="display:flex;flex-direction:column;height:100%;overflow:hidden">
      <div class="det-hd">
        <div class="det-name" id="det-name"></div>
        <div class="det-ag" id="det-ag"></div>
        <div class="det-acts">
          <button class="d-btn" id="btn-edit" onclick="editClient()">Editar</button>
          <button class="d-btn pri" id="btn-assistant" onclick="focusChat()">Asistente ↗</button>
        </div>
      </div>
      <div class="det-body" id="det-body"></div>
    </div>
  </div>

  <div class="col-chat">
    <div class="ctx-bar">
      <span class="ctx-lbl" id="ctx-lbl">Contexto</span>
      <span class="ctx-sep">·</span>
      <span class="ctx-val" id="ctx-client">Sin cliente activo</span>
      <span class="ctx-sep" id="ctx-sep2" style="display:none">·</span>
      <span class="ctx-val" id="ctx-info"></span>
    </div>
    <div class="msgs" id="msgs"></div>
    <div class="iarea">
      <div class="irow">
        <textarea id="cinput" rows="1" placeholder="Pide opciones del portafolio, arma una propuesta, consulta disponibilidad..." onkeydown="handleKey(event)" oninput="autoR(this)" data-ph-es="Pide opciones del portafolio, arma una propuesta, consulta disponibilidad..." data-ph-en="Ask for portfolio options, build a proposal, check availability..."></textarea>
        <button class="sbtn" id="sbtn" onclick="send()">
          <svg width="14" height="14" fill="none" stroke="white" stroke-width="1.8" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      <div class="hints" id="hints-bar">
        <div class="hint" id="hint-1" onclick="sh(L('Villa bachelor Medellín 15-20 personas con piscina y jacuzzi','Bachelor villa Medellín 15-20 people pool jacuzzi'))">Bachelor Medellín</div>
        <div class="hint" id="hint-2" onclick="sh(L('Botes party Cartagena 25 personas','Party boats Cartagena 25 people'))">Botes Cartagena</div>
        <div class="hint" id="hint-3" onclick="sh(L('Venue boda 80-100 personas Cartagena con alojamiento','Wedding venue 80-100 people Cartagena with accommodation'))">Venue boda</div>
        <div class="hint" id="hint-4" onclick="sh(L('Genera propuesta para enviar por WhatsApp al cliente','Generate a proposal ready to send to the client'))">Propuesta WhatsApp</div>
        <div class="hint" id="hint-5" onclick="sh(L('Opciones en Tulum para grupo pequeño de lujo','Luxury options in Tulum for small premium group'))">Tulum luxury</div>
      </div>
    </div>
  </div>
</div>

<div class="mbg hidden" id="client-modal">
  <div class="mbox">
    <div class="mttl" id="mttl">Nuevo cliente</div>
    <label id="ml-name">Nombre completo</label><input id="m-n" placeholder="Ej: Juan Pérez">
    <label id="ml-contact">WhatsApp / Email</label><input id="m-c" placeholder="Ej: +57 300 000 0000">
    <label id="ml-dest">Destino de interés</label><input id="m-d" placeholder="Ej: Cartagena">
    <label id="ml-dates">Fechas tentativas</label><input id="m-f" placeholder="Ej: Dic 20-25">
    <label id="ml-budget">Presupuesto</label><input id="m-b" placeholder="Ej: USD 5,000">
    <label id="ml-status">Estado</label>
    <select id="m-s"><option value="new" id="mopt-new">Nuevo</option><option value="hot" id="mopt-hot">Caliente</option><option value="cold" id="mopt-cold">Frío</option></select>
    <label id="ml-notes">Notas del agente</label>
    <textarea id="m-no" rows="3" placeholder="Info relevante del cliente..."></textarea>
    <div class="macts">
      <button class="mbtn" id="ml-cancel" onclick="closeClientModal()">Cancelar</button>
      <button class="mbtn ok" id="ml-save" onclick="saveClient()">Guardar</button>
    </div>
  </div>
</div>

<script>
const AG = {
  Ray:  {i:'RA',bg:'#dceef7',c:'#3a7ab8'},
  Ross: {i:'RO',bg:'#f0e6d3',c:'#9a7d52'}
};

const SAMPLE = {
  Ray:[
    {id:'ra1',name:'Andrés Castellanos',contact:'+57 320 111 0033',dest:'Cartagena',dates:'Dic 31 - Ene 3',budget:'USD 15,000',status:'hot',notes:'Año nuevo. 25 personas. Villa grande + yate para el 31.',quotes:['Yate Sea Land — 30 cap, 70ft'],savedAt:['8 Nov']},
    {id:'ra2',name:'Pedro & Ana',contact:'+1 786 555 0044',dest:'Medellín',dates:'Ene 20-24',budget:'USD 6,000',status:'new',notes:'Pareja + amigos. 8 personas. Penthouse de lujo en Provenza.',quotes:[]},
  ],
  Ross:[
    {id:'r1',name:'Familia Montoya',contact:'+57 310 555 0011',dest:'Cartagena',dates:'Dic 20-27',budget:'USD 8,000',status:'hot',notes:'18 personas, villa con piscina y chef privado. Ya vieron fotos de Casa del Mar.',quotes:['Villa La Escollera — 8 hab, 18 pax, Bocagrande'],savedAt:['15 Nov']},
    {id:'r2',name:'Santiago Ríos',contact:'+57 315 444 0022',dest:'Medellín',dates:'Ene 10-13',budget:'USD 3,500',status:'new',notes:'Bachelor party. 12 hombres. Quiere penthouse en Provenza con jacuzzi y BBQ.',quotes:[]},
    {id:'r3',name:'Grupo Empresarial XYZ',contact:'eventos@xyz.com',dest:'Tulum',dates:'Feb 8-12',budget:'USD 20,000',status:'cold',notes:'Retiro corporativo 25 personas. Premium, frente al mar o selva.',quotes:[]},
  ]
};

let agent=null, clients={}, selClient=null, editId=null, busy=false;
let chatHistory=[];
const INT={claude:false,hubspot:false,notion:false};

// ── Demo responses ──────────────────────────────────────────────
const DEMOS = [
  {
    keys:['bachelor','bache','fiesta','party','hombre','medellin','medellín','provenza','jacuzzi','penthouse'],
    text:(c)=>lang==='es'
      ?\`Para un bachelor en Medellín, las tres opciones top del portafolio son **Lleras Penthouse** (22 pax, ⭐⭐⭐⭐⭐), **Casa Amigos** (16 pax, jacuzzi XL + billar) y **Belmonte 302** (12 pax, jacuzzi + parking). Los tres están en Provenza o Manila — caminando a los bares y restaurantes del parque Lleras.\\n\\n${c?\`Para **${c.name}** con presupuesto de ${c.budget||'por definir'} y ${c.dates||'fechas por confirmar'}, te recomendaría arrancar con Lleras Penthouse. ¿Confirmo disponibilidad?\`:'¿Cuántas personas son y cuál es el presupuesto?'}\`
      :\`For a bachelor party in Medellín, the top three options are **Lleras Penthouse** (22 pax, ⭐⭐⭐⭐⭐), **Casa Amigos** (16 pax, XL jacuzzi + billiards) and **Belmonte 302** (12 pax, jacuzzi + parking). All three are in Provenza or Manila — walking distance to Parque Lleras bars and restaurants.\\n\\n${c?\`For **${c.name}** with a budget of ${c.budget||'TBD'} and ${c.dates||'dates TBC'}, I'd recommend starting with Lleras Penthouse. Shall I confirm availability?\`:'How many people and what is the budget?'}\`,
    cards:[
      {name:'Lleras Penthouse',city:'Medellín',neighborhood:'Provenza',bedrooms:6,pax:22,type:'Villa',rating:'⭐⭐⭐⭐⭐',link:'https://two.travel/lleras-penthouse-medellin-villa-rental/'},
      {name:'Casa Amigos',city:'Medellín',neighborhood:'Manila',bedrooms:8,pax:16,type:'Villa',rating:'⭐⭐⭐⭐⭐'},
      {name:'Belmonte 302',city:'Medellín',neighborhood:'Provenza',bedrooms:6,pax:12,type:'Villa',rating:'⭐⭐⭐⭐⭐'},
      {name:'Provenza Mansion',city:'Medellín',neighborhood:'Provenza',bedrooms:12,pax:26,type:'Villa',rating:'⭐⭐⭐⭐'},
    ]
  },
  {
    keys:['boda','matrimon','venue','salon','ceremonia','weddin','novio','novia','wedding'],
    text:(c)=>lang==='es'
      ?\`Para bodas en Cartagena tenemos 41 venues. Las opciones más solicitadas en Ciudad Amurallada son **Casa 1537** (150 cap, colonial histórico), **Casa Pestagua** (200 cap, piscina + alojamiento incluido) y **Bellas Artes** (150 cap, vistas a la catedral). Si buscan playa, **Shaboo** en Tierra Bomba o **Zamaz** en Barú.\\n\\n${c?\`Con el budget de **${c.name}** (${c.budget||'por definir'}) y ${c.dates||'fechas por confirmar'}, necesito saber el número de invitados para afinar las opciones.\`:'¿Cuántos invitados y tienen fecha confirmada?'}\`
      :\`For weddings in Cartagena we have 41 venues. The most requested in the Walled City are **Casa 1537** (150 cap, historic colonial), **Casa Pestagua** (200 cap, pool + accommodation included) and **Bellas Artes** (150 cap, cathedral views). For beach settings, **Shaboo** on Tierra Bomba or **Zamaz** in Barú.\\n\\n${c?\`With **${c.name}'s** budget (${c.budget||'TBD'}) and ${c.dates||'dates TBC'}, I need the guest count to narrow things down.\`:'How many guests and do they have a confirmed date?'}\`,
    cards:[
      {name:'Casa 1537',city:'Cartagena',neighborhood:'Walled City',capacity:150,type:'Venue colonial',link:'https://two.travel/two-lovers-wedding-venue/casa-1537-cartagena/'},
      {name:'Casa Pestagua',city:'Cartagena',neighborhood:'Walled City',capacity:200,type:'Venue+Accommodation',link:'https://two.travel/your-wedding-at-casa-conde-pestagua/'},
      {name:'Charleston Santa Teresa',city:'Cartagena',neighborhood:'Walled City',capacity:200,type:'Hotel+Venue',link:'https://two.travel/your-wedding-at-santa-teresa/'},
      {name:'Bellas Artes',city:'Cartagena',neighborhood:'Walled City',capacity:150,type:'Salon',link:'https://two.travel/your-wedding-at-bellas-artes/'},
    ]
  },
  {
    keys:['bote','yate','catamaran','catamarán','embarcac','lancha','velero','isla','islas','barco','speedboat','boat','yacht'],
    text:(c)=>lang==='es'
      ?\`En Cartagena tenemos **83 embarcaciones**: 46 speedboats (8-48 pax), 23 yates y 12 catamaranes. Para party de 20-30 personas, los más pedidos son los **catamaranes Valhala o Sea Wolf** (35 pax, ~$3,000 USD) o el **yate Sea Land** (30 pax, 70ft). Todos incluyen capitán, marinero, parlante, hielera y chalecos.\\n\\n${c?\`Para **${c.name}** — ¿cuántas personas son y qué día sería la salida?\`:'¿Cuántas personas y qué tipo de experiencia buscan?'}\`
      :\`In Cartagena we have **83 vessels**: 46 speedboats (8-48 pax), 23 yachts and 12 catamarans. For a party of 20-30 people, the most requested are **Valhala or Sea Wolf catamarans** (35 pax, ~$3,000 USD) or the **Sea Land yacht** (30 pax, 70ft). All include captain, first mate, speaker, cooler and life jackets.\\n\\n${c?\`For **${c.name}** — how many people and what day would the trip be?\`:'How many people and what kind of experience are they looking for?'}\`,
    cards:[
      {name:'Catamaran Valhala',city:'Cartagena',neighborhood:'Nautico',pax:35,type:'Catamaran',rating:'$3,000 USD'},
      {name:'Catamaran Sea Wolf',city:'Cartagena',neighborhood:'Nautico',pax:35,type:'Catamaran',rating:'$3,000 USD'},
      {name:'Yacht Sea Land',city:'Cartagena',neighborhood:'Nautico',pax:30,type:'Yacht 70ft',rating:'13.5MM COP'},
      {name:'Speedboat Charlie',city:'Cartagena',neighborhood:'Nautico',pax:20,type:'Speedboat 41ft'},
      {name:'Sugar Mommy',city:'Cartagena',neighborhood:'Pegasos',pax:20,type:'Speedboat 45ft'},
    ]
  },
  {
    keys:['tulum','cenote','selva','caribe','mexico','méxico','boho','jungle'],
    text:(c)=>lang==='es'
      ?\`En Tulum tenemos 9 villas boho-luxury. Para grupos premium, las mejores opciones son **Casa Zama** (6 hab, 16 pax), **Casa Babylon** (9 hab, 16 pax) y **Casa Viva** (10 hab, 16 pax, frente a playa). Para grupos pequeños, **Casa Zorba** (3 hab, 8 pax) o **Casa Arcos** (4 hab, 12 pax).\\n\\n${c?\`Para **${c.name}** con presupuesto ${c.budget||'por definir'}, ¿prefieren frente al mar o en la selva?\`:'¿Cuántas personas y qué fechas manejan?'}\`
      :\`In Tulum we have 9 boho-luxury villas. For premium groups, the top picks are **Casa Zama** (6 bed, 16 pax), **Casa Babylon** (9 bed, 16 pax) and **Casa Viva** (10 bed, 16 pax, beachfront). For smaller groups, **Casa Zorba** (3 bed, 8 pax) or **Casa Arcos** (4 bed, 12 pax).\\n\\n${c?\`For **${c.name}** with a budget of ${c.budget||'TBD'}, do they prefer beachfront or jungle?\`:'How many people and what dates are they looking at?'}\`,
    cards:[
      {name:'Casa Zama',city:'Tulum',neighborhood:'Beach Road',bedrooms:6,pax:16,type:'Boho-luxury villa'},
      {name:'Casa Babylon',city:'Tulum',neighborhood:'Beach Road',bedrooms:9,pax:16,type:'Villa'},
      {name:'Casa Viva',city:'Tulum',neighborhood:'Beach',bedrooms:10,pax:16,type:'Beachfront villa'},
      {name:'Casa Arcos',city:'Tulum',neighborhood:'Jungle',bedrooms:4,pax:12,type:'Jungle villa'},
    ]
  },
  {
    keys:['cartagena','amurallada','bocagrande','getsemani','manga','villa','casa'],
    text:(c)=>lang==='es'
      ?\`Cartagena tiene **163 villas** en varios sectores. Ciudad Amurallada: colonial, ideal para bodas y parejas. Bocagrande: moderno, vistas al mar. Tierra Bomba: isla a 10 min en bote. Para grupos grandes con vista al agua, las villas de Bocagrande son las más solicitadas — capacidades de 10 a 30 personas con pool incluido.\\n\\n${c?\`Para **${c.name}** — ¿qué sector prefieren y cuántas personas son?\`:'¿Qué sector prefieren y cuántas personas son?'}\`
      :\`Cartagena has **163 villas** across several areas. Walled City: colonial, ideal for weddings and couples. Bocagrande: modern, ocean views. Tierra Bomba: island 10 min by boat. For large groups with water views, Bocagrande villas are the most requested — 10 to 30 people with pool included.\\n\\n${c?\`For **${c.name}** — which area do they prefer and how many people?\`:'Which area do they prefer and how many people?'}\`,
    cards:[
      {name:'Villas Bocagrande',city:'Cartagena',neighborhood:'Bocagrande',pax:20,type:'Ocean view'},
      {name:'Walled City Homes',city:'Cartagena',neighborhood:'Walled City',pax:15,type:'Colonial'},
      {name:'Tierra Bomba Villas',city:'Cartagena',neighborhood:'Island',pax:25,type:'Private beach'},
    ]
  },
  {
    keys:['propuesta','whatsapp','mensaje','enviar','redact','texto','proposal','message','send'],
    text:(c)=>{
      if(!c) return lang==='es'
        ?'Selecciona un cliente primero para personalizar la propuesta con sus datos.'
        :'Select a client first so I can personalize the proposal with their details.';
      const dest=c.dest||'the destination';
      const pax=c.notes&&c.notes.match(/\\d+/)?c.notes.match(/\\d+/)[0]+(lang==='es'?' personas':' people'):(lang==='es'?'tu grupo':'your group');
      return lang==='es'
        ?\`Mensaje listo para enviar:\\n\\n---\\nHola ${c.name.split(' ')[0]} 👋\\n\\nTe comparto las opciones que seleccioné para ${pax} en ${dest}${c.dates?' ('+c.dates+')':''}.\\n\\n${c.quotes&&c.quotes.length?c.quotes.map(q=>\`✦ ${q}\`).join('\\n'):'✦ [propiedades seleccionadas según tus preferencias]'}\\n\\nTodas incluyen servicio de concierge de Two Travel — disponibilidad, traslados y lo que necesiten. ¿Te cuadra alguna?\\n---\\n\\n¿Ajusto el tono o agrego algo?\`
        :\`Message ready to send:\\n\\n---\\nHey ${c.name.split(' ')[0]} 👋\\n\\nHere are the options I selected for ${pax} in ${dest}${c.dates?' ('+c.dates+')':''}.\\n\\n${c.quotes&&c.quotes.length?c.quotes.map(q=>\`✦ ${q}\`).join('\\n'):'✦ [properties selected based on your preferences]'}\\n\\nAll include Two Travel concierge — availability, transfers, activities and whatever you need. Does any of these work?\\n---\\n\\nWant me to adjust the tone or add anything?\`;
    },
    cards:[]
  },
  {
    keys:['grande','grupo','30','40','50','60','80','100','large','group'],
    text:(c)=>lang==='es'
      ?\`Para grupos de 30+ personas: en Medellín **Succhi Apto** (30 pax, 2 rooftop pools), **Casa Mansion** (30 pax, nightclub privado) o **Icon** (30 pax, 2 piscinas, Lomas). En Cartagena para eventos, **Casa Real Getsemaní** (300 cap) o **Centro de Convenciones** (300 cap, AC, vista a la bahía).\\n\\n${c?\`Para **${c.name}** — ¿confirmas el número exacto de personas?\`:'¿Es alojamiento, evento, o ambos?'}\`
      :\`For groups of 30+ people: in Medellín **Succhi Apto** (30 pax, 2 rooftop pools), **Casa Mansion** (30 pax, private nightclub) or **Icon** (30 pax, 2 pools, Lomas). In Cartagena for events, **Casa Real Getsemaní** (300 cap) or **Convention Center** (300 cap, AC, bay views).\\n\\n${c?\`For **${c.name}** — can you confirm the exact headcount?\`:'Is this accommodation, an event, or both?'}\`,
    cards:[
      {name:'Succhi Apto',city:'Medellín',neighborhood:'Provenza',bedrooms:14,pax:30,type:'Villa',rating:'⭐⭐⭐'},
      {name:'Casa Mansion',city:'Medellín',neighborhood:'Poblado',bedrooms:11,pax:30,type:'Villa',rating:'⭐⭐⭐⭐'},
      {name:'Icon',city:'Medellín',neighborhood:'Lomas',bedrooms:10,pax:30,type:'Villa',rating:'⭐⭐'},
      {name:'Casa Real Getsemaní',city:'Cartagena',neighborhood:'Getsemaní',capacity:300,type:'Venue'},
    ]
  },
  {
    keys:['precio','costo','cuánto','cuanto','rate','tarifa','valor','price','cost','how much'],
    text:(c)=>lang==='es'
      ?\`Los precios varían según fecha, temporada y disponibilidad — siempre confirmo directamente con el proveedor. Referencia:\\n\\n**Villas Medellín:** $500–2,500+ USD/noche.\\n**Villas Tulum:** $800–3,000 USD/noche.\\n**Botes Cartagena:** Speedboats $1.4–3.5 MM COP/día · Catamaranes $1,800–3,200 USD/día · Yates $2,000–9,500 USD/día.\\n**Venues Cartagena:** $20M–$75M+ COP.\\n\\n${c?\`Para **${c.name}** con budget ${c.budget||'por definir'}, preparo opciones específicas.\`:'¿Para cuántas personas y qué destino?'}\`
      :\`Prices vary by date, season and availability — I always confirm directly with the provider. For reference:\\n\\n**Medellín villas:** $500–2,500+ USD/night.\\n**Tulum villas:** $800–3,000 USD/night.\\n**Cartagena boats:** Speedboats $1.4–3.5MM COP/day · Catamarans $1,800–3,200 USD/day · Yachts $2,000–9,500 USD/day.\\n**Cartagena venues:** $20M–$75M+ COP.\\n\\n${c?\`For **${c.name}** with a budget of ${c.budget||'TBD'}, I can put together specific options.\`:'How many people and which destination?'}\`,
    cards:[]
  },
];

const DEFAULT = {
  text:(c)=>lang==='es'
    ?\`Entendido. Tengo acceso al portafolio completo — **441 villas**, **83 embarcaciones** y **41 venues** en Cartagena, Medellín, Tulum y CDMX.\\n\\n${c?\`Trabajando con **${c.name}**: ${c.dest||'destino por definir'}, ${c.dates||'fechas por confirmar'}, presupuesto ${c.budget||'por definir'}. ¿Qué tipo de propiedad buscamos?\`:'Cuéntame más — destino, número de personas, tipo de experiencia y presupuesto.'}\`
    :\`Got it. I have access to the full portfolio — **441 villas**, **83 boats** and **41 venues** across Cartagena, Medellín, Tulum and Mexico City.\\n\\n${c?\`Working with **${c.name}**: ${c.dest||'destination TBD'}, ${c.dates||'dates TBC'}, budget ${c.budget||'TBD'}. What type of property are we looking for?\`:'Tell me more — destination, number of people, type of experience and approximate budget.'}\`,
  cards:[]
};

function getReply(text){
  const q=text.toLowerCase();
  for(const d of DEMOS){
    if(d.keys.some(k=>q.includes(k))) return d;
  }
  return DEFAULT;
}

async function login(name){
  agent=name;
  chatHistory=[];
  // Show app immediately with loading state
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const s=AG[name];
  const pav=document.getElementById('pill-av');
  pav.textContent=s.i;pav.style.background=s.bg;pav.style.color=s.c;
  document.getElementById('pill-name').textContent=name;

  // Show loading in client list
  document.getElementById('clist').innerHTML='<div style="padding:18px 14px;font-size:11px;color:var(--ink3);text-align:center">'+
    (lang==='es'?'Cargando desde HubSpot...':'Loading from HubSpot...')+'</div>';

  // Check integrations + load clients in parallel
  await checkIntegrations();
  await loadClientsFromHubSpot(name);

  addMsg('ag', lang==='es'
    ?\`Hola **${name}** — tienes **${(clients[name]||[]).length} clientes** activos. Selecciona un cliente de la lista para empezar.\`
    :\`Hey **${name}** — you have **${(clients[name]||[]).length} active clients**. Select a client from the list to get started.\`
  ,[]);
}

// Pipeline stage ID → label map fetched from HubSpot
let HS_STAGE_MAP={};

function mapDealStage(s){
  if(!s)return'new';
  const label=(HS_STAGE_MAP[s]||s).toLowerCase();
  if(label.includes('contract')||label.includes('concierge')||label.includes('won'))return'hot';
  if(label.includes('option')||label.includes('sent'))return'hot';
  if(label.includes('scheduled')||label.includes('call'))return'new';
  if(label.includes('requirement'))return'new';
  if(label.includes('lost')||label.includes('unqualified'))return'cold';
  return'new';
}

function dealStageLabel(s){
  if(!s)return'';
  // First check fetched pipeline map (handles numeric IDs)
  if(HS_STAGE_MAP[s]) return HS_STAGE_MAP[s];
  // Fallback string map
  const map={
    'requirementsreceived':'Requirements Received',
    'callscheduled':'Call Scheduled',
    'houseoptionssent':'House Options Sent',
    'boatoptionssent':'Boat Options Sent',
    'contractsent':'Contract Sent',
    'conciergeSelling':'Concierge Selling',
    'conciergeselling':'Concierge Selling',
    'closedwon':'Closed Won ✓',
    'closedlost':'Closed Lost',
  };
  const key=s.toLowerCase().replace(/[^a-z]/g,'');
  return map[key]||s.replace(/([A-Z])/g,' $1').trim();
}

// Month names for date extraction from deal names
const MONTHS=/\\b(January|February|March|April|May|June|July|August|September|October|November|December)\\b/i;
// Known city keywords found in deal names
const CITY_MAP={
  'cdmx':'Mexico City','mexico city':'Mexico City','mexico':'Mexico City',
  'cartagena':'Cartagena','ctg':'Cartagena',
  'medellin':'Medellín','medellín':'Medellín','mde':'Medellín',
  'tulum':'Tulum','cancun':'Cancún','cancún':'Cancún',
  'bogota':'Bogotá','bogotá':'Bogotá','miami':'Miami',
};

function parseDealName(dealname){
  if(!dealname)return{name:'Sin nombre',dest:'',dates:'',service:''};

  // If it uses " - " separators: "Lana Barakat - Mexico City - June 2025"
  if(/\\s[-–—]\\s/.test(dealname)){
    const parts=dealname.split(/\\s*[-–—]\\s*/);
    // The last part is often dates or service
    const last=parts[parts.length-1];
    const datesFromDash=MONTHS.test(last)?last:'';
    const dest=parts.length>=3?parts[1].trim():(parts.length===2&&!datesFromDash?parts[1].trim():'');
    return{
      name:parts[0].trim(),
      dest:dest,
      dates:datesFromDash,
      service:!datesFromDash&&parts.length>=3?parts.slice(2).join(' - ').trim():'',
    };
  }

  // Freeform: extract dates and city from the text
  // Date pattern: Month [Day[-Day]] [Year]
  const dateRe=/((?:January|February|March|April|May|June|July|August|September|October|November|December)\\s*[\\d\\-\\/–]*\\s*(?:,?\\s*\\d{4})?)/gi;
  const dateMatches=[...dealname.matchAll(dateRe)].map(m=>m[1].trim());
  const datesStr=dateMatches.join(' - ');

  // Detect city
  let dest='';
  const lower=dealname.toLowerCase();
  for(const [key,val] of Object.entries(CITY_MAP)){
    if(lower.includes(key)){dest=val;break;}
  }

  // Service keywords
  let service='';
  const svcMatch=dealname.match(/\\b(boat|bote|villa|yacht|yate|catamaran|speedboat|wedding|boda)\\b/i);
  if(svcMatch) service=svcMatch[1];

  // Client name: strip dates, city, service from deal name
  let name=dealname;
  dateMatches.forEach(d=>{name=name.replace(d,'');});
  if(dest){
    for(const key of Object.keys(CITY_MAP)){
      name=name.replace(new RegExp('\\\\b'+key+'\\\\b','gi'),'');
    }
  }
  if(service) name=name.replace(new RegExp('\\\\b'+service+'\\\\b','gi'),'');
  // Clean up parenthetical secondary names like "(Joanne Arevalo)" — keep as note
  const parenMatch=name.match(/\\(([^)]+)\\)/);
  const altName=parenMatch?parenMatch[1].trim():'';
  name=name.replace(/\\([^)]*\\)/g,'').replace(/\\s+/g,' ').trim();

  return{name:name||dealname,dest,dates:datesStr,service,altName};
}

async function loadClientsFromHubSpot(name){
  try{
    // Fetch pipeline stages + deals in parallel
    const [stagesRes, dealsRes]=await Promise.all([
      fetch('/api/hubspot',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'get_pipeline_stages',data:{}})}),
      fetch('/api/hubspot',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'get_contacts',data:{limit:100,agentName:name}})})
    ]);

    // Build stage map so numeric IDs → human-readable names
    if(stagesRes.ok){
      const stagesData=await stagesRes.json();
      if(stagesData.stageMap) Object.assign(HS_STAGE_MAP,stagesData.stageMap);
    }

    const d=await dealsRes.json();
    if(d.demo||!dealsRes.ok||!d.contacts?.length){
      if(!clients[name])clients[name]=JSON.parse(JSON.stringify(SAMPLE[name]||[]));
      renderList();return;
    }

    const mapped=d.contacts.map(deal=>{
      const p=deal.properties||{};
      const c=deal._contact||{};
      const parsed=parseDealName(p.dealname);

      // Contact info from associated HubSpot contact
      const phone=c.phone||'';
      const email=c.email||'';
      const contactStr=[phone,email].filter(Boolean).join(' · ')||'';

      // Dates: prefer dates extracted from deal name, fallback to closedate
      let tripDates=parsed.dates||'';
      if(!tripDates&&p.closedate){
        const cd=parseHsDate(p.closedate);
        if(cd) tripDates=new Date(cd).toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'});
      }

      // Display name: prefer contact full name, then parsed client name from deal
      const displayName=c.fullName||parsed.name;

      // Notes: stage label + service + alt name + HubSpot notes
      const stageLbl=dealStageLabel(p.dealstage);
      const noteParts=[
        stageLbl,
        parsed.service,
        parsed.altName?\`También conocido como: ${parsed.altName}\`:'',
        p.description||'',
        p.hs_next_step||'',
      ].filter(Boolean);

      return{
        id:deal.id,
        name:displayName,
        dealName:p.dealname||'',   // full original deal name (shown in detail panel)
        contact:contactStr,
        email,
        phone,
        dest:parsed.dest,
        dates:tripDates,
        budget:p.amount&&Number(p.amount)>0?'USD '+Number(p.amount).toLocaleString():'',
        status:mapDealStage(p.dealstage),
        notes:noteParts.join(' · '),
        quotes:[],savedAt:[],
        hsId:deal.id,
        dealStage:p.dealstage||'',
        createDate:parseHsDate(p.lastmodifieddate)||parseHsDate(p.createdate)||null
      };
    });
    clients[name]=mapped;
    renderList();
    renderPipelineSummary(name);
  }catch(e){
    console.warn('HubSpot load error, using sample',e);
    if(!clients[name])clients[name]=JSON.parse(JSON.stringify(SAMPLE[name]||[]));
    renderList();
  }
}

function logout(){
  agent=null;selClient=null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('msgs').innerHTML='';
  document.getElementById('det-empty').classList.remove('hidden');
  document.getElementById('det-content').classList.add('hidden');
}

// HubSpot devuelve fechas como epoch-ms string ("1620000000000") o ISO string
function parseHsDate(v){
  if(!v) return null;
  const n=Number(v);
  if(!isNaN(n) && n > 1e10) return new Date(n).toISOString(); // epoch ms
  const d=new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const STAGE_META = {
  requirementsreceived: {label:'Requirements',   emoji:'📋', cls:'t-new'},
  callscheduled:        {label:'Call Scheduled',  emoji:'📞', cls:'t-new'},
  houseoptionssent:     {label:'House Options',   emoji:'🏠', cls:'t-hot'},
  boatoptionssent:      {label:'Boat Options',    emoji:'⛵', cls:'t-hot'},
  contractsent:         {label:'Contract Sent',   emoji:'📄', cls:'t-hot'},
  conciergeSelling:     {label:'Concierge',       emoji:'🎯', cls:'t-hot'},
  conciergeselling:     {label:'Concierge',       emoji:'🎯', cls:'t-hot'},
  closedwon:            {label:'Won ✓',           emoji:'✅', cls:'t-new'},
  closedlost:           {label:'Lost',            emoji:'❌', cls:'t-cold'},
};

// Normalize any HubSpot stage key to our meta keys
function getStageKey(c){
  const raw = (c.dealStage||'').toLowerCase().replace(/[^a-z]/g,'');
  if(!raw) return c.status==='hot'?'contractsent':c.status==='cold'?'closedlost':'requirementsreceived';
  // Substring matching for flexibility
  if(raw.includes('requirement'))    return 'requirementsreceived';
  if(raw.includes('call')||raw.includes('scheduled')) return 'callscheduled';
  if(raw.includes('houseoption')||raw.includes('houseoption')) return 'houseoptionssent';
  if(raw.includes('boatoption'))     return 'boatoptionssent';
  if(raw.includes('contract'))       return 'contractsent';
  if(raw.includes('concierge'))      return 'conciergeselling';
  if(raw.includes('won'))            return 'closedwon';
  if(raw.includes('lost'))           return 'closedlost';
  // exact match fallback
  return raw;
}

function renderList(filter='',stageFilter=''){
  const el=document.getElementById('clist');el.innerHTML='';
  const list=(clients[agent]||[]).filter(c=>{
    const textMatch=!filter||c.name.toLowerCase().includes(filter.toLowerCase())||(c.dest||'').toLowerCase().includes(filter.toLowerCase());
    // Filter by actual pipeline stage key
    const key=getStageKey(c);
    const stageMatch=!stageFilter||key===stageFilter.toLowerCase().replace(/[^a-z]/g,'');
    return textMatch&&stageMatch;
  });
  // Sort: most recently received (createDate) first
  list.sort((a,b)=>{
    const da=a.createDate?new Date(a.createDate).getTime():0;
    const db=b.createDate?new Date(b.createDate).getTime():0;
    return db-da;
  });

  if(!list.length){el.innerHTML='<div style="padding:18px 14px;font-size:11px;color:var(--ink3);text-align:center">Sin resultados</div>';return;}
  list.forEach(c=>{
    const d=document.createElement('div');
    d.className='ci'+(selClient&&selClient.id===c.id?' active':'');
    const key=getStageKey(c);
    const meta=STAGE_META[key]||{label:c.dealStage||'—',emoji:'·',cls:'t-new'};
    // last activity label
    let ageLbl='';
    if(c.createDate){
      const diffDays=Math.floor((Date.now()-new Date(c.createDate).getTime())/(1000*60*60*24));
      ageLbl=diffDays===0?'today':diffDays===1?'yesterday':\`${diffDays}d ago\`;
    }
    d.innerHTML=\`
      <div class="ci-name">${c.name}</div>
      <div class="ci-sub">${c.dest||'—'}${c.dates?' · '+c.dates:''}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:3px">
        <span class="ci-tag ${meta.cls}" style="font-size:9px;position:static">${meta.emoji} ${meta.label}</span>
        ${ageLbl?\`<span style="font-size:9px;color:var(--ink3);letter-spacing:.04em">${ageLbl}</span>\`:''}
      </div>\`;
    d.onclick=()=>selectClient(c);
    el.appendChild(d);
  });

  // Show count
  const hd=document.getElementById('col-ttl-clients');
  if(hd) hd.textContent=\`Mis clientes (${list.length}${list.length<(clients[agent]||[]).length?' filtrados':''})\`;
}

function filterClients(v){
  const stage=document.getElementById('filter-stage')?.value||'';
  renderList(v,stage);
}

function renderPipelineSummary(name){
  const bar=document.getElementById('pipeline-summary');
  if(!bar)return;
  const list=clients[name]||[];
  const counts={};
  const ORDER=['requirementsreceived','callscheduled','houseoptionssent','boatoptionssent','contractsent','conciergeselling','closedwon','closedlost'];
  list.forEach(c=>{
    const k=getStageKey(c);
    counts[k]=(counts[k]||0)+1;
  });
  bar.innerHTML='';
  ORDER.forEach(k=>{
    if(!counts[k])return;
    const meta=STAGE_META[k]||{label:k,emoji:'·',cls:'t-new'};
    const chip=document.createElement('button');
    chip.title=\`Filtrar: ${meta.label}\`;
    chip.style.cssText='padding:3px 7px;border:1px solid var(--border);background:transparent;font-family:Jost,sans-serif;font-size:9px;color:var(--ink3);cursor:pointer;letter-spacing:.04em;transition:all .1s;white-space:nowrap';
    chip.innerHTML=\`${meta.emoji} ${counts[k]}\`;
    chip.onmouseover=()=>{chip.style.borderColor='var(--gold)';chip.style.color='var(--gold)';};
    chip.onmouseout=()=>{chip.style.borderColor='var(--border)';chip.style.color='var(--ink3)';};
    chip.onclick=()=>{
      const sel=document.getElementById('filter-stage');
      if(sel.value===k){sel.value='';filterClients(document.getElementById('srch').value);}
      else{sel.value=k;filterClients(document.getElementById('srch').value);}
    };
    bar.appendChild(chip);
  });
}

function selectClient(c){
  const isNew = !selClient || selClient.id !== c.id;
  selClient=c;
  chatHistory=[];
  renderList(document.getElementById('srch').value);
  renderDetail();
  updateCtx();
  if(isNew) openClientChat(c);
}

function openClientChat(c){
  // Clear previous messages and start fresh with client context
  document.getElementById('msgs').innerHTML='';
  const info=[];
  if(c.dest) info.push('📍 '+c.dest);
  if(c.dates) info.push('📅 '+c.dates);
  if(c.budget) info.push('💰 '+c.budget);
  if(c.phone) info.push('📱 '+c.phone);
  else if(c.email) info.push('✉ '+c.email);
  const stageMeta2=STAGE_META[getStageKey(c)]||{label:c.dealStage||'—',emoji:'·'};
  const stageStr=\`${stageMeta2.emoji} ${stageMeta2.label}\`;
  const contextLine = info.length ? info.join(' · ') : (lang==='es'?'Sin detalles aún':'No details yet');
  const greeting = lang==='es'
    ? \`Contexto cargado para **${c.name}** — ${contextLine}\\nEtapa: ${stageStr}\\n\\n${c.notes?\`Notas HubSpot: _${c.notes}_\\n\\n\`:''}¿Qué buscamos para este cliente?\`
    : \`Context loaded for **${c.name}** — ${contextLine}\\nStage: ${stageStr}\\n\\n${c.notes?\`HubSpot notes: _${c.notes}_\\n\\n\`:''}What are we looking for this client?\`;
  addMsg('ag', greeting, []);
  document.getElementById('cinput').focus();
}

function renderDetail(){
  if(!selClient)return;
  document.getElementById('det-empty').classList.add('hidden');
  const dc=document.getElementById('det-content');
  dc.classList.remove('hidden');dc.style.display='flex';
  document.getElementById('det-name').textContent=selClient.name;
  document.getElementById('det-ag').textContent=\`Agente: ${agent}\`;
  const qs=selClient.quotes||[];
  const dates=selClient.savedAt||[];
  const t=T[lang];
  // Build contact links
  const phoneLink=selClient.phone?\`<a href="tel:${selClient.phone}" style="color:var(--gold);text-decoration:none">${selClient.phone}</a>\`:'';
  const waLink=selClient.phone?\` <a href="https://wa.me/${selClient.phone.replace(/[^0-9]/g,'')}" target="_blank" style="font-size:10px;color:var(--green);border:1px solid rgba(92,184,122,.3);padding:1px 6px;text-decoration:none;margin-left:4px">WhatsApp ↗</a>\`:'';
  const emailLink=selClient.email?\`<a href="mailto:${selClient.email}" style="color:var(--gold);text-decoration:none;font-size:12px">${selClient.email}</a>\`:'';
  const contactHtml=phoneLink?(phoneLink+waLink+(emailLink?'<br>'+emailLink:'')):(emailLink||\`<span style="color:var(--ink3);font-style:italic;font-size:12px">${t.noData}</span>\`);
  // Deal name vs contact name
  const dealNameLine=selClient.dealName&&selClient.dealName!==selClient.name?\`<div style="font-size:10px;color:var(--ink3);margin-bottom:2px;letter-spacing:.04em">Deal: ${selClient.dealName}</div>\`:'';
  document.getElementById('det-body').innerHTML=\`
    ${dealNameLine}
    <div class="fg2">
      <div class="fg"><div class="fl">Teléfono / Contacto</div><div class="fv">${contactHtml}</div></div>
      <div class="fg"><div class="fl">${t.fieldBudget}</div><div class="fv ${!selClient.budget?'em':''}">${selClient.budget||t.noDefined}</div></div>
      <div class="fg"><div class="fl">${t.fieldDest}</div><div class="fv ${!selClient.dest?'em':''}">${selClient.dest||t.noDash}</div></div>
      <div class="fg"><div class="fl">Fecha cierre / Viaje</div><div class="fv ${!selClient.dates?'em':''}">${selClient.dates||t.noConfirmed}</div></div>
    </div>
    <div class="fg">
      <div class="fl">${t.fieldNotes}</div>
      <div class="fv ${!selClient.notes?'em':''}" style="font-size:12px;line-height:1.7">${selClient.notes||t.noNotes}</div>
    </div>
    <div class="fg">
      <div class="fl">${t.fieldQuotes} (${qs.length})</div>
      ${qs.length?qs.map((q,i)=>\`<div class="qitem"><div class="qitem-t">${q}</div><div class="qitem-d">${dates[i]||'—'} · ${agent}</div></div>\`).join(''):\`<div class="fv em">${t.noQuotes}</div>\`}
    </div>\`;
}

function focusChat(){updateCtx();document.getElementById('cinput').focus();}

function updateCtx(){
  const ce=document.getElementById('ctx-client'),ie=document.getElementById('ctx-info'),sep=document.getElementById('ctx-sep2');
  if(selClient){
    ce.textContent=selClient.name;
    const info=[selClient.dest,selClient.dates,selClient.budget].filter(Boolean).join(' · ');
    ie.textContent=info;sep.style.display=info?'':'none';
  }else{ce.textContent='Sin cliente activo';ie.textContent='';sep.style.display='none';}
}

function openNewClient(){
  editId=null;
  document.getElementById('mttl').textContent=T[lang].mttlNew;
  ['m-n','m-c','m-d','m-f','m-b','m-no'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('m-s').value='new';
  document.getElementById('client-modal').classList.remove('hidden');
}
function editClient(){
  if(!selClient)return;
  editId=selClient.id;
  document.getElementById('mttl').textContent=T[lang].mttlEdit;
  document.getElementById('m-n').value=selClient.name||'';
  document.getElementById('m-c').value=selClient.contact||'';
  document.getElementById('m-d').value=selClient.dest||'';
  document.getElementById('m-f').value=selClient.dates||'';
  document.getElementById('m-b').value=selClient.budget||'';
  document.getElementById('m-s').value=selClient.status||'new';
  document.getElementById('m-no').value=selClient.notes||'';
  document.getElementById('client-modal').classList.remove('hidden');
}
function closeClientModal(){document.getElementById('client-modal').classList.add('hidden');}
function saveClient(){
  const name=document.getElementById('m-n').value.trim();
  if(!name){alert('El nombre es obligatorio');return;}
  const d={name,contact:document.getElementById('m-c').value.trim(),dest:document.getElementById('m-d').value.trim(),dates:document.getElementById('m-f').value.trim(),budget:document.getElementById('m-b').value.trim(),status:document.getElementById('m-s').value,notes:document.getElementById('m-no').value.trim(),quotes:[],savedAt:[]};
  if(editId){
    const idx=clients[agent].findIndex(c=>c.id===editId);
    if(idx>=0){d.id=editId;d.quotes=clients[agent][idx].quotes||[];d.savedAt=clients[agent][idx].savedAt||[];clients[agent][idx]=d;}
    if(selClient&&selClient.id===editId)selClient=d;
  }else{d.id=Date.now().toString();clients[agent].push(d);}
  closeClientModal();renderList();if(selClient)renderDetail();toast(T[lang].toastSaved);
}

function saveQuote(text,btn){
  if(!selClient)return;
  if(!selClient.quotes)selClient.quotes=[];
  if(!selClient.savedAt)selClient.savedAt=[];
  selClient.quotes.push(text);
  selClient.savedAt.push(new Date().toLocaleDateString('es',{day:'numeric',month:'short'}));
  const idx=clients[agent].findIndex(c=>c.id===selClient.id);
  if(idx>=0)clients[agent][idx]=selClient;
  renderDetail();btn.textContent=T[lang].saveQuoteDone;btn.disabled=true;
  toast(T[lang].toastQuote);
}

function addMsg(role,text,cards){
  const msgs=document.getElementById('msgs');
  const d=document.createElement('div');
  d.className=\`msg ${role==='ag'?'':'user'}\`;
  const s=agent?AG[agent]:{i:'?',bg:'#eee',c:'#888'};
  const avS=role==='ag'?'background:var(--ink);color:var(--gold2);font-family:Cormorant Garamond,serif;font-size:11px':\`background:${s.bg};color:${s.c}\`;
  const avT=role==='ag'?'TW':s.i;
  d.innerHTML=\`<div class="mav ${role==='ag'?'ag':'us'}" style="${avS}">${avT}</div><div class="bbl ${role==='ag'?'ag':'us'}"></div>\`;
  msgs.appendChild(d);
  const b=d.querySelector('.bbl');
  if(role==='ag'){
    b.innerHTML=fmt(text);
    if(cards&&cards.length){
      const g=document.createElement('div');g.className='pgrid';
      cards.forEach(card=>{
        const c=document.createElement('div');c.className='pcard';
        c.innerHTML=\`<div class="pc-n">${card.name||''}</div><div class="pc-c">${card.city||''}${card.neighborhood?' · '+card.neighborhood:''}</div><div class="pc-ps">${card.bedrooms?\`<span class="pc-p">${card.bedrooms} hab</span>\`:''} ${card.pax?\`<span class="pc-p">${card.pax} pax</span>\`:''} ${card.capacity?\`<span class="pc-p">${card.capacity} cap</span>\`:''} ${card.type?\`<span class="pc-p">${card.type}</span>\`:''} ${card.rating?\`<span class="pc-p hl">${card.rating}</span>\`:''}</div>\`;
        if(card.link)c.onclick=()=>window.open(card.link,'_blank');
        g.appendChild(c);
      });
      b.appendChild(g);
      if(selClient){
        const btn=document.createElement('button');btn.className='sq-btn';
        btn.textContent=T[lang].saveQuoteBtn;
        btn.onclick=()=>saveQuote(cards.map(c=>c.name).join(', '),btn);
        b.appendChild(btn);
      }
    }
    const t=document.createElement('span');t.className='stag';
    t.textContent='Two Travel · '+new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});
    b.appendChild(t);
  }else{b.textContent=text;}
  msgs.scrollTop=msgs.scrollHeight;
}

function fmt(t){
  return t
    .replace(/^#{1,3} (.+)$/gm,'<strong style="font-size:13px;display:block;margin:8px 0 3px">$1</strong>')
    .replace(/\\*\\*(.*?)\\*\\*/g,'<strong>$1</strong>')
    .replace(/\\*(.*?)\\*/g,'<em>$1</em>')
    .replace(/^[-•] (.+)$/gm,'<div style="padding-left:10px;margin:2px 0">· $1</div>')
    .replace(/^\\d+\\. (.+)$/gm,'<div style="padding-left:10px;margin:2px 0">$1</div>')
    .replace(/\\n\\n/g,'<br><br>')
    .replace(/\\n/g,'<br>');
}

function showTyping(){
  const msgs=document.getElementById('msgs');
  const d=document.createElement('div');d.className='msg';d.id='typing';
  d.innerHTML=\`<div class="mav ag" style="background:var(--ink);color:var(--gold2);font-family:Cormorant Garamond,serif;font-size:11px">TW</div><div class="bbl ag"><div class="typi"><span></span><span></span><span></span></div></div>\`;
  msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;
}
function removeTyping(){const t=document.getElementById('typing');if(t)t.remove();}

function autoR(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,100)+'px';}
function handleKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}
function sh(t){const i=document.getElementById('cinput');i.value=t;autoR(i);i.focus();}
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2500);}

let lang='es';

function L(es,en){return lang==='es'?es:en;}

const T={
  es:{
    loginSub:'Portal de ventas',demoBadge:'Demo · Portafolio cargado',loginLabel:'Selecciona tu perfil',
    hdOnline:'En línea',portfolioTxt:'Portafolio cargado · 565 propiedades',
    colClients:'Mis clientes',srchPh:'Buscar...',addClient:'Nuevo cliente',
    detEmpty:'Selecciona un cliente',btnEdit:'Editar',btnAssistant:'Asistente ↗',
    ctxLbl:'Contexto',ctxDefault:'Sin cliente activo',
    hint1:'Bachelor Medellín',hint2:'Botes Cartagena',hint3:'Venue boda',hint4:'Propuesta WhatsApp',hint5:'Tulum luxury',
    mttlNew:'Nuevo cliente',mttlEdit:'Editar cliente',
    mLabelName:'Nombre completo',mLabelContact:'WhatsApp / Email',mLabelDest:'Destino de interés',
    mLabelDates:'Fechas tentativas',mLabelBudget:'Presupuesto',mLabelStatus:'Estado',mLabelNotes:'Notas del agente',
    mCancel:'Cancelar',mSave:'Guardar',
    statusHot:'Caliente',statusNew:'Nuevo',statusCold:'Frío',
    tagHot:'Caliente',tagNew:'Nuevo',tagCold:'Frío',
    fieldContact:'Contacto',fieldBudget:'Presupuesto',fieldDest:'Destino',fieldDates:'Fechas',
    fieldNotes:'Notas del agente',fieldQuotes:'Cotizaciones guardadas',noQuotes:'Sin cotizaciones aún',noNotes:'Sin notas',noData:'Sin datos',noDefined:'Por definir',noConfirmed:'Por confirmar',noDash:'—',
    saveQuoteBtn:'Guardar cotización en ficha del cliente',saveQuoteDone:'✓ Guardado en ficha',
    toastSaved:'Cliente guardado',toastQuote:'Cotización guardada en la ficha del cliente',
    sourceTag:'Two Travel',
  },
  en:{
    loginSub:'Sales Portal',demoBadge:'Demo · Portfolio loaded',loginLabel:'Select your profile',
    hdOnline:'Online',portfolioTxt:'Portfolio loaded · 565 properties',
    colClients:'My clients',srchPh:'Search...',addClient:'New client',
    detEmpty:'Select a client',btnEdit:'Edit',btnAssistant:'Assistant ↗',
    ctxLbl:'Context',ctxDefault:'No active client',
    hint1:'Bachelor Medellín',hint2:'Boats Cartagena',hint3:'Wedding venue',hint4:'WhatsApp proposal',hint5:'Tulum luxury',
    mttlNew:'New client',mttlEdit:'Edit client',
    mLabelName:'Full name',mLabelContact:'WhatsApp / Email',mLabelDest:'Destination',
    mLabelDates:'Tentative dates',mLabelBudget:'Budget',mLabelStatus:'Status',mLabelNotes:'Agent notes',
    mCancel:'Cancel',mSave:'Save',
    statusHot:'Hot',statusNew:'New',statusCold:'Cold',
    tagHot:'Hot',tagNew:'New',tagCold:'Cold',
    fieldContact:'Contact',fieldBudget:'Budget',fieldDest:'Destination',fieldDates:'Dates',
    fieldNotes:'Agent notes',fieldQuotes:'Saved quotes',noQuotes:'No quotes yet',noNotes:'No notes',noData:'No data',noDefined:'TBD',noConfirmed:'TBC',noDash:'—',
    saveQuoteBtn:'Save quote to client file',saveQuoteDone:'✓ Saved to file',
    toastSaved:'Client saved',toastQuote:'Quote saved to client file',
    sourceTag:'Two Travel',
  }
};

function toggleLang(){
  lang=lang==='es'?'en':'es';
  const t=T[lang];
  document.getElementById('lang-btn').textContent=lang==='es'?'EN':'ES';
  document.getElementById('login-sub').textContent=t.loginSub;
  document.getElementById('demo-badge').textContent=t.demoBadge;
  document.getElementById('login-label').textContent=t.loginLabel;
  document.getElementById('hd-online').textContent=t.hdOnline;
  document.querySelector('.portfolio-badge').lastChild.textContent=' '+t.portfolioTxt;
  document.getElementById('col-ttl-clients').textContent=t.colClients;
  document.getElementById('srch').placeholder=t.srchPh;
  document.getElementById('add-client-txt').textContent=t.addClient;
  document.getElementById('det-empty-txt').textContent=t.detEmpty;
  const be=document.getElementById('btn-edit');if(be)be.textContent=t.btnEdit;
  const ba=document.getElementById('btn-assistant');if(ba)ba.textContent=t.btnAssistant;
  document.getElementById('ctx-lbl').textContent=t.ctxLbl;
  const cc=document.getElementById('ctx-client');
  if(cc&&cc.textContent===T[lang==='es'?'en':'es'].ctxDefault)cc.textContent=t.ctxDefault;
  document.getElementById('cinput').placeholder=lang==='es'?
    'Pide opciones del portafolio, arma una propuesta, consulta disponibilidad...':
    'Ask for portfolio options, build a proposal, check availability...';
  document.getElementById('hint-1').textContent=t.hint1;
  document.getElementById('hint-2').textContent=t.hint2;
  document.getElementById('hint-3').textContent=t.hint3;
  document.getElementById('hint-4').textContent=t.hint4;
  document.getElementById('hint-5').textContent=t.hint5;
  document.getElementById('ml-name').textContent=t.mLabelName;
  document.getElementById('ml-contact').textContent=t.mLabelContact;
  document.getElementById('ml-dest').textContent=t.mLabelDest;
  document.getElementById('ml-dates').textContent=t.mLabelDates;
  document.getElementById('ml-budget').textContent=t.mLabelBudget;
  document.getElementById('ml-status').textContent=t.mLabelStatus;
  document.getElementById('ml-notes').textContent=t.mLabelNotes;
  document.getElementById('ml-cancel').textContent=t.mCancel;
  document.getElementById('ml-save').textContent=t.mSave;
  document.getElementById('mopt-new').textContent=t.statusNew;
  document.getElementById('mopt-hot').textContent=t.statusHot;
  document.getElementById('mopt-cold').textContent=t.statusCold;
  if(selClient)renderDetail();
  renderList(document.getElementById('srch').value);
}

// ── Integration status badges ──────────────────────────────────
async function checkIntegrations(){
  const bar=document.getElementById('int-status');
  bar.innerHTML='';
  const checks=[
    {key:'claude',label:'Claude AI',url:'/api/chat',body:{messages:[{role:'user',content:'ping'}],clientContext:null,agentName:null}},
    {key:'hubspot',label:'HubSpot',url:'/api/hubspot',body:{action:'get_contacts',data:{limit:1}}},
    {key:'notion',label:'Notion',url:'/api/notion',body:{action:'ping',data:{}}},
  ];
  for(const c of checks){
    try{
      const r=await fetch(c.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c.body)});
      const d=await r.json();
      INT[c.key]=!d.demo&&r.ok;
    }catch{INT[c.key]=false;}
    const dot=document.createElement('div');
    dot.title=c.label+(INT[c.key]?' conectado':' — no configurado');
    dot.style.cssText=\`display:flex;align-items:center;gap:3px;font-size:9px;letter-spacing:.06em;padding:3px 7px;border:1px solid ${INT[c.key]?'rgba(92,184,122,.35)':'var(--border)'};color:${INT[c.key]?'#3a9960':'var(--ink3)'};background:${INT[c.key]?'rgba(92,184,122,.06)':'transparent'};cursor:default\`;
    dot.innerHTML=\`<div style="width:4px;height:4px;border-radius:50%;background:${INT[c.key]?'#5cb87a':'var(--ink3)'}"></div>${c.label}\`;
    bar.appendChild(dot);
  }
}

function intDot(key){
  const d=document.querySelector(\`#int-status [title^="${key==='claude'?'Claude':key==='hubspot'?'HubSpot':'Notion'}"]\`);
  if(!d)return;
  d.style.borderColor='rgba(154,125,82,.4)';d.style.color='var(--gold)';d.style.background='rgba(154,125,82,.06)';
  d.querySelector('div').style.background='var(--gold2)';
  setTimeout(()=>{const ok=INT[key];d.style.borderColor=ok?'rgba(92,184,122,.35)':'var(--border)';d.style.color=ok?'#3a9960':'var(--ink3)';d.style.background=ok?'rgba(92,184,122,.06)':'transparent';d.querySelector('div').style.background=ok?'#5cb87a':'var(--ink3)';},1500);
}

// ── Real Claude API call ───────────────────────────────────────
async function callClaudeAPI(userText){
  const clientCtx=selClient?{name:selClient.name,dealName:selClient.dealName||selClient.name,phone:selClient.phone||'',email:selClient.email||'',destination:selClient.dest,dates:selClient.dates,budget:selClient.budget,status:selClient.status,pipelineStage:selClient.dealStage,notes:selClient.notes,agentName:agent}:null;
  chatHistory.push({role:'user',content:userText});
  try{
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({messages:chatHistory.slice(-12),clientContext:clientCtx,agentName:agent})});
    if(!r.ok){chatHistory.pop();return null;}
    const d=await r.json();
    if(d.demo){chatHistory.pop();return null;}
    if(!d.text){chatHistory.pop();return null;}
    chatHistory.push({role:'assistant',content:d.text});
    INT.claude=true;
    intDot('claude');
    return{text:d.text,cards:[]};
  }catch(e){chatHistory.pop();console.warn('Claude API error:',e.message);return null;}
}

// ── HubSpot sync (fire-and-forget) ────────────────────────────
async function syncHubSpot(userMsg,agentMsg){
  if(!selClient||!INT.hubspot)return;
  try{
    const email=selClient.contact?.includes('@')?selClient.contact:\`agent_${selClient.id.replace(/\\D/g,'')}@twotravelcrm.internal\`;
    const cr=await fetch('/api/hubspot',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'upsert_contact',data:{email,firstName:selClient.name.split(' ')[0],lastName:selClient.name.split(' ').slice(1).join(' ')||'',phone:selClient.contact?.startsWith('+')?selClient.contact:'',status:selClient.status==='hot'?'IN_PROGRESS':selClient.status==='new'?'NEW':'OPEN',destination:selClient.dest,agent,notes:selClient.notes}})});
    const cd=await cr.json();
    if(cd.contactId){
      await fetch('/api/hubspot',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'log_note',data:{contactId:cd.contactId,noteText:\`[${agent}]\\nClient: ${userMsg}\\nAssistant: ${agentMsg.slice(0,500)}\`,timestamp:new Date().toISOString()}})});
      intDot('hubspot');
    }
  }catch(e){console.warn('HubSpot sync error',e);}
}

// ── Notion sync (fire-and-forget) ─────────────────────────────
async function syncNotion(userMsg,agentMsg){
  if(!selClient||!INT.notion)return;
  try{
    await fetch('/api/notion',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'log_conversation',data:{clientName:selClient.name,agentName:agent,messages:[{role:'user',content:userMsg},{role:'assistant',content:agentMsg}],summary:agentMsg.slice(0,180),destination:selClient.dest,status:selClient.status==='hot'?'Hot':selClient.status==='new'?'New':'Cold',timestamp:new Date().toISOString()}})});
    intDot('notion');
  }catch(e){console.warn('Notion sync error',e);}
}

// ── Main send ─────────────────────────────────────────────────
async function send(){
  if(busy)return;
  const inp=document.getElementById('cinput');
  const text=inp.value.trim();if(!text)return;
  addMsg('us',text,[]);
  inp.value='';inp.style.height='auto';
  busy=true;document.getElementById('sbtn').disabled=true;showTyping();

  let result=null;

  // Always try real Claude first — fall back to demo only if it errors
  result=await callClaudeAPI(text);

  // Fall back to demo if Claude unavailable
  if(!result){
    const reply=getReply(text);
    await new Promise(r=>setTimeout(r,900+Math.random()*700));
    result={
      text:typeof reply.text==='function'?reply.text(selClient):reply.text,
      cards:typeof reply.cards==='function'?reply.cards(selClient):(reply.cards||[])
    };
  }

  removeTyping();
  addMsg('ag',result.text,result.cards);
  busy=false;document.getElementById('sbtn').disabled=false;

  // Background syncs (non-blocking)
  syncHubSpot(text,result.text);
  syncNotion(text,result.text);
}
</script>
</body>
</html>
`;

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(HTML);
};
