
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  const data = await response.json();
  connectionSettings = data.items?.[0];

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

export async function sendOrderConfirmationEmail(order: any) {
  try {
    const { apiKey, fromEmail } = await getCredentials();
    console.log('Using Resend fromEmail:', fromEmail);
    console.log('Sending to customer email:', order.customerEmail);
    const resend = new Resend(apiKey);

    const itemsHtml = order.items.map((item: any) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          ${item.name} ${item.color ? `(${item.color})` : ''} ${item.size ? `- ${item.size}` : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
          ${item.qty}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
          MVR ${item.price.toLocaleString()}
        </td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h1 style="color: #1a1a1a; border-bottom: 2px solid #f5f1ea; padding-bottom: 20px;">Order Confirmation</h1>
        <p>Dear ${order.customerName},</p>
        <p>Thank you for your order with <strong>INFINITE HOME</strong>. We're excited to let you know that we've received your order.</p>
        
        <div style="background-color: #fcfaf7; padding: 20px; border: 1px solid #f5f1ea; margin: 20px 0;">
          <h2 style="margin-top: 0; font-size: 18px;">Order Details</h2>
          <p><strong>Order Number:</strong> ${order.orderNumber}</p>
          <p><strong>Tracking Number:</strong> ${order.orderNumber} (Use this on our website to track your order)</p>
          <p><strong>Order Status:</strong> ${order.status.replace('_', ' ')}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f5f1ea;">
              <th style="padding: 10px; text-align: left;">Item</th>
              <th style="padding: 10px; text-align: center;">Qty</th>
              <th style="padding: 10px; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold;">Subtotal</td>
              <td style="padding: 10px; text-align: right;">MVR ${order.subtotal.toLocaleString()}</td>
            </tr>
            ${order.discount > 0 ? `
            <tr>
              <td colspan="2" style="padding: 10px; text-align: right; color: #15803d;">Discount</td>
              <td style="padding: 10px; text-align: right; color: #15803d;">-MVR ${order.discount.toLocaleString()}</td>
            </tr>` : ''}
            <tr>
              <td colspan="2" style="padding: 10px; text-align: right;">Shipping</td>
              <td style="padding: 10px; text-align: right;">${order.shipping > 0 ? `MVR ${order.shipping.toLocaleString()}` : 'FREE'}</td>
            </tr>
            <tr style="font-size: 18px; font-weight: bold;">
              <td colspan="2" style="padding: 10px; text-align: right; border-top: 2px solid #1a1a1a;">Total</td>
              <td style="padding: 10px; text-align: right; border-top: 2px solid #1a1a1a;">MVR ${order.total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div style="margin: 30px 0;">
          <h2 style="font-size: 18px;">Shipping Address</h2>
          <p style="white-space: pre-wrap;">${order.shippingAddress}</p>
        </div>

        <p style="font-size: 14px; color: #666; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
          If you have any questions, please contact us at <a href="mailto:support@infinitehome.mv" style="color: #333;">support@infinitehome.mv</a> or call us at 7840001.
        </p>
        <p style="font-size: 12px; color: #999; text-align: center;">
          &copy; 2026 INFINITE LOOP PVT LTD. All rights reserved.
        </p>
      </div>
    `;

    // Use Resend's verified sender domain
    const fromEmailToUse = fromEmail || 'INFINITE HOME <noreply@infinitehome.mv>';
    console.log('Sending from:', fromEmailToUse);
    console.log('Sending to:', order.customerEmail);
    
    const emailResult = await resend.emails.send({
      from: fromEmailToUse,
      to: order.customerEmail,
      subject: `Order Confirmation - ${order.orderNumber}`,
      html: html,
    });
    
    console.log('Resend send result:', JSON.stringify(emailResult, null, 2));
    
    if (emailResult.error) {
      console.error('Resend error:', emailResult.error);
    } else {
      console.log(`Order confirmation email sent to ${order.customerEmail} for order ${order.orderNumber}`);
    }
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
  }
}
