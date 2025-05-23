import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class GotoHumanApi implements ICredentialType {
	name = 'gotoHumanApi';
	displayName = 'gotoHuman API';
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