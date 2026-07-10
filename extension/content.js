let PS_ENABLED = true;
let PS_BACKEND_URL = "http://localhost:5001";
let isProcessing = false;
let capturedText = "";
 
const HOOKED_FLAG = 'data-ps-hooked';
console.log("[PromptShield] System Starting...");
 
// ── Universal element detection ──────────────────────────────────────────
function getTextarea() {
  // Primary selectors
  let textarea = document.querySelector('div[contenteditable="true"]') || 
                document.querySelector('textarea') ||
                document.querySelector('input[type="text"]');
  
  if (textarea) return textarea;
  
  // Generic fallbacks
  textarea = document.querySelector('input[placeholder*="Ask"]') ||
            document.querySelector('input[placeholder*="message"]') ||
            document.querySelector('input[placeholder*="prompt"]') ||
            document.querySelector('textarea[placeholder]') ||
            document.querySelector('[contenteditable="true"]');
  
  return textarea;
}
 
function getSendButton() {
  // Primary selectors
  let button = document.querySelector('button[data-testid="send-button"]') ||
               document.querySelector('button[aria-label*="Send"]') ||
               document.querySelector('button[type="submit"]');
  
  if (button) return button;
  
  // Generic fallbacks
  button = document.querySelector('button:has(svg)') ||
          document.querySelector('button[aria-label*="Submit"]') ||
          document.querySelector('.send-button');
  
  if (button) return button;
  
  // Find button by text content
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    const text = btn.textContent?.toLowerCase() || '';
    const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
    if (text.includes('send') || ariaLabel.includes('send') || 
        text.includes('submit') || ariaLabel.includes('submit')) {
      return btn;
    }
  }
  
  return document.querySelector('button');
}
 
function getText(el) {
  if (!el) return "";
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    return (el.value || "").trim();
  }
  return (el.innerText || el.textContent || "").trim();
}
 
function clearText(el) {
  if (!el) return;
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    el.value = "";
  } else {
    el.innerText = "";
  }
  el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}
 
// ── Banner system ────────────────────────────────────────────────────────
function showBanner(type, message) {
  removeBanner();
  
  const colors = {
    UNSAFE: { bg: "#ef4444", icon: "🚫", title: "BLOCKED" },
    WARN: { bg: "#f59e0b", icon: "⚠️", title: "WARNING" },
    INFO: { bg: "#3b82f6", icon: "🔍", title: "ANALYZING" },
    DISABLED: { bg: "#6b7280", icon: "⏸️", title: "DISABLED" }
  };
  const c = colors[type] || colors.INFO;
 
  const banner = document.createElement("div");
  banner.id = "promptshield-banner";
  banner.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    z-index: 2147483647; background: ${c.bg}; color: white;
    padding: 16px 20px; border-radius: 10px; min-width: 300px;
    font-family: system-ui, sans-serif; font-size: 14px; font-weight: 600;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    display: flex; align-items: center; gap: 12px;
  `;
 
  banner.innerHTML = `
    <span style="font-size: 18px;">${c.icon}</span>
    <div style="flex: 1;">
      <div style="margin-bottom: 2px;">${c.title}</div>
      <div style="opacity: 0.9; font-weight: 400; font-size: 13px;">${message}</div>
    </div>
  `;
 
  if (type === "UNSAFE") {
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = "background:none;border:none;color:white;cursor:pointer;font-size:16px;padding:4px;";
    closeBtn.onclick = removeBanner;
    banner.appendChild(closeBtn);
  }
 
  document.body.appendChild(banner);
 
  if (type !== "UNSAFE") {
    setTimeout(removeBanner, 4000);
  }
}
 
function removeBanner() {
  document.getElementById("promptshield-banner")?.remove();
}
 
// ── Analysis engine ──────────────────────────────────────────────────────
async function analyzePrompt(text) {
  try {
    console.log("[PromptShield] Analyzing:", text.substring(0, 50) + "...");
    
    const response = await fetch(`${PS_BACKEND_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: text }),
      signal: AbortSignal.timeout(25000)
    });
 
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const result = await response.json();
    console.log("[PromptShield] Result:", result.label, "-", result.reason);
    return result;
 
  } catch (err) {
    console.warn("[PromptShield] Backend failed:", err.message);
    
    // Enhanced local patterns
    const harmfulPatterns = [
      /ignore.+(previous|prior|all).+(instructions?|rules?)/i,
      /(you are now|act as|pretend).+(DAN|no restrictions|evil|unrestricted)/i,
      /(write|create|make|build).+(malware|virus|ransomware|keylogger)/i,
      /(how to|ways to).+(hack|crack|break into|gain access).+(account|system|password)/i,
      /(phishing|fake login|credential harvest|password steal)/i,
      /(bomb|explosive|weapon).+(recipe|instructions|how to|make)/i,
      /(poison|kill|murder).+(undetectable|person|someone)/i,
      /(bypass|circumvent).+(security|protections|safeguards)/i,
      /(for academic purposes|for research).+(phishing|hack|exploit|malware)/i
    ];
 
    for (const pattern of harmfulPatterns) {
      if (pattern.test(text)) {
        return { 
          label: "UNSAFE", 
          reason: "[Local] Harmful pattern detected"
        };
      }
    }
 
    return { label: "SAFE", reason: "[Local] Passed basic checks" };
  }
}
 
