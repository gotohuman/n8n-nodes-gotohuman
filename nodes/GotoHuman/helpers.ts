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

/**
 * Hides the legacy "Completed Review of a Type" option on trigger node version 2+.
 * Webhook routing follows the saved review type on every version: a missing value
 * stays on the agent, and an explicit "any" or review type is honored.
 */
export const REVIEW_CONFIG_WEBHOOKS_FEATURE = 'reviewConfigWebhooks';

/**
 * Stored as reviewTemplateID when the trigger should listen to every completed
 * review for the agent. A real form id means the webhook is set on that review config.
 */
export const ANY_REVIEW_FOR_AGENT = '__any__';
export const ANY_REVIEW_FOR_AGENT_LABEL = 'Any review for this agent';

export function locatorValue(parameter: unknown): string {
	if (typeof parameter === 'string') return parameter;
	if (parameter && typeof parameter === 'object' && 'value' in parameter) {
		const value = (parameter as IDataObject).value;
		return typeof value === 'string' ? value : '';
	}
	return '';
}

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

const emptyLocator = { value: '' };

function readLocator(hook: IHookFunctions, parameterName: string): string {
	return locatorValue(hook.getNodeParameter(parameterName, emptyLocator));
}

export function getTriggerOn(hook: IHookFunctions): string {
	return (hook.getNodeParameter('triggerOn', '') as string) || 'onReviewCompletion';
}

export function isAnyReviewForAgent(reviewTemplateId: string): boolean {
	return reviewTemplateId === '' || reviewTemplateId === ANY_REVIEW_FOR_AGENT;
}

export function isAgentWebhookTrigger(hook: IHookFunctions): boolean {
	// Value kept as onAgentMessageOrToolResult because it is stored in existing workflows.
	if (getTriggerOn(hook) !== 'onAgentMessageOrToolResult') return false;
	// Old nodes never stored a review type, so the value is blank and stays on the agent.
	// "Any" is the same target. A real form id registers on that review config instead.
	return isAnyReviewForAgent(readLocator(hook, 'reviewTemplateID'));
}

export function isReviewConfigWebhookTrigger(hook: IHookFunctions): boolean {
	if (getTriggerOn(hook) !== 'onAgentMessageOrToolResult') return false;
	return !isAnyReviewForAgent(readLocator(hook, 'reviewTemplateID'));
}

export function getWebhookFormId(hook: IHookFunctions): string {
	const triggerOn = getTriggerOn(hook);
	const paramName =
		triggerOn === 'onTriggerFormSubmission' ? 'triggerFormID' : 'reviewTemplateID';
	return readLocator(hook, paramName);
}

export function getWebhookAgentId(hook: IHookFunctions): string {
	return readLocator(hook, 'agentID');
}

/**
 * Active workflows are registered on n8n startup. A saved node can be missing the
 * agent or form id. getNodeParameter throws in that case, and the API rejects the
 * empty id. Skip the call so activation can finish.
 */
function hasWebhookTarget(hook: IHookFunctions): boolean {
	if (isAgentWebhookTrigger(hook)) return getWebhookAgentId(hook) !== '';
	const formId = getWebhookFormId(hook);
	if (isAnyReviewForAgent(formId)) return false;
	if (isReviewConfigWebhookTrigger(hook)) return getWebhookAgentId(hook) !== '';
	return true;
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
	query?: { onlyTriggerForms?: boolean; agentId?: string },
): Promise<INodeListSearchResult> {
	const params = new URLSearchParams();
	if (query?.onlyTriggerForms) params.set('onlyTriggerForms', 'true');
	if (query?.agentId) params.set('agentId', query.agentId);
	const queryString = params.toString();
	const options: IHttpRequestOptions = {
		method: 'GET',
		url: `${BASE_URL}/fetchN8nForms${queryString ? `?${queryString}` : ''}`,
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

function rememberWebhookId(hook: IHookFunctions, response: IDataObject): boolean {
	if (!response.success) return false;
	const webhookData = hook.getWorkflowStaticData('node');
	webhookData.webhookId = response.webhookId as string;
	return true;
}

export const gotoHumanWebhookMethods = {
	default: {
		async checkExists(this: IHookFunctions): Promise<boolean> {
			if (!hasWebhookTarget(this)) return false;
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
			const body: IDataObject = { formId, webhookUrl };
			if (isReviewConfigWebhookTrigger(this)) {
				body.agentId = getWebhookAgentId(this);
			}
			const response = await gotoHumanHookRequest(this, {
				method: 'POST',
				url: `${BASE_URL}/checkWebhook`,
				body,
				json: true,
			});
			return response.exists === true;
		},

		async create(this: IHookFunctions): Promise<boolean> {
			if (!hasWebhookTarget(this)) return false;
			const webhookUrl = this.getNodeWebhookUrl('default') as string;

			if (isAgentWebhookTrigger(this)) {
				const agentId = getWebhookAgentId(this);
				const response = await gotoHumanHookRequest(this, {
					method: 'POST',
					url: `${BASE_URL}/createAgentWebhook`,
					body: { agentId, webhookUrl },
					json: true,
				});
				return rememberWebhookId(this, response);
			}

			const formId = getWebhookFormId(this);
			const body: IDataObject = { formId, webhookUrl };
			if (isReviewConfigWebhookTrigger(this)) {
				body.agentId = getWebhookAgentId(this);
			}
			const response = await gotoHumanHookRequest(this, {
				method: 'POST',
				url: `${BASE_URL}/createWebhook`,
				body,
				json: true,
			});
			return rememberWebhookId(this, response);
		},

		async delete(this: IHookFunctions): Promise<boolean> {
			const webhookData = this.getWorkflowStaticData('node');
			if (!hasWebhookTarget(this)) {
				delete webhookData.webhookId;
				return true;
			}
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
				const body: IDataObject = { formId, webhookUrl };
				if (isReviewConfigWebhookTrigger(this)) {
					body.agentId = getWebhookAgentId(this);
				}
				await gotoHumanHookRequest(this, {
					method: 'POST',
					url: `${BASE_URL}/deleteWebhook`,
					body,
					json: true,
				});
			}

			delete webhookData.webhookId;
			return true;
		},
	},
};
