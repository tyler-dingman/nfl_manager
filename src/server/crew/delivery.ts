export type InviteDelivery = { state: 'SENT' | 'FAILED' | 'NOT_CONFIGURED'; reason?: string };

export interface CrewInviteDeliveryProvider {
  send(input: {
    recipient: string;
    inviterName: string;
    inviteUrl: string;
  }): Promise<InviteDelivery>;
}

export const crewSmsProvider: CrewInviteDeliveryProvider = {
  async send() {
    return process.env.CREW_SMS_PROVIDER
      ? { state: 'FAILED', reason: 'Configured SMS provider adapter is unavailable.' }
      : { state: 'NOT_CONFIGURED', reason: 'SMS provider is not configured.' };
  },
};

export const crewEmailProvider: CrewInviteDeliveryProvider = {
  async send() {
    return process.env.CREW_EMAIL_PROVIDER
      ? { state: 'FAILED', reason: 'Configured email provider adapter is unavailable.' }
      : { state: 'NOT_CONFIGURED', reason: 'Email provider is not configured.' };
  },
};
