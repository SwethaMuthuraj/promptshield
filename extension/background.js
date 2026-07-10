/**
 * PromptShield - Background Service Worker (FIXED STATE SYNC)
 */

// ── Install defaults ───────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    enabled: true,
    backendUrl: "http://localhost:5001",
    blockUnsafe: true,
    warnUser: true,
    logCount: 0,
    sessionCount: 0,
  });
  console.log("[PromptShield] Installed with defaults.");
});

// ── Reset session counter on browser startup ───────────────────────────────
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.sync.set({ sessionCount: 0 });
});

// ── Message handler ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Content script reports a blocked prompt
  if (message.type === "BLOCKED") {
    chrome.storage.sync.get(["logCount", "sessionCount"], (data) => {
      const total = (data.logCount || 0) + 1;
      const session = (data.sessionCount || 0) + 1;
      chrome.storage.sync.set({ logCount: total, sessionCount: session });
      chrome.action.setBadgeText({ text: String(session) });
      chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    });
    return;
  }

  // Content script asks "am I enabled?" on page load
  if (message.type === "GET_STATE") {
    chrome.storage.sync.get(
      ["enabled", "backendUrl", "blockUnsafe", "warnUser"],
      (data) => {
        console.log("[PromptShield] Sending state to content script:", data);
        sendResponse(data);
      }
    );
    return true; // keep channel open for async response
  }

  // Popup changed a setting — broadcast to all matching tabs
  if (message.type === "SETTINGS_CHANGED") {
    console.log("[PromptShield] Settings changed, broadcasting:", message);
    
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        // Only push to tabs that PromptShield runs on
        if (tab.id && tab.url && /openai\.com|chatgpt\.com|gemini\.google|claude\.ai|copilot\.microsoft|bing\.com|poe\.com|you\.com|monica\.im|localhost|127\.0\.0\.1/.test(tab.url)) {
          chrome.tabs.sendMessage(tab.id, {
            type: "STATE_UPDATE",
            enabled: message.enabled,
            backendUrl: message.backendUrl,
          }).catch(() => {}); // tab may not have content script yet — ignore
        }
      });
    });
    return;
  }
});