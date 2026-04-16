import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

type Call = {
  id: string;
  from_number: string;
  started_at: string;
  outcome: string;
  summary: string | null;
  decision_reason: string | null;
};

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [phone, setPhone] = useState('+919999900001');
  const [calls, setCalls] = useState<Call[]>([]);

  async function signIn() {
    await fetch(`${API_URL}/auth/request-otp`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const r = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, code: '123456', name: 'Dr. Sharma', profession: 'doctor' }),
    });
    const d = await r.json();
    setToken(d.token);
  }

  useEffect(() => {
    if (!token) return;
    const load = () =>
      fetch(`${API_URL}/calls`, { headers: { authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setCalls(d.calls ?? []));
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [token]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>Gatekeep</Text>
      <Text style={styles.subtitle}>AI call screening — demo</Text>

      {!token ? (
        <View style={styles.card}>
          <Text style={styles.label}>Your phone (demo)</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholderTextColor="#556" />
          <Pressable style={styles.btn} onPress={signIn}>
            <Text style={styles.btnText}>Sign in (OTP = 123456)</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.h2}>Recent screened calls</Text>
          <FlatList
            data={calls}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <View style={styles.callItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mono}>{item.from_number}</Text>
                  <Text style={styles.muted}>{new Date(item.started_at).toLocaleString()}</Text>
                  {item.summary && <Text style={styles.text}>{item.summary}</Text>}
                </View>
                <View style={[styles.badge, badgeColor(item.outcome)]}>
                  <Text style={styles.badgeText}>{item.outcome}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.muted}>No calls yet. Try the web simulator!</Text>}
          />
        </>
      )}
    </View>
  );
}

function badgeColor(o: string) {
  switch (o) {
    case 'forwarded': return { backgroundColor: '#16a34a' };
    case 'rejected': return { backgroundColor: '#dc2626' };
    case 'bridged_known': return { backgroundColor: '#2563eb' };
    default: return { backgroundColor: '#475569' };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 72, backgroundColor: '#0b0d12' },
  title: { fontSize: 32, fontWeight: '800', color: '#e6e9ef' },
  subtitle: { color: '#8892a6', marginBottom: 20 },
  h2: { color: '#e6e9ef', fontSize: 18, fontWeight: '600', marginBottom: 10 },
  card: { backgroundColor: '#141822', borderRadius: 14, padding: 16, gap: 10 },
  label: { color: '#8892a6', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: '#0b0d12', borderColor: '#222734', borderWidth: 1, color: '#e6e9ef', padding: 10, borderRadius: 8 },
  btn: { backgroundColor: '#7c6cff', padding: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '600' },
  callItem: { flexDirection: 'row', backgroundColor: '#141822', padding: 14, borderRadius: 12, marginBottom: 8, alignItems: 'center' },
  mono: { color: '#e6e9ef', fontFamily: 'Courier', marginBottom: 2 },
  muted: { color: '#8892a6', fontSize: 12 },
  text: { color: '#e6e9ef', marginTop: 4, fontSize: 13 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
});
