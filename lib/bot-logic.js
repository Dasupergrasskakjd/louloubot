/**
 * @fileoverview LoulouBot - Main bot logic for Wolvesville
 * @description This file contains the main bot logic including:
 * - Fetch and WebSocket request interception
 * - Game event handling (Socket.IO)
 * - Player aura and notes system
 * - Auto-replay and auto-play
 * - Inventory and rewards management
 * @version 0.6.9
 */

// =============================================================================
// ANTI-DEBUG AND CONSOLE PROTECTION (Disabled in deobfuscated version)
// =============================================================================

/**
 * @description Anti-debug protection configuration
 * In the original version, this blocks the console and developer tools
 */
const FORCE_BLOCK_CONSOLE = false; // Disabled for debugging

// =============================================================================
// GLOBAL VARIABLES
// =============================================================================

const START = Date.now(); // Bot start timestamp

/** @type {boolean} Current authentication state (always enabled) */
var IS_AUTHENTICATED = true;

/**
 * Update authentication state and save it
 * @param {boolean} state - New authentication state
 */
function setAuthState(state) {
  IS_AUTHENTICATED = true; // Always enabled
}

/** @type {string} Authenticated username */
var AUTH_USERNAME = "";

/** @type {string} Bot version */
var BOT_VERSION = "0.6.9";

/** @type {Object} Wolvesville authentication tokens */
var AUTHTOKENS = {
  idToken: "",
  refreshToken: "",
  "Cf-JWT": "",
};

/** @type {Object|undefined} Current player information */
var PLAYER = undefined;

/** @type {Object|undefined} Player inventory */
var INVENTORY = undefined;

/** @type {Array} Message history */
var HISTORY = [];

/** @type {Array} Players list in the game */
var PLAYERS = [];

/** @type {Object|undefined} Current player role */
var ROLE = undefined;

/** @type {string|undefined} Game state (started, over, etc.) */
var GAME_STATUS = undefined;

/** @type {number} Golden wheel spins counter */
var GOLD_WHEEL_SPINS_COUNTER = 0;

/** @type {number} Total silver earned in session via golden wheel */
var GOLD_WHEEL_SILVER_SESSION = 0;

/** @type {number} Total XP earned in session */
var TOTAL_XP_SESSION = 0;

/** @type {number} Levels gained in session */
var TOTAL_UP_LEVEL = 0;

/** @type {number} Game start timestamp */
var GAME_STARTED_AT = 0;

/**
 * @typedef {Object} LVSettings
 * @property {boolean} DEBUG_MODE - Debug mode enabled
 * @property {boolean} SHOW_HIDDEN_LVL - Show hidden levels
 * @property {boolean} AUTO_REPLAY - Auto-replay
 * @property {boolean} AUTO_PLAY - Auto-play
 * @property {boolean} CHAT_STATS - Chat statistics
 * @property {boolean} PLAYER_NOTES - Player notes
 * @property {boolean} PLAYER_AURA - Player aura (good/bad/unk)
 */

/** @type {LVSettings} Bot settings */
var LV_SETTINGS = {
  DEBUG_MODE: false,
  SHOW_HIDDEN_LVL: true,
  AUTO_REPLAY: true,
  AUTO_PLAY: true,
  CHAT_STATS: true,
  PLAYER_NOTES: true,
  PLAYER_AURA: true,
};

/** @type {string} License expiration date */
var licenseExpiry = "";

/** @type {boolean} Golden wheel available */
var goldWheelAvailable = false;

/** @type {string} Golden wheel status */
var goldWheelStatus = "Checking...";

/** @type {Map<string, string>} Map of player auras (username -> aura) */
const PLAYERAURAMAP = new Map();

/** @type {Map<string, string>} Map of player notes (username -> note) */
const PLAYERNOTESMAP = new Map();

/** @type {number|undefined} Interval for auto-replay */
var AUTO_REPLAY_INTERVAL = undefined;

/** @type {Object|undefined} Main socket for auto-play */
var SOCKET = undefined;

/** @type {Object|undefined} Regular socket for XP */
var REGULARSOCKET = undefined;

/** @type {string|undefined} Current game ID */
var GAME_ID = undefined;

/** @type {string|undefined} Game server URL */
var SERVER_URL = undefined;

/** @type {Object|undefined} Game settings */
var GAME_SETTINGS = undefined;

/** @type {number} Day counter */
let DAY_COUNT = 0;

/** @type {Array} Day votes */
let DAY_VOTING = [];

/** @type {string} Game vote */
let GAME_VOTING = "";

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Wait for player to be loaded
 * @param {number} timeout - Timeout in ms (default: 10000)
 * @returns {Promise<string|null>} Username or null
 */
const waitForPlayer = (timeout = 10000) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (PLAYER && PLAYER.username) {
        clearInterval(interval);
        resolve(PLAYER.username);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        resolve(null);
      }
    }, 100);
  });
};

/**
 * Send XP earned to background script (disabled - no external server)
 * @param {Object} data - XP data (player_id, xp_amount, username)
 * @returns {Promise<Object>} Simulated response
 */
const sendXpToBackground = (data) => {
  // XP tracking disabled - no external server
  return Promise.resolve({
    status: 200,
    data: { message: "XP tracking disabled" },
  });
};

/**
 * Conditional logger (only in debug mode)
 * @param {...any} args - Arguments to log
 */
const log = (...args) => {
  if (LV_SETTINGS.DEBUG_MODE) {
    console.log(...args);
  }
};

/**
 * Create a delay
 * @param {number} ms - Milliseconds (default: 500)
 * @returns {Promise<void>}
 */
const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));

// =============================================================================
// AUTHENTICATION (Simplified - no external server)
// =============================================================================

/**
 * Authenticate the bot (always enabled locally)
 * @returns {Promise<boolean>} Authentication success
 */
const authenticateBot = async () => {
  try {
    // Wait for player to be loaded
    let username = await waitForPlayer(8000);

    // Fallback: retrieve from localStorage
    if (!username) {
      username = localStorage.getItem("bot-username");
    } else {
      localStorage.setItem("bot-username", username);
    }

    if (!username) {
      setTimeout(() => {
        alert(
          "❌ USERNAME DETECTION FAILED\n\nFailed to automatically detect your username.",
        );
      }, 2000);
      return false;
    }

    // Wait for player ID to be available
    if (!PLAYER || !PLAYER.id) {
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!PLAYER || !PLAYER.id) {
      return false;
    }

    AUTH_USERNAME = username;

    // Bot enabled locally without server verification
    setAuthState(true);
    licenseExpiry = "Never";

    try {
      hideDeactivatedOverlay();
    } catch (e) {}

    return true;
  } catch (error) {
    setAuthState(true); // Always enabled even in case of error
    return true;
  }
};

/**
 * Re-check authentication periodically (disabled)
 * @returns {Promise<boolean>} Authentication state
 */
const recheckAuthentication = async () => {
  // Always authenticated
  return true;
};

// =============================================================================
// SETTINGS MANAGEMENT
// =============================================================================

/**
 * Save settings to localStorage
 */
const saveSetting = () => {
  let settings = {
    DEBUG_MODE: LV_SETTINGS.DEBUG_MODE,
    SHOW_HIDDEN_LVL: LV_SETTINGS.SHOW_HIDDEN_LVL,
    AUTO_REPLAY: LV_SETTINGS.AUTO_REPLAY,
    AUTO_PLAY: LV_SETTINGS.AUTO_PLAY,
    CHAT_STATS: LV_SETTINGS.CHAT_STATS,
    PLAYER_NOTES: LV_SETTINGS.PLAYER_NOTES,
    PLAYER_AURA: LV_SETTINGS.PLAYER_AURA,
  };
  localStorage.setItem("lv-settings", JSON.stringify(settings));
  console.log("⚙️ Settings saved:", settings);
};

/**
 * Load settings from localStorage
 */
