/**
 * @fileoverview LoulouBot extension popup script
 * @description Manages popup user interface, settings, and communication with the page
 * @version 1.0.0
 */

// Disable console logs in production
// try {
//   (function() {
//     const noop = function() {};
//     if (typeof console !== 'undefined') {
//       console.log = noop;
//       console.warn = noop;
//       console.debug = noop;
//       console.info = noop;
//       console.error = noop;
//     }
//   })();
// } catch (e) {}

// ============================================================================
// Global variables
// ============================================================================

/** @type {number} XP accumulated during the session */
let sessionXP = 0;

/** @type {number} Number of user coins */
let userCoins = 0;

/** @type {number} Number of user roses */
let userRoses = 0;

/** @type {string} Username */
let username = "";

/** @type {number} User level */
let userLevel = 0;

/** @type {string} License expiry date */
let licenseExpiry = "";

/** @type {boolean} Indicates if settings have been initialized */
let settingsInitialized = false;

// ============================================================================
// Extension context verification
// ============================================================================

/**
 * Check if the extension context is still valid
 * @returns {boolean} True if context is valid
 */
function isContextValid() {
  try {
    return chrome.runtime && chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// Display an error message if context is invalid
if (!isContextValid()) {
  document.body.innerHTML = `
    <div style="padding: 20px; text-align: center; color: #ff4757;">
      <h2>⚠️ Extension Reloaded</h2>
      <p>Please reload the Wolvesville page to continue.</p>
      <button onclick="chrome.tabs.query({url:'*://www.wolvesville.com/*'}, tabs => tabs[0] && chrome.tabs.reload(tabs[0].id))" 
        style="padding: 10px 20px; background: #00d4ff; border: none; border-radius: 8px; color: #fff; cursor: pointer; font-weight: 600;">
        Reload Page
      </button>
    </div>
  `;
  throw new Error("Extension context invalidated");
}

// ============================================================================
// DOM elements
// ============================================================================

/** @type {HTMLElement} Menu button */
const menuBtn = document.getElementById("menuBtn");

/** @type {HTMLElement} Sidebar */
const sidebar = document.getElementById("sidebar");

/** @type {HTMLElement} Sidebar overlay */
const sidebarOverlay = document.getElementById("sidebarOverlay");

/** @type {NodeList} Navigation items */
const navItems = document.querySelectorAll(".nav-item");

/** @type {NodeList} Navigation cards */
const navCards = document.querySelectorAll(".nav-card");

/** @type {NodeList} Pages */
const pages = document.querySelectorAll(".page");

/** @type {chrome.runtime.Port} Connection port with background */
const port = chrome.runtime.connect({ name: "popup" });

/** @type {Object|null} Last spin performed */
let recentSpin = null;

/** @type {HTMLElement} Bouton des messages */
const messagesBtn = document.getElementById("messagesBtn");

/** @type {HTMLElement} Badge des messages */
const messagesBadge = document.getElementById("messagesBadge");

// ============================================================================
// Communication with the page
// ============================================================================

/**
 * Envoie un message à la page Wolvesville via le content script
 * @param {Object} data - Data to send
 */
function sendToPage(data) {
  chrome.tabs.query({ url: "*://www.wolvesville.com/*" }, (tabs) => {
    if (tabs && tabs[0]) {
      chrome.tabs
        .sendMessage(tabs[0].id, {
          type: "POPUP_TO_PAGE",
          data: data,
        })
        .catch((e) => {});
    }
  });
}

// Listen to port messages
port.onMessage.addListener((message) => {
  handleMessage(message);
});

// ============================================================================
// Gestionnaire de messages
// ============================================================================

/**
 * Gère les messages reçus du background/content script
 * @param {Object} message - Message reçu
 */
function handleMessage(message) {
  // UI update
  if (message.type === "UPDATE_UI") {
    const licenseStatusElement = document.getElementById("licenseStatus");

    // Update username
    if (message.username) {
      username = message.username;
      const welcomeTitle = document.querySelector("welcomeTitle");
      if (welcomeTitle) {
        welcomeTitle.textContent = "Welcome " + username;
      }
    }

    // Update level
    if (message.level) {
      userLevel = message.level;
      const userLevelElement = document.getElementById("userLevel");
      if (userLevelElement) {
        userLevelElement.textContent = message.level;
      }
    }

    // Update license status (always enabled)
    try {
      if (licenseStatusElement) {
        licenseStatusElement.textContent = "Unlimited";
      }
      try {
        hideDeactivatedOverlay();
      } catch (e) {}
    } catch (e) {}

    // Update coins
    if (message.coins !== undefined) {
      const previousCoins = userCoins;
      userCoins = message.coins;
      const userCoinsElement = document.getElementById("userCoins");
      if (userCoinsElement) {
        userCoinsElement.textContent = message.coins.toLocaleString();
      }

      // Notification of gain after a spin
      if (recentSpin && Date.now() - recentSpin.time < 6000) {
        const coinDiff = userCoins - previousCoins;
        if (coinDiff > 0) {
          showFooterNotification("+" + coinDiff + " Coins", "coins");
        }
        recentSpin = null;
      }
    }

    // Update roses
    if (message.roses !== undefined) {
      userRoses = message.roses;
      const userRosesElement = document.getElementById("userRoses");
      if (userRosesElement) {
        userRosesElement.textContent = message.roses.toLocaleString();
      }

      // Update Rose Wheel button
      const roseWheelBtn = document.getElementById("roseWheelBtn");
      const wheelStatusElement =
        roseWheelBtn && roseWheelBtn.querySelector(".wheel-status");

      if (roseWheelBtn) {
        if (userRoses < 30) {
          roseWheelBtn.dataset.status = "Disabled";
          roseWheelBtn.disabled = true;
          if (wheelStatusElement) {
            wheelStatusElement.textContent = userRoses + " 🌹 — Need 30";
          }
        } else {
          roseWheelBtn.dataset.status = "true";
          roseWheelBtn.disabled = false;
          if (wheelStatusElement) {
            wheelStatusElement.textContent = "30 🌹 per spin";
          }
        }
      }
    }

    // Update session XP
    if (message.sessionXP !== undefined) {
      sessionXP = message.sessionXP;
      const sessionXPElement = document.getElementById("sessionXP");
      if (sessionXPElement) {
        sessionXPElement.textContent = message.sessionXP.toLocaleString();
      }
    }

    // Update loot box count
    if (message.lootBoxCount !== undefined) {
      const lootBoxCountElement = document.getElementById("lootBoxCount");
      if (lootBoxCountElement) {
        lootBoxCountElement.textContent =
          "(" + message.lootBoxCount + " available)";
      }
    }

    // Update Gold Wheel availability
    if (message.goldWheelAvailable !== undefined) {
      const goldWheelBtn = document.getElementById("goldWheelBtn");
      if (goldWheelBtn) {
        goldWheelBtn.dataset.status = message.goldWheelAvailable
          ? "true"
          : "Disabled";
        goldWheelBtn.disabled = !message.goldWheelAvailable;
      }

      const goldWheelStatusElement = document.getElementById("goldWheelStatus");
      if (goldWheelStatusElement) {
        goldWheelStatusElement.textContent = message.goldWheelAvailable
          ? "Available"
          : message.goldWheelStatus || "Unavailable";
      }
    }

    // Display wheel result
    if (message.wheelResult) {
      const wheelResultElement = document.getElementById("wheelResult");
      if (wheelResultElement) {
        wheelResultElement.textContent = message.wheelResult;
        wheelResultElement.classList.add("visible");
        setTimeout(() => wheelResultElement.classList.remove("visible"), 5000);
      }
      showFooterNotification(message.wheelResult, "gold");
    }
  }

  // Custom message
  if (message.type === "CUSTOM_MESSAGE" && message.custom_message) {
    try {
      try {
        localStorage.setItem("last-custom-msg", message.custom_message);
      } catch (e) {}
      try {
        localStorage.setItem("llb_popup_msg_seen", "Disabled");
      } catch (e) {}
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set(
            {
              "last-custom-msg": message.custom_message,
              llb_popup_msg_seen: false,
            },
            function () {},
          );
        }
      } catch (e) {}
      updateMessageBadge();
      showPopupCustomMessage(message.custom_message);
    } catch (e) {
      console.error(e);
    }
  }

  // Statut d'authentification
  if (message.type === "AUTH_STATUS") {
    try {
      const status = message.status;
      const licenseStatusElement = document.getElementById("licenseStatus");

      if (status === "authorized") {
        licenseExpiry = message.expires || "";
        if (licenseStatusElement) {
          licenseStatusElement.textContent = licenseExpiry
            ? "Active until " + licenseExpiry
            : "Active";
        }
        try {
          restoreSettingsOnAuth();
        } catch (e) {}
        try {
          hideDeactivatedOverlay();
        } catch (e) {}

        // Display custom message if present
        if (message.custom_message) {
          try {
            localStorage.setItem("last-custom-msg", message.custom_message);
          } catch (e) {}
          try {
            localStorage.setItem("llb_popup_msg_seen", "Disabled");
          } catch (e) {}
          try {
            if (chrome && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set(
                {
                  "last-custom-msg": message.custom_message,
                  llb_popup_msg_seen: false,
                },
                function () {},
              );
            }
          } catch (e) {}
          try {
            updateMessageBadge();
          } catch (e) {}
          try {
            showPopupCustomMessage(message.custom_message);
          } catch (e) {}
        }
      } else {
        if (licenseStatusElement) {
          licenseStatusElement.textContent = "NOT AUTHORIZED — BOT DEACTIVATED";
        }
        try {
          disableAllSettings();
        } catch (e) {}
        try {
          showDeactivatedOverlay();
        } catch (e) {}

        if (message.custom_message) {
          try {
            localStorage.setItem("last-custom-msg", message.custom_message);
          } catch (e) {}
          try {
            localStorage.setItem("llb_popup_msg_seen", "false");
          } catch (e) {}
          try {
            if (chrome && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set(
                {
                  "last-custom-msg": message.custom_message,
                  llb_popup_msg_seen: false,
                },
                function () {},
              );
            }
          } catch (e) {}
          try {
            updateMessageBadge();
          } catch (e) {}
          try {
            showPopupCustomMessage(message.custom_message);
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error("AUTH_STATUS handling error", e);
    }
  }

  // Loading settings
  if (
    message.type === "SETTINGS_UPDATED" ||
    message.type === "SETTINGS_LOADED"
  ) {
    const settings = message.settings;

    // Update toggles
    const autoReplayToggle = document.getElementById("autoReplayToggle");
    if (autoReplayToggle) autoReplayToggle.checked = settings.AUTO_REPLAY;

    const autoPlayToggle = document.getElementById("autoPlayToggle");
    if (autoPlayToggle) autoPlayToggle.checked = settings.AUTO_PLAY;

    const showHiddenLvlToggle = document.getElementById("showHiddenLvlToggle");
    if (showHiddenLvlToggle)
      showHiddenLvlToggle.checked = settings.SHOW_HIDDEN_LVL;

    const chatStatsToggle = document.getElementById("chatStatsToggle");
    if (chatStatsToggle) chatStatsToggle.checked = settings.CHAT_STATS;

    const debugModeToggle = document.getElementById("debugModeToggle");
    if (debugModeToggle) debugModeToggle.checked = settings.DEBUG_MODE;

    const playerAuraToggle = document.getElementById("playerAuraToggle");
    if (playerAuraToggle) {
      playerAuraToggle.dataset.enabled = settings.PLAYER_AURA;
      const statusElement = playerAuraToggle.querySelector(".feature-status");
      if (statusElement) {
        statusElement.textContent = settings.PLAYER_AURA
          ? "Enabled"
          : "Disabled";
      }
    }

    const playerNotesToggle = document.getElementById("playerNotesToggle");
    if (playerNotesToggle) {
      playerNotesToggle.dataset.enabled = settings.PLAYER_NOTES;
      const statusElement = playerNotesToggle.querySelector(".feature-status");
      if (statusElement) {
        statusElement.textContent = settings.PLAYER_NOTES
          ? "Enabled"
          : "Disabled";
      }
    }

    if (!settingsInitialized) {
      settingsInitialized = true;
    }
  }
}

// ============================================================================
// Navigation
// ============================================================================

/**
 * Navigate to a specific page
 * @param {string} pageName - Page name
 */
function navigateToPage(pageName) {
  // Update navigation items
  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.page === pageName);
  });

  // Update pages
  pages.forEach((page) => {
    page.classList.toggle("active", page.id === "page-" + pageName);
  });

  closeSidebar();
}

