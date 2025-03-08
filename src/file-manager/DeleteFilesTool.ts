import * as vscode from 'vscode';
import * as path from 'path';

interface IDeleteFilesParameters {
	pattern: string; // Can be a glob pattern or an absolute file path
}

export class DeleteFilesTool implements vscode.LanguageModelTool<IDeleteFilesParameters> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IDeleteFilesParameters>
	) {
		const params = options.input as IDeleteFilesParameters;

		// Check workspace trust
		if (!vscode.workspace.isTrusted) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('File or folder deletion is disabled in untrusted workspaces.'),
			]);
		}

		// Resolve the file path (handle both absolute and relative paths)
		const resolvedFilePath = this.resolveFilePath(params.pattern);

		// // Check if the file exists
		// const fileExists = await this.checkIfExists(resolvedFilePath);
		// if (!fileExists) {
		// 	return new vscode.LanguageModelToolResult([
		// 		new vscode.LanguageModelTextPart(`File not found: ${resolvedFilePath.fsPath}`),
		// 	]);
		// }

		try {
			// Delete the file
			await vscode.workspace.fs.delete(resolvedFilePath);
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`File deleted: ${resolvedFilePath.fsPath}`),
			]);
		} catch (error) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`Failed to delete file "${resolvedFilePath.fsPath}": ${(error as Error).message}`),
			]);
		}
	}

	// Helper function to resolve file paths
	private resolveFilePath(filePath: string): vscode.Uri {
		// Check if the file path is valid
		if (!filePath || typeof filePath !== 'string') {
			throw new Error('Invalid file path. Please provide a valid file path.');
		}

		// Get the workspace root
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			throw new Error('No workspace folder is open. Please open a workspace first.');
		}

		// Resolve the file path relative to the workspace root
		const workspaceRoot = workspaceFolders[0].uri.fsPath;
		const resolvedFilePath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);

		// Normalize the path to handle different OS path separators
		return vscode.Uri.file(path.normalize(resolvedFilePath));
	}

	// Helper function to check if a file or folder exists
	private async checkIfExists(uri: vscode.Uri): Promise<boolean> {
		try {
			await vscode.workspace.fs.stat(uri); // Check if the file or folder exists
			return true; // File or folder exists
		} catch (error) {
			if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
				return false; // File or folder does not exist
			}
			throw error; // Re-throw other errors
		}
	}
}