/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode';
import { OllamaToolAdapter } from './schema-tool';

// Define interfaces for API response
interface ModelDetails {
	parent_model: string;
	format: string;
	family: string;
	families: string[];
	parameter_size: string;
	quantization_level: string;
}

interface Model {
	name: string;
	model: string;
	modified_at: string;
	size: number;
	digest: string;
	details: ModelDetails;
}

interface OllamaTagsResponse {
	models: Model[];
}

class ContentParser {
	static parse(jsonArray: any): string {
		for (const item of jsonArray) {
			if (item.value) {
				return item.value;
			} else if (item.content) {
				let messages = '';
				for (const value of item.content) {
					messages += value.value;
				}
				return messages;
			}
		}
		return ''; // Ensure a string is always returned
	}
}

class OllamaModel {
	private apiUrl = "http://localhost:11434/api/tags";
	private chatUrl = "http://localhost:11434/api/chat";
	private targetModelName = 'qwen2.5-coder:7b';

	async getModel() {
		try {
			const response = await fetch(this.apiUrl);
			if (!response.ok) {
				throw new Error(`Failed to fetch models: ${response.statusText}`);
			}

			const data: OllamaTagsResponse = await response.json() as OllamaTagsResponse;
			const targetModel = data.models.find(m => m.name.includes(this.targetModelName));
			if (!targetModel) { throw new Error('Qwen model not found'); }

			return {
				id: targetModel.name,
				family: targetModel.details.family,
				vendor: "ollama",
				name: targetModel.name.toUpperCase(),
				version: `${targetModel.name}-latest`,
				maxInputTokens: 4096,
				countTokens: this.countTokens.bind(this),
				sendRequest: this.sendRequest.bind(this)
			};
		} catch (error) {
			console.error("Error initializing Ollama model:", error);
			return null;
		}
	}

	private countTokens(
		text: string | vscode.LanguageModelChatMessage,
		_token?: vscode.CancellationToken
	): Thenable<number> {
		try {
			let content: string;

			if (typeof text === "string") {
				content = text;
			} else {
				content = text.content
					.map(part => typeof part === "string" ? part : JSON.stringify(part))
					.join(" ");
			}

			const tokens = content.split(/\s+/).length;
			return Promise.resolve(tokens);
		} catch (error) {
			console.error("Error counting tokens:", error);
			return Promise.resolve(0);
		}
	}

	private async sendRequest(
		messages: vscode.LanguageModelChatMessage[],
		options: vscode.LanguageModelChatRequestOptions,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelChatResponse> {
		const toolAdapter = new OllamaToolAdapter();
		const ollamaMessages = messages.map(m => ({
			role: m.role === vscode.LanguageModelChatMessageRole.User ? 'user' : 'assistant',
			content: ContentParser.parse(m.content)
		}));

		const requestBody = {
			model: this.targetModelName,
			messages: ollamaMessages,
			tools: toolAdapter.getOllamaTools(),
			stream: true
		};

		console.log('Request body messages:', ollamaMessages);

		const response = await fetch(this.chatUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(requestBody)
		});

		const reader = response.body?.getReader();
		if (!reader) { throw new Error('No response body reader'); }

		const decoder = new TextDecoder();
		let buffer = '';

		const textStream = async function* () {
			while (!token.isCancellationRequested) {
				const { done, value } = await reader.read();
				if (done) { break; }

				const chunk = decoder.decode(value, { stream: true });
				buffer += chunk;

				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					try {
						const jsonResponse = JSON.parse(line.trim());
						if (jsonResponse.message?.content) {
							yield jsonResponse.message.content;
						}
					} catch (err) {
						console.error('Error parsing JSON chunk:', line, err);
					}
				}
			}
		};

		const formatToolResponse = (response: any): string => {
			try {
				const content = response.content?.[0]?.value || response.content;
				if (typeof content === 'string') {
					return content;
				} else if (typeof content === 'object') {
					return JSON.stringify(content, null, 2);
				}
				return 'No result available.';
			} catch (error) {
				console.error('Error formatting tool response:', error);
				return 'An error occurred while processing the tool response.';
			}
		};

		const fullStream = async function* (this: any) {
			while (!token.isCancellationRequested) {
				const { done, value } = await reader.read();
				if (done) { break; }

				const chunk = decoder.decode(value, { stream: true });
				buffer += chunk;

				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				console.log('Lines:', JSON.parse(lines[0]));

				for (const line of lines) {
					try {
						const jsonResponse = JSON.parse(line.trim());
						if (jsonResponse.message?.tool_calls) {
							for (const toolCall of jsonResponse.message.tool_calls) {
								try {
									const toolName = toolCall.function.name;
									const toolInput = toolCall.function.arguments;
									const callId = `callId` + `'-'` + `${Date.now()}`;
									yield new vscode.LanguageModelToolCallPart(callId, toolName, toolInput);
								} catch (error) {
									console.error('Error processing tool call:', error);
								}
							}
						}

						if (jsonResponse.message?.content.trim().length) {
							const formattedContent = formatToolResponse(jsonResponse.message);
							yield new vscode.LanguageModelTextPart(formattedContent);
						}
					} catch (err) {
						console.error('Error parsing JSON chunk:', line, err);
					}
				}
			}
		};

		return {
			text: textStream(),
			stream: fullStream()
		};
	}


}

export async function getOllamaModel() {
	const ollamaModel = new OllamaModel();
	return await ollamaModel.getModel();
}