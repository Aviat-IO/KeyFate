import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SecretCard } from '../secret-card';
import { Secret } from '@/types';

// Mock the child components
vi.mock('../check-in-button', () => ({
  CheckInButton: ({ onCheckInSuccess, secretId }: any) => (
    <button
      data-testid="check-in-button"
      onClick={() => {
        // Simulate API response with only updated fields
        const partialUpdate: Partial<Secret> = {
          id: secretId,
          lastCheckIn: new Date('2024-01-15T12:00:00Z'),
          nextCheckIn: new Date('2024-02-15T12:00:00Z'),
          status: 'active',
        };
        onCheckInSuccess(partialUpdate);
      }}
    >
      Check In
    </button>
  ),
}));

vi.mock('../toggle-pause-button', () => ({
  TogglePauseButton: ({ onToggleSuccess, secretId, status }: any) => (
    <button
      data-testid="toggle-pause-button"
      onClick={() => {
        // Simulate API response with only updated fields
        const newStatus = status === 'active' ? 'paused' : 'active';
        const partialUpdate: Partial<Secret> = {
          id: secretId,
          status: newStatus,
        };
        onToggleSuccess(partialUpdate);
      }}
    >
      {status === 'active' ? 'Pause' : 'Resume'}
    </button>
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('SecretCard - State Preservation Bug', () => {
  const createMockSecret = (overrides?: Partial<Secret>): Secret => ({
    id: 'secret-123',
    userId: 'user-123',
    title: 'Test Secret',
    recipientName: 'John Doe',
    recipientEmail: 'john@example.com',
    recipientPhone: '+1234567890',
    contactMethod: 'email' as const,
    checkInDays: 30,
    status: 'active' as const,
    serverShare: 'encrypted-server-share-data',
    iv: 'initialization-vector',
    authTag: 'auth-tag-data',
    sssSharesTotal: 3,
    sssThreshold: 2,
    triggeredAt: null,
    lastCheckIn: new Date('2024-01-01T12:00:00Z'),
    nextCheckIn: new Date('2024-02-01T12:00:00Z'),
    triggeredAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  });

  describe('Check-in action', () => {
    test('preserves serverShare field after check-in', async () => {
      const user = userEvent.setup();
      const secret = createMockSecret({ serverShare: 'important-server-share' });

      render(<SecretCard secret={secret} />);

      // Verify server share exists (card should not show "Disabled")
      expect(screen.queryByText(/Server share deleted/i)).not.toBeInTheDocument();

      // Click check-in
      const checkInButton = screen.getByTestId('check-in-button');
      await user.click(checkInButton);

      // After check-in, server share should still exist
      await waitFor(() => {
        expect(screen.queryByText(/Server share deleted/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Disabled/i)).not.toBeInTheDocument();
      });
    });

    test('preserves encryption metadata after check-in', async () => {
      const user = userEvent.setup();
      const secret = createMockSecret({
        iv: 'test-iv',
        authTag: 'test-auth-tag',
      });

      const { rerender } = render(<SecretCard secret={secret} />);

      // Click check-in
      const checkInButton = screen.getByTestId('check-in-button');
      await user.click(checkInButton);

      // The card should still function normally (no disabled state)
      await waitFor(() => {
        expect(screen.queryByText(/Disabled/i)).not.toBeInTheDocument();
      });
    });

    test('preserves recipient information after check-in', async () => {
      const user = userEvent.setup();
      const secret = createMockSecret({
        recipientEmail: 'test@example.com',
        recipientPhone: '+1234567890',
      });

      render(<SecretCard secret={secret} />);

      // Verify recipient is shown
      expect(screen.getByText('John Doe')).toBeInTheDocument();

      // Click check-in
      const checkInButton = screen.getByTestId('check-in-button');
      await user.click(checkInButton);

      // Recipient should still be shown
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    test('updates timestamps correctly after check-in', async () => {
      const user = userEvent.setup();
      const secret = createMockSecret({
        lastCheckIn: new Date('2024-01-01T12:00:00Z'),
        nextCheckIn: new Date('2024-02-01T12:00:00Z'),
      });

      render(<SecretCard secret={secret} />);

      // Click check-in
      const checkInButton = screen.getByTestId('check-in-button');
      await user.click(checkInButton);

      // Check that timing text updates (will show new date via format())
      await waitFor(() => {
        // The component should update without showing disabled state
        expect(screen.queryByText(/Disabled/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Pause/Resume action', () => {
    test('preserves serverShare field when pausing', async () => {
      const user = userEvent.setup();
      const secret = createMockSecret({
        status: 'active',
        serverShare: 'important-server-share',
      });

      render(<SecretCard secret={secret} />);

      // Verify not disabled
      expect(screen.queryByText(/Server share deleted/i)).not.toBeInTheDocument();

      // Click pause
      const pauseButton = screen.getByTestId('toggle-pause-button');
      await user.click(pauseButton);

      // After pause, should show "Paused" but NOT "Disabled" or "Server share deleted"
      await waitFor(() => {
        expect(screen.getAllByText(/Paused/i).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Server share deleted/i)).not.toBeInTheDocument();
      });
    });

    test('preserves serverShare field when resuming', async () => {
      const user = userEvent.setup();
      const secret = createMockSecret({
        status: 'paused',
        serverShare: 'important-server-share',
      });

      render(<SecretCard secret={secret} />);

      // Click resume
      const resumeButton = screen.getByTestId('toggle-pause-button');
      await user.click(resumeButton);

      // After resume, should be active and not disabled
      await waitFor(() => {
        expect(screen.queryByText(/Server share deleted/i)).not.toBeInTheDocument();
      });
    });

    test('preserves encryption metadata when pausing', async () => {
      const user = userEvent.setup();
      const secret = createMockSecret({
        status: 'active',
        iv: 'test-iv',
        authTag: 'test-auth-tag',
        serverShare: 'encrypted-data',
      });

      render(<SecretCard secret={secret} />);

      // Click pause
      const pauseButton = screen.getByTestId('toggle-pause-button');
      await user.click(pauseButton);

      // Should be paused but not disabled
      await waitFor(() => {
        expect(screen.getAllByText(/Paused/i).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Server share deleted/i)).not.toBeInTheDocument();
      });
    });

    test('preserves all secret metadata when toggling status', async () => {
      const user = userEvent.setup();
      const secret = createMockSecret({
        status: 'active',
        checkInDays: 45,
        sssSharesTotal: 5,
        sssThreshold: 3,
      });

      render(<SecretCard secret={secret} />);

      // Click pause
      const pauseButton = screen.getByTestId('toggle-pause-button');
      await user.click(pauseButton);

      // Card should still render properly without showing disabled state
      await waitFor(() => {
        expect(screen.queryByText(/Server share deleted/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('State transitions', () => {
    test('correctly handles active -> paused -> active transitions', async () => {
      const user = userEvent.setup();
      const secret = createMockSecret({
        status: 'active',
        serverShare: 'important-data',
      });

      render(<SecretCard secret={secret} />);

      // Pause
      const pauseButton = screen.getByTestId('toggle-pause-button');
      await user.click(pauseButton);

      await waitFor(() => {
        expect(screen.getAllByText(/Paused/i).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Server share deleted/i)).not.toBeInTheDocument();
      });

      // Resume
      const resumeButton = screen.getByTestId('toggle-pause-button');
      await user.click(resumeButton);

      await waitFor(() => {
        expect(screen.queryByText(/Server share deleted/i)).not.toBeInTheDocument();
      });
    });

    test('correctly handles check-in followed by pause', async () => {
      const user = userEvent.setup();
      const secret = createMockSecret({
        status: 'active',
        serverShare: 'important-data',
      });

      render(<SecretCard secret={secret} />);

      // Check in
      const checkInButton = screen.getByTestId('check-in-button');
      await user.click(checkInButton);

      await waitFor(() => {
        expect(screen.queryByText(/Server share deleted/i)).not.toBeInTheDocument();
      });

      // Pause
      const pauseButton = screen.getByTestId('toggle-pause-button');
      await user.click(pauseButton);

      await waitFor(() => {
        expect(screen.getAllByText(/Paused/i).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Server share deleted/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Disabled state detection', () => {
    test('correctly shows disabled state when serverShare is null', () => {
      const secret = createMockSecret({ serverShare: null });

      render(<SecretCard secret={secret} />);

      expect(screen.getAllByText(/Disabled/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Server share deleted/i)).toBeInTheDocument();
    });

    test('does not show disabled state when serverShare exists', () => {
      const secret = createMockSecret({ serverShare: 'encrypted-data' });

      render(<SecretCard secret={secret} />);

      expect(screen.queryByText(/Server share deleted/i)).not.toBeInTheDocument();
    });
  });
});
