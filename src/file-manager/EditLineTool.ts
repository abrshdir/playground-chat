import * as vscode from 'vscode';
import * as path from 'path';

interface IEditLineParameters {
	filePath: string;
	lineNumber: number;
	newContent: string;
}

export class EditLineTool implements vscode.LanguageModelTool<IEditLineParameters> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IEditLineParameters>,
		_token: vscode.CancellationToken
	) {
		const params = options.input as IEditLineParameters;

		try {
			const resolvedFilePath = this.resolveFilePath(params.filePath);
			const fileUri = vscode.Uri.file(resolvedFilePath);
			const document = await vscode.workspace.openTextDocument(fileUri);

			if (params.lineNumber < 1 || params.lineNumber > document.lineCount) {
				return new vscode.LanguageModelToolResult([
					new vscode.LanguageModelTextPart(`Invalid line number. The file has ${document.lineCount} lines.`),
				]);
			}

			const editor = await vscode.window.showTextDocument(document);
			const codeWithLineNumbers = this.getVisibleCodeWithLineNumbers(editor);
			console.log('Visible code with line numbers:\n', codeWithLineNumbers);

			const lineIndex = params.lineNumber - 1;
			const line = document.lineAt(lineIndex);

			this.revealLineInEditor(editor, lineIndex);

			await editor.edit((editBuilder) => {
				editBuilder.replace(line.range, '');
			});

			await this.streamContent(editor, params.newContent, lineIndex);
			await document.save();

			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`Line ${params.lineNumber} in file "${resolvedFilePath}" has been updated with streaming.`),
			]);
		} catch (error) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`Failed to edit line ${params.lineNumber} in file "${params.filePath}": ${(error as Error).message}`),
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

		return path.normalize(filePath);
	}

	private getVisibleCodeWithLineNumbers(textEditor: vscode.TextEditor): string {
		const startLine = textEditor.visibleRanges[0].start.line;
		const endLine = textEditor.visibleRanges[0].end.line;

		let code = '';

		for (let currentLine = startLine; currentLine <= endLine; currentLine++) {
			code += `${currentLine + 1}: ${textEditor.document.lineAt(currentLine).text}\n`;
		}

		return code;
	}

	private async streamContent(editor: vscode.TextEditor, content: string, lineIndex: number): Promise<void> {
		const line = editor.document.lineAt(lineIndex);
		const position = new vscode.Position(lineIndex, line.text.length);

		for (const char of content) {
			await new Promise((resolve) => setTimeout(resolve, 10));
			await editor.edit((editBuilder) => {
				editBuilder.insert(position, char);
			});
		}
	}

	private revealLineInEditor(editor: vscode.TextEditor, lineIndex: number): void {
		const range = new vscode.Range(lineIndex, 0, lineIndex, 0);
		editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
	}
}