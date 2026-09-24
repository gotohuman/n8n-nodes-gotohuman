import {
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

export class GotoHumanTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'gotoHuman Trigger',
		name: 'gotoHumanTrigger',
		icon: 'file:gotohuman.svg',
		group: ['trigger'],
		version: 1,
		subtitle:
			'={{$parameter["triggerOn"] === "onTriggerFormSubmission" ? "Trigger form: " + $parameter["triggerFormID"] : $parameter["triggerOn"] === "onAgentMessageOrToolResult" ? "Agent: " + $parameter["agentID"] : "Review type: " + $parameter["reviewTemplateID"]}}',
		description: 'Triggers when a gotoHuman event occurs',
		defaults: {
			name: 'gotoHuman Trigger',
		},
		usableAsTool: undefined,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
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
		const bodyData = this.getBodyData();
		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}
