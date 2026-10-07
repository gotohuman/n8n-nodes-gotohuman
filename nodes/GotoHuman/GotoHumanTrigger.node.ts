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
} from 'n8n-workflow';

import {
	fetchN8nAgentsListSearch,
	fetchN8nFormsListSearch,
	gotoHumanWebhookMethods,
} from './helpers';
import { getSigningSecretFormatError, verifyWebhookSignature } from './webhook-helpers';

export class GotoHumanTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'gotoHuman Trigger',
		name: 'gotoHumanTrigger',
		icon: { light: 'file:../../icons/gth.svg', dark: 'file:../../icons/gth.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle:
			'={{$parameter["triggerOn"] === "onTriggerFormSubmission" ? "Trigger form: " + $parameter["triggerFormID"] : $parameter["triggerOn"] === "onAgentMessageOrToolResult" ? "Agent: " + $parameter["agentID"] : "Review type: " + $parameter["reviewTemplateID"]}}',
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
				default: 'onReviewCompletion',
				options: [
					{
						name: 'Completed Review of a Type',
						value: 'onReviewCompletion',
					},
					{
						name: 'Completed Review for an Agent',
						// legacy value name to avoid breaking changes
						value: 'onAgentMessageOrToolResult',
					},
					{
						name: 'Submitted Trigger Form',
						value: 'onTriggerFormSubmission',
					},
				],
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
				displayName: 'Review Type',
				name: 'reviewTemplateID',
				type: 'resourceLocator',
				description:
					'Choose a review type from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a review type...',
						typeOptions: {
							searchListMethod: 'searchReviewTemplates',
							searchable: true,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						hint: 'Enter an ID',
						placeholder: 'e.g. FjbxGtNfPIuDdRm55eqK',
					},
				],
				displayOptions: {
					show: {
						triggerOn: ['onReviewCompletion'],
					},
				},
			},
			{
				displayName: 'Trigger Form',
				name: 'triggerFormID',
				type: 'resourceLocator',
				description:
					'Choose a trigger form from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a trigger form...',
						typeOptions: {
							searchListMethod: 'searchTriggerForms',
							searchable: true,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						hint: 'Enter an ID',
						placeholder: 'e.g. FjbxGtNfPIuDdRm55eqK',
					},
				],
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
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select an agent...',
						typeOptions: {
							searchListMethod: 'searchAgents',
							searchable: true,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						hint: 'Enter an ID',
						placeholder: 'e.g. Y5XrpfmvpKcdJzKYLX2M',
					},
				],
				displayOptions: {
					show: {
						triggerOn: ['onAgentMessageOrToolResult'],
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
				return fetchN8nFormsListSearch.call(this, filter);
			},
			async searchTriggerForms(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				return fetchN8nFormsListSearch.call(this, filter, { onlyTriggerForms: true });
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
