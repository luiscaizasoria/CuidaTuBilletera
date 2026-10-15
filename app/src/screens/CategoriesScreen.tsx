import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useLoader, useMutation } from '../hooks/use-loader';
import type {
  Account,
  Category,
  CategoryType,
  ResourcesApi,
  UpdateCategoryInput,
} from '../lib/resources-api';
import { Button, ErrorBox, screenStyles as s } from './ui';

// Paleta fija de colores (formato #RRGGBB).
export const CATEGORY_COLORS = [
  { name: 'Rojo', value: '#E53935' },
  { name: 'Naranja', value: '#FB8C00' },
  { name: 'Amarillo', value: '#FDD835' },
  { name: 'Verde', value: '#43A047' },
  { name: 'Azul', value: '#1E88E5' },
  { name: 'Morado', value: '#8E24AA' },
  { name: 'Gris', value: '#757575' },
] as const;

type Form = { kind: 'create' } | { kind: 'edit'; category: Category } | null;

export default function CategoriesScreen({
  account,
  api,
}: {
  account: Account;
  api: ResourcesApi;
}) {
  const { authorizedCall } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<Form>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<CategoryType>('egreso');
  const [color, setColor] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useMutation();

  const { state, reload, refresh } = useLoader(
    () =>
      authorizedCall((token) =>
        api.listCategories(token, account.id, { pageSize: 100, incluirArchivadas: showArchived }),
      ),
    `${account.id}:${showArchived}`,
  );

  function openForm(next: Form) {
    setForm(next);
    setNombre(next?.kind === 'edit' ? next.category.nombre : '');
    setDescripcion(next?.kind === 'edit' ? (next.category.descripcion ?? '') : '');
    setTipo(next?.kind === 'edit' ? next.category.tipo : 'egreso');
    setColor(next?.kind === 'edit' ? next.category.color : null);
    setFormError(null);
    mutation.clearError();
  }

  async function submit() {
    if (!form) return;
    const name = nombre.trim();
    if (name === '') {
      setFormError('Escribe un nombre.');
      return;
    }
    setFormError(null);
    const desc = descripcion.trim();
    const ok = await mutation.run(() =>
      authorizedCall((token) => {
        if (form.kind === 'create') {
          return api.createCategory(token, account.id, {
            nombre: name,
            tipo,
            ...(desc !== '' ? { descripcion: desc } : {}),
            ...(color !== null ? { color } : {}),
          });
        }
        const current = form.category;
        const changes: UpdateCategoryInput = {};
        if (name !== current.nombre) changes.nombre = name;
        if (desc !== (current.descripcion ?? '')) changes.descripcion = desc === '' ? null : desc;
        if (color !== null && color !== current.color) changes.color = color;
        return api.updateCategory(token, current.id, changes);
      }),
    );
    if (ok) {
      setForm(null);
      refresh();
    }
  }

  async function setArchived(category: Category, archivada: boolean) {
    const ok = await mutation.run(() =>
      authorizedCall((token) => api.updateCategory(token, category.id, { archivada })),
    );
    if (ok) refresh();
  }

  async function remove(category: Category) {
    const ok = await mutation.run(() =>
      authorizedCall((token) => api.deleteCategory(token, category.id)),
    );
    if (ok) refresh();
  }

  function confirmDelete(category: Category) {
    Alert.alert(
      'Eliminar categoría',
      `¿Eliminar «${category.nombre}»? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void remove(category) },
      ],
    );
  }

  const busy = mutation.pending;

  function renderSection(title: string, items: Category[]) {
    return (
      <View key={title}>
        <Text accessibilityRole="header" style={s.section}>
          {title}
        </Text>
        {items.length === 0 ? <Text style={s.muted}>Sin categorías</Text> : null}
        {items.map((category) => (
          <View key={category.id} style={s.row}>
            <View style={styles.titleLine}>
              <View style={[styles.swatch, { backgroundColor: category.color }]} />
              <Text style={s.rowTitle}>{category.nombre}</Text>
            </View>
            {category.descripcion ? (
              <Text style={s.rowSubtitle}>{category.descripcion}</Text>
            ) : null}
            {category.archivada ? <Text style={s.badge}>Archivada</Text> : null}
            <View style={s.actions}>
              <Button
                label="Editar"
                accessibilityLabel={`Editar ${category.nombre}`}
                disabled={busy}
                onPress={() => openForm({ kind: 'edit', category })}
              />
              <Button
                label={category.archivada ? 'Desarchivar' : 'Archivar'}
                accessibilityLabel={`${category.archivada ? 'Desarchivar' : 'Archivar'} ${category.nombre}`}
                disabled={busy}
                onPress={() => void setArchived(category, !category.archivada)}
              />
              <Button
                label="Eliminar"
                variant="danger"
                accessibilityLabel={`Eliminar ${category.nombre}`}
                disabled={busy}
                onPress={() => confirmDelete(category)}
              />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={s.title}>
        Categorías de {account.nombre}
      </Text>

      <View style={s.switchRow}>
        <Text>Mostrar archivadas</Text>
        <Switch
          accessibilityLabel="Mostrar archivadas"
          value={showArchived}
          onValueChange={setShowArchived}
          disabled={busy}
        />
      </View>

      {account.archivada ? (
        <Text style={s.badge}>Cuenta archivada: no se pueden crear ni desarchivar categorías.</Text>
      ) : null}

      {form ? (
        <View style={s.form}>
          <Text style={s.rowTitle}>
            {form.kind === 'create' ? 'Nueva categoría' : 'Editar categoría'}
          </Text>
          <TextInput
            accessibilityLabel="Nombre de la categoría"
            placeholder="Nombre"
            value={nombre}
            onChangeText={setNombre}
            style={s.input}
          />
          <TextInput
            accessibilityLabel="Descripción"
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChangeText={setDescripcion}
            style={s.input}
          />
          {form.kind === 'create' ? (
            <View style={s.actions}>
              {(['ingreso', 'egreso'] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={`Tipo ${value}`}
                  accessibilityState={{ selected: tipo === value }}
                  onPress={() => setTipo(value)}
                  style={[styles.chip, tipo === value && styles.chipSelected]}
                >
                  <Text>{value === 'ingreso' ? 'Ingreso' : 'Egreso'}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={{ marginTop: 8 }}>Color (opcional)</Text>
          <View style={s.actions}>
            {CATEGORY_COLORS.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={`Color ${option.name}`}
                accessibilityState={{ selected: color === option.value }}
                onPress={() => setColor(option.value)}
                style={[
                  styles.colorOption,
                  { backgroundColor: option.value },
                  color === option.value && styles.colorSelected,
                ]}
              />
            ))}
          </View>
          {formError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {formError}
            </Text>
          ) : null}
          {mutation.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {mutation.error}
            </Text>
          ) : null}
          <View style={s.actions}>
            <Button
              label="Guardar"
              variant="primary"
              disabled={busy}
              onPress={() => void submit()}
            />
            <Button label="Cancelar" disabled={busy} onPress={() => openForm(null)} />
          </View>
        </View>
      ) : (
        <>
          {!account.archivada ? (
            <Button
              label="Nueva categoría"
              variant="primary"
              disabled={busy}
              onPress={() => openForm({ kind: 'create' })}
            />
          ) : null}
          {mutation.error ? (
            <Text accessibilityRole="alert" style={[styles.error, { marginTop: 8 }]}>
              {mutation.error}
            </Text>
          ) : null}
        </>
      )}

      {state.status === 'loading' ? (
        <ActivityIndicator size="large" testID="categories-loading" style={{ marginTop: 16 }} />
      ) : state.status === 'error' ? (
        <ErrorBox message={state.message} onRetry={reload} />
      ) : state.data.items.length === 0 ? (
        <Text style={s.muted}>Esta cuenta no tiene categorías</Text>
      ) : (
        <>
          {renderSection(
            'Ingresos',
            state.data.items.filter((c) => c.tipo === 'ingreso'),
          )}
          {renderSection(
            'Egresos',
            state.data.items.filter((c) => c.tipo === 'egreso'),
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 16, height: 16, borderRadius: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbbbbb',
  },
  chipSelected: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSelected: { borderColor: '#000000' },
  error: { color: '#b3261e' },
});
