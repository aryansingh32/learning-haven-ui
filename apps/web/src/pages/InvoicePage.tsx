import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchInvoice, rupees, stateName } from '@/features/billing/billing.service';

/** A printable GST tax invoice (Print → Save as PDF). */
export default function InvoicePage() {
  const { paymentId = '' } = useParams();
  const { data: inv, isLoading, error } = useQuery({ queryKey: ['invoice', paymentId], queryFn: () => fetchInvoice(paymentId), retry: false });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (error || !inv) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white text-slate-700 p-6 text-center">
        <p className="font-semibold">{(error as Error)?.message || 'Invoice not found'}</p>
        <Link to="/subscription" className="text-sm text-blue-700 underline">Back to billing</Link>
      </div>
    );
  }
  const interstate = inv.igst_paise > 0;
  const tax = inv.cgst_paise + inv.sgst_paise + inv.igst_paise;
  const issued = new Date(inv.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 print:bg-white">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between print:hidden">
        <Link to="/subscription" className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> Billing</Link>
        <Button size="sm" onClick={() => window.print()} className="gap-1.5"><Printer className="w-4 h-4" /> Print or save as PDF</Button>
      </div>
      <article aria-label={`Tax invoice ${inv.invoice_no}`} className="max-w-3xl mx-auto bg-white shadow-sm print:shadow-none rounded-lg print:rounded-none p-6 sm:p-10 mb-10 print:mb-0">
        <header className="flex flex-col sm:flex-row sm:justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-2xl font-bold tracking-tight">Tax Invoice</p>
            <p className="text-sm text-slate-500 mt-1">Original for recipient</p>
          </div>
          <dl className="text-sm grid grid-cols-[auto_auto] gap-x-4 gap-y-1 sm:text-right">
            <dt className="text-slate-500">Invoice no.</dt><dd className="font-semibold">{inv.invoice_no}</dd>
            <dt className="text-slate-500">Date</dt><dd>{issued}</dd>
            <dt className="text-slate-500">Place of supply</dt><dd>{stateName(inv.place_of_supply)} ({inv.place_of_supply})</dd>
          </dl>
        </header>

        <div className="grid sm:grid-cols-2 gap-6 py-6 border-b border-slate-200 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">From</p>
            <p className="font-semibold">{inv.seller.name}</p>
            {inv.seller.address && <p className="text-slate-600">{inv.seller.address}</p>}
            <p className="text-slate-600">GSTIN {inv.seller.gstin}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Billed to</p>
            <p className="font-semibold">{inv.buyer_name}</p>
            {inv.buyer_address && <p className="text-slate-600">{inv.buyer_address}</p>}
            {inv.buyer_email && <p className="text-slate-600">{inv.buyer_email}</p>}
            {inv.buyer_gstin && <p className="text-slate-600">GSTIN {inv.buyer_gstin}</p>}
          </div>
        </div>

        <table className="w-full text-sm my-6">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 font-semibold">SAC</th>
              <th className="py-2 font-semibold text-right">Taxable value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-3 pr-4">{inv.description}</td>
              <td className="py-3">{inv.sac_code}</td>
              <td className="py-3 text-right tabular-nums">{rupees(inv.taxable_paise)}</td>
            </tr>
          </tbody>
        </table>

        <dl className="ml-auto w-full sm:w-72 text-sm space-y-1.5">
          <div className="flex justify-between"><dt className="text-slate-600">Taxable value</dt><dd className="tabular-nums">{rupees(inv.taxable_paise)}</dd></div>
          {interstate ? (
            <div className="flex justify-between"><dt className="text-slate-600">IGST @ 18%</dt><dd className="tabular-nums">{rupees(inv.igst_paise)}</dd></div>
          ) : (
            <>
              <div className="flex justify-between"><dt className="text-slate-600">CGST @ 9%</dt><dd className="tabular-nums">{rupees(inv.cgst_paise)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">SGST @ 9%</dt><dd className="tabular-nums">{rupees(inv.sgst_paise)}</dd></div>
            </>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-base"><dt>Total paid</dt><dd className="tabular-nums">{rupees(inv.total_paise)}</dd></div>
          <p className="text-xs text-slate-500 text-right">Includes {rupees(tax)} GST</p>
        </dl>

        <footer className="mt-10 pt-6 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          <p>Payment reference {inv.payment_id}. Tax is not payable on reverse charge.</p>
          <p>This is a computer-generated invoice and needs no signature.</p>
        </footer>
      </article>
    </div>
  );
}
