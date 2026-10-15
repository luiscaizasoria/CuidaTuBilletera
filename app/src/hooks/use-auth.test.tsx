import { act, cleanup, render } from '@testing-library/react-native';
import { StrictMode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { flush } from '../test-utils';
import type { AuthService } from '../lib/auth-service';
import { AuthProvider, FOREGROUND_DEBOUNCE_MS } from './use-auth';

type Listener = (state: AppStateStatus) => void;

// Emisor controlable que sustituye a AppState.addEventListener. Cada prueba crea el suyo.
// Nota: en el preset de Jest addEventListener ya es un jest.fn compartido. jest.spyOn devuelve ESE
// mismo mock y restoreAllMocks no lo restaura ni limpia sus llamadas, así que acumulaba llamadas de
// pruebas previas (mock.calls[0] era el listener de otra prueba). Por eso se reemplaza la propiedad
// por un jest.fn nuevo y se restaura su descriptor original en afterEach.
type Emitter = ReturnType<typeof mockAppState>;
const installed: Array<{ app: Emitter; restore: () => void }> = [];

function mockAppState(initial: AppStateStatus) {
  const listeners = new Set<Listener>();
  const removers: jest.Mock[] = [];
  const registered: Listener[] = [];
  const target = AppState as unknown as Record<string, unknown>;
  const originalState = Object.getOwnPropertyDescriptor(target, 'currentState');
  const originalAdd = Object.getOwnPropertyDescriptor(target, 'addEventListener');
  Object.defineProperty(target, 'currentState', { value: initial, configurable: true });
  const add = jest.fn((_type: string, listener: Listener) => {
    listeners.add(listener);
    registered.push(listener);
    const remove = jest.fn(() => listeners.delete(listener));
    removers.push(remove);
    return { remove };
  });
  Object.defineProperty(target, 'addEventListener', {
    value: add,
    configurable: true,
    writable: true,
  });
  const app = {
    add,
    removers,
    count: () => listeners.size,
    // Listener registrado en esta prueba (nunca uno de otra).
    registered: (index: number) => registered[index] as Listener,
    emit: (state: AppStateStatus) => [...listeners].forEach((listener) => listener(state)),
    // Emite aunque el listener ya se hubiera eliminado (evento tardío).
    emitTo: (listener: Listener, state: AppStateStatus) => listener(state),
  };
  const restore = () => {
    for (const [key, descriptor] of [
      ['currentState', originalState],
      ['addEventListener', originalAdd],
    ] as const) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else delete target[key];
    }
  };
  installed.push({ app, restore });
  return app;
}

function fakeService(): AuthService {
  return {
    getState: jest.fn(),
    subscribe: jest.fn(() => () => undefined),
    restore: jest.fn(async () => undefined),
    signIn: jest.fn(async () => undefined),
    signOut: jest.fn(async () => 'revoked' as const),
    authorizedCall: jest.fn(),
    onForeground: jest.fn(async () => undefined),
  } as unknown as AuthService;
}

// Reloj controlable: el hook usa Date.now() y no temporizadores.
let clock = 1_000_000;
beforeEach(() => {
  clock = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
});
afterEach(async () => {
  // Desmonta los árboles y comprueba que no queda ningún listener ni promesa pendiente.
  await cleanup();
  await flush();
  const leaked = installed.map(({ app }) => app.count());
  installed.splice(0).forEach(({ restore }) => restore());
  jest.restoreAllMocks();
  expect(leaked.every((count) => count === 0)).toBe(true);
});

const later = (ms = FOREGROUND_DEBOUNCE_MS) => {
  clock += ms;
};

