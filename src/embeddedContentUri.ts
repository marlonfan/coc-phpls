import { URI } from 'vscode-uri';

export const EMBEDDED_CONTENT_SCHEME = 'embedded-content';

export function isEmbeddedContentUri(virtualDocumentUri: URI): boolean {
    return virtualDocumentUri.scheme === EMBEDDED_CONTENT_SCHEME;
}

export function getEmbeddedContentUri(parentDocumentUri: string, embeddedLanguageId: string): URI {
    let uriString = EMBEDDED_CONTENT_SCHEME + '://' + embeddedLanguageId + '/' + encodeURIComponent(parentDocumentUri) + '.' + embeddedLanguageId;
    return URI.parse(uriString);
};

export function getHostDocumentUri(virtualDocumentUri: URI): string {
    let languageId = virtualDocumentUri.authority;
    let path = virtualDocumentUri.path.substring(1, virtualDocumentUri.path.length - languageId.length - 1); // remove leading '/' and new file extension
    return path;
};

export function getEmbeddedLanguageId(virtualDocumentUri: URI): string {
    return virtualDocumentUri.authority;
}
