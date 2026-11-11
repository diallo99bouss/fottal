// Interface web — parle à l'API Express (/api/...)
(function () {
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const S = { user: null, tab: 'bord', q: '', modal: null };
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = (n) => Number(n || 0).toLocaleString('fr-FR') + ' €';
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (d) => { if (!d) return '—'; const [y, m, j] = String(d).slice(0, 10).split('-'); return `${+j} ${MOIS[+m - 1]} ${y}`; };
  const initials = (m) => ((m.prenom || '')[0] || '') + ((m.nom || '')[0] || '');
  const isAdmin = () => S.user && S.user.role === 'admin';

  // ---------- API ----------
  async function api(method, url, body) {
    const res = await fetch('/api' + url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && url !== '/auth/login') { showLogin(); throw new Error(data.erreur || 'Connexion requise'); }
    if (!res.ok) throw new Error(data.erreur || 'Erreur ' + res.status);
    return data;
  }

  function toast(t) {
    const el = $('#toast'); el.textContent = t; el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (el.hidden = true), 2600);
  }
  const fail = (e) => toast(e.message || 'Erreur');

  // ---------- Connexion ----------
  function showLogin() { S.user = null; closeModal(); $('#app').hidden = true; $('#login').hidden = false; $('#l-email').focus(); }
  function showApp() {
    $('#login').hidden = true; $('#app').hidden = false;
    const chip = $('#roleChip');
    chip.textContent = (isAdmin() ? 'Administrateur' : 'Agent') + ' · ' + S.user.nom;
    chip.className = 'chip' + (isAdmin() ? '' : ' agent');
    render();
  }
  $('#fLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#l-err'); err.hidden = true;
    try {
      S.user = await api('POST', '/auth/login', { email: $('#l-email').value, motDePasse: $('#l-mdp').value });
      $('#l-mdp').value = '';
      showApp();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  $('#logout').addEventListener('click', async () => { await api('POST', '/auth/logout').catch(() => {}); showLogin(); });

  // ---------- Vues ----------
  function meetingRow(r) {
    const [y, m, d] = r.date.split('-');
    const pct = r.attendus ? Math.round((r.payes / r.attendus) * 100) : 0;
    return `<div class="row click" tabindex="0" data-open-meeting="${r.id}">
      <div class="datebox"><div class="d num">${+d}</div><div class="m">${MOIS[+m - 1]} ${y.slice(2)}</div></div>
      <div class="main"><b>${esc(r.lieu || 'Réunion')}</b>
        <span class="sub num">${r.payes}/${r.attendus} payé · ${eur(r.encaisse)} encaissés${r.date > today() ? ' · à venir' : ''}</span>
        <div class="bar"><i style="width:${pct}%"></i></div></div>
      ${r.reste > 0 ? `<span class="pill due num">${eur(r.reste)} dus</span>` : r.attendus ? '<span class="pill ok">Complet</span>' : ''}
    </div>`;
  }
  function memberRow(m) {
    return `<div class="row click" tabindex="0" data-open-member="${m.id}">
      <div class="avatar">${esc(initials(m).toUpperCase())}</div>
      <div class="main"><b>${esc(m.prenom)} ${esc(m.nom)}</b><span class="sub">${esc(m.telephone || 'Pas de téléphone')} · membre depuis ${fmtDate(m.date_adhesion)}${m.actif ? '' : ' · inactif'}</span></div>
      ${m.montant_du > 0 ? `<span class="pill due num">${eur(m.montant_du)} dus</span>` : '<span class="pill ok">À jour</span>'}
    </div>`;
  }
  const loading = '<div class="list"><div class="empty">Chargement…</div></div>';

  async function render() {
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === S.tab));
    const v = $('#view');
    try {
      if (S.tab === 'bord') {
        if (!v.innerHTML) v.innerHTML = loading;
        const [t, membres] = await Promise.all([api('GET', '/tableau'), api('GET', '/membres')]);
        const retard = membres.filter((m) => m.montant_du > 0).sort((a, b) => b.montant_du - a.montant_du).slice(0, 8);
        let prochaine = '';
        if (t.prochaine_reunion) {
          const r = await api('GET', '/reunions/' + t.prochaine_reunion.id);
          prochaine = meetingRow(r);
        } else {
          prochaine = `<div class="empty">Aucune réunion planifiée.${t.date_conseillee ? ` La suivante tombe vers le <b>${fmtDate(t.date_conseillee)}</b>.` : ''}</div>`;
        }
        v.innerHTML = `
          <div class="section"><div class="stats">
            <div class="stat"><span class="k">Membres actifs</span><span class="v num">${t.membres}</span></div>
            <div class="stat"><span class="k">En caisse</span><span class="v num">${eur(t.en_caisse)}</span></div>
            <div class="stat due"><span class="k">Restant dû</span><span class="v num">${eur(t.restant_du)}</span></div>
          </div></div>
          <div class="section"><div class="sec-head"><h2>Prochaine réunion</h2>${isAdmin() ? '<button class="btn primary" data-action="new-meeting">+ Réunion</button>' : ''}</div>
            <div class="list">${prochaine}</div></div>
          <div class="section"><h2>Cotisations en retard</h2>
            <div class="list">${retard.length ? retard.map(memberRow).join('') : '<div class="empty">Tous les membres sont à jour.</div>'}</div></div>`;
      }
      if (S.tab === 'membres') {
        const membres = await api('GET', '/membres' + (S.q ? '?q=' + encodeURIComponent(S.q) : ''));
        const hadFocus = document.activeElement && document.activeElement.id === 'q';
        v.innerHTML = `<div class="section">
          <div class="sec-head"><h2>Membres <span class="muted num">(${membres.length})</span></h2>${isAdmin() ? '<button class="btn primary" data-action="new-member">+ Membre</button>' : ''}</div>
          <input id="q" type="search" placeholder="Rechercher un nom ou un téléphone" value="${esc(S.q)}">
          <div class="list">${membres.length ? membres.map(memberRow).join('') : `<div class="empty">${S.q ? 'Aucun membre ne correspond.' : 'Aucun membre pour l\'instant.' + (isAdmin() ? ' Ajoutez le premier avec « + Membre ».' : '')}</div>`}</div>
        </div>`;
        if (hadFocus) { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
      }
      if (S.tab === 'reunions') {
        const [reunions, p] = await Promise.all([api('GET', '/reunions'), api('GET', '/reunions/prochaine-date')]);
        v.innerHTML = `<div class="section">
          <div class="sec-head"><h2>Réunions</h2>${isAdmin() ? '<button class="btn primary" data-action="new-meeting">+ Réunion</button>' : ''}</div>
          ${p.date ? `<p class="rule">Prochaine date conseillée : <b>${fmtDate(p.date)}</b></p>` : ''}
          <div class="list">${reunions.length ? reunions.map(meetingRow).join('') : `<div class="empty">Aucune réunion.${isAdmin() ? ' Créez la première avec « + Réunion ».' : ''}</div>`}</div>
        </div>`;
      }
    } catch (e) { if (S.user) v.innerHTML = `<div class="list"><div class="empty">${esc(e.message)}</div></div>`; }
  }

  // ---------- Fenêtres ----------
  function openModal(html) {
    $('#modalRoot').innerHTML = `<div class="scrim" data-scrim><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
    return $('#modalRoot .sheet');
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; S.modal = null; }

  function memberForm(m) {
    const isNew = !m;
    m = m || { prenom: '', nom: '', telephone: '', email: '', date_adhesion: today(), actif: true };
    S.modal = { kind: 'form' };
    const sh = openModal(`<div class="sheet-head"><h2>${isNew ? 'Nouveau membre' : 'Modifier le membre'}</h2><button class="btn" data-close>Fermer</button></div>
      <form id="fMember" class="section">
        <div class="grid2"><label>Prénom<input id="f-prenom" required value="${esc(m.prenom)}"></label><label>Nom<input id="f-nom" required value="${esc(m.nom)}"></label></div>
        <div class="grid2"><label>Téléphone<input id="f-tel" type="tel" value="${esc(m.telephone)}"></label><label>Email<input id="f-email" type="email" value="${esc(m.email)}"></label></div>
        <div class="grid2"><label>Date d'adhésion<input id="f-adh" type="date" required value="${esc(m.date_adhesion)}"></label>
          <label>Statut<select id="f-actif"><option value="1" ${m.actif ? 'selected' : ''}>Actif</option><option value="0" ${m.actif ? '' : 'selected'}>Inactif</option></select></label></div>
        <div class="actions"><button type="submit" class="btn primary">${isNew ? 'Ajouter le membre' : 'Enregistrer'}</button></div>
      </form>`);
    $('#f-prenom', sh).focus();
    $('#fMember', sh).addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = { prenom: $('#f-prenom', sh).value, nom: $('#f-nom', sh).value, telephone: $('#f-tel', sh).value, email: $('#f-email', sh).value, date_adhesion: $('#f-adh', sh).value, actif: $('#f-actif', sh).value === '1' };
      try {
        if (isNew) await api('POST', '/membres', body); else await api('PUT', '/membres/' + m.id, body);
        closeModal(); toast(isNew ? 'Membre ajouté' : 'Membre modifié'); render();
      } catch (ex) { fail(ex); }
    });
  }

  async function memberDetail(id) {
    try {
      const m = await api('GET', '/membres/' + id);
      S.modal = { kind: 'member', id, data: m };
      const sh = openModal(`<div class="sheet-head"><div><h2>${esc(m.prenom)} ${esc(m.nom)}</h2><p class="rule">${esc(m.telephone || 'Pas de téléphone')} · depuis le ${fmtDate(m.date_adhesion)}</p></div><button class="btn" data-close>Fermer</button></div>
        <div class="stats" style="grid-template-columns:1fr 1fr"><div class="stat"><span class="k">Réunions dues</span><span class="v num">${m.reunions_dues}</span></div><div class="stat due"><span class="k">Montant dû</span><span class="v num">${eur(m.montant_du)}</span></div></div>
        <div class="list">${m.historique.length ? m.historique.map((r) => {
          const p = !!r.cotisation_id;
          return `<div class="row"><div class="main"><b>${fmtDate(r.date)}</b><span class="sub">${esc(r.lieu || 'Réunion')}</span></div>
            <button class="btn pay ${p ? 'paid' : ''}" data-toggle-pay="${r.id}|${m.id}|${p ? 1 : 0}">${p ? '✓ Payé' : 'Encaisser ' + eur(r.montant)}</button></div>`;
        }).join('') : '<div class="empty">Aucune réunion depuis son adhésion.</div>'}</div>
        ${isAdmin() ? `<div class="actions"><button class="btn danger" data-ask-del>Supprimer</button><button class="btn" data-edit-member>Modifier</button></div>
        <div class="confirm" data-confirm hidden>Supprimer ${esc(m.prenom)} ${esc(m.nom)} et son historique de cotisations ? Cette action est définitive.
          <div class="actions"><button class="btn" data-cancel-del>Annuler</button><button class="btn danger" data-del="membres/${m.id}">Supprimer définitivement</button></div></div>` : ''}`);
      return sh;
    } catch (e) { fail(e); }
  }

  async function meetingForm(r) {
    const isNew = !r;
    if (isNew) {
      const p = await api('GET', '/reunions/prochaine-date').catch(() => ({}));
      r = { date: p.date || today(), lieu: '', notes: '', montant: 30 };
    }
    S.modal = { kind: 'form' };
    const sh = openModal(`<div class="sheet-head"><h2>${isNew ? 'Nouvelle réunion' : 'Modifier la réunion'}</h2><button class="btn" data-close>Fermer</button></div>
      <form id="fMeeting" class="section">
        <div class="grid2"><label>Date<input id="f-date" type="date" required value="${esc(r.date)}"></label><label>Cotisation (€)<input id="f-mont" type="number" min="0" step="1" required value="${esc(r.montant)}"></label></div>
        <label>Lieu<input id="f-lieu" placeholder="Salle, adresse…" value="${esc(r.lieu)}"></label>
        <label>Ordre du jour / notes<textarea id="f-notes" rows="3">${esc(r.notes)}</textarea></label>
        <div class="actions"><button type="submit" class="btn primary">${isNew ? 'Créer la réunion' : 'Enregistrer'}</button></div>
      </form>`);
    $('#fMeeting', sh).addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = { date: $('#f-date', sh).value, montant: $('#f-mont', sh).value, lieu: $('#f-lieu', sh).value, notes: $('#f-notes', sh).value };
      try {
        if (isNew) await api('POST', '/reunions', body); else await api('PUT', '/reunions/' + r.id, body);
        closeModal(); toast(isNew ? 'Réunion créée' : 'Réunion modifiée'); render();
      } catch (ex) { fail(ex); }
    });
  }

  async function meetingDetail(id) {
    try {
      const r = await api('GET', '/reunions/' + id);
      S.modal = { kind: 'meeting', id, data: r };
      openModal(`<div class="sheet-head"><div><h2>Réunion du ${fmtDate(r.date)}</h2><p class="rule">${esc(r.lieu || 'Lieu non précisé')} · cotisation ${eur(r.montant)}</p></div><button class="btn" data-close>Fermer</button></div>
        ${r.notes ? `<p class="rule" style="white-space:pre-wrap">${esc(r.notes)}</p>` : ''}
        <div class="stats"><div class="stat"><span class="k">Payé</span><span class="v num">${r.payes}/${r.attendus}</span></div><div class="stat"><span class="k">Encaissé</span><span class="v num">${eur(r.encaisse)}</span></div><div class="stat due"><span class="k">Reste</span><span class="v num">${eur(r.reste)}</span></div></div>
        <div class="list">${r.membres.length ? r.membres.map((m) => {
          const p = !!m.cotisation_id;
          return `<div class="row"><div class="avatar">${esc(initials(m).toUpperCase())}</div><div class="main"><b>${esc(m.prenom)} ${esc(m.nom)}</b>${p ? `<span class="sub">Payé le ${fmtDate(m.paye_le)}</span>` : ''}</div>
            <button class="btn pay ${p ? 'paid' : ''}" data-toggle-pay="${r.id}|${m.id}|${p ? 1 : 0}">${p ? '✓ Payé' : 'Encaisser'}</button></div>`;
        }).join('') : '<div class="empty">Aucun membre inscrit à cette date.</div>'}</div>
        ${isAdmin() ? `<div class="actions"><button class="btn danger" data-ask-del>Supprimer</button><button class="btn" data-edit-meeting>Modifier</button></div>
        <div class="confirm" data-confirm hidden>Supprimer cette réunion et les cotisations enregistrées pour elle ? Cette action est définitive.
          <div class="actions"><button class="btn" data-cancel-del>Annuler</button><button class="btn danger" data-del="reunions/${r.id}">Supprimer définitivement</button></div></div>` : ''}`);
    } catch (e) { fail(e); }
  }

  async function refreshModal() {
    if (!S.modal) return;
    const sc = $('#modalRoot .sheet')?.scrollTop || 0;
    if (S.modal.kind === 'meeting') await meetingDetail(S.modal.id);
    if (S.modal.kind === 'member') await memberDetail(S.modal.id);
    const s = $('#modalRoot .sheet'); if (s) s.scrollTop = sc;
  }

  // ---------- Événements ----------
  $('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    S.tab = b.dataset.tab; $('#view').innerHTML = ''; render();
  });
  let searchT;
  document.addEventListener('input', (e) => {
    if (e.target.id === 'q') { S.q = e.target.value; clearTimeout(searchT); searchT = setTimeout(render, 250); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.modal) closeModal();
    if (e.key === 'Enter' && e.target.matches('.row.click')) e.target.click();
  });
  let busy = false;
  document.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.matches('[data-scrim]') || t.closest('[data-close]')) return closeModal();
    const a = t.closest('[data-action]');
    if (a) return a.dataset.action === 'new-member' ? memberForm() : meetingForm();
    const om = t.closest('[data-open-meeting]'); if (om) return meetingDetail(om.dataset.openMeeting);
    const ob = t.closest('[data-open-member]'); if (ob) return memberDetail(ob.dataset.openMember);
    if (t.closest('[data-edit-member]')) return memberForm(S.modal.data);
    if (t.closest('[data-edit-meeting]')) return meetingForm(S.modal.data);
    if (t.closest('[data-ask-del]')) { $('[data-confirm]').hidden = false; return; }
    if (t.closest('[data-cancel-del]')) { $('[data-confirm]').hidden = true; return; }
    const del = t.closest('[data-del]');
    if (del) {
      try { await api('DELETE', '/' + del.dataset.del); closeModal(); toast('Supprimé'); render(); } catch (ex) { fail(ex); }
      return;
    }
    const tp = t.closest('[data-toggle-pay]');
    if (tp && !busy) {
      busy = true; tp.disabled = true;
      const [reunion, membre, paye] = tp.dataset.togglePay.split('|');
      try {
        if (paye === '1') { await api('DELETE', `/reunions/${reunion}/cotisations/${membre}`); toast('Paiement annulé'); }
        else { await api('POST', `/reunions/${reunion}/cotisations`, { membre_id: Number(membre) }); toast('Cotisation encaissée'); }
        await refreshModal(); render();
      } catch (ex) { fail(ex); tp.disabled = false; }
      busy = false;
    }
  });

  // ---------- Démarrage ----------
  api('GET', '/auth/me').then((u) => { S.user = u; showApp(); }).catch(() => showLogin());
})();
