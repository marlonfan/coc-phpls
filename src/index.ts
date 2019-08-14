import {
    ExtensionContext,
    LanguageClient,
    ServerOptions,
    workspace,
    services,
    TransportKind,
    LanguageClientOptions,
    CompletionContext,
    ProvideCompletionItemsSignature,
    ProviderResult,
    commands
} from "coc.nvim";

import {
    CompletionItem,
    TextDocument,
    Position,
    CompletionList,
    NotificationType,
    RequestType,
    Disposable
} from "vscode-languageserver-protocol";

import { CancellationToken } from "vscode-jsonrpc";

const LanguageID = 'php';
const VERSION = '1.0.14';
const INDEXING_STARTED_NOTIFICATION = new NotificationType('indexingStarted');
const INDEXING_ENDED_NOTIFICATION = new NotificationType('indexingEnded');
const INDEX_WORKSPACE_REQUEST = new RequestType('indexWorkspace');
const CANCEL_INDEXING_REQUEST = new RequestType('cancelIndexing');

let languageClient: LanguageClient;
let extensionContext: ExtensionContext;
let clientDisposable:Disposable;
let file: string;

export async function activate(context: ExtensionContext): Promise<void> {
    extensionContext = context;

    let c = workspace.getConfiguration();
    const config = c.get("phpls") as any;
    const enable = config.enable;

    file = require.resolve("intelephense");

    if (enable === false) return;
    if (!file) {
        workspace.showMessage(
            "intelephense-server not found!, please run yarn global add intelephense-server",
            "error"
        );
        return;
    }

    languageClient = createClient(context, false);

    let indexWorkspaceDisposable = commands.registerCommand('intelephense.index.workspace', indexWorkspace);
    let cancelIndexingDisposable = commands.registerCommand('intelephense.cancel.indexing', cancelIndexing);

    context.subscriptions.push(
        indexWorkspaceDisposable,
        cancelIndexingDisposable,
    );

    clientDisposable = languageClient.start();
}

function fixItem(item: CompletionItem): void {
    if (/^\\\w+/.test(item.insertText) && !/^(\\\w+){2,}/.test(item.insertText)) {
        item.insertText = item.insertText.replace('\\', '');
    }
}

function createClient(context: ExtensionContext, clearCache: boolean) {
    // The debug options for the server
    let debugOptions = {
        execArgv: ["--nolazy", "--inspect=6039", "--trace-warnings", "--preserve-symlinks"],
        detached: true
    };

    let serverOptions: ServerOptions = {
        run: { module: file, transport: TransportKind.ipc },
        debug: { module: file, transport: TransportKind.ipc, options: debugOptions }
    }

    // todo: implements createMiddleware method
    // let middleware = createMiddleware(() => {
    // 	return languageClient;
    // });

    let clientOptions: LanguageClientOptions = {
        documentSelector: [
            { language: LanguageID, scheme: 'file' },
            { language: LanguageID, scheme: 'untitled' }
        ],
        initializationOptions: {
            storagePath: context.storagePath,
            clearCache: clearCache
        },
        middleware: {
            provideCompletionItem: (
                document: TextDocument,
                position: Position,
                context: CompletionContext,
                token: CancellationToken,
                next: ProvideCompletionItemsSignature
            ): ProviderResult<CompletionItem[] | CompletionList> => {
                return Promise.resolve(next(document, position, context, token)).then(
                    (res: CompletionItem[] | CompletionList) => {
                        let doc = workspace.getDocument(document.uri);
                        if (!doc) return [];

                        if (res.hasOwnProperty('isIncomplete')) {
                            let itemList = (res as CompletionList);
                            if (Array.isArray(itemList.items)) {
                                itemList.items.forEach(fixItem);
                            }
                            return itemList;
                        }

                        let items = (res as CompletionItem[]);
                        if (Array.isArray(items)) {
                            items.forEach(fixItem);
                        }
                        return items;
                    }
                );
            }
        }
    };

    languageClient = new LanguageClient(
        "phpls",
        "PHP Language Server",
        serverOptions,
        clientOptions
    );

    languageClient.onReady().then(() => {
        languageClient.info('Intelephense ' + VERSION);

        let startedTime: Date;

        languageClient.onNotification(INDEXING_STARTED_NOTIFICATION.method, () => {
            startedTime = new Date();
            workspace.showMessage('intelephense indexing ...');
        });

        languageClient.onNotification(INDEXING_ENDED_NOTIFICATION.method, () => {
            let usedTime: number = Math.abs(
                new Date().getTime() - startedTime.getTime()
            );
            workspace.showMessage("Indexed php files, times: " + usedTime + "ms");
        });
    });

    return languageClient;
}

function indexWorkspace() {
	if(!languageClient) {
		return;
	}
	languageClient.stop().then(_ => {
		clientDisposable.dispose();
		languageClient = createClient(extensionContext, true);
		clientDisposable = languageClient.start();
	});
}

function cancelIndexing() {
	languageClient.sendRequest(CANCEL_INDEXING_REQUEST.method);
}
