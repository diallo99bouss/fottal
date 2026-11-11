const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class ErreurValidation extends Error {
  constructor(message) { super(message); this.status = 400; }
}

function texte(v, champ, { requis = false } = {}) {
  if (v === undefined || v === null || String(v).trim() === '') {
    if (requis) throw new ErreurValidation(`Le champ « ${champ} » est obligatoire`);
    return null;
  }
  return String(v).trim();
}

function date(v, champ, { requis = false } = {}) {
  const t = texte(v, champ, { requis });
  if (t === null) return null;
  if (!DATE_RE.test(t) || isNaN(Date.parse(t))) throw new ErreurValidation(`Date invalide pour « ${champ} » (format AAAA-MM-JJ)`);
  return t;
}

function montant(v, champ, defaut) {
  if (v === undefined || v === null || v === '') return defaut;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new ErreurValidation(`Montant invalide pour « ${champ} »`);
  return n;
}

function id(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ErreurValidation('Identifiant invalide');
  return n;
}

module.exports = { ErreurValidation, texte, date, montant, id };
