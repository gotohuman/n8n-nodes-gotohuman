import { INodeType, INodeTypeDescription, NodeConnectionTypes, ILoadOptionsFunctions, INodeListSearchResult, IHttpRequestOptions, NodeOperationError, ResourceMapperFields, IDataObject, jsonParse, ResourceMapperField, ResourceMapperValue, IWebhookFunctions, IWebhookResponseData, IExecuteFunctions, NodeApiError } from 'n8n-workflow';

const BASE_URL = 'https://api.gotohuman.com';

export class GotoHuman implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'gotoHuman',
		name: 'gotoHuman',
		icon: 'file:gotohuman.svg',
		group: ['transform'],
		version: [1, 2],
		features: {
			sendRawReviewData: { '@version': [{ _cnd: { gte: 2 } }] },
		},
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Request human reviews with gotoHuman',
		defaults: {
			name: 'gotoHuman',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
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
				responseData: '',
				path: '={{ $nodeId }}',
				restartWebhook: true,
				isFullPath: true,
			}
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Review Request',
						value: 'reviewRequest',
						description: 'Request for Human Review',
					},
				],
				default: 'reviewRequest',
				required: true,
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
			options: [
				{
					name: 'Send',
					value: 'send',
					action: 'Send review request',
					description: 'Request a human review',
				},
			{
				name: 'Send and Wait for Response',
				value: 'sendAndWait',
				action: 'Send review request and wait for response',
				description: 'Request a human review and wait for the response',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete review request',
				description: 'Delete an existing review request',
			},
		],
			default: 'sendAndWait',
				displayOptions: {
					show: {
						resource: [
							'reviewRequest',
						],
					},
				},
			},
			{
				displayName: 'Review Template',
				name: 'reviewTemplateID',
				type: 'resourceLocator',
				description: 'Choose a review template from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				default: { mode: 'list', value: '' },
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
					}
				],
				displayOptions: {
					show: {
						resource: [
							'reviewRequest',
						],
					operation: [
						'send',
						'sendAndWait',
					],
					},
				},
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'resourceMapper',
				noDataExpression: true,
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				required: true,
				typeOptions: {
					loadOptionsDependsOn: ['reviewTemplateID.value'],
					resourceMapper: {
						resourceMapperMethod: 'getMappingFields',
						mode: 'add',
						valuesLabel: 'Fields',
						fieldWords: {
							singular: 'field',
							plural: 'fields',
						},
						supportAutoMap: false,
					},
				},
			displayOptions: {
				show: {
					resource: ['reviewRequest'],
					operation: ['send', 'sendAndWait'],
					'@feature': [{ _cnd: { not: 'sendRawReviewData' } }],
				},
				hide: { reviewTemplateID: [''] },
			},
		},
		{
			displayName: 'Review Data',
			name: 'reviewData',
			type: 'json',
			required: true,
			default: '',
			placeholder: 'e.g. {"property1": "value1"}',
			description: 'The data to populate the review template',
			displayOptions: {
				show: {
					resource: ['reviewRequest'],
					operation: ['send', 'sendAndWait'],
					'@feature': ['sendRawReviewData'],
				},
				hide: { reviewTemplateID: [''] },
			},
		},
		{
			displayName: 'Review Config',
			name: 'reviewConfig',
			type: 'json',
			default: '{}',
			placeholder: 'e.g. {"fields": { "myField1": { ... } }}',
			description: "Can optionally be used to dynamically configure your review and its fields",
			displayOptions: {
				show: {
					resource: ['reviewRequest'],
					operation: ['send', 'sendAndWait'],
					'@feature': ['sendRawReviewData'],
				},
				hide: { reviewTemplateID: [''] },
			},
		},
		{
			displayName: 'Meta Data',
			name: 'metaSelect',
				description: 'Select if you want to add meta data that you want to receive back in the response webhook',
				required: true,
				type: 'options',
				options: [
					{
						name: 'No Meta Data',
						value: 'no',
					},
					{
						name: 'Add as JSON',
						value: 'json',
					},
					{
						name: 'Add as Key-Value Pairs',
						value: 'keyValue',
					},
				],
				default: 'no',
				displayOptions: {
					show: {
						resource: ['reviewRequest'],
						operation: ['send', 'sendAndWait'],
					},
					hide: { reviewTemplateID: [''] },
				},
			},
			{
				displayName: 'Meta Data JSON',
				name: 'metaJson',
				type: 'json',
				default: '',
				placeholder: 'e.g. {"myKey": "myValue"}',
				displayOptions: {
					show: {
						resource: ['reviewRequest'],
						operation: ['send', 'sendAndWait'],
						metaSelect: ['json'],
					},
					hide: { reviewTemplateID: [''] },
				},
			},
			{
				displayName: 'Meta Data Values',
				name: 'metaKeyValues',
				type: 'fixedCollection',
				placeholder: 'Add Key-Value Pair',
				default: {},
				typeOptions: {
					multipleValues: true,
				},
				options: [
					{
						name: 'metaArray',
						displayName: 'Metadata',
						values: [
							{
								displayName: 'Key',
								name: 'key',
								type: 'string',
								placeholder: 'myKey',
								default: '',
								description: 'Name of the metadata key to add',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								placeholder: 'myValue',
								default: '',
								description: 'Value to set for the metadata key',
							},
						],
					},
				],
				displayOptions: {
					show: {
						resource: ['reviewRequest'],
						operation: ['send', 'sendAndWait'],
						metaSelect: ['keyValue'],
					},
					hide: { reviewTemplateID: [''] },
				},
			},
			{
				displayName: 'Assigned Users',
				name: 'assignToSelect',
				description: 'Select who you want to assign the review to',
				required: true,
				type: 'options',
				options: [
					{
						name: 'All Users in Your Account',
						value: 'all',
					},
					{
						name: 'Only Selected Users',
						value: 'selectByEmail',
					},
				],
				default: 'all',
				displayOptions: {
					show: {
						resource: ['reviewRequest'],
						operation: ['send', 'sendAndWait'],
					},
					hide: { reviewTemplateID: [''] },
				},
			},
			{
				displayName: 'Selected Users',
				name: 'assignTo',
				description: 'List the email addresses of the users you want to assign the review to',
				type: 'fixedCollection',
				placeholder: 'Add User',
				typeOptions: {
					multipleValues: true,
				},
				default: [],
				options: [
					{
						displayName: 'Values',
						name: 'values',
						values: [
							{
								displayName: 'Email Address',
								name: 'email',
								description: 'The email address the user used when signing up for gotoHuman',
								type: 'string',
								required: true,
								placeholder: 'e.g. nathan@example.com',
								default: '',
								hint: 'Only emails from registered users will be accepted',
							},
						],
					},
				],
				displayOptions: {
					show: {
						resource: ['reviewRequest'],
						operation: ['send', 'sendAndWait'],
						assignToSelect: ['selectByEmail'],
					},
					hide: { reviewTemplateID: [''] },
				},
			},
			{
				displayName: 'Review ID',
				name: 'reviewId',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. 123456',
				description: 'The ID of the review request to delete',
				displayOptions: {
					show: {
						resource: ['reviewRequest'],
						operation: ['delete'],
					},
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['reviewRequest'],
						operation: ['send', 'sendAndWait'],
					},
					hide: { reviewTemplateID: [''] },
				},
				options: [
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'Set a title for this review request. Read more about it <a href="https://docs.gotohuman.com/send-requests">here</a>.',
					},
					{
						displayName: 'Auto Approve',
						name: 'autoApprove',
						type: 'boolean',
						default: false,
						description: 'Whether to automatically approve this request. Read more about it <a href="https://docs.gotohuman.com/send-requests">here</a>.',
					},
					{
						displayName: 'Workflow Info',
						name: 'workflow',
						type: 'json',
						default: '',
						placeholder: '{"runId": "123456", "runName": "My Workflow", "prevSteps": ["1234567890"]}',
						description: 'Send to connect multiple review steps. Read more about it <a href="https://docs.gotohuman.com/send-requests#workflow-metadata">here</a>.',
					},
					{
						displayName: 'Update for Review ID',
						name: 'updateForReviewId',
						type: 'string',
						default: '',
						description: 'To update a specific review, enter the review ID here. Read more about it <a href="https://docs.gotohuman.com/retries">here</a>.',
					},
				],
			}
		]
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

				const reviewTemplates: ReviewTemplatesResponse = await this.helpers.requestWithAuthentication.call(this, 'gotoHumanApi', options);

				if (reviewTemplates === undefined) {
					throw new NodeOperationError(this.getNode(), 'No review templates found. Please create one first in our web app.');
				}

				return {
					results: (reviewTemplates?.forms || [])
						.filter(
							(template) => !filter || template.label.toLowerCase().includes(filter.toLowerCase()),
						)
						.map((template) => ({
							name: template.label,
							value: template.value,
						})),
				};
			},
		},
		resourceMapping: {
			async getMappingFields(
				this: ILoadOptionsFunctions
			): Promise<ResourceMapperFields> {

				interface ReviewTemplateFieldsResponse {
					formId: string;
					fields: ResourceMapperField[] | undefined;
				}

				const reviewTemplateObj = this.getNodeParameter('reviewTemplateID', 0) as IDataObject | null;
				if (!reviewTemplateObj) return { fields: [] };

				const { value: reviewTemplateID } = reviewTemplateObj;

				const options: IHttpRequestOptions = {
					method: 'GET',
					url: `${BASE_URL}/fetchN8nFields`,
					qs: {
						formId: reviewTemplateID,
					},
					json: true,
				};

				const templateFieldsResponse: ReviewTemplateFieldsResponse = await this.helpers.requestWithAuthentication.call(this, 'gotoHumanApi', options);

				if (templateFieldsResponse?.fields === undefined) {
					throw new NodeOperationError(this.getNode(), 'No fields found for review template. Please add some fields in our web editor first.');
				}
				const fieldSpecs = templateFieldsResponse.fields;

				return {
					fields: fieldSpecs
				}
			}
		}
	};

	async execute(this: IExecuteFunctions) {
		const items = this.getInputData();
		const returnData = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		// Determine wait timeout
		let waitMillis: number = 14 * 24 * 60 * 60 * 1000; // 14 days default
		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'reviewRequest' && (operation === 'sendAndWait' || operation === 'send')) {
					const reviewTemplateID = this.getNodeParameter('reviewTemplateID', i) as IDataObject;
					const useSendRawReviewData = this.isNodeFeatureEnabled('sendRawReviewData');
					let parsedFields: IDataObject;
					let parsedConfig: IDataObject | undefined;
				if (useSendRawReviewData) {
					const reviewDataRaw = this.getNodeParameter('reviewData', i);
					if (typeof reviewDataRaw === 'string') {
						try {
							parsedFields = jsonParse(reviewDataRaw);
						} catch (error) {
							throw new NodeOperationError(this.getNode(), 'reviewData is not valid JSON', error);
						}
					} else {
						parsedFields = reviewDataRaw as IDataObject;
					}
					const reviewConfigRaw = this.getNodeParameter('reviewConfig', i);
					if (reviewConfigRaw) {
						if (typeof reviewConfigRaw === 'string') {
							try {
								parsedConfig = jsonParse(reviewConfigRaw);
							} catch (error) {
								throw new NodeOperationError(this.getNode(), 'reviewConfig is not valid JSON', error);
							}
						} else {
							parsedConfig = reviewConfigRaw as IDataObject;
						}
					}
				} else {
						const fieldsParam = this.getNodeParameter('fields', i) as ResourceMapperValue;
						parsedFields = { ...(fieldsParam.value || {}) };
						const schemaList = fieldsParam.schema;
						// Prepare fields for body, parsing array/object types as JSON if needed
						if (fieldsParam.value && schemaList) {
							for (const field of schemaList) {
								const val = fieldsParam.value[field.id];
								if ((field.type === 'array' || field.type === 'object') && typeof val === 'string') {
									try {
										parsedFields[field.id] = jsonParse(val);
									} catch (err) {
										throw new NodeOperationError(this.getNode(), `Could not parse field '${field.id}' as JSON: ${val}`);
									}
								}
							}
						}
					}
					const metaSelect = this.getNodeParameter('metaSelect', i) as string;
					let meta: any = undefined;
					if (metaSelect === 'json') {
						const metaJson = this.getNodeParameter('metaJson', i) as string;
						if (metaJson) {
							try {
								meta = jsonParse(metaJson);
							} catch (error) {
								throw new NodeOperationError(this.getNode(), 'Not a valid JSON object', error);
							}
						}
					} else if (metaSelect === 'keyValue') {
						const metaKeyValues = this.getNodeParameter('metaKeyValues', i) as IDataObject;
						if (metaKeyValues && Array.isArray(metaKeyValues.metaArray)) {
							meta = {};
							for (const pair of metaKeyValues.metaArray as Array<{key: string, value: string}>) {
								meta[pair.key] = pair.value;
							}
						}
					}
					const assignToSelect = this.getNodeParameter('assignToSelect', i) as string;
					let assignTo: any = undefined;
					if (assignToSelect === 'selectByEmail') {
						const assignToParam = this.getNodeParameter('assignTo', i) as IDataObject;
						if (assignToParam && Array.isArray(assignToParam.values)) {
							assignTo = assignToParam.values.map((v: any) => v.email);
						}
					}
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
					const body: any = {
						formId: reviewTemplateID.value,
						fields: parsedFields,
						origin: 'n8n',
						originV: this.getNode().typeVersion,
					};
					if (parsedConfig !== undefined) body.config = parsedConfig;
					if (meta !== undefined) body.meta = meta;
					if (assignTo !== undefined) body.assignTo = assignTo;
					if (additionalFields?.title) body.title = additionalFields.title;
					if (additionalFields?.autoApprove !== undefined) body.autoApprove = additionalFields.autoApprove;
					if (additionalFields?.workflow) {
						try {
							body.workflow = jsonParse(additionalFields.workflow as string);
						} catch {
							throw new NodeOperationError(this.getNode(), 'workflow field is not valid JSON');
						}
					}
					if (additionalFields?.updateForReviewId) {
						body.updateForReviewId = additionalFields.updateForReviewId;
					}
				if (operation === 'sendAndWait') {
					const resumeUrl = this.evaluateExpression('{{ $execution?.resumeUrl }}', i) as string;
					const nodeId = this.evaluateExpression('{{ $nodeId }}', i) as string;
					body.webhookUrl = `${resumeUrl}/${nodeId}`;
				}
					const options: IHttpRequestOptions = {
						method: 'POST',
						url: `${BASE_URL}/requestReview`,
						body,
						json: true,
					};
					let responseData;
					try {
						responseData = await this.helpers.requestWithAuthentication.call(this, 'gotoHumanApi', options);
						const statusCode = responseData?.statusCode || 200;
						if (String(statusCode).startsWith('4') || String(statusCode).startsWith('5')) {
							throw new NodeApiError(this.getNode(), responseData, {
								message: responseData.body ? responseData.body : JSON.stringify(responseData),
								httpCode: String(statusCode),
							});
						}
						if (responseData && typeof responseData.timeoutInMillis === 'number' && responseData.timeoutInMillis > 0) {
							waitMillis = responseData.timeoutInMillis;
						}
					} catch (error) {
						throw error;
					}
					returnData.push({ json: responseData });
			} else if (resource === 'reviewRequest' && operation === 'delete') {
				const reviewId = this.getNodeParameter('reviewId', i) as string;
				const options: IHttpRequestOptions = {
					method: 'DELETE',
					url: `${BASE_URL}/deleteReview`,
					body: { reviewId },
					json: true,
				};
				try {
					const responseData = await this.helpers.requestWithAuthentication.call(this, 'gotoHumanApi', options);
					returnData.push({ json: responseData ?? { success: true } });
				} catch (error) {
					throw error;
				}
			} else {
				throw new NodeOperationError(this.getNode(), `The operation ${operation} is not supported!`);
			}
			} catch (err) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: err.message }, error: err });
					continue;
				}
				throw err;
			}
		}

		if (operation === 'sendAndWait') {
			const waitTill = new Date(new Date().getTime() + waitMillis);
			await this.putExecutionToWait(waitTill);
			return [this.getInputData()];
		}
		return [returnData];
	}

	webhook = async function(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData();
		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}
