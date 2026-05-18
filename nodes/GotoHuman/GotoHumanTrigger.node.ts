import {
	IHookFunctions,
	IWebhookFunctions,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	IHttpRequestOptions,
	NodeConnectionTypes,
	NodeOperationError,
	IDataObject,
} from 'n8n-workflow';

const BASE_URL = 'https://api.gotohuman.com';

export class GotoHumanTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'gotoHuman Trigger',
		name: 'gotoHumanTrigger',
		icon: 'file:gotohuman.svg',
		group: ['trigger'],
		version: 1,
		description: 'Triggers when a gotoHuman review is completed or a trigger form is submitted',
		defaults: {
			name: 'gotoHuman Trigger',
		},
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
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Review Template',
				name: 'reviewTemplateID',
				type: 'resourceLocator',
				description:
					'Choose a review template from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Review Template...',
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
			},
		],
	};

	methods = {
		listSearch: {
			async searchReviewTemplates(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				interface ReviewTemplateForm {
					value: string;
					label: string;
				}

				interface ReviewTemplatesResponse {
					forms: ReviewTemplateForm[];
				}

				const options: IHttpRequestOptions = {
					method: 'GET',
					url: `${BASE_URL}/fetchN8nForms`,
					json: true,
				};

				const reviewTemplates: ReviewTemplatesResponse =
					await this.helpers.requestWithAuthentication.call(this, 'gotoHumanApi', options);

				if (reviewTemplates === undefined) {
					throw new NodeOperationError(
						this.getNode(),
						'No review templates found. Please create one first in our web app.',
					);
				}

				return {
					results: (reviewTemplates?.forms || [])
						.filter(
							(template) =>
								!filter || template.label.toLowerCase().includes(filter.toLowerCase()),
						)
						.map((template) => ({
							name: template.label,
							value: template.value,
						})),
				};
			},
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const reviewTemplateObj = this.getNodeParameter('reviewTemplateID') as IDataObject;
				const formId = reviewTemplateObj.value as string;

				const options: IHttpRequestOptions = {
					method: 'POST',
					url: `${BASE_URL}/checkWebhook`,
					body: { formId, webhookUrl },
					json: true,
				};

				const response = await this.helpers.requestWithAuthentication.call(
					this,
					'gotoHumanApi',
					options,
				);
				return response.exists === true;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const reviewTemplateObj = this.getNodeParameter('reviewTemplateID') as IDataObject;
				const formId = reviewTemplateObj.value as string;

				const options: IHttpRequestOptions = {
					method: 'POST',
					url: `${BASE_URL}/createWebhook`,
					body: { formId, webhookUrl },
					json: true,
				};

				const response = await this.helpers.requestWithAuthentication.call(
					this,
					'gotoHumanApi',
					options,
				);

				if (response.success) {
					const webhookData = this.getWorkflowStaticData('node');
					webhookData.webhookId = response.webhookId as string;
					return true;
				}
				return false;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const reviewTemplateObj = this.getNodeParameter('reviewTemplateID') as IDataObject;
				const formId = reviewTemplateObj.value as string;

				const options: IHttpRequestOptions = {
					method: 'POST',
					url: `${BASE_URL}/deleteWebhook`,
					body: { formId, webhookUrl },
					json: true,
				};

				try {
					await this.helpers.requestWithAuthentication.call(this, 'gotoHumanApi', options);
					const webhookData = this.getWorkflowStaticData('node');
					delete webhookData.webhookId;
				} catch {
					return false;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData();
		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}
