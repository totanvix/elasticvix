export default defineBackground(() => {
  // Icon click opens the console in a full-page tab.
  browser.action.onClicked.addListener(() => {
    browser.tabs.create({ url: browser.runtime.getURL('/console.html') });
  });
});
