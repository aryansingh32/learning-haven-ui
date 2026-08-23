import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock UI components representing business logic flows
const MockCheckoutFlow = ({ hasEntitlement }: { hasEntitlement: boolean }) => {
  const [coupon, setCoupon] = React.useState('');
  const [error, setError] = React.useState('');
  const [total, setTotal] = React.useState(199);

  const applyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (coupon === 'EXPIRED') {
      setError('This coupon is expired.');
    } else if (coupon === 'SAVE50') {
      setError('');
      setTotal(149); // Applying $50 discount
    } else {
      setError('Invalid coupon.');
    }
  };

  const handleEnroll = () => {
    if (hasEntitlement) {
      setError('You are already enrolled in this program.');
    } else {
      // Proceed to checkout logic
      setError('');
    }
  };

  return (
    <div>
      <h2>Checkout & Enrollment</h2>
      <div data-testid="total-price">Total: ${total}</div>
      <form onSubmit={applyCoupon}>
        <input 
          data-testid="coupon-input"
          value={coupon} 
          onChange={(e) => setCoupon(e.target.value)} 
          placeholder="Promo code" 
        />
        <button type="submit" data-testid="apply-coupon-btn">Apply</button>
      </form>
      {error && <div data-testid="checkout-error">{error}</div>}
      <button data-testid="enroll-btn" onClick={handleEnroll}>Complete Enrollment</button>
    </div>
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderComponent = (hasEntitlement: boolean = false) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <MockCheckoutFlow hasEntitlement={hasEntitlement} />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Frontend Business Logic & Edge Cases', () => {
  
  it('Double Enrollment Prevention: Blocks checkout if user already has entitlement', async () => {
    renderComponent(true); // User already enrolled

    expect(screen.getByText('Checkout & Enrollment')).toBeInTheDocument();
    
    // User tries to enroll again
    fireEvent.click(screen.getByTestId('enroll-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('checkout-error')).toHaveTextContent('You are already enrolled in this program.');
    });
  });

  it('Coupon Application Edge Cases: Rejects expired/invalid coupons and applies valid ones', async () => {
    renderComponent(false); // User not enrolled

    const couponInput = screen.getByTestId('coupon-input');
    const applyBtn = screen.getByTestId('apply-coupon-btn');
    const totalDisplay = screen.getByTestId('total-price');

    expect(totalDisplay).toHaveTextContent('Total: $199');

    // 1. Apply Expired Coupon
    fireEvent.change(couponInput, { target: { value: 'EXPIRED' } });
    fireEvent.click(applyBtn);
    await waitFor(() => {
      expect(screen.getByTestId('checkout-error')).toHaveTextContent('This coupon is expired.');
    });
    expect(totalDisplay).toHaveTextContent('Total: $199'); // Price unchanged

    // 2. Apply Invalid Coupon
    fireEvent.change(couponInput, { target: { value: 'FAKE_CODE' } });
    fireEvent.click(applyBtn);
    await waitFor(() => {
      expect(screen.getByTestId('checkout-error')).toHaveTextContent('Invalid coupon.');
    });

    // 3. Apply Valid Coupon
    fireEvent.change(couponInput, { target: { value: 'SAVE50' } });
    fireEvent.click(applyBtn);
    await waitFor(() => {
      // Error clears, total drops
      expect(screen.queryByTestId('checkout-error')).not.toBeInTheDocument();
      expect(totalDisplay).toHaveTextContent('Total: $149');
    });
  });

});
