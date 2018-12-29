import { ExtensionContext, LanguageClient, ServerOptions, workspace, services, TransportKind, LanguageClientOptions, WorkspaceConfiguration, ProvideCompletionItemsSignature, FileSystemWatcher } from 'coc.nvim'
import { TextDocument, Position, CompletionItem, CompletionList, InsertTextFormat, DocumentSelector } from 'vscode-languageserver-protocol'
import { CompletionContext } from 'vscode-languageserver-protocol'
import { CancellationToken } from 'vscode-jsonrpc'
import { ProviderResult } from 'coc.nvim/lib/provider'
import Uri from 'vscode-uri';
import Glob from 'glob'

import { WorkspaceDiscovery } from './workspaceDiscovery';

const sections = ['php']

export async function activate(context: ExtensionContext): Promise<void> {
  let { subscriptions } = context
  let c = workspace.getConfiguration()
  const config = c.get('phpls') as any
  const enable = config.enable
  const file = require.resolve('intelephense-server');

  if (enable === false) return
  if (!file) {
    workspace.showMessage("intelephense-server not found!, please run yarn global add intelephense-server", 'error')
    return
  }

  const selector: DocumentSelector = [{
    language: 'php',
    scheme: 'file'
  }]

  let serverOptions: ServerOptions = {
    module: file,
    args: ['--node-ipc'],
    transport: TransportKind.ipc,
    options: {
      cwd: workspace.root,
      execArgv: config.execArgv || []
    }
  }

  let fsWatcher: FileSystemWatcher = workspace.createFileSystemWatcher('**/*.php', true, false, true)

  let clientOptions: LanguageClientOptions = {
    documentSelector: selector,
    synchronize: {
      configurationSection: sections,
      fileEvents: fsWatcher
    },
    outputChannelName: 'php',
    initializationOptions: {},
    middleware: {
      provideCompletionItem: (
        document: TextDocument,
        position: Position,
        context: CompletionContext,
        token: CancellationToken,
        next: ProvideCompletionItemsSignature
      ): ProviderResult<CompletionItem[] | CompletionList> => {
        return Promise.resolve(next(document, position, context, token)).then((res: CompletionItem[] | CompletionList) => {
          let doc = workspace.getDocument(document.uri)
          if (!doc) return []
          let items: CompletionItem[] = res.hasOwnProperty('isIncomplete') ? (res as CompletionList).items : res as CompletionItem[]
          let pre = doc.getline(position.line).slice(0, position.character)
          // searching for class name
          if (/(^|\s)\.\w*$/.test(pre)) {
            items = items.filter(o => o.label.startsWith('.'))
            items.forEach(fixItem)
          }
          if (context.triggerCharacter == ':'
            || /\:\w*$/.test(pre)) {
            items = items.filter(o => o.label.startsWith(':'))
            items.forEach(fixItem)
          }
          return items
        })
      }
    }
  }

  let client = new LanguageClient('php', 'PHP Language Server', serverOptions, clientOptions)

  subscriptions.push(
    services.registLanguageClient(client)
  )

  setTimeout(() => {
    WorkspaceDiscovery.client = client

    fsWatcher.onDidDelete(onDidDelete);
    fsWatcher.onDidCreate(onDidCreate);
    fsWatcher.onDidChange(onDidChange);

    readAllFile(workspace.rootPath)
      .then(files => files.map(file => {
        workspace.showMessage(file)
        return Uri.file(file)
      }))
      .then(uriArray => {
        let token: CancellationToken;
        workspace.showMessage('Indexing started.');
        return WorkspaceDiscovery.checkCacheThenDiscover(uriArray, true, token);
      })
      .then(() => {
        workspace.showMessage("Indexed php files");
      })
  }, 1000)
}

function fixItem(item: CompletionItem): void {
  item.data = item.data || {}
  item.data.abbr = item.label
  item.label = item.label.slice(1)
  item.textEdit = null
  item.insertTextFormat = InsertTextFormat.PlainText
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
        resolve(matches)
      }
      reject(err)
    })
  });
}
