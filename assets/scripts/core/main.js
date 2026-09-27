function checkForAutoLoad() {
  const assetsLoaded = localStorage.getItem('webdash_assets_loaded') === 'true';
  const lastLoadTime = parseInt(localStorage.getItem('webdash_last_load_time') || '0');
  const now = Date.now();
  const hoursSinceLoad = (now - lastLoadTime) / (1000 * 60 * 60);
  if (assetsLoaded && hoursSinceLoad < 24 && window.gameCache.isCacheValid()) {
    const stats = window.gameCache.getCacheStats();
    if (stats.validEntries > 50) {
      console.log('auto loading from cache');
      return true;
    }
  }
  return false;
}

if (window.gameCache) {
  window.gameCache.init();
  const canAutoLoad = checkForAutoLoad();

  if (canAutoLoad) {
    const autoLoadIndicator = document.createElement('div');

    autoLoadIndicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #00ff00;
      color: #000;
      padding: 5px 10px;
      border-radius: 5px;
      font-family: Arial;
      font-size: 12px;
      z-index: 9999;
    `;

    autoLoadIndicator.textContent = 'turbo loading';
    document.body.appendChild(autoLoadIndicator);

    setTimeout(() => {
      if (autoLoadIndicator.parentNode) {
        autoLoadIndicator.parentNode.removeChild(autoLoadIndicator);
      }
    }, 3000);
  }
}

let initialFpsCap = 0;
try {
  const savedSettings = JSON.parse(localStorage.getItem("gd_settings") || "{}");
  initialFpsCap = Math.max(0, Math.min(1000, Math.round(Number(savedSettings.fpsCap) || 0)));
} catch (error) {
  initialFpsCap = 0;
}

async function syncLiveLevelCatalog() {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = setTimeout(() => controller?.abort(), 1500);

  try {
    const response = await fetch("https://web-dashers.github.io/assets/scripts/game/allLevels.js", {
      cache: "no-store",
      credentials: "omit",
      signal: controller?.signal
    });

    if (!response.ok) return;

    const source = await response.text();
    const start = source.indexOf("[");
    const end = source.lastIndexOf("]");

    if (start < 0 || end <= start) return;

    const jsonText = source
      .slice(start, end + 1)
      .replace(/\/\*[\\s\\S]*?\*\//g, "")
      .replace(/^\\s*\/\/.*$/gm, "")
      .replace(/,\\s*([}\\]])/g, "$1");

    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) return;

    const normalized = parsed.filter(level =>
      Array.isArray(level) &&
      level.length >= 4 &&
      typeof level[0] === "string" &&
      typeof level[1] === "string" &&
      typeof level[2] === "string"
    );

    if (normalized.length) {
      window.allLevels = normalized;
      window._webDashLevelCatalogSource = "live";
      window._webDashLevelCatalogSyncedAt = Date.now();
    }
  } catch (error) {
    window._webDashLevelCatalogSource = "local";
  } finally {
    clearTimeout(timeoutId);
  }
}

const liveLevelCatalogSync = syncLiveLevelCatalog();

const phaserConfig = {
  type: Phaser.AUTO,
  width: screenWidth,
  height: screenHeight,
  resolution: 1,
  fps: {
    limit: initialFpsCap,
    smoothStep: true
  },
  backgroundColor: "#000000",
  parent: document.body,
  input: {
    windowEvents: false
  },
  render: {
    powerPreference: "default"
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, GameScene]
};

const startWebDash = async () => {
  try {
    await liveLevelCatalogSync;
  } catch (error) {
  }

  window.webDashGame = new Phaser.Game(phaserConfig);
};

startWebDash();

window.clearGameCache = () => {
  if (window.gameCache) {
    window.gameCache.clearCache();
    localStorage.removeItem('webdash_assets_loaded');
    localStorage.removeItem('webdash_last_load_time');
    console.log('Game cache cleared');
    location.reload();
  }
};

window.getCacheInfo = () => {
  if (window.gameCache) {
    return window.gameCache.getCacheStats();
  }

  return null;
};
