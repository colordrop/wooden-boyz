const viewer = document.getElementById("playground-viewer");
const swatches = [...document.querySelectorAll(".swatch")];

const cameraViews = [
  "-46deg 78deg auto",
  "34deg 82deg auto",
  "132deg 82deg auto",
  "-46deg 56deg auto"
];

let currentView = 0;
let qrGenerated = false;

const textureCache = new Map();

async function getTexture(texturePath) {
  const normalizedPath = encodeURI(texturePath);
  if (textureCache.has(normalizedPath)) return textureCache.get(normalizedPath);
  const texture = await viewer.createTexture(normalizedPath);
  textureCache.set(normalizedPath, texture);
  return texture;
}

async function applyTextureToMaterial(materialIndex, texturePath) {
  if (!viewer?.model?.materials?.length) return;

  const material = viewer.model.materials[materialIndex];
  if (!material?.pbrMetallicRoughness) return;

  const texture = await getTexture(texturePath);
  material.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
}

async function applyTextureToMaterialByName(namePattern, texturePath) {
  if (!viewer?.model?.materials?.length) return false;

  const texture = await getTexture(texturePath);
  let found = false;

  for (const material of viewer.model.materials) {
    if (material.name && material.name.toLowerCase().includes(namePattern.toLowerCase())) {
      if (material.pbrMetallicRoughness?.baseColorTexture) {
        material.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
        found = true;
      }
    }
  }
  return found;
}

async function selectSwatch(button) {
  const type = button.dataset.type;
  const materialNamePattern = button.dataset.materialName;
  const indexValue = button.dataset.index || "0";
  const texturePath = button.dataset.texture;
  if (!texturePath) return;

  swatches
    .filter((item) => item.dataset.type === type)
    .forEach((item) => item.classList.remove("active"));
  button.classList.add("active");

  let appliedByName = false;
  if (materialNamePattern) {
    try {
      appliedByName = await applyTextureToMaterialByName(materialNamePattern, texturePath);
    } catch (error) {
      console.error("Failed to apply texture by name pattern", materialNamePattern, error);
    }
  }

  // Fallback to indices if name matching did not apply to any material
  if (!appliedByName) {
    const materialIndices = indexValue.split(",").map((s) => Number.parseInt(s.trim(), 10));
    for (const materialIndex of materialIndices) {
      if (Number.isNaN(materialIndex)) continue;
      try {
        await applyTextureToMaterial(materialIndex, texturePath);
      } catch (error) {
        console.error("Failed to apply texture to material index", materialIndex, error);
      }
    }
  }
}

function nextView() {
  currentView = (currentView + 1) % cameraViews.length;
  viewer.cameraOrbit = cameraViews[currentView];
}

function prevView() {
  currentView = (currentView - 1 + cameraViews.length) % cameraViews.length;
  viewer.cameraOrbit = cameraViews[currentView];
}

function switchTab(tabBtn, tabId) {
  document.querySelectorAll(".tab").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));

  tabBtn.classList.add("active");
  document.getElementById(tabId).classList.add("active");
}

function openQR() {
  const modal = document.getElementById("qr-modal");
  modal.classList.add("open");

  if (!qrGenerated) {
    new QRCode(document.getElementById("qr-container"), {
      text: window.location.href,
      width: 200,
      height: 200,
      colorDark: "#18331f",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
    qrGenerated = true;
  }
}

function closeQR(event) {
  const modal = document.getElementById("qr-modal");
  if (!event || event.target === modal) {
    modal.classList.remove("open");
  }
}

viewer?.addEventListener("load", async () => {
  // Hide loader once model is loaded
  const loader = document.getElementById("model-loader");
  if (loader) {
    loader.classList.add("hidden");
  }

  const defaults = document.querySelectorAll(".swatch.active");
  for (const swatch of defaults) {
    // Load defaults sequentially so both material indices get deterministic startup textures.
    await selectSwatch(swatch);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeQR();
});

window.selectSwatch = selectSwatch;
window.nextView = nextView;
window.prevView = prevView;
window.switchTab = switchTab;
window.openQR = openQR;
window.closeQR = closeQR;
