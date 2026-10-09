import { cleanBillingProfile, sellerFromEnv } from '../modules/billing/services/invoice.service';

describe('invoices', () => {
  it('needs the seller name and GSTIN before issuing; state comes from the GSTIN', () => {
    expect(sellerFromEnv({})).toBeNull();
    expect(sellerFromEnv({ SELLER_LEGAL_NAME: 'Forge Learning Pvt Ltd' })).toBeNull();
    expect(sellerFromEnv({ SELLER_LEGAL_NAME: 'Forge Learning Pvt Ltd', SELLER_GSTIN: '33AAAAA0000A1Z5', SELLER_ADDRESS: 'Chennai' }))
      .toEqual({ name: 'Forge Learning Pvt Ltd', gstin: '33AAAAA0000A1Z5', state_code: '33', address: 'Chennai' });
  });

  it('cleans billing details', () => {
    expect(cleanBillingProfile({ legal_name: '  Rao Labs LLP ', gstin: '29abcde1234f1z5' }))
      .toEqual({ ok: true, value: { legal_name: 'Rao Labs LLP', gstin: '29ABCDE1234F1Z5', state_code: '29', address: null } });
    expect(cleanBillingProfile({ state_code: '33' })).toEqual({ ok: true, value: { legal_name: null, gstin: null, state_code: '33', address: null } });
    expect(cleanBillingProfile({})).toMatchObject({ ok: true });
  });

  it('refuses a bad GSTIN, a bad state, or a GSTIN from another state', () => {
    expect(cleanBillingProfile({ gstin: '12345' })).toMatchObject({ ok: false });
    expect(cleanBillingProfile({ state_code: 'TN' })).toMatchObject({ ok: false });
    expect(cleanBillingProfile({ gstin: '29ABCDE1234F1Z5', state_code: '33' })).toMatchObject({ ok: false, error: expect.stringMatching(/different state/) });
  });
});
