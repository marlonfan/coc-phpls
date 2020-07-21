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
    Disposable,
    Definition
} from "vscode-languageserver-protocol";

import { CancellationToken } from "vscode-jsonrpc";
import { ProvideImplementationSignature } from 'coc.nvim/lib/language-client/implementation';
import { Location } from 'vscode-languageserver-types';
import { isArray } from 'util';
import { existsSync  } from "fs";

const LanguageID = 'php';

const INDEXING_STARTED_NOTIFICATION = new NotificationType('indexingStarted');
const INDEXING_ENDED_NOTIFICATION = new NotificationType('indexingEnded');
const INDEX_WORKSPACE_REQUEST = new RequestType('indexWorkspace');
const CANCEL_INDEXING_REQUEST = new RequestType('cancelIndexing');

let languageClient: LanguageClient;
let extensionContext: ExtensionContext;
let clientDisposable:Disposable;
let file: string;
let licenceKey: string;

export async function activate(context: ExtensionContext): Promise<void> {
    extensionContext = context;

    let c = workspace.getConfiguration();
    const config = c.get("phpls") as any;
    const intelephenseConfig = c.get("intelephense") as any;
    const enable = config.enable;
    licenceKey = intelephenseConfig.licenceKey || '';

    if (enable === false) return;
    if (existsSync(config.path)) {
        try {
            file = require.resolve(config.path);
            if (file.endsWith("intelephense.js") === false) throw new Error();

            /* ---- See :CocOpenLog ---- */
            extensionContext.logger.info(
                "intelephense module (phpls.path) is ready to be started"
            );
        } catch (e) {
            workspace.showMessage(
                "intelephense module not found! phpls.path is invalid.",
                "error"
            );
            return;
        }
    } else {
        try {
            file = require.resolve("intelephense");
            if (file.endsWith("intelephense.js") === false) throw new Error();

            /* ---- See :CocOpenLog ---- */
            extensionContext.logger.info(
                "intelephense module (builtin) is ready to be started"
            );
        } catch (e) {
            workspace.showMessage(
                "intelephense module not found! builtin module is invalid",
                "error"
            );
            return;
        }
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
            globalStoragePath: context.storagePath,
            storagePath: context.storagePath,
            clearCache: clearCache,
            licenceKey: licenceKey,
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
        },
    };

    languageClient = new LanguageClient(
        "phpls",
        "PHP Language Server",
        serverOptions,
        clientOptions
    );

    languageClient.onReady().then(() => {
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

function indexWorkspace(licenceKey: string) {
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