/**
 * Open sidebar
 */
function openSidebar() {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("visible");
}

/**
 * Close sidebar
 */
function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("visible");
}

// Event listeners for navigation
menuBtn.addEventListener("click", openSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    navigateToPage(item.dataset.page);
  });
});

navCards.forEach((card) => {
  card.addEventListener("click", () => {
    navigateToPage(card.dataset.page);
  });
});

// ============================================================================
// Settings management
// ============================================================================

// Auto Replay Toggle
const autoReplayToggle = document.getElementById("autoReplayToggle");
if (autoReplayToggle) {
  autoReplayToggle.addEventListener("change", function () {
    sendToPage({
      type: "SETTING_CHANGE",
      key: "AUTO_REPLAY",
      value: this.checked,
    });
  });
}

// Auto Play Toggle
const autoPlayToggle = document.getElementById("autoPlayToggle");
if (autoPlayToggle) {
  autoPlayToggle.addEventListener("change", function () {
    sendToPage({
      type: "SETTING_CHANGE",
      key: "AUTO_PLAY",
      value: this.checked,
    });
  });
}

// Show Hidden Level Toggle
const showHiddenToggle = document.getElementById("showHiddenLvlToggle");
if (showHiddenToggle) {
  showHiddenToggle.addEventListener("change", function () {
    sendToPage({
      type: "SETTING_CHANGE",
      key: "SHOW_HIDDEN_LVL",
      value: this.checked,
    });
  });
}

