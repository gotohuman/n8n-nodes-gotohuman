import {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class GotoHumanApi implements ICredentialType {
	name = 'gotoHumanApi';
	displayName = 'gotoHuman API';
	icon: Icon = { light: 'file:../icons/gth.svg', dark: 'file:../icons/gth.dark.svg' };
	documentationUrl = 'https://docs.gotohuman.com/Integrations/n8n';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			}
		},
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.gotohuman.com',
			url: '/authCheck',
		},
	};
}
