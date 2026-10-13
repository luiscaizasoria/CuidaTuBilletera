import { fakeJwt, NOW_MS, USER } from '../test-utils';
import { readUnverifiedClaims } from './jwt-claims';

describe('readUnverifiedClaims', () => {
  it('lee exp y datos de pantalla, incluso con tildes', () => {
    const claims = readUnverifiedClaims(fakeJwt(900, { ...USER, name: 'José Núñez' }));
    expect(claims).toMatchObject({ sub: USER.id, email: USER.email, name: 'José Núñez' });
    expect(claims?.exp).toBe(Math.floor(NOW_MS / 1000) + 900);
  });

  it.each(['', 'abc', 'a.b.c', 'a.e30.c'])('devuelve null con "%s"', (token) => {
    expect(readUnverifiedClaims(token)).toBeNull();
  });
});
