import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../hooks/use-auth';
import { useLoader, useMutation } from '../hooks/use-loader';
import { formatCents, parseCentsFromInput } from '../lib/money';
import type { Account, ResourcesApi } from '../lib/resources-api';
import { Button, ErrorBox, screenStyles as s } from './ui';

type Form = { kind: 'create' } | { kind: 'rename'; account: Account } | null;

const BALANCE_ERROR = 'El saldo inicial no es válido. Usa el formato 1234.56 (hasta 2 decimales).';

export default function AccountsScreen({
  api,
  onOpenAccount,
}: {
  api: ResourcesApi;
  onOpenAccount: (account: Account) => void;
}) {
  const { authorizedCall } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<Form>(null);
  const [nombre, setNombre] = useState('');
  const [saldo, setSaldo] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useMutation();

  const { state, reload, refresh } = useLoader(
    () =>
      authorizedCall((token) =>
        api.listAccounts(token, { pageSize: 100, incluirArchivadas: showArchived }),
      ),
    String(showArchived),
  );

  function openForm(next: Form) {
    setForm(next);
    setNombre(next?.kind === 'rename' ? next.account.nombre : '');
    setSaldo('');
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
    let saldoInicial: number | undefined;
    if (form.kind === 'create' && saldo.trim() !== '') {
      const cents = parseCentsFromInput(saldo);
      if (cents === null) {
        setFormError(BALANCE_ERROR);
        return;
      }
      saldoInicial = cents;
    }
    setFormError(null);
    const ok = await mutation.run(() =>
      authorizedCall<unknown>((token) =>
        form.kind === 'create'
          ? api.createAccount(token, {
              nombre: name,
              ...(saldoInicial !== undefined ? { saldoInicial } : {}),
            })
          : api.updateAccount(token, form.account.id, { nombre: name }),
      ),
    );
    if (ok) {
      setForm(null);
      refresh();
    }
  }

  async function setArchived(account: Account, archivada: boolean) {
    const ok = await mutation.run(() =>
      authorizedCall((token) => api.updateAccount(token, account.id, { archivada })),
    );
    if (ok) refresh();
  }

  function confirmArchive(account: Account) {
    Alert.alert('Archivar cuenta', `¿Archivar «${account.nombre}»? Podrás desarchivarla después.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Archivar', style: 'destructive', onPress: () => void setArchived(account, true) },
    ]);
  }

  const busy = mutation.pending;

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={s.title}>
        Cuentas
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

      {form ? (
        <View style={s.form}>
          <Text style={s.rowTitle}>
            {form.kind === 'create' ? 'Nueva cuenta' : 'Renombrar cuenta'}
          </Text>
          <TextInput
            accessibilityLabel="Nombre de la cuenta"
            placeholder="Nombre"
            value={nombre}
            onChangeText={setNombre}
            style={s.input}
          />
          {form.kind === 'create' ? (
            <TextInput
              accessibilityLabel="Saldo inicial"
              placeholder="Saldo inicial (opcional)"
              keyboardType="numbers-and-punctuation"
              value={saldo}
              onChangeText={setSaldo}
              style={s.input}
            />
          ) : null}
          {formError ? (
            <Text accessibilityRole="alert" style={{ color: '#b3261e' }}>
              {formError}
            </Text>
          ) : null}
          {mutation.error ? (
            <Text accessibilityRole="alert" style={{ color: '#b3261e' }}>
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
          <Button
            label="Nueva cuenta"
            variant="primary"
            disabled={busy}
            onPress={() => openForm({ kind: 'create' })}
          />
          {mutation.error ? (
            <Text accessibilityRole="alert" style={{ color: '#b3261e', marginTop: 8 }}>
              {mutation.error}
            </Text>
          ) : null}
        </>
      )}

      <View style={{ height: 12 }} />

      {state.status === 'loading' ? (
        <ActivityIndicator size="large" testID="accounts-loading" />
      ) : state.status === 'error' ? (
        <ErrorBox message={state.message} onRetry={reload} />
      ) : state.data.items.length === 0 ? (
        <Text style={s.muted}>Crea tu primera cuenta</Text>
      ) : (
        state.data.items.map((account) => (
          <View key={account.id} style={s.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${account.nombre}`}
              onPress={() => onOpenAccount(account)}
            >
              <Text style={s.rowTitle}>{account.nombre}</Text>
              <Text style={s.rowSubtitle}>Saldo inicial {formatCents(account.saldoInicial)}</Text>
              {account.archivada ? <Text style={s.badge}>Archivada</Text> : null}
            </Pressable>
            <View style={s.actions}>
              <Button
                label="Renombrar"
                accessibilityLabel={`Renombrar ${account.nombre}`}
                disabled={busy}
                onPress={() => openForm({ kind: 'rename', account })}
              />
              {account.archivada ? (
                <Button
                  label="Desarchivar"
                  accessibilityLabel={`Desarchivar ${account.nombre}`}
                  disabled={busy}
                  onPress={() => void setArchived(account, false)}
                />
              ) : (
                <Button
                  label="Archivar"
                  accessibilityLabel={`Archivar ${account.nombre}`}
                  disabled={busy}
                  onPress={() => confirmArchive(account)}
                />
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
