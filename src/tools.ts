import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';

export function registerChatTools(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.lm.registerTool('chat-tools-sample_tabCounting', new TabCountTool())
	);
	context.subscriptions.push(
		vscode.lm.registerTool('chat-tools-sample_findFiles', new FindFilesTool())
	);
	context.subscriptions.push(
		vscode.lm.registerTool('chat-tools-sample_runInTerminal', new RunInTerminalTool())
	);
	context.subscriptions.push(
		vscode.lm.registerTool('chat-tools-sample_deleteFilesOrFolder', new DeleteFilesTool())
	);
	context.subscriptions.push(
		vscode.lm.registerTool('chat-tools-sample_findAndOpenFile', new FindAndOpenFileTool())
	);
	context.subscriptions.push(
		vscode.lm.registerTool('chat-tools-sample_createAndStreamFile', new CreateAndStreamFileTool())
	);
	context.subscriptions.push(
		vscode.lm.registerTool('chat-tools-sample_editLine', new EditLineTool()) // Register the new tool
	);
}

interface ITabCountParameters {
	tabGroup?: number;
}

export class TabCountTool implements vscode.LanguageModelTool<ITabCountParameters> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ITabCountParameters>,
		_token: vscode.CancellationToken
	) {
		const params = options.input;
		const tabGroups = vscode.window.tabGroups.all;

		if (typeof params.tabGroup === 'number') {
			// Ensure the tabGroup index is within bounds
			const groupIndex = Math.max(0, Math.min(params.tabGroup - 1, tabGroups.length - 1));
			const group = tabGroups[groupIndex];

			if (!group) {
				return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`The specified tab group does not exist.`)]);
			}

			const nth = this.getOrdinalSuffix(params.tabGroup);
			return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`There are ${group.tabs.length} tabs open in the ${nth} tab group.`)]);
		} else {
			const group = vscode.window.tabGroups.activeTabGroup;
			return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`There are ${group.tabs.length} tabs open in the active tab group.`)]);
		}
	}

	private getOrdinalSuffix(n: number): string {
		if (n === 1) { return '1st'; }
		if (n === 2) { return '2nd'; }
		if (n === 3) { return '3rd'; }
		return `${n}th`;
	}
}

interface IFindFilesParameters {
	pattern: string;
}

export class FindFilesTool implements vscode.LanguageModelTool<IFindFilesParameters> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IFindFilesParameters>,
		token: vscode.CancellationToken
	) {
		const params = options.input as IFindFilesParameters;
		const files = await vscode.workspace.findFiles(
			params.pattern,
			'**/node_modules/**',
			undefined,
			token
		);

		const strFiles = files.map((f) => f.fsPath).join('\n');
		return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Found ${files.length} files matching "${params.pattern}":\n${strFiles}`)]);
	}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IFindFilesParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Searching workspace for "${options.input.pattern}"`,
		};
	}
}

interface IDeleteFilesParameters {
	pattern: string; // File or folder pattern to match (e.g., "src/*.css" or "dist/")
}

export class DeleteFilesTool implements vscode.LanguageModelTool<IDeleteFilesParameters> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IDeleteFilesParameters>,
		token: vscode.CancellationToken
	) {
		const params = options.input as IDeleteFilesParameters;

		// Check workspace trust
		if (!vscode.workspace.isTrusted) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('File or folder deletion is disabled in untrusted workspaces.'),
			]);
		}

		// Find files and folders matching the pattern
		const files = await vscode.workspace.findFiles(
			params.pattern,
			'**/node_modules/**',
			undefined,
			token
		);

		if (files.length === 0) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`No files or folders found matching "${params.pattern}".`),
			]);
		}

		// Log files/folders to delete
		console.log('Files/folders to delete:', files.map(f => f.fsPath));

		// Delete files and folders
		const deletedPaths: string[] = [];
		for (const file of files) {
			try {
				// Check if the file/folder exists before deletion
				const existsBefore = await this.checkIfExists(file);
				if (!existsBefore) {
					console.warn(`File or folder does not exist: ${file.fsPath}`);
					continue; // Skip deletion if it doesn't exist
				}

				// Check if the path is a file or folder
				const stat = await vscode.workspace.fs.stat(file);
				if (stat.type === vscode.FileType.File) {
					// Delete file
					await vscode.workspace.fs.delete(file);
				} else if (stat.type === vscode.FileType.Directory) {
					// Recursively delete folder contents
					await this.deleteFolderRecursively(file);
				}

				// Verify deletion
				const existsAfter = await this.checkIfExists(file);
				if (!existsAfter) {
					deletedPaths.push(file.fsPath);
				} else {
					console.error(`Failed to verify deletion of ${file.fsPath}`);
				}
			} catch (error) {
				console.error(`Failed to delete ${file.fsPath}:`, error);
				return new vscode.LanguageModelToolResult([
					new vscode.LanguageModelTextPart(`Failed to delete ${file.fsPath}: ${(error as Error).message}`),
				]);
			}
		}

		return new vscode.LanguageModelToolResult([
			new vscode.LanguageModelTextPart(`Deleted ${deletedPaths.length} items:\n${deletedPaths.join('\n')}`),
		]);
	}

	// Helper function to check if a file or folder exists
	private async checkIfExists(uri: vscode.Uri): Promise<boolean> {
		try {
			await vscode.workspace.fs.stat(uri);
			return true; // File or folder exists
		} catch (error) {
			if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
				return false; // File or folder does not exist
			}
			throw error; // Re-throw other errors
		}
	}

	// Helper function to recursively delete a folder and its contents
	private async deleteFolderRecursively(folderUri: vscode.Uri): Promise<void> {
		const files = await vscode.workspace.fs.readDirectory(folderUri);

		for (const [name, type] of files) {
			const fileUri = vscode.Uri.joinPath(folderUri, name);
			if (type === vscode.FileType.Directory) {
				// Recursively delete subfolders
				await this.deleteFolderRecursively(fileUri);
			} else {
				// Delete files
				await vscode.workspace.fs.delete(fileUri);
			}
		}

		// Delete the folder itself
		await vscode.workspace.fs.delete(folderUri);
	}
}