const loadSettings = () => {
  const saved = localStorage.getItem("lv-settings");
  if (saved) {
    try {
      LV_SETTINGS = JSON.parse(saved);
      console.log("⚙️ Settings loaded:", LV_SETTINGS);
    } catch (e) {
      console.error("⚠️ Failed to load settings:", e);
      saveSetting();
    }
  } else {
    console.log("⚙️ No saved settings, using defaults");
    saveSetting();
  }
};

/**
 * Send settings to popup
 */
function sendSettings() {
  window.postMessage({ type: "SETTINGS_UPDATED", settings: LV_SETTINGS }, "*");
}

// =============================================================================
// TOKEN AND HEADER MANAGEMENT
// =============================================================================

/**
 * Retrieve authentication tokens from localStorage
 */
const getAuthtokens = () => {
  try {
    const tokens = JSON.parse(localStorage.getItem("authtokens"));
    if (tokens) {
      console.log("authtokens found baby");
      AUTHTOKENS.idToken = tokens.idToken || "";
      AUTHTOKENS.refreshToken = tokens.refreshToken || "";
    } else {
      console.log("authtokens not found", tokens);
    }
  } catch (e) {
    console.log("Failed to parse authtokens from localStorage", e);
  }
};

/**
 * Generate headers for Wolvesville API requests
 * @returns {Object} HTTP headers
 */
const getHeaders = () => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: "Bearer " + AUTHTOKENS.idToken,
  "Cf-JWT": "" + AUTHTOKENS["Cf-JWT"],
  ids: 1,
});

/**
 * Generate secret for wheel rewards
 * @returns {string} Calculated secret
 */
const getRewardSecret = () => {
  const playerId = PLAYER?.id;
  const silverCount = INVENTORY.silverCount;
  const xpTotal = PLAYER.xpTotal;
  const roseCount = INVENTORY.roseCount;

  log(playerId, silverCount, xpTotal, roseCount);

  return (
    "" +
    playerId.charAt(silverCount % 32) +
    playerId.charAt(xpTotal % 32) +
    new Date().getTime().toString(16) +
    playerId.charAt((silverCount + 1) % 32) +
    playerId.charAt(roseCount % 32)
  );
};

// =============================================================================
// ROLE MANAGEMENT
// =============================================================================

/**
 * Get role information by its ID
 * @param {string} roleId - Role ID
 * @returns {Object} Role information
 */
const getRole = (roleId) => {
  return JSON.parse(localStorage.getItem("roles-meta-data")).roles[roleId];
};

/**
 * Set the player's role
 * @param {string} roleId - Role ID
 */
const setRole = (roleId) => {
  ROLE = getRole(roleId);
};

// =============================================================================
// FETCH INTERCEPTION
// =============================================================================

/**
 * Map of requests to intercept with their handlers
 */
const requestsToCatch = {
  // Sign up with email/password
  "https://auth.api-wolvesville.com/players/signUpWithEmailAndPassword": (
    response,
  ) => {
    if (response?.idToken) {
      AUTHTOKENS.idToken = response?.idToken;
      AUTHTOKENS.refreshToken = response.refreshToken;
    }
  },

  // Create ID token
  "https://auth.api-wolvesville.com/players/createIdToken": (response) => {
    if (response?.idToken) {
      AUTHTOKENS.idToken = response?.idToken;
      AUTHTOKENS.refreshToken = response.refreshToken;
    }
  },

  // Cloudflare Turnstile verification
  "https://auth.api-wolvesville.com/cloudflareTurnstile/verify": (response) => {
    if (response.jwt) {
      AUTHTOKENS["Cf-JWT"] = response.jwt || "";
      console.log("🛡️ Cloudflare token intercepted");
    }
  },

  // Retrieve player info
  "https://core.api-wolvesville.com/players/meAndCheckAppVersion": (
    response,
  ) => {
    if (response.player) {
      const { username, level } = response.player;
      if (!PLAYER) {
        console.log(
          "👋 Hello " +
            username +
            ", you are level " +
            level +
            " right now, ready to gain XP?",
        );
      }
      PLAYER = response.player;
    }
  },

  // Open loot boxes
  "https://core.api-wolvesville.com/inventory/lootBoxes/": (response) => {
    if (response.items?.length) {
      let silverGained = 0;
      let itemTypes = [];

      response.items.forEach((item) => {
        itemTypes.push(item.type);
        if (item.duplicateItemCompensationInSilver) {
          silverGained += item.duplicateItemCompensationInSilver;
        } else if (item.type === "SILVER_PILE") {
          silverGained += item.silverPile.silverCount;
        }
      });

      INVENTORY.silverCount += silverGained;
      console.log(
        "🎁 You've just gained " +
          itemTypes.join(", ") +
          " and 🪙" +
          silverGained +
          " coins!",
      );
    }
  },

  // Retrieve inventory
  "https://core.api-wolvesville.com/inventory?": (response, url) => {
    if (response.silverCount) {
      INVENTORY = response;
    }

    if (response.lootBoxes !== undefined) {
      const { lootBoxes } = response;
      if (lootBoxes?.length) {
        const roleCards = lootBoxes.filter(
          (box) => box.event === "LEVEL_UP_CARD",
        ).length;
        const roleCardText = roleCards
          ? "(including " + roleCards + " role cards)"
          : "";
        console.log(
          "🎁 " + lootBoxes.length + " boxes available " + roleCardText,
        );
      }
      $(".lv-modal-loot-boxes-status").text(
        "(" + lootBoxes.length + " 🎁 available)",
      );
    }
  },

  // Check if a game is running (blocked)
  "https://game.api-wolvesville.com/api/public/game/running": (response) => {
    return new Response(JSON.stringify({ running: false }));
  },

  // Golden wheel spin (with roses)
  "https://core.api-wolvesville.com/rewards/goldenWheelSpin": (response) => {
    if (response?.length) {
      const winner = response.find((item) => item.winner);
      if (winner) {
        const reward = winner.silver > 0 ? "🪙" + winner.silver : winner.type;
        console.log(reward + " looted from 🌹 wheel");
        INVENTORY.silverCount += winner.silver;
        INVENTORY.roseCount -= 30;

        window.postMessage(
          {
            type: "UPDATE_UI",
            wheelResult: "Rose Wheel: Won " + reward,
            coins: INVENTORY.silverCount,
            roses: INVENTORY.roseCount,
          },
          "*",
        );
      }
    }
  },

  // Wheel spin with secret (free)
  "https://core.api-wolvesville.com/rewards/wheelRewardWithSecret/": (
    response,
  ) => {
    if (response.code) {
      // Error - probably limit reached
      console.log(
        "Error: You probably hit the spins limit for today " +
          JSON.stringify(response),
      );
      goldWheelAvailable = false;
      goldWheelStatus = "Unavailable";
      $(".lv-modal-gold-wheel-status")
        .text("Unavailable")
        .css({ color: "#ff603b" });
      sendUIUpdate();
    } else if (response?.length) {
      const winner = response.find((item) => item.winner);
      if (winner) {
        const reward = winner.silver > 0 ? "🪙" + winner.silver : winner.type;

        INVENTORY.silverCount += winner.silver;
        GOLD_WHEEL_SPINS_COUNTER += 1;
        GOLD_WHEEL_SILVER_SESSION += winner.silver;
        PLAYER.silverCount += winner.silver;

        console.log(
          "#" +
            GOLD_WHEEL_SPINS_COUNTER +
            ": " +
            reward +
            " looted from 🪙 wheel (session: 🪙" +
            GOLD_WHEEL_SILVER_SESSION +
            ")",
        );

        window.postMessage(
          {
            type: "UPDATE_UI",
            wheelResult: "Gold Wheel: Won " + reward,
            coins: INVENTORY.silverCount,
          },
          "*",
        );
      }
    }
  },

  // Check wheel availability
  "https://core.api-wolvesville.com/rewards/wheelItems/v2": (response) => {
    if (response.nextRewardAvailableTime) {
      goldWheelAvailable = false;
      goldWheelStatus =
        "Unavailable until " +
        new Date(response.nextRewardAvailableTime).toLocaleString();
      $(".lv-modal-gold-wheel-status")
        .text(goldWheelStatus)
        .css({ color: "#ff603b" });
    } else {
      goldWheelAvailable = true;
      goldWheelStatus = "Available";
      $(".lv-modal-gold-wheel-status")
        .text("Available")
        .css({ color: "#67c23a" });
    }
    sendUIUpdate();
  },
};

