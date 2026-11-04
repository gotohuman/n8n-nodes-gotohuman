import {
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	INodeCredentialTestResult,
	IWebhookFunctions,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

import {
	ANY_REVIEW_FOR_AGENT,
	ANY_REVIEW_FOR_AGENT_LABEL,
	REVIEW_CONFIG_WEBHOOKS_FEATURE,
	fetchN8nAgentsListSearch,
	fetchN8nFormsListSearch,
	gotoHumanWebhookMethods,
	locatorValue,
} from './helpers';
import { getSigningSecretFormatError, verifyWebhookSignature } from './webhook-helpers';

const featureOff = { '@feature': [{ _cnd: { not: REVIEW_CONFIG_WEBHOOKS_FEATURE } }] };

const triggerOnOptions = [
	{
		name: 'Completed Review',
		// Stored value kept so existing workflows still match.
		value: 'onAgentMessageOrToolResult',
	},
	{
		name: 'Completed Review of a Type (Legacy)',
		value: 'onReviewCompletion',
		displayOptions: {
			show: featureOff,
		},
	},
	{
		name: 'Submitted Trigger Form',
		value: 'onTriggerFormSubmission',
	},
];

const agentModes = [
	{
		displayName: 'From List',
		name: 'list',
		type: 'list' as const,
		placeholder: 'Select an agent...',
		typeOptions: {
			searchListMethod: 'searchAgents',
			searchable: true,
		},
	},
	{
		displayName: 'ID',
		name: 'id',
		type: 'string' as const,
		hint: 'Enter an ID',
		placeholder: 'e.g. Y5XrpfmvpKcdJzKYLX2M',
	},
];

const reviewTypeModes = [
	{
		displayName: 'From List',
		name: 'list',
		type: 'list' as const,
		placeholder: 'Select a review type...',
		typeOptions: {
			searchListMethod: 'searchReviewTemplates',
			searchable: true,
		},
	},
	{
		displayName: 'ID',
		name: 'id',
		type: 'string' as const,
		hint: 'Enter an ID',
		placeholder: 'e.g. FjbxGtNfPIuDdRm55eqK',
	},
];

const triggerFormModes = [
	{
		displayName: 'From List',
		name: 'list',
		type: 'list' as const,
		placeholder: 'Select a trigger form...',
		typeOptions: {
			searchListMethod: 'searchTriggerForms',
			searchable: true,
		},
	},
	{
		displayName: 'ID',
		name: 'id',
		type: 'string' as const,
		hint: 'Enter an ID',
		placeholder: 'e.g. FjbxGtNfPIuDdRm55eqK',
	},
];

function withAnyReview(
	results: INodeListSearchResult['results'],
): INodeListSearchResult['results'] {
	return [{ name: ANY_REVIEW_FOR_AGENT_LABEL, value: ANY_REVIEW_FOR_AGENT }, ...results];
}

export class GotoHumanTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'gotoHuman Trigger',
		name: 'gotoHumanTrigger',
		icon: { light: 'file:../../icons/gth.svg', dark: 'file:../../icons/gth.dark.svg' },
		group: ['trigger'],
		version: [1, 2],
		features: {
			[REVIEW_CONFIG_WEBHOOKS_FEATURE]: { '@version': [{ _cnd: { gte: 2 } }] },
		},
		subtitle: `={{$parameter["triggerOn"] === "onTriggerFormSubmission" ? "Trigger form: " + $parameter["triggerFormID"] : $parameter["triggerOn"] === "onAgentMessageOrToolResult" && $parameter["reviewTemplateID"] && $parameter["reviewTemplateID"] !== "${ANY_REVIEW_FOR_AGENT}" ? "Review: " + $parameter["reviewTemplateID"] : $parameter["triggerOn"] === "onAgentMessageOrToolResult" ? "Agent: " + $parameter["agentID"] : "Review type: " + $parameter["reviewTemplateID"]}}`,
		description: 'Triggers when a gotoHuman event occurs',
		defaults: {
			name: 'gotoHuman Trigger',
		},
		usableAsTool: undefined,
		triggerPanel: {
			executionsHelp:
				'When testing your trigger, the test webhook URL is used. When publishing your workflow, the production webhook URL is used. Make sure the correct URL is set in gotoHuman, or leave it unset so we can add it automatically.',
			activationHint:
				"Once you've finished building your workflow, activate it to use the production webhook URL in gotoHuman.",
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				// Optional: each trigger node has its own signing secret
				name: 'gotoHumanWebhookSigningSecretApi',
				required: false,
				testedBy: 'gotoHumanWebhookSigningSecretTest',
			},
			{
				name: 'gotoHumanApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				responseData: 'Ok',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					"The first credential is the signing secret from your webhook configuration in gotoHuman (recommended for production).",
				name: 'noticeGotoHumanWebhookSigningSecret',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Trigger On',
				name: 'triggerOn',
				type: 'options',
				required: true,
				// Version 1 nodes omitted this value when it was the default.
				default: 'onReviewCompletion',
				options: triggerOnOptions,
				displayOptions: {
					show: { '@version': [1] },
				},
			},
			{
				displayName: 'Trigger On',
				name: 'triggerOn',
				type: 'options',
				required: true,
				// New nodes are version 2 and start on Completed Review.
				default: 'onAgentMessageOrToolResult',
				options: triggerOnOptions,
				displayOptions: {
					show: { '@version': [{ _cnd: { gte: 2 } }] },
				},
			},
			{
				displayName:
					"The webhook is registered automatically (test trigger / publish). Alternatively, copy the webhook URL into this review type's webhook configuration in gotoHuman.",
				name: 'noticeReviewType',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						triggerOn: ['onReviewCompletion'],
					},
				},
			},
			{
				displayName:
					"The webhook is registered automatically (test trigger / publish). Alternatively, copy the webhook URL into this agent's webhook configuration in gotoHuman.",
				name: 'noticeAgent',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						triggerOn: ['onAgentMessageOrToolResult'],
					},
				},
			},
			{
				displayName:
					"The webhook is registered automatically (test trigger / publish). Alternatively, copy the webhook URL into this trigger form's webhook configuration in gotoHuman.",
				name: 'noticeTriggerForm',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						triggerOn: ['onTriggerFormSubmission'],
					},
				},
			},
			{
				displayName: 'Agent',
				name: 'agentID',
				type: 'resourceLocator',
				description:
					'Choose an agent from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				default: { mode: 'list', value: '' },
				required: true,
				modes: agentModes,
				displayOptions: {
					show: {
						triggerOn: ['onReviewCompletion', 'onAgentMessageOrToolResult', 'onTriggerFormSubmission'],
					},
				},
			},
			{
				displayName: 'Review Type',
				name: 'reviewTemplateID',
				type: 'resourceLocator',
				description:
					'Choose one of the agent\'s review types from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				default: {
					mode: 'list',
					value: ANY_REVIEW_FOR_AGENT,
					cachedResultName: ANY_REVIEW_FOR_AGENT_LABEL,
				},
				required: true,
				typeOptions: {
					loadOptionsDependsOn: ['agentID.value'],
				},
				modes: reviewTypeModes,
				displayOptions: {
					show: {
						triggerOn: ['onReviewCompletion', 'onAgentMessageOrToolResult'],
					},
					hide: {
						agentID: [''],
					},
				},
			},
			{
				displayName: 'Trigger Form',
				name: 'triggerFormID',
				type: 'resourceLocator',
				description:
					'Choose one of this agent\'s trigger forms from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				default: { mode: 'list', value: '' },
				required: true,
				typeOptions: {
					loadOptionsDependsOn: ['agentID.value'],
				},
				modes: triggerFormModes,
				displayOptions: {
					show: {
						triggerOn: ['onTriggerFormSubmission'],
					},
					hide: {
						agentID: [''],
					},
				},
			},
		],
	};

	methods = {
		credentialTest: {
			async gotoHumanWebhookSigningSecretTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const error = getSigningSecretFormatError(credential.data?.signingSecret);
				if (error) {
					return { status: 'Error', message: error };
				}
				return { status: 'OK', message: 'Signing secret format is valid' };
			},
		},
		listSearch: {
			async searchReviewTemplates(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const agentId = locatorValue(this.getCurrentNodeParameter('agentID'));
				if (!agentId) {
					throw new NodeOperationError(this.getNode(), 'Select an agent first.');
				}
				const forms = await fetchN8nFormsListSearch.call(this, filter, { agentId });
				// Legacy "Completed Review of a Type" registers on one form, so it has no "any".
				const triggerOn = this.getCurrentNodeParameter('triggerOn') as string;
				if (filter || triggerOn === 'onReviewCompletion') return forms;
				return { results: withAnyReview(forms.results) };
			},
			async searchTriggerForms(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const agentId = locatorValue(this.getCurrentNodeParameter('agentID'));
				if (!agentId) {
					throw new NodeOperationError(this.getNode(), 'Select an agent first.');
				}
				return fetchN8nFormsListSearch.call(this, filter, {
					onlyTriggerForms: true,
					agentId,
				});
			},
			async searchAgents(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				return fetchN8nAgentsListSearch.call(this, filter);
			},
		},
	};

	webhookMethods = gotoHumanWebhookMethods;

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const verification = await verifyWebhookSignature.call(this);
		if (!verification.valid) {
			const res = this.getResponseObject();
			res.status(401).json({ error: verification.reason });
			return {
				noWebhookResponse: true,
			};
		}

		const bodyData = this.getBodyData();
		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}
