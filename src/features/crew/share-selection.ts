export type CrewShareRecipient = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export function allRecipientsSelected(
  recipientIds: readonly string[],
  selectedIds: ReadonlySet<string>,
) {
  return recipientIds.length > 0 && recipientIds.every((id) => selectedIds.has(id));
}

export function toggleAllRecipients(recipientIds: readonly string[], selectAll: boolean) {
  return new Set(selectAll ? recipientIds : []);
}

export function toggleRecipient(selectedIds: ReadonlySet<string>, recipientId: string) {
  const next = new Set(selectedIds);
  if (next.has(recipientId)) next.delete(recipientId);
  else next.add(recipientId);
  return next;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'PERSON';

export function crewShareCta(
  recipients: readonly CrewShareRecipient[],
  selectedIds: ReadonlySet<string>,
) {
  const selected = recipients.filter((recipient) => selectedIds.has(recipient.id));
  if (!selected.length) return 'SELECT AT LEAST ONE PERSON';
  if (selected.length === recipients.length) return 'SEND TO CREW →';
  if (selected.length === 1) return `SEND TO ${firstName(selected[0].displayName).toUpperCase()} →`;
  if (selected.length === 2)
    return `SEND TO ${selected.map((person) => firstName(person.displayName).toUpperCase()).join(' + ')} →`;
  return `SEND TO ${selected.length} PEOPLE →`;
}

export function resolveCrewShareAudience(
  eligibleIds: readonly string[],
  requestedIds: readonly string[],
) {
  const eligible = new Set(eligibleIds);
  const recipients = [...new Set(requestedIds)];
  if (!recipients.length) throw new Error('Select at least one person.');
  if (recipients.some((id) => !eligible.has(id)))
    throw new Error('One recipient is no longer in this Crew. Refresh recipient state.');
  return {
    recipientIds: recipients,
    visibility: recipients.length === eligible.size ? ('CREW' as const) : ('TARGETED' as const),
  };
}