/**
 * Intercept fetch requests to capture important responses
 */
const fetchInterceptor = () => {
  const { fetch: originalFetch } = window;

  window.fetch = async (...args) => {
    const url = args[0];

    // Block certain protection requests
    if (
      url.includes("/players/webAutomatio") ||
      url.includes("/players/webBo") ||
      url.includes("about:blank")
    ) {
      return;
    }

    // Modify inventory request
    if (url.startsWith("https://core.api-wolvesville.com/inventory?")) {
      args[0] = "https://core.api-wolvesville.com/inventory?";
    }

    // Clone the request to read headers
    let requestClone;
    if (args[0] instanceof Request) {
      requestClone = args[0].clone();
    } else {
      const requestUrl = args[0];
      const requestInit = args[1] || {};
      requestClone = new Request(requestUrl, requestInit);
    }

    // Capture tokens from headers
    for (const [key, value] of requestClone.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "authorization" && value.startsWith("Bearer ")) {
        if (!AUTHTOKENS.idToken) {
          console.log("auto token found in api");
        }
        AUTHTOKENS.idToken = value.slice(7);
      }
      if (lowerKey === "cf-jwt") {
        AUTHTOKENS["Cf-JWT"] = value;
      }
    }

    // Find the handler for this URL
    const handler =
      requestsToCatch[
        Object.keys(requestsToCatch).find((key) => url.startsWith(key))
      ];

    if (handler) {
      log("fetch called with args:", args);
      const response = await originalFetch(...args);
      const result = await response
        .clone()
        .json()
        .then((data) => {
          log("intercepted response data:", data);
          return handler(data);
        });

      if (result) {
        log(result, response);
      }
      return result || response;
    } else {
      return originalFetch(...args);
    }
  };
};

// =============================================================================
// WEBSOCKET INTERCEPTION
// =============================================================================

/**
 * Intercept WebSocket messages
 * @param {Function} callback - Function called for each message
 */
function socketInterceptor(callback) {
  callback = callback || log;

  let descriptor = Object.getOwnPropertyDescriptor(
    MessageEvent.prototype,
    "data",
  );
  const originalGetter = descriptor.get;

  function newGetter() {
    let isWebSocket = this.currentTarget instanceof WebSocket;
    if (!isWebSocket) {
      return originalGetter.call(this);
    }

    let data = originalGetter.call(this);
    Object.defineProperty(this, "data", { value: data });

    callback({
      data: data,
      socket: this.currentTarget,
      event: this,
    });

    return data;
  }

  descriptor.get = newGetter;
  Object.defineProperty(MessageEvent.prototype, "data", descriptor);
}

/**
 * Handler for received WebSocket messages
 * @param {Object} event - Event containing data
 */
const onMessage = (event) => {
  const prefix = event.data.slice(0, 2);

  // Socket.IO messages start with "42"
  if (prefix === "42") {
    const parsed = messageParser(event.data);
    log(parsed);
    if (parsed?.length) {
      messageDispatcher(parsed);
    }
  }
};

/**
 * Parse a Socket.IO message
 * @param {string} raw - Raw message
 * @returns {Array|undefined} Parsed message
 */
function messageParser(raw) {
  let message = raw.slice(2);
  message = message.replaceAll('"{', "{");
  message = message.replaceAll('}"', "}");
  message = message.replaceAll('\\"', '"');

  let parsed = undefined;
  try {
    parsed = JSON.parse(message);
  } catch (e) {}

  return parsed;
}

// =============================================================================
// AUTO-PLAY SOCKET CONNECTION
// =============================================================================

/**
 * Connect a regular socket to retrieve XP
 */
const connectRegularSocket = () => {
  if (!IS_AUTHENTICATED) return;

  const socketUrl = "wss://" + SERVER_URL.replace("https://", "") + "/";

  REGULARSOCKET = _myExtensionSocketIO_(socketUrl, {
    query: {
      firebaseToken: AUTHTOKENS.idToken,
      gameId: GAME_ID,
      reconnect: true,
      ids: 1,
      "Cf-JWT": AUTHTOKENS["Cf-JWT"],
      apiV: 1,
      EIO: 4,
    },
    transports: ["websocket"],
  });

  REGULARSOCKET.on("disconnect", () => {
    console.log("🤖 Parallel socket disconnected");
    REGULARSOCKET = undefined;
  });

  REGULARSOCKET.on("game-joined", () => {
    console.log("🤖 Parallel socket connected");
  });

  // Retrieve end-game rewards
  REGULARSOCKET.on("game-over-awards-available", (data) => {
    DAY_COUNT = 0;
    DAY_VOTING = [];
    GAME_VOTING = "";

    const parsed = JSON.parse(data);

    if (parsed.playerAward.canClaimDoubleXp) {
      REGULARSOCKET.emit("game-over-double-xp");
      console.log("Claim double xp");
    } else {
      TOTAL_XP_SESSION += parsed.playerAward.awardedTotalXp;
      console.log("🧪 " + parsed.playerAward.awardedTotalXp + " xp");

      // Send XP to server
      if (PLAYER && PLAYER.id && AUTH_USERNAME) {
        const xpData = {
          player_id: PLAYER.id,
          xp_amount: parsed.playerAward.awardedTotalXp,
          username: AUTH_USERNAME,
        };
        try {
          sendXpToBackground(xpData)
            .then((r) => {})
            .catch(() => {});
        } catch (e) {}
      }

      if (parsed.playerAward.awardedLevels) {
        PLAYER.level += parsed.playerAward.awardedLevels;
        TOTAL_UP_LEVEL += parsed.playerAward.awardedLevels;
        log("🆙 " + PLAYER.level);
      }

      sendUIUpdate();

      setTimeout(() => {
        REGULARSOCKET.disconnect();
      }, 500);
    }
  });

  REGULARSOCKET.onAny((...args) => {
    // Already logged by onMessage, no need to log again
    // log(args);
  });
};

/**
 * Connect a socket for full auto-play
 * Handles automatic votes as werewolf
 */
