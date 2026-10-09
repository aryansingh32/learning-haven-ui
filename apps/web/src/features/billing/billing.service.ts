import { api } from '@/services/api.svc';

export interface BillingProfile { legal_name: string | null; gstin: string | null; state_code: string | null; address: string | null }
export interface Invoice {
  id: string;
  invoice_no: string;
  fy: string;
  payment_id: string;
  issued_at: string;
  seller: { name: string; gstin: string; state_code: string; address: string | null };
  buyer_name: string;
  buyer_email: string | null;
  buyer_gstin: string | null;
  buyer_address: string | null;
  place_of_supply: string;
  description: string;
  sac_code: string;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
  currency: string;
}

/** The v2 payment endpoints answer `{ success, data }`; take the data (and tolerate a bare body). */
export function unwrap<T>(body: unknown): T {
  return (body && typeof body === 'object' && 'success' in body && 'data' in body ? (body as { data: T }).data : body) as T;
}

export const fetchBillingProfile = (): Promise<BillingProfile> => api.get('/v2/payments/billing-profile').then(unwrap<BillingProfile>);
export const saveBillingProfile = (p: BillingProfile): Promise<BillingProfile> => api.put('/v2/payments/billing-profile', p).then(unwrap<BillingProfile>);
export const fetchInvoice = (paymentId: string): Promise<Invoice> => api.get(`/v2/payments/invoices/${paymentId}`).then(unwrap<Invoice>);

export const rupees = (paise: number) =>
  (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

/** GST state codes (first two digits of a GSTIN). */
export const GST_STATES: Array<[string, string]> = [
  ['01', 'Jammu and Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'],
  ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'],
  ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'], ['26', 'Dadra and Nagar Haveli and Daman and Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'],
  ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman and Nicobar Islands'],
  ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'],
];
export const stateName = (code: string | null) => GST_STATES.find(([c]) => c === code)?.[1] ?? code ?? '';
