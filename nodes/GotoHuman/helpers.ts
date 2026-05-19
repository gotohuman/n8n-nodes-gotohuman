import {
	IDataObject,
	IHookFunctions,
	IHttpRequestOptions,
	JsonObject,
	NodeApiError,
} from 'n8n-workflow';

export const BASE_URL = 'https://api.gotohuman.com';

export const gotoHumanWebhookMethods = {
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

			const response = await this.helpers.httpRequestWithAuthentication.call(
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

			const response = await this.helpers.httpRequestWithAuthentication.call(
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
				await this.helpers.httpRequestWithAuthentication.call(this, 'gotoHumanApi', options);
				const webhookData = this.getWorkflowStaticData('node');
				delete webhookData.webhookId;
				return true;
			} catch (error) {
				throw new NodeApiError(this.getNode(), error as JsonObject);
			}
		},
	},
};
