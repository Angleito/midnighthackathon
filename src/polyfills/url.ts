// URL polyfill for browser compatibility
export function format(urlObject: any): string {
  if (typeof urlObject === 'string') {
    return urlObject;
  }
  
  if (!urlObject) {
    return '';
  }
  
  let url = '';
  
  if (urlObject.protocol) {
    url += urlObject.protocol;
    if (!urlObject.protocol.endsWith(':')) {
      url += ':';
    }
  }
  
  if (urlObject.slashes || urlObject.protocol) {
    url += '//';
  }
  
  if (urlObject.auth) {
    url += urlObject.auth + '@';
  }
  
  if (urlObject.hostname) {
    url += urlObject.hostname;
  } else if (urlObject.host) {
    url += urlObject.host;
  }
  
  if (urlObject.port) {
    url += ':' + urlObject.port;
  }
  
  if (urlObject.pathname) {
    url += urlObject.pathname;
  }
  
  if (urlObject.search) {
    url += urlObject.search;
  } else if (urlObject.query) {
    url += '?' + (typeof urlObject.query === 'string' ? urlObject.query : '');
  }
  
  if (urlObject.hash) {
    url += urlObject.hash;
  }
  
  return url;
}

export function parse(urlString: string): any {
  try {
    const url = new URL(urlString);
    return {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      host: url.host,
      href: url.href
    };
  } catch {
    return {};
  }
}

export function resolve(from: string, to: string): string {
  try {
    return new URL(to, from).href;
  } catch {
    return to;
  }
}

export default {
  format,
  parse,
  resolve
};