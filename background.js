const QUICK_FILL_TOGGLE_PANEL = 'QUICK_FILL_TOGGLE_PANEL';

chrome.action.onClicked.addListener((tab) => {
  if (!tab || typeof tab.id !== 'number') return;
  chrome.tabs.sendMessage(tab.id, { type: QUICK_FILL_TOGGLE_PANEL }, () => {
    // Restricted pages have no content script. Ignore that expected failure safely.
    void chrome.runtime.lastError;
  });
});
