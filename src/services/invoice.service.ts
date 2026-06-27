import PDFDocument from 'pdfkit';
import { ISubscription } from '../models/Subscription';
import Employee from '../models/Employee';
import Employer from '../models/Employer';
import { UserRole } from '../types';
import env from '../config/env';

const GST_RATE = 18;
const CGST_RATE = 9;
const SGST_RATE = 9;
const IGST_RATE = 18;

type GstType = 'intra' | 'inter'; // intra = same state (CGST+SGST), inter = different state (IGST)

interface GstBreakdown {
  type: GstType;
  baseAmount: number; // in paise
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
}

interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  customerName: string;
  customerEmail: string;
  customerState: string;
  planName: string;
  totalAmount: number;
  gst: GstBreakdown;
  currency: string;
  paymentId: string;
  startDate: Date;
  endDate: Date;
}

class InvoiceService {
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /** Formats amount in paise to human-readable currency string */
  private formatAmount(amountInPaise: number, currency: string): string {
    const amount = amountInPaise / 100;
    if (currency === 'INR') {
      return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${currency} ${amount.toFixed(2)}`;
  }

  /** Calculates GST breakdown based on buyer's state vs company's state */
  private calculateGst(totalAmountInPaise: number, buyerState: string): GstBreakdown {
    const baseAmount = Math.round(totalAmountInPaise / (1 + GST_RATE / 100));
    const totalGst = totalAmountInPaise - baseAmount;

    const isSameState = buyerState.toLowerCase().trim() === env.COMPANY_STATE.toLowerCase().trim();

    if (isSameState) {
      // Intra-state: CGST + SGST
      const cgst = Math.round(totalGst / 2);
      const sgst = totalGst - cgst;
      return { type: 'intra', baseAmount, cgst, sgst, igst: 0, totalGst };
    } else {
      // Inter-state: IGST
      return { type: 'inter', baseAmount, cgst: 0, sgst: 0, igst: totalGst, totalGst };
    }
  }

  /** Generates a PDF tax invoice with dynamic GST (CGST+SGST or IGST) based on buyer's state */
  async generateInvoicePdf(subscription: ISubscription): Promise<Buffer> {
    let customerName = 'Customer';
    let customerEmail = '';
    let customerState = '';

    if (subscription.userRole === UserRole.EMPLOYEE) {
      const employee = await Employee.findById(subscription.user);
      if (employee) {
        customerName = `${employee.firstName} ${employee.lastName}`;
        customerEmail = employee.email;
        customerState = employee.billingState || '';
      }
    } else if (subscription.userRole === UserRole.EMPLOYER) {
      const employer = await Employer.findById(subscription.user);
      if (employer) {
        customerName = `${employer.firstName} ${employer.lastName}`;
        customerEmail = employer.email;
        customerState = employer.billingState || '';
      }
    }

    // Default to inter-state (IGST) if billing state not set
    if (!customerState) {
      customerState = 'OTHER';
    }

    const gst = this.calculateGst(subscription.amount, customerState);

    const invoiceData: InvoiceData = {
      invoiceNumber: `INV-${subscription._id.toString().slice(-8).toUpperCase()}`,
      date: subscription.startDate || new Date(),
      customerName,
      customerEmail,
      customerState,
      planName: subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1),
      totalAmount: subscription.amount,
      gst,
      currency: subscription.currency,
      paymentId: subscription.razorpayPaymentId || 'N/A',
      startDate: subscription.startDate,
      endDate: subscription.endDate,
    };

    return this.buildPdf(invoiceData);
  }

  /** Builds PDF layout with header, billing info, line items, dynamic GST breakdown, and footer */
  private buildPdf(data: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('Job Platform', 50, 50)
        .fontSize(10)
        .font('Helvetica')
        .text('www.jobplatform.com', 50, 78)
        .text('support@jobplatform.com', 50, 92)
        .text(`GSTIN: ${env.COMPANY_GSTIN}`, 50, 106)
        .text(`State: ${env.COMPANY_STATE}`, 50, 120);

      // Invoice title
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('TAX INVOICE', 400, 50, { align: 'right' });

      // Invoice details
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Invoice No: ${data.invoiceNumber}`, 400, 78, { align: 'right' })
        .text(`Date: ${this.formatDate(data.date)}`, 400, 92, { align: 'right' })
        .text(`SAC Code: 998314`, 400, 106, { align: 'right' })
        .text(`Place of Supply: ${data.customerState}`, 400, 120, { align: 'right' });

      // Divider
      doc.moveTo(50, 140).lineTo(560, 140).strokeColor('#e5e7eb').stroke();

      // Bill To
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('Bill To:', 50, 155)
        .fontSize(10)
        .font('Helvetica')
        .text(data.customerName, 50, 173)
        .text(data.customerEmail, 50, 187)
        .text(`State: ${data.customerState}`, 50, 201);

      // Payment Info
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Payment Info:', 350, 155)
        .fontSize(10)
        .font('Helvetica')
        .text(`Payment ID: ${data.paymentId}`, 350, 173)
        .text('Method: Razorpay', 350, 187);

      // Table Header
      const tableTop = 230;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Description', 50, tableTop);
      doc.text('Period', 230, tableTop);
      doc.text('Amount', 450, tableTop, { align: 'right' });
      doc.moveTo(50, tableTop + 18).lineTo(560, tableTop + 18).strokeColor('#e5e7eb').stroke();

      // Line Item
      const row1 = tableTop + 30;
      doc.fontSize(10).font('Helvetica');
      doc.text(`${data.planName} Plan Subscription`, 50, row1);
      doc.text(`${this.formatDate(data.startDate)} - ${this.formatDate(data.endDate)}`, 230, row1);
      doc.text(this.formatAmount(data.gst.baseAmount, data.currency), 450, row1, { align: 'right' });

      // Subtotal line
      const subtotalLine = row1 + 30;
      doc.moveTo(50, subtotalLine).lineTo(560, subtotalLine).strokeColor('#e5e7eb').stroke();

      // Summary
      let y = subtotalLine + 15;
      doc.fontSize(10).font('Helvetica');
      doc.text('Subtotal:', 350, y);
      doc.text(this.formatAmount(data.gst.baseAmount, data.currency), 450, y, { align: 'right' });

      y += 20;
      if (data.gst.type === 'intra') {
        // Same state — CGST + SGST
        doc.text(`CGST @ ${CGST_RATE}%:`, 350, y);
        doc.text(this.formatAmount(data.gst.cgst, data.currency), 450, y, { align: 'right' });
        y += 20;
        doc.text(`SGST @ ${SGST_RATE}%:`, 350, y);
        doc.text(this.formatAmount(data.gst.sgst, data.currency), 450, y, { align: 'right' });
      } else {
        // Different state — IGST
        doc.text(`IGST @ ${IGST_RATE}%:`, 350, y);
        doc.text(this.formatAmount(data.gst.igst, data.currency), 450, y, { align: 'right' });
      }

      // Total line
      y += 25;
      doc.moveTo(350, y).lineTo(560, y).strokeColor('#333333').lineWidth(1).stroke();

      // Grand Total
      y += 10;
      doc
        .fontSize(13)
        .font('Helvetica-Bold')
        .text('Total (incl. GST):', 350, y)
        .text(this.formatAmount(data.totalAmount, data.currency), 450, y, { align: 'right' });

      // Tax summary
      y += 45;
      doc.fontSize(9).font('Helvetica').fillColor('#374151');
      doc.text('Tax Summary', 50, y, { underline: true });
      y += 16;
      doc.text(`Taxable Amount: ${this.formatAmount(data.gst.baseAmount, data.currency)}`, 50, y);
      y += 14;
      if (data.gst.type === 'intra') {
        doc.text(
          `CGST (${CGST_RATE}%): ${this.formatAmount(data.gst.cgst, data.currency)}  |  SGST (${SGST_RATE}%): ${this.formatAmount(data.gst.sgst, data.currency)}  |  Total Tax: ${this.formatAmount(data.gst.totalGst, data.currency)}`,
          50, y
        );
      } else {
        doc.text(
          `IGST (${IGST_RATE}%): ${this.formatAmount(data.gst.igst, data.currency)}  |  Total Tax: ${this.formatAmount(data.gst.totalGst, data.currency)}`,
          50, y
        );
      }

      // Footer
      const footerTop = 700;
      doc.moveTo(50, footerTop).lineTo(560, footerTop).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text(
          'This is a computer-generated tax invoice and does not require a signature.',
          50, footerTop + 15, { align: 'center' }
        )
        .text(
          'For any queries regarding this invoice, please contact support@jobplatform.com',
          50, footerTop + 30, { align: 'center' }
        );

      doc.end();
    });
  }
}

export default new InvoiceService();
