import * as vscode from 'vscode';

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