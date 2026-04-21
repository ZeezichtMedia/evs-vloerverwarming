import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

export const prerender = false;

const LABELS: Record<string, string> = {
  verdieping: 'Verdieping',
  verdieping_anders: 'Andere verdieping',
  type_vloer: 'Type vloer',
  area_m2: 'Oppervlakte (m²)',
  warmtebron: 'Warmtebron',
  verdeler_aansluiten: 'Verdeler aansluiten',
  vloer_dichtsmeren: 'Vloer dichtsmeren',
  montagedatum_type: 'Montagedatum keuze',
  montagedatum: 'Gewenste datum',
  voornaam: 'Voornaam',
  achternaam: 'Achternaam',
  email: 'E-mailadres',
  telefoon: 'Telefoonnummer',
  land: 'Land',
  adres: 'Adres',
  huisnummer: 'Huisnummer',
  postcode: 'Postcode',
  plaats: 'Plaats',
  toelichting: 'Toelichting',
};

const VALUE_LABELS: Record<string, string> = {
  begaande_grond: 'Begaande grond',
  eerste_verdieping: 'Eerste verdieping',
  zolder: 'Zolder',
  anders: 'Anders',
  cement_dekvloer: 'Cement dekvloer',
  tegelvloer: 'Tegelvloer',
  betonvloer: 'Betonvloer',
  fermacelvloer: 'Fermacelvloer',
  cv_ketel: 'CV ketel',
  hybride_warmtepomp: 'Hybride warmtepomp',
  volledige_warmtepomp: 'Volledige warmtepomp',
  stadsverwarming: 'Stadsverwarming',
  toekomstige_warmtepomp: 'Toekomstige warmtepomp',
  ja: 'Ja',
  nee: 'Nee',
  datum: 'Specifieke datum',
  weet_niet: 'Weet ik nog niet',
};

function humanize(key: string, val: string) {
  return VALUE_LABELS[val] || val;
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildRows(data: Record<string, string>) {
  const order = [
    'verdieping', 'verdieping_anders', 'type_vloer', 'area_m2', 'warmtebron',
    'verdeler_aansluiten', 'vloer_dichtsmeren', 'montagedatum_type', 'montagedatum',
    'voornaam', 'achternaam', 'email', 'telefoon',
    'land', 'adres', 'huisnummer', 'postcode', 'plaats', 'toelichting',
  ];
  return order
    .filter(k => data[k] !== undefined && data[k] !== '' && data[k] !== null)
    .map(k => ({ key: k, label: LABELS[k] || k, value: humanize(k, data[k]) }));
}

function renderHtml(data: Record<string, string>) {
  const rows = buildRows(data)
    .map(r => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#1d3557;vertical-align:top;white-space:nowrap;">${escapeHtml(r.label)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#333;">${escapeHtml(r.value)}</td>
    </tr>`)
    .join('');
  return `<!doctype html>
  <html><body style="font-family:Arial,sans-serif;background:#f6f6f6;padding:20px;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
      <div style="background:#e63946;color:#fff;padding:20px 24px;">
        <h2 style="margin:0;">Nieuwe offerteaanvraag</h2>
      </div>
      <div style="padding:24px;">
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>
    </div>
  </body></html>`;
}

function renderText(data: Record<string, string>) {
  return buildRows(data).map(r => `${r.label}: ${r.value}`).join('\n');
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json() as Record<string, string>;

    const host = import.meta.env.SMTP_HOST;
    const port = Number(import.meta.env.SMTP_PORT || 587);
    const user = import.meta.env.SMTP_USER;
    const pass = import.meta.env.SMTP_PASS;
    const from = import.meta.env.MAIL_FROM || user;
    const to = import.meta.env.MAIL_TO;

    if (!host || !user || !pass || !to) {
      console.error('SMTP env vars missing');
      return new Response(JSON.stringify({ error: 'Server is niet geconfigureerd.' }), { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const html = renderHtml(data);
    const text = renderText(data);
    const naam = [data.voornaam, data.achternaam].filter(Boolean).join(' ').trim() || 'website';

    await transporter.sendMail({
      from,
      to,
      replyTo: data.email || undefined,
      subject: `Offerteaanvraag – ${naam}`,
      text,
      html,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('send-offerte error', err);
    return new Response(JSON.stringify({ error: 'Verzenden mislukt.' }), { status: 500 });
  }
};