// Chat Stats Toggle
const chatStatsToggle = document.getElementById("chatStatsToggle");
if (chatStatsToggle) {
  chatStatsToggle.addEventListener("change", function () {
    sendToPage({
      type: "SETTING_CHANGE",
      key: "CHAT_STATS",
      value: this.checked,
    });
  });
}

// Debug Mode Toggle
const debugModeToggle = document.getElementById("debugModeToggle");
if (debugModeToggle) {
  debugModeToggle.addEventListener("change", function () {
    sendToPage({
      type: "SETTING_CHANGE",
      key: "DEBUG_MODE",
      value: this.checked,
    });
  });
}

// ============================================================================
// Roues (Gold & Rose)
// ============================================================================

// Gold Wheel Button
const goldWheelBtn = document.getElementById("goldWheelBtn");
if (goldWheelBtn) {
  goldWheelBtn.addEventListener("click", function () {
    if (this.dataset.status === "true") {
      this.classList.add("spinning");
      recentSpin = { type: "gold", time: Date.now() };
      showFooterNotification("Spinning Gold Wheel...", "pending");
      sendToPage({ type: "SPIN_GOLD_WHEEL" });

      setTimeout(() => {
        this.classList.remove("spinning");
        this.classList.add("result");
        setTimeout(() => this.classList.remove("result"), 2000);
      }, 500);
    } else {
      showFooterNotification("Gold Wheel unavailable", "error");
    }
  });
}

