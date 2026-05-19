import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// PR #26 — testa os 5 estados visuais + transições enable/disable.
// Mockamos só o lib/push/registerPush — UI conversa com ele e nada mais.

const getStatusMock = vi.fn();
const subscribeMock = vi.fn();
const unsubscribeMock = vi.fn();

vi.mock('@/lib/push/registerPush', () => ({
  getStatus: () => getStatusMock(),
  subscribe: () => subscribeMock(),
  unsubscribe: () => unsubscribeMock(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { NotificationsToggle } from './NotificationsToggle';

beforeEach(() => {
  getStatusMock.mockReset();
  subscribeMock.mockReset();
  unsubscribeMock.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe('NotificationsToggle — estados visuais (PR #26)', () => {
  it('renderiza loading inicial', async () => {
    getStatusMock.mockResolvedValue('granted-unsubscribed');
    render(<NotificationsToggle />);
    expect(screen.getByText(/Verificando/i)).toBeInTheDocument();
    // Aguarda transição.
    await waitFor(() => {
      expect(screen.getByTestId('enable-push')).toBeInTheDocument();
    });
  });

  it('estado: unsupported → mensagem específica, sem CTA', async () => {
    getStatusMock.mockResolvedValue('unsupported');
    render(<NotificationsToggle />);
    await waitFor(() => {
      expect(screen.getByText(/não suporta notificações/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('enable-push')).not.toBeInTheDocument();
    expect(screen.queryByTestId('disable-push')).not.toBeInTheDocument();
  });

  it('estado: ios-needs-install → instrução PWA install', async () => {
    getStatusMock.mockResolvedValue('ios-needs-install');
    render(<NotificationsToggle />);
    await waitFor(() => {
      expect(screen.getByTestId('ios-install-hint')).toBeInTheDocument();
    });
    expect(screen.getByText(/Adicionar à Tela Inicial/i)).toBeInTheDocument();
  });

  it('estado: denied → mensagem com instrução, sem CTA pra re-pedir', async () => {
    getStatusMock.mockResolvedValue('denied');
    render(<NotificationsToggle />);
    await waitFor(() => {
      expect(screen.getByText(/Notificações bloqueadas/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('enable-push')).not.toBeInTheDocument();
  });

  it('estado: granted-unsubscribed → CTA "Ativar"', async () => {
    getStatusMock.mockResolvedValue('granted-unsubscribed');
    render(<NotificationsToggle />);
    const btn = await screen.findByTestId('enable-push');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/Ativar notificações/i);
  });

  it('estado: subscribed → CTA "Desativar" + badge ATIVO', async () => {
    getStatusMock.mockResolvedValue('subscribed');
    render(<NotificationsToggle />);
    await waitFor(() => {
      expect(screen.getByTestId('disable-push')).toBeInTheDocument();
    });
    expect(screen.getByText('ATIVO')).toBeInTheDocument();
  });
});

describe('NotificationsToggle — transições (PR #26)', () => {
  it('clicar Ativar chama subscribe() e troca pra estado subscribed', async () => {
    getStatusMock.mockResolvedValue('granted-unsubscribed');
    subscribeMock.mockResolvedValue('subscribed');
    render(<NotificationsToggle />);
    await userEvent.click(await screen.findByTestId('enable-push'));
    await waitFor(() => {
      expect(screen.getByTestId('disable-push')).toBeInTheDocument();
    });
    expect(subscribeMock).toHaveBeenCalledOnce();
  });

  it('subscribe falha com code=denied → estado vira denied', async () => {
    getStatusMock.mockResolvedValue('granted-unsubscribed');
    const err = new Error('blocked') as Error & { code: string };
    err.code = 'denied';
    subscribeMock.mockRejectedValue(err);
    render(<NotificationsToggle />);
    await userEvent.click(await screen.findByTestId('enable-push'));
    await waitFor(() => {
      expect(screen.getByText(/Notificações bloqueadas/i)).toBeInTheDocument();
    });
  });

  it('clicar Desativar chama unsubscribe() e volta pra granted-unsubscribed', async () => {
    getStatusMock.mockResolvedValue('subscribed');
    unsubscribeMock.mockResolvedValue('granted-unsubscribed');
    render(<NotificationsToggle />);
    await userEvent.click(await screen.findByTestId('disable-push'));
    await waitFor(() => {
      expect(screen.getByTestId('enable-push')).toBeInTheDocument();
    });
    expect(unsubscribeMock).toHaveBeenCalledOnce();
  });
});
