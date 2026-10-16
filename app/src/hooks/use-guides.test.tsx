// Proveedor de guías (R5; docs/007 §5.12.B e I; criterios J5, J6, J12, J15 y J16).
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { guideRecord, memoryGuideStorage } from '../guides-test-utils';
import { GuidesProvider, useGuide, useGuides } from './use-guides';
import { controlledPromise, relaxTimeoutsForColdCache } from '../test-utils';

relaxTimeoutsForColdCache();

let api: ReturnType<typeof useGuides>;
function Probe() {
  api = useGuides();
  const { guide } = useGuide(['calendario', 'reportes'], true);
  return (
    <>
      <Text testID="state">{`${api.ready ? 'ready' : 'loading'}|${api.seen.join(',')}`}</Text>
      <Text testID="guide">{guide?.id ?? 'ninguna'}</Text>
    </>
  );
}

const state = () => screen.getByTestId('state').props.children as string;
const shown = () => screen.getByTestId('guide').props.children as string;

const renderWith = (storage: ReturnType<typeof memoryGuideStorage>, userId: string | null = 'u1') =>
  render(
    <GuidesProvider userId={userId} storage={storage}>
      <Probe />
    </GuidesProvider>,
  );

describe('GuidesProvider', () => {
  it('sin proveedor no hay guías', async () => {
    await render(<Probe />);
    expect(state()).toBe('loading|');
    expect(shown()).toBe('ninguna');
  });

  it('mientras la lectura está pendiente no muestra ninguna guía; luego solo la no descartada', async () => {
    const storage = memoryGuideStorage({ guias_v1_u1: guideRecord('calendario') });
    const release = storage.holdReads();
    await renderWith(storage);
    expect(state()).toBe('loading|');
    expect(shown()).toBe('ninguna');
    await act(async () => release());
    expect(state()).toBe('ready|calendario');
    expect(shown()).toBe('reportes');
  });

  it('dato corrupto o fallo de lectura: listo y sin descartadas, sin romper', async () => {
    const corrupt = memoryGuideStorage({ guias_v1_u1: '%%%' });
    await renderWith(corrupt);
    expect(await screen.findByText('ready|')).toBeTruthy();
    expect(shown()).toBe('calendario');
  });

  it('fallo de lectura: listo y sin descartadas', async () => {
    const storage = memoryGuideStorage();
    storage.setFailRead(true);
    await renderWith(storage);
    expect(await screen.findByText('ready|')).toBeTruthy();
  });

  it('descartar es inmediato en memoria y se guarda; con fallo al guardar no reaparece', async () => {
    const storage = memoryGuideStorage();
    await renderWith(storage);
    await screen.findByText('ready|');
    storage.setFailWrite(true);
    await act(async () => api.dismiss('calendario'));
    expect(shown()).toBe('reportes');
    expect(state()).toBe('ready|calendario');
    expect(storage.writes).toEqual([]);
    storage.setFailWrite(false);
    await act(async () => api.dismiss(['reportes']));
    expect(shown()).toBe('ninguna');
    expect(JSON.parse(storage.data.get('guias_v1_u1')!)).toEqual({
      v: 1,
      vistas: ['calendario', 'reportes'],
    });
  });

  it('fallo de lectura al descartar: sigue oculta en memoria, no reescribe y la pantalla no se rompe', async () => {
    const saved = guideRecord('categorias');
    const storage = memoryGuideStorage({ guias_v1_u1: saved });
    await renderWith(storage);
    await screen.findByText('ready|categorias');
    storage.setFailRead(true);
    await act(async () => api.dismiss('calendario'));
    expect(shown()).toBe('reportes');
    expect(state()).toBe('ready|calendario,categorias');
    expect(storage.writes).toEqual([]);
    expect(storage.data.get('guias_v1_u1')).toBe(saved);
  });

  it('una versión mayor no se sobrescribe, pero la guía se oculta en la sesión', async () => {
    const future = '{"v":3,"vistas":[]}';
    const storage = memoryGuideStorage({ guias_v1_u1: future });
    await renderWith(storage);
    await screen.findByText('ready|');
    await act(async () => api.dismiss('calendario'));
    expect(shown()).toBe('reportes');
    expect(storage.data.get('guias_v1_u1')).toBe(future);
  });

  it('resetAll vacía las vistas al instante y devuelve true; con fallo devuelve false sin cambiar', async () => {
    const storage = memoryGuideStorage({ guias_v1_u1: guideRecord('calendario', 'reportes') });
    await renderWith(storage);
    await screen.findByText('ready|calendario,reportes');
    storage.setFailWrite(true);
    let ok = true;
    await act(async () => {
      ok = await api.resetAll();
    });
    expect(ok).toBe(false);
    expect(state()).toBe('ready|calendario,reportes');
    storage.setFailWrite(false);
    await act(async () => {
      ok = await api.resetAll();
    });
    expect(ok).toBe(true);
    expect(state()).toBe('ready|');
    expect(shown()).toBe('calendario');
    expect(JSON.parse(storage.data.get('guias_v1_u1')!)).toEqual({ v: 1, vistas: [] });
  });

  it('cambio de usuario: no muestra nada hasta leer su clave y nunca usa los ids del anterior', async () => {
    const storage = memoryGuideStorage({
      guias_v1_u1: guideRecord('calendario'),
      guias_v1_u2: guideRecord('reportes'),
    });
    const view = await renderWith(storage, 'u1');
    await screen.findByText('ready|calendario');
    const release = storage.holdReads();
    await view.rerender(
      <GuidesProvider userId="u2" storage={storage}>
        <Probe />
      </GuidesProvider>,
    );
    expect(state()).toBe('loading|');
    expect(shown()).toBe('ninguna');
    await act(async () => release());
    expect(state()).toBe('ready|reportes');
    expect(shown()).toBe('calendario');
  });

  it('un descarte tardío del usuario anterior no escribe en la clave del nuevo', async () => {
    const storage = memoryGuideStorage();
    const view = await renderWith(storage, 'u1');
    await screen.findByText('ready|');
    const staleDismiss = api.dismiss; // closure del usuario u1
    await view.rerender(
      <GuidesProvider userId="u2" storage={storage}>
        <Probe />
      </GuidesProvider>,
    );
    await screen.findByText('ready|');
    await act(async () => staleDismiss('calendario'));
    expect(state()).toBe('ready|');
    expect(storage.data.has('guias_v1_u2')).toBe(false);
    expect(JSON.parse(storage.data.get('guias_v1_u1')!).vistas).toEqual(['calendario']);
  });

  it('una lectura lenta del usuario anterior no pisa al nuevo', async () => {
    const slow = controlledPromise<string | null>();
    const storage = memoryGuideStorage({ guias_v1_u2: guideRecord('reportes') });
    const originalRead = storage.read;
    storage.read = jest.fn(async (key: string) =>
      key === 'guias_v1_u1' ? slow.promise : originalRead(key),
    );
    const view = await renderWith(storage, 'u1');
    await view.rerender(
      <GuidesProvider userId="u2" storage={storage}>
        <Probe />
      </GuidesProvider>,
    );
    await screen.findByText('ready|reportes');
    await act(async () => slow.resolve(guideRecord('calendario')));
    expect(state()).toBe('ready|reportes');
  });

  it('sin usuario nunca está listo', async () => {
    await renderWith(memoryGuideStorage(), null);
    expect(state()).toBe('loading|');
  });

  it('una sola guía a la vez con candidatas simultáneas', async () => {
    await renderWith(memoryGuideStorage());
    await screen.findByText('ready|');
    expect(shown()).toBe('calendario');
  });
});