const connectSocket = () => {
  if (!IS_AUTHENTICATED) return;

  console.log("mr socket called");

  var couplesInfo = [];
  var deadPlayers = [];
  var voteTarget = undefined;
  var hasAskedWho = false;
  var werewolvesRoles = [];
  var lastVote = undefined;

  const socketUrl = "wss://" + SERVER_URL.replace("https://", "") + "/";

  SOCKET = _myExtensionSocketIO_(socketUrl, {
    query: {
      firebaseToken: AUTHTOKENS.idToken,
      gameId: GAME_ID,
      reconnect: true,
      ids: 1,
      "Cf-JWT": AUTHTOKENS["Cf-JWT"],
      apiV: 1,
      EIO: 4,
    },
    transports: ["websocket"],
  });

  SOCKET.on("disconnect", () => {
    console.log("🤖 Parallel socket disconnected");
    SOCKET = undefined;
  });

  SOCKET.on("game-joined", () => {
    console.log("🤖 Parallel socket connected");
  });

  // Players killed
  SOCKET.on("game-players-killed", (data) => {
    const parsed = JSON.parse(data);
    parsed.victims.forEach((victim) => {
      const player = PLAYERS.find((p) => p?.id === victim.targetPlayerId);
      if (player) {
        deadPlayers.push(player?.id);
        console.log(
          "☠️ " +
            (parseInt(player.gridIdx) + 1) +
            ". " +
            player.username +
            " (" +
            victim.targetPlayerRole +
            ") by " +
            victim.cause,
        );
      } else {
        console.error("dead player not found");
      }
    });
  });

  // Cupid lovers
  SOCKET.on("game-cupid-lover-ids-and-roles", (data) => {
    const parsed = JSON.parse(data);

    if (!PLAYER) getPLAYER();

    if (PLAYER && ROLE) {
      // Filter to not include current player
      const otherLovers = parsed.loverPlayerIds.filter(
        (id) => id !== PLAYER?.id,
      );
      const otherRoles = parsed.loverRoles.filter((id) => id !== ROLE?.id);

      couplesInfo = otherLovers.map((id, idx) => ({
        id: id,
        role: otherRoles[idx],
      }));

      if (couplesInfo?.length === 1) {
        const lover = PLAYERS.find((p) => p?.id === couplesInfo[0]?.id);
        console.log(
          "💘 Your lover is " +
            (lover.gridIdx + 1) +
            ". " +
            lover.username +
            " (" +
            couplesInfo[0].role +
            ")",
        );
      } else if (couplesInfo?.length === 2) {
        const lover1 = PLAYERS.find((p) => p?.id === couplesInfo[0]?.id);
        const lover2 = PLAYERS.find((p) => p?.id === couplesInfo[1]?.id);
        console.log(
          "💘 Your lovers are " +
            (lover1.gridIdx + 1) +
            ". " +
            lover1.username +
            " (" +
            couplesInfo[0].role +
            ") and " +
            (lover2.gridIdx + 1) +
            ". " +
            lover2.username +
            " (" +
            couplesInfo[1].role +
            ")",
        );
      } else {
        console.error("Couple not found ", parsed);
      }
    } else {
      console.error("PLAYER or ROLE not found", PLAYER, ROLE);
    }
  });

  // Night started - vote as wolf
  SOCKET.on("game-night-started", () => {
    setTimeout(() => {
      if (ROLE && ROLE.team === "WEREWOLF") {
        // Find a non-wolf to vote for
        const nonWolf = couplesInfo.find(
          (c) => getRole(c.role).team !== "WEREWOLF",
        );
        if (nonWolf) {
          const target = PLAYERS.find((p) => p?.id === nonWolf?.id);
          if (target) {
            console.log(
              "👉 Vote " + (target.gridIdx + 1) + ". " + target.username,
            );
          }
          lastVote = nonWolf?.id;
          SOCKET.emit(
            "game-werewolves-vote-set",
            JSON.stringify({ targetPlayerId: nonWolf?.id }),
          );
        }
      }
    }, 1000);
  });

  // Werewolves roles update
  SOCKET.on("game-werewolves-set-roles", (data) => {
    const parsed = JSON.parse(data);
    werewolvesRoles = Object.entries(parsed.werewolves).map(([id, role]) => ({
      id,
      role,
    }));

    // Junior werewolf asks "Who?"
    if (
      !hasAskedWho &&
      couplesInfo?.length &&
      werewolvesRoles?.length &&
      ROLE.team === "WEREWOLF" &&
      ROLE?.id === "junior-werewolf" &&
      couplesInfo.find((c) => getRole(c.role).team !== "WEREWOLF")
    ) {
      hasAskedWho = true;
      setTimeout(() => {
        SOCKET.emit(
          "game:chat-werewolves:msg",
          JSON.stringify({ msg: "Who?" }),
        );
      }, 2000);
    }
  });

  // Werewolves chat
  SOCKET.on("game:chat-werewolves:msg", (data) => {
    const parsed = JSON.parse(data);

    // Reply to "who?" if we are a wolf
    if (
      ROLE &&
      ROLE.team === "WEREWOLF" &&
      parsed.authorId !== PLAYER?.id &&
      parsed.msg &&
      parsed.msg.toLowerCase().includes("who")
    ) {
      const target = PLAYERS.find((p) => p?.id === couplesInfo[0]?.id);
      if (target) {
        setTimeout(() => {
          SOCKET.emit(
            "game:chat-werewolves:msg",
            JSON.stringify({ msg: "" + (target.gridIdx + 1) }),
          );
        }, 1000);
      }
    }

    // Junior werewolf follows the mentioned number
    if (
      ROLE &&
      ROLE?.id === "junior-werewolf" &&
      parsed.msg &&
      parsed.authorId !== PLAYER?.id
    ) {
      const numbers = parsed.msg.match(/\d+/);
      if (numbers && numbers?.length) {
        const gridNum = parseInt(numbers[0]);
        const target = PLAYERS.find((p) => p.gridIdx + 1 === gridNum);
        if (target) {
          voteTarget = target.id;
          console.log(
            "🐾 Select " + (target.gridIdx + 1) + ". " + target.username,
          );
          SOCKET.emit(
            "game-junior-werewolf-selected-player",
            JSON.stringify({ targetPlayerId: target.id }),
          );
        }
      }
    }
  });

  // Werewolves vote
  SOCKET.on("game-werewolves-vote-set", (data) => {
    const parsed = JSON.parse(data);

    if (parsed.playerId === PLAYER?.ID) return;

    // Junior werewolf follows the vote
    if (
      !voteTarget &&
      ROLE &&
      ROLE?.id === "junior-werewolf" &&
      parsed.playerId !== PLAYER?.id
    ) {
      voteTarget = parsed.targetPlayerId;
      const target = PLAYERS.find((p) => p?.id === parsed.targetPlayerId);
      if (target) {
        console.log(
          "🐾 Select " + (target.gridIdx + 1) + ". " + target.username,
        );
      }
      SOCKET.emit(
        "game-junior-werewolf-selected-player",
        JSON.stringify({ targetPlayerId: parsed.targetPlayerId }),
      );
    }

    // Follow junior werewolf vote
    if (
      ROLE &&
      ROLE?.id !== "junior-werewolf" &&
      werewolvesRoles.find(
        (w) => w.role === "junior-werewolf" && w?.id === parsed.playerId,
      )
    ) {
      const target = PLAYERS.find((p) => p?.id === parsed.targetPlayerId);
      setTimeout(() => {
        if (target) {
          console.log(
            "👉 Vote " + (target.gridIdx + 1) + ". " + target.username,
          );
        }
        if (lastVote !== parsed.targetPlayerId) {
          lastVote = parsed.targetPlayerId;
          SOCKET.emit(
            "game-werewolves-vote-set",
            JSON.stringify({ targetPlayerId: parsed.targetPlayerId }),
          );
        }
      }, 1000);
    } else if (
      ROLE &&
      ROLE?.id !== "junior-werewolf" &&
      !werewolvesRoles.find(
        (w) => w.role === "junior-werewolf" && w?.id === parsed.playerId,
      ) &&
      couplesInfo.find((c) =>
        ["priest", "vigilante", "gunner"].includes(c.role),
      )
    ) {
      // Inform about lover with special role
      const target = PLAYERS.find((p) => p?.id === parsed.targetPlayerId);
      const lover = couplesInfo.find((c) => ["priest", "vigilante", "gunner"].includes(c.role));
      const lover_player = PLAYERS.find((p) => p?.id === lover.id);
      setTimeout(() => {
        if (target) {
          console.log(
            "👉 Vote " + (target.gridIdx + 1) + ". " + target.username,
          );
          SOCKET.emit(
            "game:chat-werewolves:msg",
            JSON.stringify({
              msg: lover_player.gridIdx + 1 + " is " + lover.role,
            }),
          );
        }
        if (lastVote !== parsed.targetPlayerId) {
          lastVote = parsed.targetPlayerId;
          SOCKET.emit(
            "game-werewolves-vote-set",
            JSON.stringify({ targetPlayerId: parsed.targetPlayerId }),
          );
        }
      }, 1000);
    }
  });

  // Day vote
  SOCKET.on("game-day-voting-started", () => {
    if (!PLAYER) getPLAYER();

    if (PLAYER && !deadPlayers.includes(PLAYER?.id)) {
      // Find a wolf among lovers
      const wolf = couplesInfo.find((c) => getRole(c.role).team === "WEREWOLF");

      if (wolf) {
        if (ROLE && ROLE.team === "WEREWOLF") {
          SOCKET.emit("game:chat-public:msg", JSON.stringify({ msg: "wc" }));
        }

        const target = PLAYERS.find((p) => p?.id === wolf?.id);
        if (target) {
          console.log(
            "👉 Vote " + (target.gridIdx + 1) + ". " + target.username,
          );
        }
        SOCKET.emit(
          "game-day-vote-set",
          JSON.stringify({ targetPlayerId: wolf?.id }),
        );
      } else {
        // Vote for oneself or say "solo"
        if (ROLE && ROLE.team === "WEREWOLF") {
          SOCKET.emit("game:chat-public:msg", JSON.stringify({ msg: "me" }));
        } else if (
          ROLE &&
          [
            "serial-killer",
            "arsonist",
            "corruptor",
            "bandit",
            "cannibal",
            "evil-detective",
            "bomber",
            "alchemist",
            "illusionist",
            "zombie",
            "blight",
            "sect-leader",
            "siren",
          ].includes(ROLE.id)
        ) {
          SOCKET.emit("game:chat-public:msg", JSON.stringify({ msg: "solo" }));
        }
      }
    }
  });

  // React to messages "me" or "wc" in chat
  SOCKET.on("game:chat-public:msg", (data) => {
    const parsed = JSON.parse(data);

    if (!PLAYER) getPLAYER();

    if (
      PLAYER &&
      !deadPlayers.includes(PLAYER?.id) &&
      parsed.authorId !== PLAYER?.id &&
      parsed.msg &&
      ROLE &&
      ROLE.team === "VILLAGER" &&
      ["Me", "me", "ME", "m", "M", "wc", "Wc", "WC"].includes(parsed.msg)
    ) {
      const voter = PLAYERS.find((p) => p?.id === parsed.authorId);
      if (voter) {
        SOCKET.emit(
          "game-day-vote-set",
          JSON.stringify({ targetPlayerId: voter.id }),
        );
        console.log("👉 Vote " + (voter.gridIdx + 1) + ". " + voter.username);
      }
    }
  });

  // Follow day votes
  SOCKET.on("game-day-vote-set", (data) => {
    const parsed = JSON.parse(data);

    if (!PLAYER) getPLAYER();

    if (PLAYER && !deadPlayers.includes(PLAYER?.id)) {
      const target = PLAYERS.find((p) => p?.id === parsed.targetPlayerId);

      DAY_VOTING.push(PLAYER.id);
      DAY_VOTING.push(target.id);

      // Priest kills
      if (ROLE && ROLE?.id === "priest") {
        setTimeout(() => {
          if (target) {
            console.log(
              "💦 Kill " + (target.gridIdx + 1) + ". " + target.username,
            );
          }
          SOCKET.emit(
            "game-priest-kill-player",
            JSON.stringify({ targetPlayerId: parsed.targetPlayerId }),
          );
        }, 1000);
      }
      // Vigilante shoots
      else if (ROLE && ROLE.id === "vigilante") {
        setTimeout(() => {
          if (target) {
            console.log(
              "🔫 Kill " + (target.gridIdx + 1) + ". " + target.username,
            );
          }
          SOCKET.emit(
            "game-vigilante-shoot",
            JSON.stringify({ targetPlayerId: parsed.targetPlayerId }),
          );
        }, 1000);
      }
      // Gunner shoots
      else if (ROLE && ROLE?.id === "gunner") {
        setTimeout(() => {
          if (target) {
            console.log(
              "🔫 Kill " + (target.gridIdx + 1) + ". " + target.username,
            );
          }
          SOCKET.emit(
            "game-gunner-shoot-player",
            JSON.stringify({ targetPlayerId: parsed.targetPlayerId }),
          );
        }, 1000);
      }
    }
  });

  // Players status
  SOCKET.on("game-reconnect-set-players", (data) => {
    const parsed = JSON.parse(data);
    Object.values(parsed).forEach((player) => {
      if (!player.isAlive) {
        deadPlayers.push(player.id);
      }
    });
  });

  // End-game rewards
  SOCKET.on("game-over-awards-available", (data) => {
    const parsed = JSON.parse(data);

    if (parsed.playerAward.canClaimDoubleXp) {
      SOCKET.emit("game-over-double-xp");
      console.log("Claim double xp");
    } else {
      TOTAL_XP_SESSION += parsed.playerAward.awardedTotalXp;
      console.log("🧪 " + parsed.playerAward.awardedTotalXp + " xp gained.");

      if (PLAYER && PLAYER.id && AUTH_USERNAME) {
        const xpData = {
          player_id: PLAYER.id,
          xp_amount: parsed.playerAward.awardedTotalXp,
          username: AUTH_USERNAME,
        };
        try {
          sendXpToBackground(xpData)
            .then((r) => {})
            .catch(() => {});
        } catch (e) {}
      }

      if (parsed.playerAward.awardedLevels) {
        PLAYER.level += parsed.playerAward.awardedLevels;
        TOTAL_UP_LEVEL += parsed.playerAward.awardedLevels;
        log("🆙 " + PLAYER.level);
      }

      sendUIUpdate();

      setTimeout(() => {
        SOCKET.disconnect();
      }, 500);
    }
  });

  SOCKET.onAny((...args) => {
    // Already logged by onMessage, no need to log again
    // log(args);
  });
};

