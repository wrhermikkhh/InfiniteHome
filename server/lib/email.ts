
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not found in environment variables');
  }
  return { apiKey, fromEmail: 'noreply@infinitehome.mv' };
}

export async function sendOrderConfirmationEmail(order: any) {
  try {
    const { apiKey, fromEmail } = await getCredentials();
    console.log('Using Resend fromEmail:', fromEmail);
    console.log('Sending to customer email:', order.customerEmail);
    const resend = new Resend(apiKey);
    console.log('Sending email with Resend API Key:', apiKey.substring(0, 10) + '...');

    const baseUrl = 'https://infinitehome.mv';
    const trackingUrl = `${baseUrl}/track?order=${order.orderNumber}`;

    const itemsHtml = order.items.map((item: any) => `
      <tr>
        <td style="padding: 12px 10px; border-bottom: 1px solid #eee;">
          <div style="font-weight: bold; color: #1a1a1a;">${item.name}</div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">
            ${item.color && item.color !== 'Default' ? `<span style="margin-right: 10px;">Color: ${item.color}</span>` : ''}
            ${item.size && item.size !== 'Standard' ? `<span>Size: ${item.size}</span>` : ''}
          </div>
        </td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #eee; text-align: center; vertical-align: top;">
          ${item.qty}
        </td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #eee; text-align: right; vertical-align: top; font-weight: bold;">
          MVR ${item.price.toLocaleString()}
        </td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500&display=swap');
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #fcfaf7; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #f0e6d2;">
          <!-- Header -->
          <div style="padding: 40px 20px; text-align: center; background-color: #1a1a1a; color: #ffffff;">
            <h1 style="font-family: 'Playfair Display', serif; margin: 0; font-size: 28px; letter-spacing: 2px;">INFINITE HOME</h1>
            <p style="margin: 10px 0 0; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.8;">Premium E-commerce</p>
          </div>

          <!-- Body -->
          <div style="padding: 40px 30px;">
            <h2 style="font-family: 'Playfair Display', serif; color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">Order Confirmation</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #4a4a4a;">Dear ${order.customerName},</p>
            <p style="font-size: 15px; line-height: 1.6; color: #4a4a4a;">Thank you for choosing <strong>INFINITE HOME</strong>. We've received your order and are currently preparing it for processing.</p>
            
            <!-- Order Summary Box -->
            <div style="margin: 30px 0; padding: 25px; background-color: #fcfaf7; border: 1px solid #f0e6d2; border-radius: 4px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding-bottom: 10px; font-size: 14px; color: #666;">Order Number:</td>
                  <td style="padding-bottom: 10px; font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right;">${order.orderNumber}</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 10px; font-size: 14px; color: #666;">Order Status:</td>
                  <td style="padding-bottom: 10px; font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right; text-transform: capitalize;">${order.status.replace('_', ' ')}</td>
                </tr>
                <tr>
                  <td style="padding-top: 15px; border-top: 1px solid #f0e6d2; font-size: 14px; color: #666;">Tracking Number:</td>
                  <td style="padding-top: 15px; border-top: 1px solid #f0e6d2; font-size: 14px; text-align: right;">
                    <a href="${trackingUrl}" style="color: #1a1a1a; font-weight: 700; text-decoration: underline;">${order.orderNumber}</a>
                  </td>
                </tr>
              </table>
              <div style="margin-top: 20px; text-align: center;">
                <a href="${trackingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">Track Your Order</a>
              </div>
            </div>

            <!-- Items Table -->
            <table style="width: 100%; border-collapse: collapse; margin: 30px 0;">
              <thead>
                <tr style="border-bottom: 2px solid #1a1a1a;">
                  <th style="padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Item</th>
                  <th style="padding: 10px; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Qty</th>
                  <th style="padding: 10px; text-align: right; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="padding: 15px 10px 5px; text-align: right; font-size: 14px; color: #666;">Subtotal</td>
                  <td style="padding: 15px 10px 5px; text-align: right; font-size: 14px; color: #1a1a1a;">MVR ${order.subtotal.toLocaleString()}</td>
                </tr>
                ${order.discount > 0 ? `
                <tr>
                  <td colspan="2" style="padding: 5px 10px; text-align: right; font-size: 14px; color: #15803d;">Discount</td>
                  <td style="padding: 5px 10px; text-align: right; font-size: 14px; color: #15803d;">-MVR ${order.discount.toLocaleString()}</td>
                </tr>` : ''}
                <tr>
                  <td colspan="2" style="padding: 5px 10px; text-align: right; font-size: 14px; color: #666;">Shipping</td>
                  <td style="padding: 5px 10px; text-align: right; font-size: 14px; color: #1a1a1a;">${order.shipping > 0 ? `MVR ${order.shipping.toLocaleString()}` : 'FREE'}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 15px 10px; text-align: right; font-size: 18px; font-weight: bold; color: #1a1a1a; border-top: 1px solid #1a1a1a;">Total</td>
                  <td style="padding: 15px 10px; text-align: right; font-size: 18px; font-weight: bold; color: #1a1a1a; border-top: 1px solid #1a1a1a;">MVR ${order.total.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>

            <!-- Shipping Info -->
            <div style="margin-top: 40px; padding: 20px; border-left: 4px solid #1a1a1a; background-color: #fcfaf7;">
              <h3 style="font-family: 'Playfair Display', serif; font-size: 18px; margin: 0 0 10px;">Shipping Address</h3>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #4a4a4a; white-space: pre-wrap;">${order.shippingAddress}</p>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 40px 20px; background-color: #f8f8f8; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0 0 15px; font-size: 14px; color: #666;">Questions? Contact our concierge team.</p>
            <div style="margin-bottom: 20px;">
              <a href="mailto:support@infinitehome.mv" style="color: #1a1a1a; font-weight: 600; text-decoration: none; margin: 0 10px;">support@infinitehome.mv</a>
              <span style="color: #ccc;">|</span>
              <span style="color: #1a1a1a; font-weight: 600; margin: 0 10px;">7840001</span>
            </div>
            <p style="margin: 0; font-size: 11px; color: #999; letter-spacing: 0.5px; text-transform: uppercase;">
              &copy; 2026 INFINITE LOOP PVT LTD. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Use the fromEmail provided by the integration if available, otherwise use our verified domain
    // Resend requires the 'from' address to match a verified domain
    const fromEmailToUse = fromEmail || 'noreply@infinitehome.mv';
    console.log('Sending from:', fromEmailToUse);
    console.log('Sending to:', order.customerEmail);
    
    const emailResult = await resend.emails.send({
      from: `INFINITE HOME <${fromEmailToUse}>`,
      to: order.customerEmail,
      subject: `Order Confirmation - ${order.orderNumber}`,
      html: html,
    });
    
    console.log('Resend send result:', JSON.stringify(emailResult, null, 2));

    // Notify admin about the new order
    await resend.emails.send({
      from: `INFINITE HOME <${fromEmailToUse}>`,
      to: 'sales@infinitehome.mv',
      subject: `NEW ORDER - ${order.orderNumber}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #1a1a1a;">New Order Received</h2>
          <p><strong>Order Number:</strong> ${order.orderNumber}</p>
          <p><strong>Customer:</strong> ${order.customerName} (${order.customerEmail})</p>
          <p><strong>Total:</strong> MVR ${order.total.toLocaleString()}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <h3 style="color: #1a1a1a;">Order Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 2px solid #1a1a1a;">
                <th style="padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase;">Item</th>
                <th style="padding: 10px; text-align: center; font-size: 12px; text-transform: uppercase;">Qty</th>
                <th style="padding: 10px; text-align: right; font-size: 12px; text-transform: uppercase;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div style="margin-top: 30px; text-align: center;">
            <a href="${baseUrl}/admin" style="display: inline-block; padding: 12px 24px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; font-weight: bold;">View in Admin Panel</a>
          </div>
        </div>
      `,
    }).then(res => console.log('Admin notification result:', JSON.stringify(res, null, 2)))
      .catch(adminErr => {
      console.error('Failed to send admin notification email:', adminErr);
    });
    
    if (emailResult.error) {
      console.error('Resend error:', emailResult.error);
    } else {
      console.log(`Order confirmation email sent to ${order.customerEmail} for order ${order.orderNumber}`);
    }
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
  }
}
