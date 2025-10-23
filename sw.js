chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "SET_BADGE") {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.action.setBadgeText({ tabId, text: msg.text || "" });
      chrome.action.setBadgeBackgroundColor({ tabId, color: msg.color || "#596677" });
    }
  }
});