// =============================================================================
// WEBSOCKET MESSAGE HANDLER
// =============================================================================

/**
 * Map of game events to handle
 */
const messagesToCatch = {
  // Game joined
  "game-joined": (data) => {
    if (SOCKET || REGULARSOCKET) return;

    console.log("🔗 Game joined");
    const values = Object.values(data);
    GAME_ID = values[0];
    SERVER_URL = values[1];
    setTimeout(setPlayersLevel, 1000);
  },

  // Game settings changed
  "game-settings-changed": (data) => {
    GAME_SETTINGS = data;
  },

  // Game starting soon
  "game-starting": () => {
    if (SOCKET || REGULARSOCKET) return;
    console.log("🚩 Game starting in 5 seconds...");
  },

  // Game started
  "game-started": (data) => {
    if (SOCKET || REGULARSOCKET) return;

    console.log("🚀 Game started");
    GAME_STATUS = "started";
    GAME_STARTED_AT = new Date().getTime();

    setRole(data.role);
    console.log("You are " + ROLE.name + " (" + ROLE?.id + ")");

    PLAYERS = data.players;
    setTimeout(setPlayersLevel, 1000);
    setTimeout(handlePlayerAura, 20000);
    setTimeout(handlePlayerNotes, 20000);

    setTimeout(() => {
      // Connect socket for custom all-coupled
      if (
        !SOCKET &&
        LV_SETTINGS.AUTO_PLAY &&
        GAME_SETTINGS.gameMode === "custom" &&
        GAME_SETTINGS.allCoupled &&
        GAME_ID &&
        SERVER_URL
      ) {
        connectSocket();
      }

      // Connect regular socket for other modes
      if (
        !REGULARSOCKET &&
        !(GAME_SETTINGS.gameMode === "custom") &&
        GAME_ID &&
        SERVER_URL
      ) {
        connectRegularSocket();
      }
    }, 1000);
  },

  "game-select-advanced-role": (data) => {
    setRole(data.role);
    console.log("Auto selected " + ROLE.name + " (" + ROLE?.id + ")");
  },

  // Player joined (ignored)
  "player-joined-and-equipped-items": (data) => {},

  // Game status (ignored)
  "game-set-game-status": (data) => {},

  // Reconnection
  "game-reconnect-set-game-status": (data) => {
    setTimeout(() => {
      if (
        !SOCKET &&
        LV_SETTINGS.AUTO_PLAY &&
        GAME_SETTINGS.gameMode === "custom" &&
        GAME_SETTINGS.allCoupled &&
        GAME_ID &&
        SERVER_URL
      ) {
        connectSocket();
      }
      if (
        !REGULARSOCKET &&
        !(GAME_SETTINGS.gameMode === "custom") &&
        GAME_ID &&
        SERVER_URL
      ) {
        connectRegularSocket();
      }
    }, 1000);
  },

  // Players list
  "players-and-equipped-items": (data) => {
    if (GAME_STATUS === "started") {
      PLAYERS = data.players;
      setTimeout(setPlayersLevel, 1000);
      setTimeout(handlePlayerAura, 1000);
      setTimeout(handlePlayerNotes, 1000);
    }
  },

  // Reconnectio regular socket for other
  "game-reconnect-set-players": (data) => {
    if (SOCKET || REGULARSOCKET) return;

    PLAYERS = Object.values(data);
    setTimeout(setPlayersLevel, 1000);
    setTimeout(handlePlayerAura, 1000);
    setTimeout(handlePlayerNotes, 1000);

    if (PLAYER) {
      const me = PLAYERS.find((p) => p.username === PLAYER.username);
      if (me) {
        if (me.spectate) {
          console.log("You are Spectator");
        } else {
          setRole(me.role);
          console.log("You are " + ROLE.name + " (" + ROLE?.id + ")");
        }
      }
    }
  },

  // Night started
  "game-night-started": () => {
    const me = PLAYERS.find((p) => p?.id === PLAYER?.id);
    setTimeout(setPlayersLevel, 1000);
  },

  // Players killed
  "game-players-killed": (data) => {
    if (SOCKET || REGULARSOCKET) return;

    data.victims.forEach((victim) => {
      const player = PLAYERS.find((p) => p?.id === victim.targetPlayerId);
      if (player) {
        console.log(
          "☠️ " +
            (parseInt(player.gridIdx) + 1) +
            ". " +
            player.username +
            " (" +
            victim.targetPlayerRole +
            ") by " +
            victim.cause,
        );
      }
    });
  },

  // Game over
  "game-game-over": () => {
    if (GAME_STATUS === "over") return;

    GAME_STATUS = "over";
    let message = "🏁 Game over";

    if (GAME_STARTED_AT) {
      const duration = new Date().getTime() - GAME_STARTED_AT;
      message += " (" + (duration / 1000).toFixed(0) + "s)";
      GAME_STARTED_AT = 0;
    }

    console.log(message);
  },

  // Rewards available
  "game-over-awards-available": (data) => {
    if (SOCKET || REGULARSOCKET) return;

    TOTAL_XP_SESSION += data.playerAward.awardedTotalXp;
    console.log("🧪 " + data.playerAward.awardedTotalXp + " xp");

    clearChat();

    if (data.playerAward.awardedLevels) {
      PLAYER.level += data.playerAward.awardedLevels;
      TOTAL_UP_LEVEL += data.playerAward.awardedLevels;
      console.log("🆙 " + PLAYER.level);
    }
  },

  // Disconnection
  disconnect: () => {
    ROLE = undefined;
    PLAYERS = [];
    GAME_ID = undefined;
    SERVER_URL = undefined;
    GAME_SETTINGS = undefined;

    setTimeout(() => {
      if (SOCKET) SOCKET.disconnect();
      if (REGULARSOCKET) REGULARSOCKET.disconnect();
    }, 1000);
  },
};

