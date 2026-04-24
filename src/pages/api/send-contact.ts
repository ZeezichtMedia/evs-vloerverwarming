import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

export const prerender = false;

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHtml(data: Record<string, string>) {
  const rows: [string, string][] = [
    ['Naam', data.naam || ''],
    ['E-mailadres', data.email || ''],
    ['Telefoon', data.telefoon || ''],
  ].filter(([, v]) => v) as [string, string][];

  const tableRows = rows.map(([label, value]) => `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#1d3557;white-space:nowrap;">${escapeHtml(label)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#333;">${escapeHtml(value)}</td>
  </tr>`).join('');

  const message = escapeHtml(data.bericht || '').replace(/\n/g, '<br/>');

  return `<!doctype html>
  <html><body style="font-family:Arial,sans-serif;background:#f6f6f6;padding:20px;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
      <div style="background:#e63946;color:#fff;padding:20px 24px;">
        <h2 style="margin:0;">Nieuw contactbericht</h2>
      </div>
      <div style="padding:24px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">${tableRows}</table>
        <div style="background:#f4f1ec;border-radius:6px;padding:16px;color:#1d3557;">
          <div style="font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#8a8478;margin-bottom:8px;">Bericht</div>
          <div style="color:#333;line-height:1.6;">${message}</div>
        </div>
      </div>
    </div>
  </body></html>`;
}

function renderText(data: Record<string, string>) {
  return [
    `Naam: ${data.naam || ''}`,
    `E-mail: ${data.email || ''}`,
    `Telefoon: ${data.telefoon || ''}`,
    ``,
    `Bericht:`,
    data.bericht || '',
  ].join('\n');
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = (await request.json()) as Record<string, string>;

    // Honeypot: als dit veld gevuld is → bot, stilletjes OK returnen
    if (data.website) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Basic validatie
    const required = ['naam', 'email', 'bericht'];
    for (const field of required) {
      if (!(data[field] || '').trim()) {
        return new Response(JSON.stringify({ error: `Veld "${field}" is verplicht.` }), { status: 400 });
      }
    }

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

    await transporter.sendMail({
      from,
      to,
      replyTo: data.email || undefined,
      subject: `Contactbericht – ${data.naam}`,
      text: renderText(data),
      html: renderHtml(data),
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('send-contact error', err);
    return new Response(JSON.stringify({ error: 'Verzenden mislukt.' }), { status: 500 });
  }
};
