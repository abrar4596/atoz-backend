import nodemailer from 'nodemailer'
import { Resend } from 'resend'

export const getMailTransporter = () => {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    return {
      type: 'resend' as const,
      client: new Resend(process.env.RESEND_API_KEY),
      from: process.env.EMAIL_FROM,
    }
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASSWORD || '',
    },
  })

  return {
    type: 'nodemailer' as const,
    client: transporter,
    from: process.env.EMAIL_FROM || 'orders@atoz.local',
  }
}
