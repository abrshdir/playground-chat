import * as vscode from 'vscode';
import { TabCountTool } from './file-manager/TabCountTool';
import { FindFilesTool } from './file-manager/FindFilesTool';
import { RunInTerminalTool } from './file-manager/RunInTerminalTool';
import { DeleteFilesTool } from './file-manager/DeleteFilesTool';
import { FindAndOpenFileTool } from './file-manager/FindAndOpenFileTool';
import { CreateAndStreamFileTool } from './file-manager/CreateAndStreamFileTool';
import { EditLineTool } from './file-manager/EditLineTool';

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
		vscode.lm.registerTool('chat-tools-sample_editLine', new EditLineTool())
	);
}