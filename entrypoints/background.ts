import { handleRpc } from '../src/lib/rpc/handlers';
import type { RpcRequest } from '../src/lib/rpc/messages';

export default defineBackground(() => {
  // Icon click opens the console in a full-page tab.
  browser.action.onClicked.addListener(() => {
    browser.tabs.create({ url: browser.runtime.getURL('/console.html') });
  });

  browser.runtime.onMessage.addListener((msg: RpcRequest) => {
    // Returning a Promise makes the response async; the UI awaits it.
    return handleRpc(msg);
  });
});