/**
 * Dispatch messages to appropriate handlers
 * @param {Array} message - Parsed message [eventName, data]
 */
const messageDispatcher = (message) => {
  const eventName = message[0];
  const data = message.length > 1 ? message[1] : null;
  const handler = messagesToCatch[eventName];

  if (handler) {
    handler(data);
  }
};

// =============================================================================
// LEVEL DISPLAY
// =============================================================================

/**
 * Display player levels in the UI
 */
function setPlayersLevel() {
  if (!LV_SETTINGS.SHOW_HIDDEN_LVL) return;

  PLAYERS.forEach((player) => {
    const searchText = parseInt(player.gridIdx) + 1 + " " + player.username;
    const elements = $('div:contains("' + searchText + '")');
    const gridNum = parseInt(player.gridIdx) + 1;
    const username = player.username;
    const level = player.level;

    let clanTag = "";
    if (player.clanTag) {
      clanTag = "" + player.clanTag;
    }

    let displayText = gridNum + " " + username + " [" + level + "] " + clanTag;

    if (elements?.length) {
      elements[elements.length - 1].innerHTML = displayText;
      elements[elements.length - 1].className = "lv-username";
      elements[elements.length - 1].parentElement.className = "lv-username-box";
    }
  });
}

// =============================================================================
// PLAYER AURA
// =============================================================================

/**
 * Add aura dropdowns for each player
 */
const addPlayerAura = () => {
  PLAYERS.forEach((player) => {
    const searchText = parseInt(player.gridIdx) + 1 + " " + player.username;
    const elements = $('div:contains("' + searchText + '")');
    const username = player.username;

    if (elements?.length && username) {
      const dropdown = $("<select></select>")
        .addClass("player-status-dropdown")
        .css({
          width: "40px",
          height: "20px",
          padding: "0px",
          marginLeft: "4px",
          marginRight: "4px",
          border: "none",
          appearance: "none",
          zIndex: "10000",
        });

      const options = ["none", "good", "bad", "unk"];
      options.forEach((opt) => {
        dropdown.append(
          $("<option></option>")
            .val(opt)
            .text(opt.charAt(0).toUpperCase() + opt.slice(1)),
        );
      });

      dropdown.on("click mousedown focus", function (e) {
        e.stopPropagation();
      });

      const container = $(
        elements[elements.length - 1].parentElement.parentElement.parentElement,
      );

      if (container.find("select.player-status-dropdown").length === 0) {
        $(
          elements[elements.length - 1].parentElement.parentElement
            .parentElement,
        ).append(dropdown);

        dropdown.on("change", function () {
          const value = dropdown.val();
          let color = "white";

          if (value === "good") {
            color = "green";
          } else if (value === "bad") {
            color = "red";
          } else if (value === "unk") {
            color = "yellow";
          }

          $(this).css("background-color", color);
          PLAYERAURAMAP.set(username, value);
        });
      }
    }
  });
};

/**
 * Remove aura dropdowns
 */
const removePlayerAura = () => {
  $("select.player-status-dropdown").remove();
};

/**
 * Handle aura display according to settings
 */
const handlePlayerAura = () => {
  if (LV_SETTINGS.PLAYER_AURA) {
    console.log(" 🍂 Adding player aura");
    PLAYERAURAMAP.clear();
    addPlayerAura();
  } else {
    removePlayerAura();
  }
};

/**
 * Update all player auras
 */
function updateAllPlayerAura() {
  PLAYERS.forEach((player) => {
    const searchText = parseInt(player.gridIdx) + 1 + " " + player.username;
    const elements = $('div:contains("' + searchText + '")');

    if (elements?.length) {
      const container = $(
        elements[elements.length - 1].parentElement.parentElement,
      );
      const dropdown = container.find("select.player-status-dropdown");
      const username = player.username;

      if (PLAYERAURAMAP.has(username)) {
        const aura = PLAYERAURAMAP.get(username);
        dropdown.val(aura);
      } else {
        dropdown.val("none");
      }
    }
  });
}

// =============================================================================
// PLAYER NOTES
// =============================================================================

/**
 * Add notes fields for each player
 */