// Rose Wheel Button
const roseWheelBtn = document.getElementById("roseWheelBtn");
if (roseWheelBtn) {
  roseWheelBtn.addEventListener("click", function () {
    if (this.dataset.status === "true") {
      this.classList.add("spinning");
      recentSpin = { type: "rose", time: Date.now() };
      showFooterNotification("Spinning Rose Wheel...", "pending");
      sendToPage({ type: "SPIN_ROSE_WHEEL" });

      setTimeout(() => {
        this.classList.remove("spinning");
        this.classList.add("result");
        setTimeout(() => this.classList.remove("result"), 2000);
      }, 500);
    } else {
      showFooterNotification("Not enough roses", "error");
    }
  });
}

// ============================================================================
// Player Aura & Notes Toggles
// ============================================================================

// Player Aura Toggle
const playerAuraToggleBtn = document.getElementById("playerAuraToggle");
if (playerAuraToggleBtn) {
  playerAuraToggleBtn.addEventListener("click", function () {
    const isEnabled = this.dataset.enabled === "true";
    this.dataset.enabled = !isEnabled;
    const statusElement = this.querySelector(".feature-status");
    if (statusElement) {
      statusElement.textContent = !isEnabled ? "Enabled" : "Disabled";
    }
    sendToPage({ type: "TOGGLE_PLAYER_AURA", value: !isEnabled });
  });
}

