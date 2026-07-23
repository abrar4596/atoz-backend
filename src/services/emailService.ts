import { getMailTransporter } from '../config/mailer'

export async function sendPurchaseOrderEmail({
  to,
  productName,
  sku,
  distributorName,
  minimumOrderQuantity,
}: {
  to: string
  productName: string
  sku: string
  distributorName: string
  minimumOrderQuantity: number
}) {
  const subject = `Purchase Order Request – ${productName}`
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin-bottom: 10px;">Purchase Order</h2>
      <p><strong>Distributor:</strong> ${distributorName}</p>
      <p><strong>Product:</strong> ${productName}</p>
      <p><strong>SKU:</strong> ${sku}</p>
      <p><strong>Minimum Order Qty:</strong> ${minimumOrderQuantity}</p>
      <p>Please confirm availability and send the replenishment order at your earliest convenience.</p>
    </div>
  `

  const mailer = getMailTransporter()

  if (mailer.type === 'resend') {
    try {
      const resend = mailer.client as any
      await resend.emails.send({
        from: mailer.from,
        to: [to],
        subject,
        html,
      })
      return { success: true }
    } catch (error: any) {
      console.error('Resend email failed', error)
      return { success: false, error: 'Email dispatch failed' }
    }
  } else {
    try {
      const transporter = mailer.client as any
      await transporter.sendMail({
        from: mailer.from,
        to,
        subject,
        html,
      })
      return { success: true }
    } catch (error: any) {
      console.error('Nodemailer email failed', error)
      return { success: false, error: 'Email dispatch failed' }
    }
  }
}
