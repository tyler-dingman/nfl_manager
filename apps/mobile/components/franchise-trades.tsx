import {
  isTradeDeadlinePassed,
  TRADE_DEADLINE_MESSAGE,
} from '../../../src/lib/front-office-trade-window';
import { FranchiseTradeMarket } from './franchise-trade-market';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TEAM_LIST } from '../../../src/data/teams';
import type { TeamTradeAssetSourceDTO } from '../../../src/types/trade-offers';
import { franchiseRequest } from './franchise-roster';
import { SectionMenu } from './section-menu';
import { useTeamBranding } from '../lib/team-branding';
type Asset = {
  id: string;
  type: 'player' | 'pick';
  side: 'send' | 'receive';
  label: string;
  value: number;
  playerId?: string;
  pickId?: string;
};
type Trade = { id: string; partnerTeamAbbr: string; sendAssets: Asset[]; receiveAssets: Asset[] };
type Analysis = {
  acceptance: number;
  likelyAccepted: boolean;
  packageValues: { outgoing: number; incoming: number; difference: number };
  proposal: { isValid: boolean; validationErrors?: { message: string }[] };
  caps: { userCapSpace: number; partnerCapSpace: number };
};
export function FranchiseTrades({
  saveId,
  phase,
  onChanged,
}: {
  saveId: string;
  phase: string;
  onChanged: () => Promise<void>;
}) {
  const { teamId, theme } = useTeamBranding();
  const [tool, setTool] = useState('Build Trade');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [partner, setPartner] = useState(TEAM_LIST.find((t) => t.abbr !== teamId)!.abbr);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [assets, setAssets] = useState<{
    user: TeamTradeAssetSourceDTO;
    partner: TeamTradeAssetSourceDTO;
  } | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [picker, setPicker] = useState<'send' | 'receive' | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    setTrade(null);
    setAnalysis(null);
    setAssets(null);
    setNotice('');
    setError('');
  }, [partner, saveId]);
  async function create() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await franchiseRequest<{ trade: Trade }>('/api/trades/create', {
        saveId,
        teamAbbr: teamId,
        partnerTeamAbbr: partner,
      });
      const source = await franchiseRequest<{
        user: TeamTradeAssetSourceDTO;
        partner: TeamTradeAssetSourceDTO;
      }>('/api/trade-offers/assets', { saveId, partnerTeamAbbr: partner });
      setAssets(source);
      if (targetId && source.partner.players.some((p) => p.id === targetId)) {
        setTrade(
          await franchiseRequest<Trade>(`/api/trades/${result.trade.id}/add-asset`, {
            saveId,
            side: 'receive',
            type: 'player',
            playerId: targetId,
          }),
        );
        setTargetId(null);
      } else setTrade(result.trade);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start trade.');
    } finally {
      setBusy(false);
    }
  }
  async function update(action: 'add-asset' | 'remove-asset', payload: object) {
    if (!trade || busy) return;
    setBusy(true);
    setError('');
    try {
      setTrade(
        await franchiseRequest<Trade>(`/api/trades/${trade.id}/${action}`, { saveId, ...payload }),
      );
      setAnalysis(null);
      setNotice('');
      setPicker(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update assets.');
    } finally {
      setBusy(false);
    }
  }
  async function evaluate() {
    if (!trade || busy) return;
    setBusy(true);
    setError('');
    try {
      setAnalysis(await franchiseRequest<Analysis>(`/api/trades/${trade.id}/analyze`, { saveId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to evaluate trade.');
    } finally {
      setBusy(false);
    }
  }
  async function propose() {
    if (!trade || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await franchiseRequest<{ accepted: boolean; acceptance: number }>(
        `/api/trades/${trade.id}/propose`,
        { saveId },
      );
      setNotice(
        result.accepted
          ? 'Trade accepted. Your roster has been updated.'
          : 'Trade declined. Adjust the package and try again.',
      );
      if (result.accepted) {
        setTrade(null);
        setAssets(null);
        setAnalysis(null);
        await onChanged();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to propose trade.');
    } finally {
      setBusy(false);
    }
  }
  const menu = (
    <SectionMenu
      title="Trade tools"
      items={[
        'Build Trade',
        'Trade Finder',
        'Find Trade Partners',
        'My Trade Offers',
        'Trade Block',
        'Recently Viewed',
        'League Trade Activity',
      ].map((label) => ({ label, selected: tool === label, onPress: () => setTool(label) }))}
    />
  );
  if (isTradeDeadlinePassed(phase))
    return (
      <View style={s.card}>
        <Text style={s.heading}>Trade Market</Text>
        <Text style={s.copy}>{TRADE_DEADLINE_MESSAGE}</Text>
      </View>
    );
  if (tool !== 'Build Trade')
    return (
      <View>
        {menu}
        <FranchiseTradeMarket
          saveId={saveId}
          tool={tool}
          onChoose={(target) => {
            if (target.teamAbbr) {
              setTrade(null);
              setAssets(null);
              setAnalysis(null);
              setPartner(target.teamAbbr);
              setTargetId(target.id);
              setTool('Build Trade');
            }
          }}
        />
      </View>
    );
  const source = picker === 'send' ? assets?.user : assets?.partner;
  const selected = picker === 'send' ? trade?.sendAssets : trade?.receiveAssets;
  return (
    <View>
      {menu}
      <Text style={s.title}>TRADE CENTER</Text>
      <Text style={s.copy}>Build a package. Find the right partner. Improve your roster.</Text>
      <SectionMenu
        title={`Trade partner: ${partner}`}
        items={TEAM_LIST.filter((t) => t.abbr !== teamId).map((t) => ({
          label: t.name,
          selected: partner === t.abbr,
          onPress: () => {
            if (!busy) setPartner(t.abbr);
          },
        }))}
      />
      {busy && <ActivityIndicator color="white" />}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {!!notice && <Text style={s.copy}>{notice}</Text>}
      {!trade && (
        <Pressable
          disabled={busy}
          style={[s.button, { backgroundColor: theme.primaryFill }]}
          onPress={() => void create()}
        >
          <Text style={{ color: theme.onPrimary, fontWeight: '800' }}>BUILD TRADE</Text>
        </Pressable>
      )}
      {trade && (
        <>
          {(['send', 'receive'] as const).map((side) => (
            <View key={side} style={s.card}>
              <Text style={s.heading}>
                {side === 'send' ? `${teamId} SENDS` : `${teamId} RECEIVES`}
              </Text>
              {(side === 'send' ? trade.sendAssets : trade.receiveAssets).map((asset) => (
                <View key={asset.id} style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{asset.label}</Text>
                    <Text style={s.copy}>
                      {asset.type.toUpperCase()} · Value {asset.value}
                    </Text>
                  </View>
                  <Pressable
                    disabled={busy}
                    accessibilityLabel={`Remove ${asset.label}`}
                    style={s.touch}
                    onPress={() => void update('remove-asset', { side, assetId: asset.id })}
                  >
                    <Text style={s.name}>✕</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                disabled={busy || !assets}
                style={s.button}
                onPress={() => {
                  setPicker(side);
                  setQuery('');
                }}
              >
                <Text style={s.name}>ADD PLAYER OR PICK +</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            disabled={busy || !trade.sendAssets.length || !trade.receiveAssets.length}
            style={s.button}
            onPress={() => void evaluate()}
          >
            <Text style={s.name}>EVALUATE TRADE</Text>
          </Pressable>
          {analysis && (
            <View style={s.card}>
              <Text style={s.heading}>TRADE REVIEW</Text>
              <Text style={s.name}>
                {analysis.likelyAccepted ? 'Strong interest' : 'Needs improvement'} · Interest{' '}
                {analysis.acceptance}
              </Text>
              <Text style={s.copy}>
                Sending value {analysis.packageValues.outgoing} · Receiving value{' '}
                {analysis.packageValues.incoming}
              </Text>
              <Text style={s.copy}>
                Your cap space ${analysis.caps.userCapSpace.toFixed(1)}M · Partner $
                {analysis.caps.partnerCapSpace.toFixed(1)}M
              </Text>
              {analysis.proposal.validationErrors?.map(({ message }, i) => (
                <Text key={i} style={s.error}>
                  {message}
                </Text>
              ))}
              <Pressable
                disabled={busy || !analysis.proposal.isValid}
                style={[s.button, { backgroundColor: theme.primaryFill }]}
                onPress={() =>
                  Alert.alert(
                    'Propose trade?',
                    `Send ${trade.sendAssets.map((a) => a.label).join(', ')} to ${partner} for ${trade.receiveAssets.map((a) => a.label).join(', ')}?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Propose', onPress: () => void propose() },
                    ],
                  )
                }
              >
                <Text style={{ color: theme.onPrimary, fontWeight: '800' }}>PROPOSE TRADE</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
      <Modal visible={!!picker} animationType="slide" onRequestClose={() => setPicker(null)}>
        <SafeAreaView style={s.modal}>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
            <Pressable style={s.button} onPress={() => setPicker(null)}>
              <Text style={s.name}>CLOSE ✕</Text>
            </Pressable>
            <Text style={s.title}>SELECT TRADE ASSETS</Text>
            <TextInput
              accessibilityLabel="Search trade assets"
              value={query}
              onChangeText={setQuery}
              placeholder="Search players or picks"
              placeholderTextColor="#AFC5D3"
              style={s.input}
            />
            {!!error && <Text style={s.error}>{error}</Text>}
            {source?.players
              .filter(
                (p) =>
                  `${p.firstName} ${p.lastName} ${p.position}`
                    .toLowerCase()
                    .includes(query.toLowerCase()) && !selected?.some((a) => a.playerId === p.id),
              )
              .map((p) => (
                <Pressable
                  disabled={busy}
                  key={p.id}
                  style={s.card}
                  onPress={() =>
                    void update('add-asset', { side: picker, type: 'player', playerId: p.id })
                  }
                >
                  <Text style={s.name}>
                    {p.firstName} {p.lastName}
                  </Text>
                  <Text style={s.copy}>
                    {p.position} · {p.rating ?? '—'} OVR · {p.capHit}
                  </Text>
                </Pressable>
              ))}
            {source?.draftPicks
              .filter(
                (p) =>
                  p.label.toLowerCase().includes(query.toLowerCase()) &&
                  !selected?.some((a) => a.pickId === p.id),
              )
              .map((p) => (
                <Pressable
                  disabled={busy}
                  key={p.id}
                  style={s.card}
                  onPress={() =>
                    void update('add-asset', { side: picker, type: 'pick', pickId: p.id })
                  }
                >
                  <Text style={s.name}>{p.label}</Text>
                  <Text style={s.copy}>
                    {p.year} · Round {p.round}
                  </Text>
                </Pressable>
              ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  title: { color: 'white', fontFamily: 'BarlowCondensed', fontSize: 34, marginVertical: 12 },
  heading: { color: 'white', fontFamily: 'BarlowCondensed', fontSize: 26 },
  name: { color: 'white', fontSize: 14, fontWeight: '800' },
  copy: { color: '#AFC5D3', fontSize: 13, lineHeight: 21, marginVertical: 8 },
  error: { color: '#FFB4AB', marginVertical: 12 },
  card: {
    backgroundColor: '#06222B',
    borderWidth: 1,
    borderColor: '#36505B',
    borderRadius: 10,
    padding: 18,
    marginVertical: 10,
  },
  button: {
    backgroundColor: '#263F48',
    minHeight: 48,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#36505B',
  },
  touch: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1, backgroundColor: '#001222' },
  input: {
    borderWidth: 1,
    borderColor: '#36505B',
    padding: 14,
    borderRadius: 8,
    color: 'white',
    marginVertical: 12,
  },
});
