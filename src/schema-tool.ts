/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode';
import { TabCountTool, FindFilesTool, RunInTerminalTool, DeleteFilesTool, FindAndOpenFileTool, CreateAndStreamFileTool, EditLineTool } from './tools'; // Adjust the import path

export class OllamaToolAdapter {
	private tools: Map<string, { tool: vscode.LanguageModelTool<any>, name: string, description: string }>;

	constructor() {
		this.tools = new Map();
		this.registerTools();
	}

	private registerTools() {
		// Register your existing tools with their names and descriptions
		const toolDefinitions = [
			{ tool: new TabCountTool(), name: 'chat-tools-sample_tabCounting', description: 'Count the number of open tabs in the editor' },
			{ tool: new FindFilesTool(), name: 'chat-tools-sample_findFiles', description: 'Search the workspace for files matching a pattern' },
			{ tool: new RunInTerminalTool(), name: 'chat-tools-sample_runInTerminal', description: 'Run a command in the terminal' },
			{ tool: new DeleteFilesTool(), name: 'chat-tools-sample_deleteFilesOrFolder', description: 'Delete files matching a pattern' },
			{ tool: new FindAndOpenFileTool(), name: 'chat-tools-sample_findAndOpenFile', description: 'Find and open a file in the editor' },
			{ tool: new CreateAndStreamFileTool(), name: 'chat-tools-sample_createAndStreamFile', description: 'Create a new file and stream content into it' },
			{ tool: new EditLineTool(), name: 'chat-tools-sample_editLine', description: 'Edit specific codes of line from the file' }

		];

		for (const { tool, name, description } of toolDefinitions) {
			this.tools.set(name, { tool, name, description });
		}
	}

	public getOllamaTools(): any[] {
		return Array.from(this.tools.values()).map(({ name, description, tool }) => ({
			type: 'function',
			function: {
				name,
				description,
				parameters: this.getToolSchema(tool)
			}
		}));
	}

	private getToolSchema(tool: vscode.LanguageModelTool<any>): any {
		// Infer schema from the tool's input type (if possible)
		// For now, use a generic object schema
		return {
			type: 'object',
			properties: {},
			required: []
		};
	}

	public async invokeTool(name: string, input: any, token: vscode.CancellationToken): Promise<string> {
		const toolEntry = this.tools.get(name);
		if (!toolEntry) {
			throw new Error(`Tool not found: ${name}`);
		}

		const { tool } = toolEntry;

		// Invoke the tool using VS Code's interface
		const result = await tool.invoke({
			input,
			toolInvocationToken: undefined
		}, token);

		// Convert the result to a string
		return result ? result.toString() : '';
	}
}