import { mergeById } from './list-utils';

describe('mergeById', () => {
  it('agrega solo los ids nuevos conservando el orden y sin mutar', () => {
    const current = [{ id: 'a' }, { id: 'b' }];
    const incoming = [{ id: 'b' }, { id: 'c' }];
    expect(mergeById(current, incoming)).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(current).toHaveLength(2);
  });

  it('mantiene la versión existente cuando el id se repite', () => {
    expect(mergeById([{ id: 'a', v: 1 }], [{ id: 'a', v: 2 }])).toEqual([{ id: 'a', v: 1 }]);
  });
});
