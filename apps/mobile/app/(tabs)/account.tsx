import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL } from '../../lib/api';
import { C, Eyebrow, Heading } from '../../components/screen';
import { useAuth } from '../../lib/auth-context';
import { useTeam } from '../../lib/team-context';
import { router } from 'expo-router';
import { useTeamBranding } from '../../lib/team-branding';
const rows = [{label:'Profile',href:'/profile' as const},{label:'Favorite team',href:'/team-select' as const},{label:'Front Office',href:'/front-office' as const},{label:'Merch',href:'/merch' as const},{label:'Notification preferences',href:'/notification-settings' as const},{label:'Saved content',href:'/saved' as const},{label:'The Locker',href:'/rewards' as const}];
export default function Account() {
  const { user, logout, busy } = useAuth();
  const { teamId } = useTeam();
  const { theme } = useTeamBranding();
  return (
    <View style={s.page}>
      <Eyebrow>YOUR DOWN & DISTANCE</Eyebrow>
      <Heading>Account</Heading>
      <View style={[s.card, { backgroundColor: theme.dark }]}>
        {user?.avatarUrl?<Image source={{uri:user.avatarUrl}} style={s.avatar}/>:<View style={[s.avatarFallback, { backgroundColor: theme.primary }]}><Text style={[s.avatarLetter, { color: theme.light }]}>{user?.displayName?.[0]??'D'}</Text></View>}
        <Text style={[s.name, { color: theme.light }]}>{user?.displayName}</Text>
        <Text style={s.email}>{user?.primaryEmail ?? 'D&D account'}</Text>
      </View>
      {rows.map((row, i) => (
        <Pressable key={row.label} style={s.row} onPress={() => router.push(row.href)}>
          <Text style={s.rowText}>{row.label}</Text>
          <Text style={[s.value, { color: theme.primary }]}>{i === 1 ? teamId : 'OPEN'} ›</Text>
        </Pressable>
      ))}
      <Text style={s.api}>API: {API_BASE_URL}</Text>
      <Pressable style={[s.logout, { borderColor: theme.primary }]} disabled={busy} onPress={() => void logout()}><Text style={[s.logoutText, { color: theme.primary }]}>{busy ? 'Signing out…' : 'Log out'}</Text></Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream, padding: 20 },
  card: { borderRadius: 18, padding: 20, marginTop: 22, marginBottom: 14 },
  name: { fontSize: 21, fontWeight: '900' },
  email: { color: '#AFC0CC', marginTop: 6 },
  avatar:{width:54,height:54,borderRadius:27,marginBottom:14},avatarFallback:{width:54,height:54,borderRadius:27,alignItems:'center',justifyContent:'center',marginBottom:14},avatarLetter:{fontSize:23,fontWeight:'900'},
  row: {
    backgroundColor: C.white,
    padding: 18,
    borderRadius: 14,
    marginTop: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowText: { color: C.ink, fontWeight: '800' },
  value: { fontSize: 13, fontWeight: '900' },
  api: { color: C.muted, fontSize: 12, marginTop: 24 },
  logout: { marginTop: 24, borderWidth: 1, borderRadius: 12, padding: 15, alignItems: 'center' },
  logoutText: { fontWeight: '900' },
});