// ── Processing logic ─────────────────────────────────────────────────────
async function processSubmission(text) {
  if (!PS_ENABLED) {
    console.log("[PromptShield] Extension disabled, allowing all prompts");
    return false;
  }
 
  if (isProcessing) {
    console.log("[PromptShield] Already processing, ignoring");
    return true;
  }
 
  if (text.length < 2) {
    console.log("[PromptShield] Text too short, allowing");
    return false;
  }
 
  isProcessing = true;
  console.log("[PromptShield] Processing submission (Extension ENABLED)");
 
  try {
    showBanner("INFO", "Scanning prompt for harmful content...");
 
    const result = await analyzePrompt(text);
 
    if (result.label === "UNSAFE") {
      console.log("[PromptShield] BLOCKING harmful content");
      showBanner("UNSAFE", result.reason);
      
      const textarea = getTextarea();
      if (textarea) clearText(textarea);
      
      try {
        chrome.runtime.sendMessage({ 
          type: "BLOCKED", 
          prompt: text.substring(0, 100),
          reason: result.reason 
        });
      } catch (e) {}
      
      return true; // BLOCKED
    }
 
    if (result.label === "WARN") {
      console.log("[PromptShield] WARNING, but allowing");
      showBanner("WARN", result.reason + " - Proceeding with caution");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
 
    console.log("[PromptShield] Content is safe, allowing");
    removeBanner();
    return false; // ALLOWED
 
  } catch (error) {
    console.error("[PromptShield] Processing error:", error);
    removeBanner();
    return false;
  } finally {
    isProcessing = false;
  }
}
 
// ── Universal event hooks ────────────────────────────────────────────────
function installHooks() {
  const textarea = getTextarea();
  const sendBtn = getSendButton();
 
  console.log("[PromptShield] Found elements - Textarea:", !!textarea, "SendBtn:", !!sendBtn);
 
  // Hook textarea for Enter key
  if (textarea && !textarea.hasAttribute(HOOKED_FLAG)) {
    textarea.setAttribute(HOOKED_FLAG, "true");
    console.log("[PromptShield] Hooking textarea:", textarea.tagName, textarea.placeholder || textarea.className);
 
    textarea.addEventListener("keydown", async (e) => {
      if (e.psInternal) return;
 
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        console.log("[PromptShield] Enter key intercepted");
        
        capturedText = getText(textarea);
        
        e.preventDefault();
        e.stopImmediatePropagation();
 
        const blocked = await processSubmission(capturedText);
        if (!blocked) {
          // Restore text and trigger submission
          if (getText(textarea) !== capturedText) {
            if (textarea.tagName === "TEXTAREA" || textarea.tagName === "INPUT") {
              textarea.value = capturedText;
            } else {
              textarea.innerText = capturedText;
            }
            textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
          }
          
          setTimeout(() => {
            const btn = getSendButton();
            if (btn && !btn.disabled) {
              btn.click();
            } else {
              const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                bubbles: true,
                cancelable: true
              });
              enterEvent.psInternal = true;
              textarea.dispatchEvent(enterEvent);
            }
          }, 50);
        }
      }
    }, true);
  }
 
  // Hook send button
  if (sendBtn && !sendBtn.hasAttribute(HOOKED_FLAG)) {
    sendBtn.setAttribute(HOOKED_FLAG, "true");
    console.log("[PromptShield] Hooking send button:", sendBtn.textContent?.trim() || sendBtn.className);
 
    sendBtn.addEventListener("click", async (e) => {
      if (e.isTrusted) {
        console.log("[PromptShield] Send button intercepted");
        
        const textarea = getTextarea();
        if (textarea) {
          capturedText = getText(textarea);
        }
        
        e.preventDefault();
        e.stopImmediatePropagation();
 
        if (capturedText) {
          const blocked = await processSubmission(capturedText);
          if (!blocked) {
            if (textarea && getText(textarea) !== capturedText) {
              if (textarea.tagName === "TEXTAREA" || textarea.tagName === "INPUT") {
                textarea.value = capturedText;
              } else {
                textarea.innerText = capturedText;
              }
              textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
            }
            setTimeout(() => sendBtn.click(), 50);
          }
        }
      }
    }, true);
  }
}
 
// ── Initialization ───────────────────────────────────────────────────────
let observerActive = false;
 
function startProtection() {
  if (observerActive) return;
  observerActive = true;
 
  installHooks();
 
  const observer = new MutationObserver(() => {
    installHooks();
  });
 
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
 
  console.log("[PromptShield] Protection hooks installed");
}
 
function initializeState() {
  try {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("[PromptShield] Background script not ready, using defaults");
      } else if (response) {
        PS_ENABLED = response.enabled ?? true;
        PS_BACKEND_URL = response.backendUrl ?? PS_BACKEND_URL;
        console.log("[PromptShield] Initial state loaded - Enabled:", PS_ENABLED, "Backend:", PS_BACKEND_URL);
      }
      
      startProtection();
      
      if (PS_ENABLED) {
        console.log("[PromptShield] Protection ACTIVE");
      } else {
        console.log("[PromptShield] Protection DISABLED");
      }
    });
  } catch (e) {
    console.log("[PromptShield] Extension context issue, using defaults");
    startProtection();
  }
}
 
// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeState);
} else {
  initializeState();
}
 
// Settings sync
chrome.runtime?.onMessage?.addListener((msg) => {
  if (msg.type === "STATE_UPDATE") {
    const oldEnabled = PS_ENABLED;
    PS_ENABLED = msg.enabled ?? PS_ENABLED;
    PS_BACKEND_URL = msg.backendUrl ?? PS_BACKEND_URL;
    
    console.log("[PromptShield] Settings updated - Enabled:", PS_ENABLED, "Backend:", PS_BACKEND_URL);
    
    if (oldEnabled !== PS_ENABLED) {
      if (PS_ENABLED) {
        console.log("[PromptShield] Protection ENABLED");
        showBanner("INFO", "PromptShield protection is now active");
      } else {
        console.log("[PromptShield] Protection DISABLED");
        removeBanner();
        showBanner("DISABLED", "PromptShield protection is disabled");
      }
    }
  }
});