// Player Notes Toggle
const playerNotesToggleBtn = document.getElementById("playerNotesToggle");
if (playerNotesToggleBtn) {
  playerNotesToggleBtn.addEventListener("click", function () {
    const isEnabled = this.dataset.enabled === "true";
    this.dataset.enabled = !isEnabled;
    const statusElement = this.querySelector(".feature-status");
    if (statusElement) {
      statusElement.textContent = !isEnabled ? "Enabled" : "Disabled";
    }
    sendToPage({ type: "TOGGLE_PLAYER_NOTES", value: !isEnabled });
  });
}

// ============================================================================
// Loot Boxes
// ============================================================================

const lootBoxBtn = document.getElementById("lootBoxBtn");
if (lootBoxBtn) {
  lootBoxBtn.addEventListener("click", function () {
    sendToPage({ type: "OPEN_LOOT_BOXES" });
  });
}

// ============================================================================
// Initialisation
// ============================================================================

// Request initial data
sendToPage({ type: "REQUEST_UI_DATA" });
sendToPage({ type: "REQUEST_SETTINGS" });

// Periodically update data
setInterval(() => {
  sendToPage({ type: "REQUEST_UI_DATA" });
}, 3000);

// ============================================================================
// Notifications
// ============================================================================

/**
 * Affiche une notification dans le footer
 * @param {string} message - Message to display
 * @param {string} [type] - Type de notification (coins, gold, error, pending)
 */
function showFooterNotification(message, type) {
  const footerNotify = document.getElementById("footerNotify");
  if (!footerNotify) return;

  footerNotify.textContent = message;
  footerNotify.className = "footer-notify";

  if (type) {
    footerNotify.classList.add("footer-" + type);
  }

  footerNotify.classList.add("visible");

  const timeout = type !== "pending" ? 4000 : 6000;
  setTimeout(() => footerNotify.classList.remove("visible"), timeout);
}

// ============================================================================
// Custom messages
// ============================================================================

/**
 * Affiche une modal avec un message personnalisé
 * @param {string} messageContent - Message content
 */
function showPopupCustomMessage(messageContent) {
  if (!messageContent) return;
  if (document.getElementById("llb-popup-custom-msg")) return;

  // Overlay
  const overlay = document.createElement("div");
  overlay.id = "llb-popup-custom-msg";
  overlay.className = "llb-modal-overlay";

  // Panel
  const panel = document.createElement("div");
  panel.className = "llb-modal-panel";

  // Titre
  const title = document.createElement("div");
  title.textContent = "Message from LoulouBot";
  title.className = "llb-modal-title";

  // Contenu
  const content = document.createElement("div");
  content.className = "llb-modal-content";

  // Parse paragraphs
  const paragraphs = messageContent.split("\n\n");
  paragraphs.forEach((paragraphText) => {
    const p = document.createElement("p");
    p.textContent = paragraphText.trim();
    p.style.margin = "8px 0";
    p.style.lineHeight = "1.5";
    p.style.fontSize = "14px";
    p.style.color = "#d7e9ff";
    p.style.textAlign = "center";
    content.appendChild(p);
  });

  // Confirmation button
  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = "I Understand";
  confirmBtn.className = "llb-modal-btn";
  confirmBtn.addEventListener("click", () => {
    try {
      localStorage.setItem("llb_popup_msg_seen", "true");
    } catch (e) {}
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ llb_popup_msg_seen: true }, function () {});
      }
    } catch (e) {}
    try {
      updateMessageBadge();
    } catch (e) {}
    overlay.remove();
  });

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "llb-modal-close";
  closeBtn.innerHTML = "✕";
  closeBtn.title = "Close";
  closeBtn.addEventListener("click", () => {
    try {
      localStorage.setItem("llb_popup_msg_seen", "true");
    } catch (e) {}
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ llb_popup_msg_seen: true }, function () {});
      }
    } catch (e) {}
    try {
      updateMessageBadge();
    } catch (e) {}
    overlay.remove();
  });

  // Assembly
  panel.appendChild(title);
  panel.appendChild(content);
  panel.appendChild(confirmBtn);
  overlay.appendChild(panel);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);
  confirmBtn.focus();
}

