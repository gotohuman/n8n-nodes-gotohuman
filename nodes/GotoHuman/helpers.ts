import {
	IDataObject,
	IHookFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	JsonObject,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

export const BASE_URL = 'https://api.gotohuman.com';

async function gotoHumanHookRequest(
	hook: IHookFunctions,
	options: IHttpRequestOptions,
): Promise<IDataObject> {
	const requestOptions: IHttpRequestOptions = {
		...options,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};

	let responseData: IDataObject;
	try {
		responseData = await hook.helpers.httpRequestWithAuthentication.call(
			hook,
			'gotoHumanApi',
			requestOptions,
		);
	} catch (error) {
		throw new NodeApiError(hook.getNode(), error as JsonObject);
	}

	const statusCode = responseData?.statusCode || 200;
	if (String(statusCode).startsWith('4') || String(statusCode).startsWith('5')) {
		const body = responseData.body as IDataObject | string | undefined;
		let message: string;
		if (typeof body === 'object' && body !== null && typeof body.error === 'string') {
			message = body.error;
		} else if (typeof body === 'string') {
			message = body;
		} else if (body !== undefined) {
			message = JSON.stringify(body);
		} else {
			message = JSON.stringify(responseData);
		}
		throw new NodeApiError(hook.getNode(), responseData as JsonObject, {
			message,
			httpCode: String(statusCode),
		});
	}

	return (responseData.body ?? responseData) as IDataObject;
}

export function getTriggerOn(hook: IHookFunctions): string {
	return (hook.getNodeParameter('triggerOn') as string) || 'onReviewCompletion';
}

export function isAgentWebhookTrigger(hook: IHookFunctions): boolean {
	// Value kept as onAgentMessageOrToolResult because it is stored in existing workflows.
	return getTriggerOn(hook) === 'onAgentMessageOrToolResult';
}

export function getWebhookFormId(hook: IHookFunctions): string {
	const triggerOn = getTriggerOn(hook);
	const paramName =
		triggerOn === 'onTriggerFormSubmission' ? 'triggerFormID' : 'reviewTemplateID';
	const formObj = hook.getNodeParameter(paramName) as IDataObject;
	return formObj.value as string;
}

export function getWebhookAgentId(hook: IHookFunctions): string {
	const agentObj = hook.getNodeParameter('agentID') as IDataObject;
	return agentObj.value as string;
}

interface N8nFormOption {
	value: string;
	label: string;
}

interface N8nFormsResponse {
	forms: N8nFormOption[];
}

export async function fetchN8nFormsListSearch(
	this: ILoadOptionsFunctions,
	filter?: string,
	query?: { onlyTriggerForms?: boolean },
): Promise<INodeListSearchResult> {
	const queryString = query?.onlyTriggerForms ? '?onlyTriggerForms=true' : '';
	const options: IHttpRequestOptions = {
		method: 'GET',
		url: `${BASE_URL}/fetchN8nForms${queryString}`,
		json: true,
	};

	const response: N8nFormsResponse = await this.helpers.httpRequestWithAuthentication.call(
		this,
		'gotoHumanApi',
		options,
	);

	if (response === undefined) {
		const emptyLabel = query?.onlyTriggerForms
			? 'No trigger forms found. Please create one first in our web app.'
			: 'No review types found. Please create one first in our web app.';
		throw new NodeOperationError(this.getNode(), emptyLabel);
	}

	return {
		results: (response?.forms || [])
			.filter(
				(form) => !filter || form.label.toLowerCase().includes(filter.toLowerCase()),
			)
			.map((form) => ({
				name: form.label,
				value: form.value,
			})),
	};
}

interface N8nAgentOption {
	value: string;
	label: string;
}

interface N8nAgentsResponse {
	agents: N8nAgentOption[];
}

export async function fetchN8nAgentsListSearch(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const options: IHttpRequestOptions = {
		method: 'GET',
		url: `${BASE_URL}/fetchN8nAgents`,
		json: true,
	};

	const response: N8nAgentsResponse = await this.helpers.httpRequestWithAuthentication.call(
		this,
		'gotoHumanApi',
		options,
	);

	if (response === undefined) {
		throw new NodeOperationError(
			this.getNode(),
			'No agents found. Please create one first in our web app.',
		);
	}

	return {
		results: (response?.agents || [])
			.filter(
				(agent) => !filter || agent.label.toLowerCase().includes(filter.toLowerCase()),
			)
			.map((agent) => ({
				name: agent.label,
				value: agent.value,
			})),
	};
}

export const gotoHumanWebhookMethods = {
	default: {
		async checkExists(this: IHookFunctions): Promise<boolean> {
			const webhookUrl = this.getNodeWebhookUrl('default') as string;

			if (isAgentWebhookTrigger(this)) {
				const agentId = getWebhookAgentId(this);
				const response = await gotoHumanHookRequest(this, {
					method: 'POST',
					url: `${BASE_URL}/checkAgentWebhook`,
					body: { agentId, webhookUrl },
					json: true,
				});
				return response.exists === true;
			}

			const formId = getWebhookFormId(this);
			const response = await gotoHumanHookRequest(this, {
				method: 'POST',
				url: `${BASE_URL}/checkWebhook`,
				body: { formId, webhookUrl },
				json: true,
			});
			return response.exists === true;
		},

		async create(this: IHookFunctions): Promise<boolean> {
			const webhookUrl = this.getNodeWebhookUrl('default') as string;

			if (isAgentWebhookTrigger(this)) {
				const agentId = getWebhookAgentId(this);
				const response = await gotoHumanHookRequest(this, {
					method: 'POST',
					url: `${BASE_URL}/createAgentWebhook`,
					body: { agentId, webhookUrl },
					json: true,
				});

				if (response.success) {
					const webhookData = this.getWorkflowStaticData('node');
					webhookData.webhookId = response.webhookId as string;
					return true;
				}
				return false;
			}

			const formId = getWebhookFormId(this);
			const response = await gotoHumanHookRequest(this, {
				method: 'POST',
				url: `${BASE_URL}/createWebhook`,
				body: { formId, webhookUrl },
				json: true,
			});

			if (response.success) {
				const webhookData = this.getWorkflowStaticData('node');
				webhookData.webhookId = response.webhookId as string;
				return true;
			}
			return false;
		},

		async delete(this: IHookFunctions): Promise<boolean> {
			const webhookUrl = this.getNodeWebhookUrl('default') as string;

			if (isAgentWebhookTrigger(this)) {
				const agentId = getWebhookAgentId(this);
				await gotoHumanHookRequest(this, {
					method: 'POST',
					url: `${BASE_URL}/deleteAgentWebhook`,
					body: { agentId, webhookUrl },
					json: true,
				});
			} else {
				const formId = getWebhookFormId(this);
				await gotoHumanHookRequest(this, {
					method: 'POST',
					url: `${BASE_URL}/deleteWebhook`,
					body: { formId, webhookUrl },
					json: true,
				});
			}

			const webhookData = this.getWorkflowStaticData('node');
			delete webhookData.webhookId;
			return true;
		},
	},
};
