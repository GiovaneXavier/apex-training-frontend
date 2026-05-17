import axios, { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';

import { apiErrorMessage, isCancelError } from './api';

// PR #15 (audit 5.18) — apiErrorMessage cobre os cenários de rede que
// antes caíam todos em "Erro inesperado".

function makeAxiosError(overrides: Partial<AxiosError> = {}): AxiosError {
  const err = new axios.AxiosError('Network Error');
  Object.assign(err, overrides);
  return err;
}

describe('apiErrorMessage — ERR_NETWORK / timeout / cancel', () => {
  it('ERR_NETWORK → mensagem clara "Sem conexão com a internet"', () => {
    const err = makeAxiosError({ code: 'ERR_NETWORK' });
    expect(apiErrorMessage(err)).toMatch(/sem conexão/i);
    expect(apiErrorMessage(err)).toMatch(/rede/i);
  });

  it('ECONNABORTED → mensagem de timeout (não confunde com offline)', () => {
    const err = makeAxiosError({ code: 'ECONNABORTED' });
    expect(apiErrorMessage(err)).toMatch(/demorou/i);
    expect(apiErrorMessage(err)).not.toMatch(/sem conexão/i);
  });

  it('ETIMEDOUT → mesma família, mensagem de timeout', () => {
    const err = makeAxiosError({ code: 'ETIMEDOUT' });
    expect(apiErrorMessage(err)).toMatch(/demorou/i);
  });

  it('cancelado (ERR_CANCELED) → string vazia, NÃO mostra erro', () => {
    const err = makeAxiosError({ code: 'ERR_CANCELED' });
    expect(apiErrorMessage(err)).toBe('');
  });

  it('cancelado via axios.CanceledError → string vazia', () => {
    const err = new axios.CanceledError('canceled');
    expect(apiErrorMessage(err)).toBe('');
  });

  it('AbortError DOMException → string vazia', () => {
    const err = new DOMException('aborted', 'AbortError');
    expect(apiErrorMessage(err)).toBe('');
  });
});

describe('apiErrorMessage — backend response (sem regressão do PR #6)', () => {
  it('response.data.issues → concatena com " · "', () => {
    const err = makeAxiosError({
      response: {
        status: 400,
        data: { issues: [{ message: 'kg obrigatório' }, { message: 'reps inválido' }] },
        statusText: '', headers: {}, config: {} as never,
      },
    });
    expect(apiErrorMessage(err)).toBe('kg obrigatório · reps inválido');
  });

  it('response.data.message → mensagem direta', () => {
    const err = makeAxiosError({
      response: {
        status: 400, data: { message: 'Treino não encontrado' },
        statusText: '', headers: {}, config: {} as never,
      },
    });
    expect(apiErrorMessage(err)).toBe('Treino não encontrado');
  });

  it('response.data.error → fallback de mensagem do backend', () => {
    const err = makeAxiosError({
      response: {
        status: 500, data: { error: 'InternalServerError' },
        statusText: '', headers: {}, config: {} as never,
      },
    });
    expect(apiErrorMessage(err)).toBe('InternalServerError');
  });

  it('Error nativo (não-axios) → propaga message', () => {
    expect(apiErrorMessage(new Error('Strava OAuth não configurado'))).toBe(
      'Strava OAuth não configurado',
    );
  });

  it('string → devolve a própria string', () => {
    expect(apiErrorMessage('falha bruta')).toBe('falha bruta');
  });

  it('unknown → fallback "Erro inesperado"', () => {
    expect(apiErrorMessage({})).toBe('Erro inesperado');
    expect(apiErrorMessage(null)).toBe('Erro inesperado');
    expect(apiErrorMessage(42)).toBe('Erro inesperado');
  });
});

describe('isCancelError — sentinela pra useEffect cleanup', () => {
  it('detecta CanceledError do axios', () => {
    expect(isCancelError(new axios.CanceledError('x'))).toBe(true);
  });

  it('detecta AxiosError com code=ERR_CANCELED', () => {
    expect(isCancelError(makeAxiosError({ code: 'ERR_CANCELED' }))).toBe(true);
  });

  it('detecta DOMException AbortError', () => {
    expect(isCancelError(new DOMException('x', 'AbortError'))).toBe(true);
  });

  it('NÃO confunde ERR_NETWORK com cancel', () => {
    expect(isCancelError(makeAxiosError({ code: 'ERR_NETWORK' }))).toBe(false);
  });

  it('NÃO confunde Error nativo com cancel', () => {
    expect(isCancelError(new Error('boom'))).toBe(false);
  });
});