/**
 * Update unread messages badge
 */
function updateMessageBadge() {
  if (!messagesBadge) return;

  const lastMessage = localStorage.getItem("last-custom-msg");
  const messageSeen = localStorage.getItem("llb_popup_msg_seen");

  if (lastMessage && messageSeen !== "true") {
    messagesBadge.classList.remove("hidden");
    messagesBadge.textContent = "1";
  } else {
    messagesBadge.classList.add("hidden");
  }
}

// Listener for messages button
if (messagesBtn) {
  messagesBtn.addEventListener("click", () => {
    const lastMessage = localStorage.getItem("last-custom-msg");
    if (lastMessage) {
      showPopupCustomMessage(lastMessage);
    }
  });
}

// Synchronisation avec chrome.storage.local
if (chrome && chrome.storage && chrome.storage.local) {
  try {
    chrome.storage.local.get(
      ["last-custom-msg", "llb_popup_msg_seen"],
      (result) => {
        try {
          if (result && result["last-custom-msg"]) {
            localStorage.setItem("last-custom-msg", result["last-custom-msg"]);
          }
          if (result && result["llb_popup_msg_seen"] !== undefined) {
            localStorage.setItem(
              "llb_popup_msg_seen",
              result["llb_popup_msg_seen"] ? "true" : "false",
            );
          }
        } catch (e) {}
        try {
          updateMessageBadge();
        } catch (e) {}
      },
    );
  } catch (e) {
    try {
      updateMessageBadge();
    } catch (e2) {}
  }
} else {
  try {
    updateMessageBadge();
  } catch (e) {}
}

// ============================================================================
// Deactivation overlay
// ============================================================================

/**
 * Show deactivation overlay de licence
 */