const addPlayerNotes = () => {
  PLAYERS.forEach((player) => {
    const searchText = parseInt(player.gridIdx) + 1 + " " + player.username;
    const elements = $('div:contains("' + searchText + '")');
    const username = player.username;

    if (elements?.length && username) {
      const container = $(
        elements[elements.length - 1].parentElement.parentElement.parentElement,
      );

      if (container.find("input.player-status-note")?.length === 0) {
        const input = $('<input type="text" />')
          .addClass("player-status-note")
          .css({
            display: "block",
            width: "60px",
            height: "20px",
            fontSize: "14px",
            marginBottom: "2px",
            marginLeft: "4px",
            zIndex: "10000",
            position: "relative",
            pointerEvents: "auto",
          });

        input.on("click mousedown focus", function (e) {
          e.stopPropagation();
        });

        input.on("focus", function () {
          $("textarea").prop("disabled", true);
        });

        input.on("blur", function () {
          $("textarea").prop("disabled", false);
        });

        input.on("input", function () {
          const value = input.val();
          PLAYERNOTESMAP.set(username, value);
        });

        container.append(input);
      }
    }
  });
};

/**
 * Remove notes fields
 */
const removePlayerNotes = () => {
  $("input.player-status-note").remove();
};

/**
 * Update player notes
 */
const updatePlayerNotes = () => {
  PLAYERS.forEach((player) => {
    const username = player.username;
    const searchText = parseInt(player.gridIdx) + 1 + " " + username;
    const elements = $('div:contains("' + searchText + '")');

    if (elements?.length && username) {
      const container = $(
        elements[elements.length - 1].parentElement.parentElement.parentElement,
      );
      const input = container.find("input.player-status-note");

      if (input?.length > 0 && PLAYERNOTESMAP.has(username)) {
        const note = PLAYERNOTESMAP.get(username);
        input.val(note);
      }
    }
  });
};

/**
 * Handle notes display according to settings
 */
const handlePlayerNotes = () => {
  if (LV_SETTINGS.PLAYER_NOTES) {
    console.log(" 🍂 Adding player notes");
    PLAYERNOTESMAP.clear();
    addPlayerNotes();
  } else {
    removePlayerNotes();
  }
};

// =============================================================================
// CHAT HIDING
// =============================================================================

/**
 * Hide chat messages except from a specific player
 * @param {string} playerNum - Player number to keep visible
 */
const playerChatHiding = (playerNum) => {
  const dayElements = $('div:contains("Day ")');
  const firstDay = dayElements.last()[0];

  let className = "";
  if (firstDay && firstDay.className) {
    const classes = firstDay.className.trim().split(/\s+/);
    className = classes[classes.length - 1];
  }

  if (className) {
    $("span." + className).each(function () {
      const text = $(this).text().trim();
      const firstWord = text.split(" ")[0];

      if (/^\d/.test(firstWord) && firstWord !== playerNum.toString()) {
        const parent = $(this).closest("div");
        parent.hide();
      }
    });
  }
};

/**
 * Undo chat hiding
 */
const undoChatHiding = () => {
  const dayElements = $('div:contains("Day ")');
  const firstDay = dayElements.last()[0];

  let className = "";
  if (firstDay && firstDay.className) {
    const classes = firstDay.className.trim().split(/\s+/);
    className = classes[classes.length - 1];
  }

  if (className) {
    $("span." + className).each(function () {
      const parent = $(this).closest("div");
      parent.show();
    });
  }
};

/**
 * Hide messages not mentioning a player
 * @param {string} mentionText - Mention text to search for
 */
const playerChatHidingMention = (mentionText) => {
  const dayElements = $('div:contains("Day ")');
  const firstDay = dayElements.last()[0];

  let className = "";
  if (firstDay && firstDay.className) {
    const classes = firstDay.className.trim().split(/\s+/);
    className = classes[classes.length - 1];
  }

  if (className) {
    $("span." + className).each(function () {
      const parent = $(this).closest("div");
      const fullText = parent.text();
      const spanText = parent.find("span." + className).text();
      const messageText = fullText.replace(spanText, "");

      const regex = new RegExp("\\b" + mentionText + "\\b");
      if (!regex.test(messageText)) {
        parent.hide();
      }
    });
  }
};

/**
 * Undo mention hiding
 */
const undoChatHidingMention = () => {
  const dayElements = $('div:contains("Day ")');
  const firstDay = dayElements.last()[0];

  let className = "";
  if (firstDay && firstDay.className) {
    const classes = firstDay.className.trim().split(/\s+/);
    className = classes[classes.length - 1];
  }

  if (className) {
    $("span." + className).each(function () {
      const parent = $(this).closest("div");
      parent.show();
    });
  }
};

// =============================================================================
// AUTO-REPLAY
// =============================================================================

/**
 * Handle auto-replay
 */
const handleAutoReplay = () => {
  // Clean up existing interval
  if (AUTO_REPLAY_INTERVAL) {
    clearInterval(AUTO_REPLAY_INTERVAL);
    AUTO_REPLAY_INTERVAL = undefined;
  }

  if (!LV_SETTINGS.AUTO_REPLAY) {
    return;
  }

  /**
   * Simulate a click on an element
   * @param {Element} element - Element to click
   */
  function simulateClick(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    window.postMessage({ type: "FROM_PAGE_CLICK", x: x, y: y }, "*");
  }


  const findLastDivContaining = (text, filterFn = null) => {
    let divs = $(`div:contains("${text}")`);
    if (filterFn) divs = divs.filter(filterFn);
    return divs.length ? divs[divs.length - 1] : null;
  };

  // Talisman or password required lobbies
  const blacklistLobbies = ["koawer", "daffodiI", "DyTan21", "Neptunoo", "Dek", "XXIIIXII"];

  let running = false;

  AUTO_REPLAY_INTERVAL = setInterval( async () => {
    if (!LV_SETTINGS.AUTO_REPLAY) {
      return;
    }

    if (running) return;
    running = true;

    // Join unblacklisted lobby
    const lobby = findLastDivContaining("VILL WIN",  function () {
      return !blacklistLobbies.includes(this.nextElementSibling?.innerHTML) &&
        this.nextElementSibling?.innerHTML &&
       !this.innerText.includes("\n") &&
       !this.innerText.toLowerCase().includes("bqt")
    });
    if (lobby) {
      const host = lobby.nextElementSibling?.innerHTML;
      simulateClick(lobby);
      console.log("Joining " + host + "'s lobby");
      await delay();
    }
    else {
      const refreshButton = findLastDivContaining("REFRESH");
      if (refreshButton) {
        simulateClick(refreshButton);
      }
    }

    // Click on "Join"
    const joinButton = findLastDivContaining("Join");
    if (joinButton) {
      simulateClick(joinButton);
    }

    // Click on "Continue"
    const continueButton = findLastDivContaining("Continue");
    if (continueButton) {
      simulateClick(continueButton);
      homeTimeout = setTimeout(() => {
        const char = String.fromCharCode(61461);
        const homeButton = findLastDivContaining(char);
        if (homeButton) {
          simulateClick(homeButton);
        }
      }, 10000);
    }

    // Click on "Play again"
    const playAgainButtons = findLastDivContaining("Play again");
    if (playAgainButtons) {
      simulateClick(playAgainButtons);

      setTimeout(() => {
        const okButton = findLastDivContaining("OK");
        if (okButton) {
          simulateClick(okButton[okButton.length - 1]);
        }
      }, 500);
    }

    // Click on "Play"
    const playButton = findLastDivContaining("PLAY", function () {
      return !this.innerText.includes("PLAY WITH FRIENDS");
    });
    if (playButton && (Date.now() - START > 10000)) {
      simulateClick(playButton);
    }

    // Click on "Custom Games"
    const customGameButton = findLastDivContaining("CUSTOM GAMES");
    if (customGameButton) {
      simulateClick(customGameButton);
    }
    running = false;
  }, 1000);
};

// =============================================================================
// LOOT BOXES
// =============================================================================

/**
 * Automatically open loot boxes
 * @param {number} count - Opening counter (for rate limiting)
 */
