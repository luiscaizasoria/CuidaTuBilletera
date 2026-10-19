// Mocks globales de módulos nativos añadidos para el modo inmersivo (docs/003 D17).
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    // Solo el provider se simplifica; el contexto real se conserva (sin provider → respaldo).
    SafeAreaProvider: ({ children }: { children?: unknown }) => children,
  };
});

// El módulo nativo se simula disponible; las pruebas de ausencia lo sustituyen localmente.
jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  requireOptionalNativeModule: jest.fn(() => ({})),
}));

jest.mock('expo-navigation-bar', () => ({
  NavigationBar: { setHidden: jest.fn(), setStyle: jest.fn() },
  addVisibilityListener: jest.fn(() => ({ remove: jest.fn() })),
}));
