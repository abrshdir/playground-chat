import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';

interface ICreateFileParameters {
	path: string;
	content?: string;
}

async function createFile(filePath: string): Promise<vscode.Uri> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		throw new Error('No workspace folder found.');
	}

	const normalizedFilePath = path.normalize(filePath);
	let fullPath: string;
	if (path.isAbsolute(normalizedFilePath)) {
		const workspaceRoot = path.normalize(workspaceFolders[0].uri.fsPath);
		if (!normalizedFilePath.startsWith(workspaceRoot)) {
			throw new Error(`The file path "${normalizedFilePath}" is outside the workspace. Please provide a valid workspace path.`);
		}
		fullPath = normalizedFilePath;
	} else {
		fullPath = path.join(workspaceFolders[0].uri.fsPath, normalizedFilePath);
	}

	const dirName = path.dirname(fullPath);
	if (!fs.existsSync(dirName)) {
		fs.mkdirSync(dirName, { recursive: true });
	}

	fs.writeFileSync(fullPath, '');
	return vscode.Uri.file(fullPath);
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

export class CreateAndStreamFileTool implements vscode.LanguageModelTool<ICreateFileParameters> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ICreateFileParameters>,
		_token: vscode.CancellationToken
	) {
		const params = options.input as ICreateFileParameters;

		try {
			const fileUri = await createFile(params.path);

			if (params.content) {
				const editor = await openFile(fileUri.fsPath);
				await streamContent(editor, params.content);
				return new vscode.LanguageModelToolResult([
					new vscode.LanguageModelTextPart(`File created and content streamed: ${fileUri.fsPath}`),
				]);
			} else {
				return new vscode.LanguageModelToolResult([
					new vscode.LanguageModelTextPart(`File created: ${fileUri.fsPath}`),
				]);
			}
		} catch (error) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`Failed to create file "${params.path}": ${(error as Error).message}`),
			]);
		}
	}
}