import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';

interface IOpenFileParameters {
	filePath: string;
	content?: string;
}

async function openFile(filePath: string): Promise<vscode.TextEditor> {
	try {
		if (!filePath || typeof filePath !== 'string') {
			throw new Error('Invalid file path. Please provide a valid file path.');
		}

		if (!fs.existsSync(filePath)) {
			throw new Error(`File not found: ${filePath}`);
		}

		const fileUri = vscode.Uri.file(filePath);
		const document = await vscode.workspace.openTextDocument(fileUri);
		const editor = await vscode.window.showTextDocument(document, { preview: false });

		return editor;
	} catch (error) {
		if (error instanceof vscode.FileSystemError) {
			throw new Error(`Failed to open file: ${error.message}`);
		} else if (error instanceof Error) {
			throw new Error(`Failed to open file: ${error.message}`);
		} else {
			throw new Error('An unknown error occurred while trying to open the file.');
		}
	}
}

async function streamContent(editor: vscode.TextEditor, content: string): Promise<void> {
	for (const char of content) {
		await new Promise(resolve => setTimeout(resolve, 10));
		await editor.edit(editBuilder => {
			editBuilder.insert(new vscode.Position(editor.document.lineCount, 0), char);
		});
	}
}

export class FindAndOpenFileTool implements vscode.LanguageModelTool<IOpenFileParameters> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IOpenFileParameters>,
		_token: vscode.CancellationToken
	) {
		const params = options.input as IOpenFileParameters;

		try {
			const resolvedFilePath = this.resolveFilePath(params.filePath);
			const editor = await openFile(resolvedFilePath);

			if (params.content) {
				await streamContent(editor, params.content);
				return new vscode.LanguageModelToolResult([
					new vscode.LanguageModelTextPart(`Content streamed into file: ${resolvedFilePath}`),
				]);
			} else {
				return new vscode.LanguageModelToolResult([
					new vscode.LanguageModelTextPart(`File opened: ${resolvedFilePath}`),
				]);
			}
		} catch (error) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`Failed to open file "${params.filePath}": ${(error as Error).message}`),
			]);
		}
	}

	private resolveFilePath(filePath: string): string {
		if (!filePath || typeof filePath !== 'string') {
			throw new Error('Invalid file path. Please provide a valid file path.');
		}

		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			throw new Error('No workspace folder is open. Please open a workspace first.');
		}

		const workspaceRoot = workspaceFolders[0].uri.fsPath;
		const resolvedFilePath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);

		return path.normalize(resolvedFilePath);
	}
}