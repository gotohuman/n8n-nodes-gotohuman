import {
	IDataObject,
	IHookFunctions,
	IHttpRequestOptions,
	JsonObject,
	NodeApiError,
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

export const gotoHumanWebhookMethods = {
	default: {
		async checkExists(this: IHookFunctions): Promise<boolean> {
			const webhookUrl = this.getNodeWebhookUrl('default') as string;
			const reviewTemplateObj = this.getNodeParameter('reviewTemplateID') as IDataObject;
			const formId = reviewTemplateObj.value as string;

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
			const reviewTemplateObj = this.getNodeParameter('reviewTemplateID') as IDataObject;
			const formId = reviewTemplateObj.value as string;

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
			const reviewTemplateObj = this.getNodeParameter('reviewTemplateID') as IDataObject;
			const formId = reviewTemplateObj.value as string;

			await gotoHumanHookRequest(this, {
				method: 'POST',
				url: `${BASE_URL}/deleteWebhook`,
				body: { formId, webhookUrl },
				json: true,
			});

			const webhookData = this.getWorkflowStaticData('node');
			delete webhookData.webhookId;
			return true;
		},
	},
};
