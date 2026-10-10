import { render, screen } from '@testing-library/react-native';

import App from './App';

describe('App', () => {
  it('muestra que CuidaTuBilletera está funcionando', async () => {
    await render(<App />);

    expect(screen.getByText('CuidaTuBilletera')).toBeTruthy();
    expect(screen.getByText('La aplicación está funcionando.')).toBeTruthy();
  });
});
