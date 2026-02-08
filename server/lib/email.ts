
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

export async function sendOrderStatusEmail(order: any, newStatus: string) {
  try {
    const { apiKey, fromEmail } = await getCredentials();
    const resend = new Resend(apiKey);
    const baseUrl = 'https://infinitehome.mv';
    const trackingUrl = `${baseUrl}/track?order=${order.orderNumber}`;

    const statusContent: { [key: string]: { subject: string; title: string; message: string; icon: string } } = {
      confirmed: {
        subject: `Order Confirmed - ${order.orderNumber}`,
        title: 'Order Confirmed!',
        message: 'Great news! Your order has been confirmed and payment verified. We are now preparing your items for shipment.',
        icon: '✓'
      },
      processing: {
        subject: `Preparing Your Order - ${order.orderNumber}`,
        title: 'Preparing Your Order',
        message: 'Your order is being prepared for shipment. Our team is carefully packing your items to ensure they arrive in perfect condition.',
        icon: '📦'
      },
      shipped: {
        subject: `Your Order Has Shipped! - ${order.orderNumber}`,
        title: 'Order Shipped!',
        message: 'Exciting news! Your order has been handed over to our delivery partner and is on its way to you.',
        icon: '🚚'
      },
      in_transit: {
        subject: `Order In Transit - ${order.orderNumber}`,
        title: 'On The Way',
        message: 'Your package is moving through our delivery network and will arrive soon.',
        icon: '📍'
      },
      out_for_delivery: {
        subject: `Out for Delivery Today! - ${order.orderNumber}`,
        title: 'Arriving Today!',
        message: 'Your order is out for delivery! Our delivery partner will arrive at your address today. Please ensure someone is available to receive the package.',
        icon: '🏠'
      },
      delivered: {
        subject: `Order Delivered - ${order.orderNumber}`,
        title: 'Order Delivered!',
        message: 'Your order has been successfully delivered! We hope you love your new items. Thank you for shopping with INFINITE HOME.',
        icon: '🎉'
      },
      cancelled: {
        subject: `Order Cancelled - ${order.orderNumber}`,
        title: 'Order Cancelled',
        message: 'Your order has been cancelled. If you did not request this cancellation, please contact us immediately.',
        icon: '✕'
      },
      refunded: {
        subject: `Refund Processed - ${order.orderNumber}`,
        title: 'Refund Processed',
        message: 'Your refund has been processed. Please allow 5-7 business days for the amount to reflect in your account.',
        icon: '💰'
      },
      delivery_exception: {
        subject: `Delivery Exception - ${order.orderNumber}`,
        title: 'Delivery Exception',
        message: 'There has been an issue with the delivery of your order. Our team is looking into it and will update you shortly. If you have any questions, please don\'t hesitate to contact us.',
        icon: '⚠️'
      }
    };

    const content = statusContent[newStatus];
    if (!content) {
      console.log(`No email template for status: ${newStatus}`);
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; background-color: #fcfaf7; font-family: 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="padding: 40px 20px; text-align: center; background-color: #1a1a1a; color: #ffffff;">
            <h1 style="font-family: serif; margin: 0; font-size: 28px; letter-spacing: 2px;">INFINITE HOME</h1>
            <p style="margin: 10px 0 0; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.8;">Premium E-commerce</p>
          </div>
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="font-size: 48px; margin-bottom: 10px;">${content.icon}</div>
              <h2 style="color: #1a1a1a; font-size: 24px; margin: 0;">${content.title}</h2>
            </div>
            <p style="color: #333; line-height: 1.6;">Dear ${order.customerName},</p>
            <p style="color: #333; line-height: 1.6;">${content.message}</p>
            <div style="background-color: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #666;">Order Number</p>
              <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #1a1a1a;">${order.orderNumber}</p>
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${trackingUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">Track Your Order</a>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px; line-height: 1.6;">
              If you have any questions, please contact us at support@infinitehome.mv or call 7840001.
            </p>
          </div>
          <div style="padding: 30px 20px; background-color: #f8f8f8; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; font-size: 11px; color: #999;">&copy; 2026 INFINITE LOOP PVT LTD. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: `INFINITE HOME <${fromEmail}>`,
      to: order.customerEmail,
      subject: content.subject,
      html: html,
    });

    console.log(`Status email (${newStatus}) sent to ${order.customerEmail}`);
  } catch (error) {
    console.error('Error sending status email:', error);
  }
}