// Core function to create a file (and its folders if they don't exist)
async function createFile(filePath: string): Promise<vscode.Uri> {
	console.log('Received filePath:', filePath); // Debugging

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		throw new Error('No workspace folder found.');
	}

	// Normalize the filePath to handle both POSIX and Windows formats
	const normalizedFilePath = path.normalize(filePath);

	// Resolve the full file path
	let fullPath: string;
	if (path.isAbsolute(normalizedFilePath)) {
		// Normalize the workspace root path
		const workspaceRoot = path.normalize(workspaceFolders[0].uri.fsPath);

		// Check if the filePath is within the workspace
		if (!normalizedFilePath.startsWith(workspaceRoot)) {
			throw new Error(`The file path "${normalizedFilePath}" is outside the workspace. Please provide a valid workspace path.`);
		}
		fullPath = normalizedFilePath;
	} else {
		// If the filePath is relative, join it with the workspace root path
		fullPath = path.join(workspaceFolders[0].uri.fsPath, normalizedFilePath);
	}

	console.log('Resolved fullPath:', fullPath); // Debugging

	// Create the directory structure if it doesn't exist
	const dirName = path.dirname(fullPath);
	if (!fs.existsSync(dirName)) {
		fs.mkdirSync(dirName, { recursive: true });
	}

	// Create an empty file
	fs.writeFileSync(fullPath, '');
	return vscode.Uri.file(fullPath);
}

// Core function to open a file
async function openFile(filePath: string): Promise<vscode.TextEditor> {
	try {
		// Validate the file path
		if (!filePath || typeof filePath !== 'string') {
			throw new Error('Invalid file path. Please provide a valid file path.');
		}

		// Check if the file exists
		if (!fs.existsSync(filePath)) {
			throw new Error(`File not found: ${filePath}`);
		}

		// Open the file
		const fileUri = vscode.Uri.file(filePath);
		const document = await vscode.workspace.openTextDocument(fileUri);

		// Show the document in the editor
		const editor = await vscode.window.showTextDocument(document, { preview: false });

		return editor;
	} catch (error) {
		// Handle specific errors and provide user-friendly messages
		if (error instanceof vscode.FileSystemError) {
			throw new Error(`Failed to open file: ${error.message}`);
		} else if (error instanceof Error) {
			throw new Error(`Failed to open file: ${error.message}`);
		} else {
			throw new Error('An unknown error occurred while trying to open the file.');
		}
	}
}

// Core function to stream content into a file
async function streamContent(editor: vscode.TextEditor, content: string): Promise<void> {
	for (const char of content) {
		await new Promise(resolve => setTimeout(resolve, 10)); // Adjust delay as needed
		await editor.edit(editBuilder => {
			editBuilder.insert(new vscode.Position(editor.document.lineCount, 0), char);
		});
	}
}


interface ICreateFileParameters {
	filePath: string; // The path of the file to create (e.g., "src/components/newComponent/newComponent.ts")
	content?: string; // Optional content to stream into the file
}

export class CreateAndStreamFileTool implements vscode.LanguageModelTool<ICreateFileParameters> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ICreateFileParameters>,
		_token: vscode.CancellationToken
	) {
		const params = options.input as ICreateFileParameters;

		try {
			const fileUri = await createFile(params.filePath);

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
				new vscode.LanguageModelTextPart(`Failed to create file "${params.filePath}": ${(error as Error).message}`),
			]);
		}
	}
}


