// Envio de e-mail (notificação de líder quando um colaborador preenche o
// DISC — ver src/notifications/discNotifier.js). Ao contrário do Postgres
// (DATABASE_URL, obrigatório — o app não sobe sem banco), SMTP é opcional:
// se não estiver configurado, a aplicação continua funcionando normalmente
// pra tudo (metas, disc, meu-porque, PDFs) — só a notificação por e-mail
// fica desligada, com um aviso no log (1 vez só, não a cada tentativa).
const nodemailer = require('nodemailer');

let transporter = null;
let avisoFaltaConfigMostrado = false;

function smtpConfigurado() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

// Sempre resolve (nunca rejeita por falta de config) — quem chama decide
// se quer logar/ignorar falhas de envio de verdade (erro do próprio
// nodemailer, ex. credencial errada, ainda propaga normalmente).
async function enviarEmail({ to, subject, text, attachments }) {
  if (!smtpConfigurado()) {
    if (!avisoFaltaConfigMostrado) {
      console.warn(
        'SMTP não configurado (SMTP_HOST/SMTP_USER/SMTP_PASS ausentes) — ' +
        'notificações por e-mail desativadas. Ver .env.example.'
      );
      avisoFaltaConfigMostrado = true;
    }
    return;
  }

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    attachments,
  });
}

module.exports = { enviarEmail };
