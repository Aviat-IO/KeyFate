import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StripeProvider } from '@/lib/payment/providers/StripeProvider';

const mockStripe = {
  subscriptions: {
    update: vi.fn(),
    retrieve: vi.fn(),
  },
};

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => mockStripe),
  };
});

describe('Payment Provider - Downgrade Functionality (TDD)', () => {
  let stripeProvider: StripeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    stripeProvider = new StripeProvider('sk_test_123');
  });

  describe('StripeProvider - cancel_at_period_end flag', () => {
    it('should set cancel_at_period_end to true when scheduling downgrade', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: true,
        items: {
          data: [
            {
              price: {
                id: 'price_123',
                currency: 'usd',
                unit_amount: 900,
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      };

      mockStripe.subscriptions.update.mockResolvedValueOnce(mockSubscription);

      const result = await stripeProvider.updateSubscription('sub_123', {
        cancelAtPeriodEnd: true,
      });

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: true,
      });
      expect(result.cancelAtPeriodEnd).toBe(true);
    });

    it('should set cancel_at_period_end to false when canceling scheduled downgrade', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        items: {
          data: [
            {
              price: {
                id: 'price_123',
                currency: 'usd',
                unit_amount: 900,
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      };

      mockStripe.subscriptions.update.mockResolvedValueOnce(mockSubscription);

      const result = await stripeProvider.updateSubscription('sub_123', {
        cancelAtPeriodEnd: false,
      });

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: false,
      });
      expect(result.cancelAtPeriodEnd).toBe(false);
    });

    it('should retrieve subscription with cancel_at_period_end status', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: true,
        items: {
          data: [
            {
              price: {
                id: 'price_123',
                currency: 'usd',
                unit_amount: 900,
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      };

      mockStripe.subscriptions.retrieve.mockResolvedValueOnce(mockSubscription);

      const result = await stripeProvider.getSubscription('sub_123');

      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
      expect(result.cancelAtPeriodEnd).toBe(true);
    });

    it('should handle updating subscription with both priceId and cancelAtPeriodEnd', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: true,
        items: {
          data: [
            {
              price: {
                id: 'price_new_123',
                currency: 'usd',
                unit_amount: 900,
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      };

      mockStripe.subscriptions.update.mockResolvedValueOnce(mockSubscription);

      const result = await stripeProvider.updateSubscription('sub_123', {
        priceId: 'price_new_123',
        cancelAtPeriodEnd: true,
      });

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        items: [{ price: 'price_new_123' }],
        cancel_at_period_end: true,
      });
      expect(result.cancelAtPeriodEnd).toBe(true);
    });
  });

  describe('StripeProvider - error handling', () => {
    it('should throw error when Stripe API fails', async () => {
      mockStripe.subscriptions.update.mockRejectedValueOnce(
        new Error('Stripe API error')
      );

      await expect(
        stripeProvider.updateSubscription('sub_123', {
          cancelAtPeriodEnd: true,
        })
      ).rejects.toThrow('Stripe API error');
    });

    it('should throw error for invalid subscription ID', async () => {
      mockStripe.subscriptions.update.mockRejectedValueOnce(
        new Error('No such subscription: sub_invalid')
      );

      await expect(
        stripeProvider.updateSubscription('sub_invalid', {
          cancelAtPeriodEnd: true,
        })
      ).rejects.toThrow('No such subscription');
    });
  });

  describe('BTCPay - period end calculation', () => {
    it('should calculate period end for monthly subscription', () => {
      const paymentDate = new Date('2025-01-01');
      const expectedEndDate = new Date('2025-02-01');
      
      const periodEnd = new Date(paymentDate);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      expect(periodEnd.getTime()).toBe(expectedEndDate.getTime());
    });

    it('should calculate period end for yearly subscription', () => {
      const paymentDate = new Date('2025-01-01');
      const expectedEndDate = new Date('2026-01-01');
      
      const periodEnd = new Date(paymentDate);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      expect(periodEnd.getTime()).toBe(expectedEndDate.getTime());
    });

    it('should handle month overflow correctly', () => {
      const paymentDate = new Date('2025-01-31');
      
      const periodEnd = new Date(paymentDate);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      expect(periodEnd.getMonth()).toBe(2);
    });

    it('should calculate period end for leap year', () => {
      const paymentDate = new Date('2024-02-29');
      
      const periodEnd = new Date(paymentDate);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      expect(periodEnd.getFullYear()).toBe(2025);
      expect(periodEnd.getMonth()).toBe(1);
      expect(periodEnd.getDate()).toBe(28);
    });
  });

  describe('Subscription mapping', () => {
    it('should correctly map cancel_at_period_end from Stripe subscription', async () => {
      const mockSubscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        current_period_start: 1735689600,
        current_period_end: 1738368000,
        cancel_at_period_end: true,
        items: {
          data: [
            {
              price: {
                id: 'price_123',
                currency: 'usd',
                unit_amount: 900,
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      };

      mockStripe.subscriptions.retrieve.mockResolvedValueOnce(mockSubscription);

      const result = await stripeProvider.getSubscription('sub_123');

      expect(result).toMatchObject({
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'active',
        cancelAtPeriodEnd: true,
      });
      expect(result.currentPeriodStart).toBeInstanceOf(Date);
      expect(result.currentPeriodEnd).toBeInstanceOf(Date);
    });
  });
});
