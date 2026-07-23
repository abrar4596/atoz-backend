export async function sendSMSAlert(to: string, message: string) {
  console.log(`[SMS Alert Sent] To: ${to}, Message: ${message}`)
  return { success: true }
}