function showDeactivatedOverlay() {
  if (document.getElementById("llb-deactivated-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "llb-deactivated-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background =
    "linear-gradient(180deg, rgba(7,10,20,0.96), rgba(2,6,12,0.96))";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = 10000;
  overlay.style.padding = "20px";

  const content = document.createElement("div");
  content.style.maxWidth = "420px";
  content.style.width = "92%";
  content.style.background = "#071026";
  content.style.border = "1px solid rgba(255,255,255,0.04)";
  content.style.borderRadius = "12px";
  content.style.padding = "26px";
  content.style.boxSizing = "border-box";
  content.style.textAlign = "center";
  content.style.color = "#ff8a8a";

  const statusIcon = document.createElement("div");
  statusIcon.textContent = "NOT AUTHORIZED";
  statusIcon.style.fontSize = "20px";
  statusIcon.style.fontWeight = "800";
  statusIcon.style.color = "#ff8a8a";
  statusIcon.style.marginBottom = "10px";

  const title = document.createElement("div");
  title.textContent = "BOT DEACTIVATED";
  title.style.fontSize = "26px";
  title.style.opacity = "0.95";
  title.style.marginBottom = "6px";

  const description = document.createElement("div");
  description.textContent =
    "Your license is inactive. The bot is disabled until a valid license is present.";
  description.style.fontSize = "14px";
  description.style.color = "#d7e9ff";
  description.style.opacity = "0.9";
  description.style.marginTop = "12px";

  content.appendChild(statusIcon);
  content.appendChild(title);
  content.appendChild(description);
  overlay.appendChild(content);
  overlay.tabIndex = -1;
  document.body.appendChild(overlay);
}

/**
 * Hide deactivation overlay
 */
function hideDeactivatedOverlay() {
  const overlay = document.getElementById("llb-deactivated-overlay");
  if (overlay) {
    overlay.remove();
  }
}

// ============================================================================
// Settings management lors de l'authentification
// ============================================================================

/**
 * Disable all settings (when license is invalid)
 */
function disableAllSettings() {
  try {
    // Save current settings
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["prev_settings"], (result) => {
        if (!result || !result.prev_settings) {
          const currentSettings = {};
          const toggles = [
            { id: "autoReplayToggle", key: "AUTO_REPLAY" },
            { id: "autoPlayToggle", key: "AUTO_PLAY" },
            { id: "showHiddenLvlToggle", key: "SHOW_HIDDEN_LVL" },
            { id: "chatStatsToggle", key: "CHAT_STATS" },
            { id: "debugModeToggle", key: "DEBUG_MODE" },
            { id: "playerAuraToggle", key: "PLAYER_AURA", special: true },
            { id: "playerNotesToggle", key: "PLAYER_NOTES", special: true },
          ];

          toggles.forEach((toggle) => {
            const element = document.getElementById(toggle.id);
            if (!element) return;

            let value = false;
            if (toggle.special) {
              value = element.dataset.enabled === "true";
            } else if (element.type === "checkbox") {
              value = !!element.checked;
            } else {
              value = element.dataset.enabled === "true";
            }
            currentSettings[toggle.key] = value;
          });

          try {
            chrome.storage.local.set(
              { prev_settings: currentSettings },
              function () {},
            );
          } catch (e) {}
        }
      });
    }
  } catch (e) {}

  // Disable all toggles
  try {
    const disableToggle = (elementId, key, isSpecial) => {
      const element = document.getElementById(elementId);
      if (!element) return;

      if (isSpecial) {
        element.dataset.enabled = "Disabled";
        const statusElement = element.querySelector(".feature-status");
        if (statusElement) statusElement.textContent = "Disabled";
        element.setAttribute("disabled", "true");
      } else if (element.type === "checkbox") {
        element.checked = false;
        element.setAttribute("disabled", "true");
      } else {
        element.dataset.enabled = "Disabled";
        element.setAttribute("disabled", "true");
      }

      try {
        sendToPage({ type: "SETTING_CHANGE", key: key, value: false });
      } catch (e) {}
    };

    disableToggle("autoReplayToggle", "AUTO_REPLAY");
    disableToggle("autoPlayToggle", "AUTO_PLAY");
    disableToggle("showHiddenLvlToggle", "SHOW_HIDDEN_LVL");
    disableToggle("chatStatsToggle", "CHAT_STATS");
    disableToggle("debugModeToggle", "DEBUG_MODE");
    disableToggle("playerAuraToggle", "PLAYER_AURA", true);
    disableToggle("playerNotesToggle", "PLAYER_NOTES", true);
  } catch (e) {}
}

/**
 * Restore settings after successful authentication
 */
function restoreSettingsOnAuth() {
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["prev_settings"], (result) => {
        const prevSettings = result && result.prev_settings;
        if (!prevSettings) return;

        const restoreToggle = (elementId, key, isSpecial) => {
          const element = document.getElementById(elementId);
          if (!element) return;

          const value = !!prevSettings[key];

          if (isSpecial) {
            element.dataset.enabled = value ? "true" : "false";
            const statusElement = element.querySelector(".feature-status");
            if (statusElement) {
              statusElement.textContent = value ? "Enabled" : "Disabled";
            }
            element.removeAttribute("disabled");
          } else if (element.type === "checkbox") {
            element.checked = value;
            element.removeAttribute("disabled");
          } else {
            element.dataset.enabled = value ? "true" : "Disabled";
            element.removeAttribute("disabled");
          }

          try {
            sendToPage({ type: "SETTING_CHANGE", key: key, value: value });
          } catch (e) {}
        };

        restoreToggle("autoReplayToggle", "AUTO_REPLAY");
        restoreToggle("autoPlayToggle", "AUTO_PLAY");
        restoreToggle("showHiddenLvlToggle", "SHOW_HIDDEN_LVL");
        restoreToggle("chatStatsToggle", "CHAT_STATS");
        restoreToggle("debugModeToggle", "DEBUG_MODE");
        restoreToggle("playerAuraToggle", "PLAYER_AURA", true);
        restoreToggle("playerNotesToggle", "PLAYER_NOTES", true);

        try {
          chrome.storage.local.remove("prev_settings", function () {});
        } catch (e) {}
      });
    }
  } catch (e) {}
}