const lootBox = async (count = 0) => {
  // Pause after 40 openings (rate limit)
  if (count === 40) {
    console.log("⏳ wait 1 min before opening again");
    await delay(1000 * 60 * 1);
    count = 0;
  }

  await fetch(
    "https://core.api-wolvesville.com/inventory/lootBoxes/" +
      INVENTORY.lootBoxes[0].id,
    { method: "PUT", headers: getHeaders() },
  ).then((response) => {
    if (response.status === 200) {
      INVENTORY.lootBoxes.shift();
      $(".lv-modal-loot-boxes-status").text(
        "(" + INVENTORY.lootBoxes.length + " 🎁 available)",
      );

      if (INVENTORY.lootBoxes?.length) {
        return lootBox(count + 1);
      }
    }
  });
};

// =============================================================================
// UI AND OVERLAYS
// =============================================================================

/**
 * Send UI update to popup
 */
function sendUIUpdate() {
  window.postMessage(
    {
      type: "UPDATE_UI",
      username: PLAYER?.username || AUTH_USERNAME,
      level: PLAYER?.level,
      licenseExpiry: licenseExpiry,
      authStatus: IS_AUTHENTICATED ? "authorized" : "unauthorized",
      coins: INVENTORY?.silverCount || 0,
      roses: INVENTORY?.roseCount || 0,
      sessionXP: TOTAL_XP_SESSION,
      lootBoxCount: INVENTORY?.lootBoxes?.length || 0,
      goldWheelAvailable: goldWheelAvailable,
      goldWheelStatus: goldWheelStatus,
    },
    "*",
  );
}

/**
 * Show bot deactivation overlay (disabled - bot always active)
 */
function showDeactivatedOverlay() {
  // Does nothing - bot always active
}

/**
 * Hide deactivation overlay (disabled - bot always active)
 */
function hideDeactivatedOverlay() {
  // Does nothing - bot always active
}

/**
 * Show custom message (disabled - no server messages)
 * @param {string} message - Message to display
 */
function showCustomMessageModal(message) {
  // Does nothing - no server messages
}

/**
 * Clear chat
 */
function clearChat() {
  $(".lv-chat-container").empty();
  HISTORY.length = 0;
  log("[LoulouBot] Chat cleared.");
}

/**
 * Format a date/time
 * @param {Date} date - Date to format
 * @returns {string} Formatted time HH:MM:SS.mmm
 */
function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  const ms = date.getMilliseconds().toString().padStart(3, "0");

  return hours + ":" + minutes + ":" + seconds + "." + ms;
}

// =============================================================================
// MISCELLANEOUS UTILITIES
// =============================================================================

/**
 * Retrieve player information via API
 */
const getPLAYER = () => {
  log("getPLAYER called");
  fetch("https://core.api-wolvesville.com/players/meAndCheckAppVersion", {
    method: "PUT",
    headers: getHeaders(),
    // Needed otherwise it returns empty response
    body: JSON.stringify({"versionNumber":1, "platform":"web", "deviceId":null}),
  });
};

/**
 * Inject CSS styles
 */
const injectStyles = () => {
  const styles = `
    <style>
    .lv-username {
      color: #ffffff; /* White text */
      font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-weight: 500;
    }
    .lv-username-box {
      background-color: #000000; /* Black background */
      padding: 2px 8px 4px 8px;
      border-radius: 8px;
    }
    </style>
  `;
  $("html").append(styles);
};

/**
 * Remove Wolvesville protections
 */
const removeWovProtections = () => {
  const startButtons = $('div:contains("START GAME")');
  const okButtons = $('div:contains("OK")');
  const inventoryButtons = $('div:contains("INVENTORY")');

  if (startButtons?.length && okButtons?.length && inventoryButtons?.length) {
    startButtons[startButtons?.length - 1].remove();
    okButtons[okButtons?.length - 1].remove();
  }
};

/**
 * Patch localStorage to block certain writes
 */
const patchLocalStorage = () => {
  var originalSetItem = localStorage.setItem;

  localStorage.setItem = function (key, value) {
    if (key == "open-page") {
      localStorage.removeItem(key);
      return;
    }
    originalSetItem.apply(this, arguments);
  };
};

// =============================================================================
// EVENT LISTENERS
// =============================================================================

// Listen for messages from popup/content-script
window.addEventListener("message", (event) => {
  // UI update request
  if (event.data.type === "REQUEST_UI_DATA") {
    sendUIUpdate();
  }

  // Settings request
  if (event.data.type === "REQUEST_SETTINGS") {
    window.postMessage({ type: "SETTINGS_LOADED", settings: LV_SETTINGS }, "*");
  }

  // Setting change
  if (event.data.type === "SETTING_CHANGE") {
    const { key, value } = event.data;
    LV_SETTINGS[key] = value;
    saveSetting();
    sendSettings();

    if (key === "AUTO_REPLAY") handleAutoReplay();
    if (key === "PLAYER_AURA") handlePlayerAura();
    if (key === "PLAYER_NOTES") handlePlayerNotes();

    console.log("⚙️ Setting changed: " + key + " = " + value);
  }

  // Rose wheel spin
  if (event.data.type === "SPIN_ROSE_WHEEL") {
    fetch(
      "https://core.api-wolvesville.com/rewards/wheelRewardWithSecret/" +
        getRewardSecret(),
      {
        method: "POST",
        headers: getHeaders(),
      },
    );
  }

  // Golden wheel spin
  if (event.data.type === "SPIN_GOLD_WHEEL") {
    fetch("https://core.api-wolvesville.com/rewards/goldenWheelSpin", {
      method: "POST",
      headers: getHeaders(),
    });
  }

  // Toggle player aura
  if (event.data.type === "TOGGLE_PLAYER_AURA") {
    LV_SETTINGS.PLAYER_AURA = event.data.value;
    saveSetting();
    sendSettings();
    handlePlayerAura();
  }

  // Toggle player notes
  if (event.data.type === "TOGGLE_PLAYER_NOTES") {
    LV_SETTINGS.PLAYER_NOTES = event.data.value;
    saveSetting();
    sendSettings();
    handlePlayerNotes();
  }

  // Open loot boxes
  if (event.data.type === "OPEN_LOOT_BOXES") {
    if (INVENTORY.lootBoxes?.length) {
      lootBox();
    }
  }
});

// Listen for auth requests from page
window.addEventListener("message", (event) => {
  if (
    event.data.type === "AUTH_REQUEST_TO_BACKGROUND" &&
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    chrome.runtime.sendMessage
  ) {
    chrome.runtime.sendMessage({
      type: "AUTH_REQUEST",
      username: event.data.username,
      messageId: event.data.messageId,
    });
  }
});

// Remove protections periodically
setInterval(removeWovProtections, 5000);

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Main entry point
 */
const main = async () => {
  // Load settings
  loadSettings();

  // Retrieve tokens
  getAuthtokens();

  // Activate interceptors
  fetchInterceptor();
  socketInterceptor(onMessage);

  // Send settings after a delay
  setTimeout(() => {
    sendSettings();
  }, 1000);

  // Wait a bit
  await new Promise((r) => setTimeout(r, 2000));

  // Retrieve player if not yet loaded
  if (!PLAYER) {
    getPLAYER();
    await new Promise((r) => setTimeout(r, 3000));
  }

  // Assume authenticated at start
  setAuthState(true);

  // Authenticate with server
  const authenticated = await authenticateBot();

  if (!authenticated) {
    setAuthState(false);
    if (SOCKET) {
      SOCKET.disconnect();
      SOCKET = undefined;
    }
    if (REGULARSOCKET) {
      REGULARSOCKET.disconnect();
      REGULARSOCKET = undefined;
    }
    return;
  }

  // Authentication successful
  setAuthState(true);

  // Re-check periodically (every 5 minutes)
  setInterval(recheckAuthentication, 5 * 60 * 1000);

  // Enable auto-replay
  handleAutoReplay();

  // Send UI updates periodically
  setInterval(() => {
    if (IS_AUTHENTICATED) {
      sendUIUpdate();
    }
  }, 4000);
};

// Inject styles
injectStyles();

// Start the bot
main();

// Listen for page load
window.addEventListener("load", function () {});
