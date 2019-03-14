import {
  ExtensionContext,
  LanguageClient,
  ServerOptions,
  workspace,
  services,
  TransportKind,
  LanguageClientOptions,
  FileSystemWatcher,
  CompletionContext,
  ProvideCompletionItemsSignature,
  ProviderResult
} from "coc.nvim";
import {
  DocumentSelector,
  CompletionItem,
  TextDocument,
  Position,
  CompletionList,
  DidOpenTextDocumentNotification
} from "vscode-languageserver-protocol";
import { CancellationToken } from "vscode-jsonrpc";
import Uri from "vscode-uri";
import Glob from "glob";

import { WorkspaceDiscovery } from "./workspaceDiscovery";
import { CompleterResult } from "readline";

const sections = ["php"];

export async function activate(context: ExtensionContext): Promise<void> {
  let { subscriptions } = context;
  let c = workspace.getConfiguration();
  const config = c.get("phpls") as any;
  const enable = config.enable;
  const file = require.resolve("intelephense-server");

  if (enable === false) return;
  if (!file) {
    workspace.showMessage(
      "intelephense-server not found!, please run yarn global add intelephense-server",
      "error"
    );
    return;
  }

  const selector: DocumentSelector = [
    {
      language: "php",
      scheme: "file"
    }
  ];

  let serverOptions: ServerOptions = {
    module: file,
    args: ["--node-ipc"],
    transport: TransportKind.ipc,
    options: {
      cwd: workspace.root,
      execArgv: config.execArgv || []
    }
  };

  let fsWatcher: FileSystemWatcher = workspace.createFileSystemWatcher(
    "**/*.php",
    true,
    false,
    true
  );

  let clientOptions: LanguageClientOptions = {
    documentSelector: selector,
    synchronize: {
      configurationSection: sections,
      fileEvents: fsWatcher
    },
    outputChannelName: "php",
    initializationOptions: {},
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

  let client = new LanguageClient(
    "phpls",
    "PHP Language Server",
    serverOptions,
    clientOptions
  );

  subscriptions.push(services.registLanguageClient(client));

  client.onReady().then(async () => {
    WorkspaceDiscovery.client = client;

    fsWatcher.onDidDelete(onDidDelete);
    fsWatcher.onDidCreate(onDidCreate);
    fsWatcher.onDidChange(onDidChange);

    let startedTime: Date;

    return await readAllFile(workspace.rootPath)
      .then(files => files.map(file => Uri.file(file)))
      .then(uriArray => {
        let token: CancellationToken;
        workspace.showMessage("Indexing started.");
        startedTime = new Date();
        return WorkspaceDiscovery.checkCacheThenDiscover(uriArray, true, token);
      })
      .then(() => {
        let usedTime: number = Math.abs(
          new Date().getTime() - startedTime.getTime()
        );
        workspace.showMessage("Indexed php files, times: " + usedTime + "ms");
      });
  });
}

function onDidDelete(uri: Uri) {
  WorkspaceDiscovery.forget(uri);
}

function onDidChange(uri: Uri) {
  WorkspaceDiscovery.delayedDiscover(uri);
}

function onDidCreate(uri: Uri) {
  onDidChange(uri);
}

function readAllFile(root: string) {
  return new Promise<string[]>((resolve, reject) => {
    Glob(root + "/**/*.php", (err, matches) => {
      if (err == null) {
        resolve(matches);
      }
      reject(err);
    });
  });
}

function fixItem(item: CompletionItem): void {
  if (/^\\\w+/.test(item.insertText) && !/^(\\\w+){2,}/.test(item.insertText)) {
    item.insertText = item.insertText.replace('\\', '');
  }
}
