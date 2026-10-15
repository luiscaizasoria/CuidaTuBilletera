// Conjunto inicial de categorías que se copia a cada cuenta nueva (docs/001-CONSTITUCION.md §5).
// Después cada cuenta administra sus categorías de forma independiente.

export interface DefaultCategory {
  nombre: string;
  tipo: 'ingreso' | 'egreso';
  icono: string;
  color: string;
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { nombre: 'Alimentación', tipo: 'egreso', icono: 'utensils', color: '#F97316' },
  { nombre: 'Transporte', tipo: 'egreso', icono: 'bus', color: '#3B82F6' },
  { nombre: 'Servicios básicos', tipo: 'egreso', icono: 'lightbulb', color: '#EAB308' },
  { nombre: 'Salud', tipo: 'egreso', icono: 'heart-pulse', color: '#EF4444' },
  { nombre: 'Educación', tipo: 'egreso', icono: 'graduation-cap', color: '#8B5CF6' },
  { nombre: 'Hogar', tipo: 'egreso', icono: 'home', color: '#14B8A6' },
  { nombre: 'Entretenimiento', tipo: 'egreso', icono: 'film', color: '#EC4899' },
  { nombre: 'Otros gastos', tipo: 'egreso', icono: 'ellipsis', color: '#6B7280' },
  { nombre: 'Sueldo', tipo: 'ingreso', icono: 'briefcase', color: '#22C55E' },
  { nombre: 'Ventas', tipo: 'ingreso', icono: 'shopping-bag', color: '#06B6D4' },
  { nombre: 'Otros ingresos', tipo: 'ingreso', icono: 'plus-circle', color: '#84CC16' },
];