describe('AuthProvider: ciclo de vida con AppState', () => {
  it('background -> active llama una vez a onForeground', async () => {
    const app = mockAppState('active');
    const service = fakeService();
    await render(<AuthProvider service={service}>{null}</AuthProvider>);
    await act(async () => app.emit('background'));
    await act(async () => app.emit('active'));
    expect(service.onForeground).toHaveBeenCalledTimes(1);
  });

  it('inactive -> active es equivalente', async () => {
    const app = mockAppState('active');
    const service = fakeService();
    await render(<AuthProvider service={service}>{null}</AuthProvider>);
    await act(async () => app.emit('inactive'));
    await act(async () => app.emit('active'));
    expect(service.onForeground).toHaveBeenCalledTimes(1);
  });

  it('active duplicados se ignoran', async () => {
    const app = mockAppState('background');
    const service = fakeService();
    await render(<AuthProvider service={service}>{null}</AuthProvider>);
    await act(async () => app.emit('active'));
    later();
    await act(async () => app.emit('active'));
    await act(async () => app.emit('active'));
    expect(service.onForeground).toHaveBeenCalledTimes(1);
  });

  it('montaje en active: solo restore, cero onForeground', async () => {
    const app = mockAppState('active');
    const service = fakeService();
    await render(<AuthProvider service={service}>{null}</AuthProvider>);
    await act(async () => app.emit('active'));
    expect(service.restore).toHaveBeenCalledTimes(1);
    expect(service.onForeground).not.toHaveBeenCalled();
  });

  it('montaje en background: el primer active sí delega', async () => {
    const app = mockAppState('background');
    const service = fakeService();
    await render(<AuthProvider service={service}>{null}</AuthProvider>);
    await act(async () => app.emit('active'));
    expect(service.onForeground).toHaveBeenCalledTimes(1);
  });

  it('ráfaga dentro de la ventana: una sola llamada; fuera de ella, otra', async () => {
    const app = mockAppState('active');
    const service = fakeService();
    await render(<AuthProvider service={service}>{null}</AuthProvider>);
    for (let i = 0; i < 3; i += 1) {
      await act(async () => app.emit('background'));
      later(100);
      await act(async () => app.emit('active'));
    }
    expect(service.onForeground).toHaveBeenCalledTimes(1);
    later();
    await act(async () => app.emit('background'));
    await act(async () => app.emit('active'));
    expect(service.onForeground).toHaveBeenCalledTimes(2);
  });

  // Mutaciones que detecta cada aserción (verificadas en una copia):
  // - quitar subscription.remove(): fallan removers[0] (0 llamadas) y count() (1 listener vivo).
  // - quitar `disposed`: falla la última aserción (el evento tardío llega al servicio).
  it('desmontar elimina la suscripción y los eventos posteriores no llaman al servicio', async () => {
    const app = mockAppState('active');
    const service = fakeService();
    const view = await render(<AuthProvider service={service}>{null}</AuthProvider>);
    expect(app.add).toHaveBeenCalledTimes(1);
    expect(app.count()).toBe(1);
    const captured = app.registered(0);
    await view.unmount();
    expect(app.removers).toHaveLength(1);
    expect(app.removers[0]).toHaveBeenCalledTimes(1);
    expect(app.count()).toBe(0);
    app.emitTo(captured, 'background');
    app.emitTo(captured, 'active');
    expect(service.onForeground).not.toHaveBeenCalled();
  });

  it('debounce: dos transiciones separadas por 999 ms, la segunda no delega', async () => {
    const app = mockAppState('active');
    const service = fakeService();
    await render(<AuthProvider service={service}>{null}</AuthProvider>);
    await act(async () => app.emit('background'));
    await act(async () => app.emit('active'));
    expect(service.onForeground).toHaveBeenCalledTimes(1);
    later(FOREGROUND_DEBOUNCE_MS - 1);
    await act(async () => app.emit('background'));
    await act(async () => app.emit('active'));
    expect(service.onForeground).toHaveBeenCalledTimes(1);
  });

  // Detecta la mutación `<` => `<=` en el hook.
  it('debounce: dos transiciones separadas por exactamente 1000 ms, la segunda sí delega', async () => {
    const app = mockAppState('active');
    const service = fakeService();
    await render(<AuthProvider service={service}>{null}</AuthProvider>);
    await act(async () => app.emit('background'));
    await act(async () => app.emit('active'));
    expect(service.onForeground).toHaveBeenCalledTimes(1);
    later(FOREGROUND_DEBOUNCE_MS);
    await act(async () => app.emit('background'));
    await act(async () => app.emit('active'));
    expect(service.onForeground).toHaveBeenCalledTimes(2);
  });

  it('re-render no duplica listeners; cambiar service reemplaza el listener', async () => {
    const app = mockAppState('active');
    const a = fakeService();
    const b = fakeService();
    const view = await render(<AuthProvider service={a}>{null}</AuthProvider>);
    await view.rerender(<AuthProvider service={a}>{null}</AuthProvider>);
    expect(app.count()).toBe(1);
    await view.rerender(<AuthProvider service={b}>{null}</AuthProvider>);
    expect(app.count()).toBe(1);
    expect(app.removers[0]).toHaveBeenCalledTimes(1);
    await act(async () => app.emit('background'));
    await act(async () => app.emit('active'));
    expect(a.onForeground).not.toHaveBeenCalled();
    expect(b.onForeground).toHaveBeenCalledTimes(1);
  });

  it('StrictMode no acumula listeners', async () => {
    const app = mockAppState('active');
    const service = fakeService();
    const view = await render(
      <StrictMode>
        <AuthProvider service={service}>{null}</AuthProvider>
      </StrictMode>,
    );
    expect(app.count()).toBe(1);
    await act(async () => app.emit('background'));
    await act(async () => app.emit('active'));
    expect(service.onForeground).toHaveBeenCalledTimes(1);
    await view.unmount();
    expect(app.count()).toBe(0);
  });

  it('un evento tardío del provider anterior no llama a su servicio obsoleto', async () => {
    const app = mockAppState('active');
    const old = fakeService();
    const view = await render(<AuthProvider service={old}>{null}</AuthProvider>);
    const stale = app.registered(0);
    await view.rerender(<AuthProvider service={fakeService()}>{null}</AuthProvider>);
    app.emitTo(stale, 'background');
    app.emitTo(stale, 'active');
    expect(old.onForeground).not.toHaveBeenCalled();
  });
});
