import { Resend } from "resend";
import { env } from "@mascotinhos/env/server";

function getResend() {
  if (!env.RESEND_API_KEY) return null;
  return new Resend(env.RESEND_API_KEY);
}

const FROM = env.RESEND_FROM_EMAIL ?? "Músicas Personalizadas <noreply@musicaspersonalizadas.com.br>";
const BASE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3001";

export async function sendOrderConfirmationEmail({
  to,
  nomeCliente,
  nomeHomenageado,
  orderId,
}: {
  to: string;
  nomeCliente: string;
  nomeHomenageado: string;
  orderId: string;
}) {
  const resend = getResend();
  if (!resend) return;

  const link = `${BASE_URL}/pedido/${orderId}/acompanhar`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `🎵 Seu pedido foi recebido! Música para ${nomeHomenageado}`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="color: #b10b68; font-size: 24px; margin-bottom: 8px;">Pedido recebido! 🎵</h1>
        <p style="font-size: 16px; color: #444;">Olá, <strong>${nomeCliente}</strong>!</p>
        <p style="font-size: 16px; color: #444;">
          Recebemos seu pedido de música personalizada para <strong>${nomeHomenageado}</strong>.
          Assim que o pagamento for confirmado, começaremos a criar sua música.
        </p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${link}" style="background: #b10b68; color: white; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Acompanhar meu pedido
          </a>
        </div>
        <p style="font-size: 13px; color: #888;">
          Guarde esse e-mail — o link acima é onde você vai ouvir e baixar sua música quando ficar pronta.
        </p>
        <hr style="border: none; border-top: 1px solid #f0dde0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #aaa; text-align: center;">Músicas Personalizadas &mdash; feitas com carinho ❤️</p>
      </div>
    `,
  });
}

export async function sendMusicReadyEmail({
  to,
  nomeCliente,
  nomeHomenageado,
  orderId,
  musicaTitulo,
  audioUrl,
}: {
  to: string;
  nomeCliente: string;
  nomeHomenageado: string;
  orderId: string;
  musicaTitulo?: string | null;
  audioUrl: string;
}) {
  const resend = getResend();
  if (!resend) return;

  const link = `${BASE_URL}/pedido/${orderId}/acompanhar`;
  const titulo = musicaTitulo ? `"${musicaTitulo}"` : `para ${nomeHomenageado}`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `🎉 Sua música está pronta! ${titulo}`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="color: #b10b68; font-size: 24px; margin-bottom: 8px;">Sua música está pronta! 🎉</h1>
        <p style="font-size: 16px; color: #444;">Olá, <strong>${nomeCliente}</strong>!</p>
        <p style="font-size: 16px; color: #444;">
          A música personalizada ${titulo} ficou incrível. Clique abaixo para ouvir e baixar!
        </p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${link}" style="background: #b10b68; color: white; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Ouvir e baixar minha música
          </a>
        </div>
        <p style="font-size: 13px; color: #888;">
          Você também pode baixar o arquivo de áudio direto pelo link acima.
        </p>
        <hr style="border: none; border-top: 1px solid #f0dde0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #aaa; text-align: center;">Músicas Personalizadas &mdash; feitas com carinho ❤️</p>
      </div>
    `,
  });
}
