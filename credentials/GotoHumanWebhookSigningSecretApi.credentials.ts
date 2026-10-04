import { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';

export class GotoHumanWebhookSigningSecretApi implements ICredentialType {
	name = 'gotoHumanWebhookSigningSecretApi';
	displayName = 'gotoHuman Webhook Signing Secret API';
	icon: Icon = { light: 'file:../icons/gth.svg', dark: 'file:../icons/gth.dark.svg' };
	documentationUrl = 'https://docs.gotohuman.com/Integrations/n8n';
	properties: INodeProperties[] = [
		{
			displayName: 'Webhook Signing Secret',
			name: 'signingSecret',
			type: 'string',
			typeOptions: { password: true },
      required: true,
			default: '',
			placeholder: 'whsec_...',
			description:
				"The signing secret from the webhook configuration in gotoHuman (starts with 'whsec_'). It is used to verify that incoming webhook requests really come from gotoHuman.",
		},
	];
}