interface IOpenFileParameters {
	filePath: string; // The path of the file to open (e.g., "src/existingFile.js")
	content?: string; // Optional content to stream into the file
}

export class FindAndOpenFileTool implements vscode.LanguageModelTool<IOpenFileParameters> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IOpenFileParameters>,
		_token: vscode.CancellationToken
	) {
		const params = options.input as IOpenFileParameters;

		try {
			// Resolve the file path to an absolute path within the workspace
			const resolvedFilePath = this.resolveFilePath(params.filePath);

			// Open the file
			const editor = await openFile(resolvedFilePath);

			// Stream content if provided
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

	// Helper function to resolve file paths
	private resolveFilePath(filePath: string): string {
		// Check if the file path is valid
		if (!filePath || typeof filePath !== 'string') {
			throw new Error('Invalid file path. Please provide a valid file path.');
		}

		// Get the workspace root
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			throw new Error('No workspace folder is open. Please open a workspace first.');
		}

		const workspaceRoot = workspaceFolders[0].uri.fsPath;

		// Resolve the file path
		const resolvedFilePath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);

		// Normalize the path to handle different OS path separators
		return path.normalize(resolvedFilePath);
	}
}

interface IRunInTerminalParameters {
	command: string;
}

async function waitForShellIntegration(
	terminal: vscode.Terminal,
	timeout: number
): Promise<void> {
	let resolve: () => void;
	let reject: (e: Error) => void;
	const p = new Promise<void>((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});

	const timer = setTimeout(() => reject(new Error('Could not run terminal command: shell integration is not enabled')), timeout);

	const listener = vscode.window.onDidChangeTerminalShellIntegration((e) => {
		if (e.terminal === terminal) {
			clearTimeout(timer);
			listener.dispose();
			resolve();
		}
	});

	await p;
}

export class RunInTerminalTool
	implements vscode.LanguageModelTool<IRunInTerminalParameters> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IRunInTerminalParameters>,
		_token: vscode.CancellationToken
	) {
		const params = options.input as IRunInTerminalParameters;

		const terminal = vscode.window.createTerminal('Language Model Tool User');
		terminal.show();
		try {
			await waitForShellIntegration(terminal, 5000);
		} catch (e) {
			return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart((e as Error).message)]);
		}

		const execution = terminal.shellIntegration!.executeCommand(params.command);
		const terminalStream = execution.read();

		let terminalResult = '';
		for await (const chunk of terminalStream) {
			terminalResult += chunk;
		}

		return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(terminalResult)]);
	}
}


interface IEditLineParameters {
	filePath: string; // The path of the file to edit
	lineNumber: number; // The line number to edit (1-based index)
	newContent: string; // The new content for the specified line
}

export class EditLineTool implements vscode.LanguageModelTool<IEditLineParameters> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IEditLineParameters>,
		_token: vscode.CancellationToken
	) {
		const params = options.input as IEditLineParameters;

		try {
			// Open the file
			const fileUri = vscode.Uri.file(params.filePath);
			const document = await vscode.workspace.openTextDocument(fileUri);

			// Validate the line number
			if (params.lineNumber < 1 || params.lineNumber > document.lineCount) {
				return new vscode.LanguageModelToolResult([
					new vscode.LanguageModelTextPart(`Invalid line number. The file has ${document.lineCount} lines.`),
				]);
			}

			// Get the line to edit (line numbers are 0-based in the API)
			const lineIndex = params.lineNumber - 1;
			const line = document.lineAt(lineIndex);

			// Open the file in an editor
			const editor = await vscode.window.showTextDocument(document);

			// Delete the existing line content
			await editor.edit((editBuilder) => {
				editBuilder.replace(line.range, ''); // Clear the line
			});

			// Stream the new content into the line
			await this.streamContent(editor, params.newContent, lineIndex);

			// Save the document
			await document.save();

			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`Line ${params.lineNumber} in file "${params.filePath}" has been updated with streaming.`),
			]);
		} catch (error) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`Failed to edit line ${params.lineNumber} in file "${params.filePath}": ${(error as Error).message}`),
			]);
		}
	}

	// Helper function to stream content into a specific line
	private async streamContent(editor: vscode.TextEditor, content: string, lineIndex: number): Promise<void> {
		const position = new vscode.Position(lineIndex, 0); // Start at the beginning of the line
		for (const char of content) {
			await new Promise((resolve) => setTimeout(resolve, 10)); // Adjust delay as needed
			await editor.edit((editBuilder) => {
				editBuilder.insert(position, char);
			});
		}
	}
}