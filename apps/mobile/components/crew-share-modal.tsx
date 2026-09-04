import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getCrewShareRecipients, shareToCrew, type CrewShareRecipient } from '../lib/api';
import { useTeamBranding } from '../lib/team-branding';

export type MobileCrewShareContent = {
  contentType: string;
  contentId: string;
  href: string;
  title: string;
};
const firstName = (name: string) => name.trim().split(/\s+/)[0].toUpperCase();
export default function CrewShareModal({
  visible,
  content,
  onClose,
  onShared,
}: {
  visible: boolean;
  content: MobileCrewShareContent;
  onClose: () => void;
  onShared?: (message: string) => void;
}) {
  const { theme } = useTeamBranding();
  const [recipients, setRecipients] = useState<CrewShareRecipient[]>([]),
    [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(''),
    [status, setStatus] = useState(''),
    [sending, setSending] = useState(false),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setStatus('');
    void getCrewShareRecipients()
      .then((body) => {
        setRecipients(body.recipients);
        setSelected(new Set(body.recipients.map(({ id }) => id)));
      })
      .catch((error) =>
        setStatus(error instanceof Error ? error.message : 'Unable to load your Crew.'),
      )
      .finally(() => setLoading(false));
  }, [visible]);
  const everyone = recipients.length > 0 && recipients.every(({ id }) => selected.has(id));
  const selectedPeople = useMemo(
    () => recipients.filter(({ id }) => selected.has(id)),
    [recipients, selected],
  );
  const cta = everyone
    ? 'SEND TO CREW →'
    : selectedPeople.length === 1
      ? `SEND TO ${firstName(selectedPeople[0].displayName)} →`
      : selectedPeople.length === 2
        ? `SEND TO ${selectedPeople.map(({ displayName }) => firstName(displayName)).join(' + ')} →`
        : selectedPeople.length
          ? `SEND TO ${selectedPeople.length} PEOPLE →`
          : 'SELECT AT LEAST ONE PERSON';
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const submit = async () => {
    if (!selected.size || sending) return;
    setSending(true);
    try {
      await shareToCrew({ ...content, message, recipientIds: [...selected] });
      const confirmation = everyone
        ? 'Shared with the Crew.'
        : 'Shared with selected Crew members.';
      onShared?.(confirmation);
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to share.');
    } finally {
      setSending(false);
    }
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={s.page}>
        <View style={s.header}>
          <Text style={s.heading}>SHARE WITH THE CREW</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={s.close}>×</Text>
          </Pressable>
        </View>
        <View style={s.preview}>
          <Text style={[s.kind, { color: theme.primary }]}>
            {content.contentType.replace('_', ' ')}
          </Text>
          <Text style={s.title}>{content.title}</Text>
        </View>
        {loading ? (
          <Text style={s.center}>Loading your Crew…</Text>
        ) : recipients.length ? (
          <>
            <Text style={s.label}>SEND TO</Text>
            <ScrollView style={s.recipients} nestedScrollEnabled>
              <RecipientRow
                name="EVERYONE"
                detail={`All ${recipients.length} Crew members`}
                checked={everyone}
                mixed={selected.size > 0 && !everyone}
                onPress={() => setSelected(new Set(everyone ? [] : recipients.map(({ id }) => id)))}
                color={theme.primaryFill}
              />
              {recipients.map((recipient) => (
                <RecipientRow
                  key={recipient.id}
                  name={recipient.displayName}
                  checked={selected.has(recipient.id)}
                  onPress={() => toggle(recipient.id)}
                  color={theme.primaryFill}
                  avatarUrl={recipient.avatarUrl}
                />
              ))}
            </ScrollView>
            <TextInput
              value={message}
              onChangeText={(value) => setMessage(value.slice(0, 120))}
              placeholder="Add a message (optional)…"
              multiline
              style={s.message}
            />
            <Text style={s.count}>{message.length}/120</Text>
            <Pressable
              disabled={!selected.size || sending}
              onPress={() => void submit()}
              accessibilityRole="button"
              accessibilityLabel={`Send to ${selected.size} Crew members`}
              style={[
                s.send,
                { backgroundColor: theme.primaryFill },
                (!selected.size || sending) && s.disabled,
              ]}
            >
              <Text style={[s.sendText, { color: theme.onPrimary }]}>
                {sending ? 'SENDING…' : cta}
              </Text>
            </Pressable>
            {!selected.size ? <Text style={s.hint}>Select at least one person.</Text> : null}
          </>
        ) : (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>YOUR CREW IS EMPTY</Text>
            <Text style={s.center}>Invite some people before sharing.</Text>
            <Pressable
              style={[s.send, { backgroundColor: theme.primaryFill }]}
              onPress={() => {
                onClose();
                router.push('/crew' as never);
              }}
            >
              <Text style={[s.sendText, { color: theme.onPrimary }]}>INVITE FRIENDS</Text>
            </Pressable>
          </View>
        )}
        {status ? (
          <Text accessibilityLiveRegion="polite" style={s.status}>
            {status}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}
function RecipientRow({
  name,
  detail,
  checked,
  mixed = false,
  onPress,
  color,
  avatarUrl,
}: {
  name: string;
  detail?: string;
  checked: boolean;
  mixed?: boolean;
  onPress: () => void;
  color: string;
  avatarUrl?: string | null;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: mixed ? 'mixed' : checked }}
      accessibilityLabel={detail ? `${name}, ${detail}` : name}
      style={s.row}
    >
      <View
        style={[s.check, checked || mixed ? { backgroundColor: color, borderColor: color } : null]}
      >
        <Text style={s.checkText}>{mixed ? '−' : checked ? '✓' : ''}</Text>
      </View>
      {avatarUrl ? <Image source={{ uri: avatarUrl }} style={s.avatar} /> : null}
      <View>
        <Text style={s.name}>{name}</Text>
        {detail ? <Text style={s.detail}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 18, fontWeight: '900', color: '#00172B' },
  close: { fontSize: 32, color: '#00172B', padding: 8 },
  preview: { backgroundColor: '#F1F3F5', borderRadius: 16, padding: 16, marginTop: 18 },
  kind: { fontSize: 11, fontWeight: '900' },
  title: { color: '#00172B', fontWeight: '900', marginTop: 7, fontSize: 16 },
  label: { fontSize: 11, fontWeight: '900', color: '#667085', marginTop: 20, marginBottom: 8 },
  recipients: { maxHeight: 280, borderWidth: 1, borderColor: '#E2E5E8', borderRadius: 14 },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E5E8',
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#A8B0B7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: '#fff', fontWeight: '900' },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  name: { fontWeight: '900', color: '#00172B' },
  detail: { fontSize: 12, color: '#667085', marginTop: 2 },
  message: {
    height: 90,
    borderWidth: 1,
    borderColor: '#CFD4D7',
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
    textAlignVertical: 'top',
  },
  count: { textAlign: 'right', color: '#98A0A7', fontSize: 11 },
  send: {
    minHeight: 52,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  sendText: { fontWeight: '900' },
  disabled: { opacity: 0.45 },
  hint: { color: '#667085', fontSize: 12, textAlign: 'center', marginTop: 7 },
  center: { color: '#667085', textAlign: 'center', marginTop: 24 },
  empty: { paddingVertical: 40 },
  emptyTitle: { textAlign: 'center', fontWeight: '900', color: '#00172B' },
  status: { textAlign: 'center', color: '#667085', fontWeight: '700', marginTop: 12 },
});
