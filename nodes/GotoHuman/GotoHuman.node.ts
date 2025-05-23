import { INodeType, INodeTypeDescription, NodeConnectionType, ILoadOptionsFunctions, INodeListSearchResult, IRequestOptions, NodeOperationError, ResourceMapperFields, IDataObject, jsonParse, ResourceMapperField, ResourceMapperValue, IWebhookFunctions, IWebhookResponseData, IExecuteFunctions, NodeApiError } from 'n8n-workflow';

const BASE_URL = 'https://api.gotohuman.com';
const VERSION = 1;

export class GotoHuman implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'gotoHuman',
		name: 'gotoHuman',
		icon: 'file:gotohuman.svg',
		group: ['transform'],
		version: VERSION,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Request human reviews with gotoHuman',
		defaults: {
			name: 'gotoHuman',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
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
						name: 'Send and Wait for Response',
						value: 'sendAndWait',
						action: 'Send review request and wait for response',
						description: 'Request a human review and wait for the response',
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
						operation: ['sendAndWait'],
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
						operation: ['sendAndWait'],
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
						operation: ['sendAndWait'],
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
						operation: ['sendAndWait'],
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
						operation: ['sendAndWait'],
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
						operation: ['sendAndWait'],
						assignToSelect: ['selectByEmail'],
					},
					hide: { reviewTemplateID: [''] },
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
						operation: ['sendAndWait'],
					},
					hide: { reviewTemplateID: [''] },
				},
				options: [
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

				const options: IRequestOptions = {
					method: 'GET',
					uri: `${BASE_URL}/fetchN8nForms`,
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

				const options: IRequestOptions = {
					method: 'GET',
					uri: `${BASE_URL}/fetchN8nFields`,
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
		// Determine wait timeout
		let waitMillis: number = 14 * 24 * 60 * 60 * 1000; // 14 days default
		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				if (resource === 'reviewRequest' && operation === 'sendAndWait') {
					const reviewTemplateID = this.getNodeParameter('reviewTemplateID', i) as IDataObject;
					const fieldsParam = this.getNodeParameter('fields', i) as ResourceMapperValue;
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
					// Prepare fields for body, parsing array/object types as JSON if needed
					const schemaList = fieldsParam.schema;
					let parsedFields = { ...(fieldsParam.value || {}) };
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
					const body: any = {
						formId: reviewTemplateID.value,
						fields: parsedFields,
						origin: 'n8n',
						originV: VERSION,
					};
					if (meta !== undefined) body.meta = meta;
					if (assignTo !== undefined) body.assignTo = assignTo;
					if (additionalFields && additionalFields.updateForReviewId) {
						body.updateForReviewId = additionalFields.updateForReviewId;
					}
					// Add webhookData
					const resumeUrl = this.evaluateExpression('{{ $execution?.resumeUrl }}', i) as string;
					const nodeId = this.evaluateExpression('{{ $nodeId }}', i) as string;
					body.webhookUrl = `${resumeUrl}/${nodeId}`;
					const options: IRequestOptions = {
						method: 'POST',
						uri: `${BASE_URL}/requestReview`,
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

		const waitTill = new Date(new Date().getTime() + waitMillis);
		await this.putExecutionToWait(waitTill);
		return [this.getInputData()];
	}

	webhook = async function(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData();
		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}