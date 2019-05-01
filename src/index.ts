import * as path from 'path'

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
    DocumentSelector,
    CompletionItem,
    TextDocument,
    Position,
    CompletionList,
    NotificationType,
    RequestType
} from "vscode-languageserver-protocol";

import { CancellationToken } from "vscode-jsonrpc";
import * as fs from 'fs-extra';

const LanguageID = 'php';
const VERSION = '1.0.14';
const INDEXING_STARTED_NOTIFICATION = new NotificationType('indexingStarted');
const INDEXING_ENDED_NOTIFICATION = new NotificationType('indexingEnded');
const INDEX_WORKSPACE_REQUEST = new RequestType('indexWorkspace');
const CANCEL_INDEXING_REQUEST = new RequestType('cancelIndexing');

let languageClient: LanguageClient;

export async function activate(context: ExtensionContext): Promise<void> {
    let c = workspace.getConfiguration();
    const config = c.get("phpls") as any;
    const enable = config.enable;
    const file = require.resolve("intelephense");

    if (enable === false) return;
    if (!file) {
        workspace.showMessage(
            "intelephense-server not found!, please run yarn global add intelephense-server",
            "error"
        );
        return;
    }

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
        synchronize: {
            fileEvents: [
                workspace.createFileSystemWatcher('**/composer.json'),
                workspace.createFileSystemWatcher('**/vendor/**')
            ]
        },
        initializationOptions: {
            storagePath: context.storagePath,
            clearCache: false
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
    }

    languageClient = new LanguageClient(
        "phpls",
        "PHP Language Server",
        serverOptions,
        clientOptions
    );

    let ready = languageClient.onReady();

    ready.then(() => {
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
    })

    let indexWorkspaceDisposable = commands.registerCommand('intelephense.index.workspace', () => languageClient.sendRequest(INDEX_WORKSPACE_REQUEST.method));
    let cancelIndexingDisposable = commands.registerCommand('intelephense.cancel.indexing', () => languageClient.sendRequest(CANCEL_INDEXING_REQUEST.method));

    context.subscriptions.push(
        services.registLanguageClient(languageClient),
        indexWorkspaceDisposable,
        cancelIndexingDisposable,
    );
}

function fixItem(item: CompletionItem): void {
    if (/^\\\w+/.test(item.insertText) && !/^(\\\w+){2,}/.test(item.insertText)) {
        item.insertText = item.insertText.replace('\\', '');
    }
}
