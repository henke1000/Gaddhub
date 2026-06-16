const config = window.SITE_CONFIG || {};
const statusEl = document.querySelector("#admin-status");
const loginStatus = document.querySelector("#login-status");
const loginView = document.querySelector("#login-view");
const adminView = document.querySelector("#admin-view");
const pageList = document.querySelector("#page-list");
const blockList = document.querySelector("#block-list");
const editorTitle = document.querySelector("#editor-title");
const lastSaved = document.querySelector("#last-saved");
const pagePreview = document.querySelector("#page-preview");

let supabaseClient;
let pages = [];
let currentPage = null;
const colorOptions = [
  { label: "Standard", value: "" },
  { label: "Svart", value: "#1f2933" },
  { label: "Vit", value: "#ffffff" },
  { label: "Grå", value: "#667085" },
  { label: "Blå", value: "#2563eb" },
  { label: "Grön", value: "#0f766e" },
  { label: "Röd", value: "#dc2626" },
  { label: "Orange", value: "#f97316" }
];

function setStatus(message) {
  statusEl.textContent = message || "";
}

function setLoginStatus(message) {
  loginStatus.textContent = message || "";
}

function configured() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
}

function db() {
  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }
  return supabaseClient;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}

function formatSavedAt(value) {
  if (!value) return "Inte sparad ännu";
  return `Senast sparad ${new Date(value).toLocaleString("sv-SE", {
    dateStyle: "short",
    timeStyle: "short"
  })}`;
}

function blockTemplate(type) {
  const style = { textColor: "", titleSize: "", bodySize: "" };
  const templates = {
    hero: { type, ...style, eyebrow: "Ny sektion", title: "Stor rubrik", text: "Skriv din text har.", image: "", align: "left", buttonText: "", buttonHref: "" },
    text: { type, ...style, eyebrow: "", title: "Rubrik", text: "Skriv din text har.", layout: "narrow" },
    image: { type, ...style, image: "", alt: "", caption: "", layout: "wide" },
    split: { type, ...style, eyebrow: "", title: "Rubrik", text: "Skriv din text har.", image: "", alt: "", imageSide: "right" },
    cards: { type, ...style, eyebrow: "", title: "Kortsektion", cards: [{ title: "Kort 1", text: "Text" }, { title: "Kort 2", text: "Text" }, { title: "Kort 3", text: "Text" }] },
    contact: { type, ...style, eyebrow: "Kontakt", title: "Kontakta mig", text: "Skriv en kort introduktion.", email: "din-epost@example.com" }
  };
  return templates[type] || templates.text;
}

function field(label, value, path, kind = "input", options = []) {
  const encoded = escapeAttr(value || "");
  const id = `field-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  if (kind === "palette") {
    return `
      <div class="field-row wide-field">
        <span class="field-label">${label}</span>
        <div class="color-palette" role="group" aria-label="${escapeAttr(label)}">
          ${colorOptions
            .map(
              (color) => `
                <button
                  class="${color.value === (value || "") ? "is-selected" : ""}"
                  data-color-path="${path}"
                  data-color-value="${escapeAttr(color.value)}"
                  type="button"
                >
                  <span style="background:${color.value || "linear-gradient(135deg,#fff 0%,#fff 48%,#d1d5db 49%,#d1d5db 52%,#fff 53%)"}"></span>
                  ${color.label}
                </button>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  }
  if (kind === "textarea") {
    return `
      <div class="field-row wide-field">
        <label for="${id}">${label}</label>
        <textarea id="${id}" data-path="${path}" rows="4">${escapeHtml(value || "")}</textarea>
      </div>
    `;
  }
  if (kind === "select") {
    return `
      <div class="field-row">
        <label for="${id}">${label}</label>
        <select id="${id}" data-path="${path}">
          ${options.map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option || "Standard"}</option>`).join("")}
        </select>
      </div>
    `;
  }
  return `
    <div class="field-row">
      <label for="${id}">${label}</label>
      <input id="${id}" data-path="${path}" value="${encoded}" />
    </div>
  `;
}

function styleFields(block, index) {
  return [
    field("Textfärg", block.textColor || "", `${index}.textColor`, "palette"),
    field("Rubrikstorlek", block.titleSize || "", `${index}.titleSize`, "select", ["", "2rem", "3rem", "4rem", "5rem", "6rem"]),
    field("Textstorlek", block.bodySize || "", `${index}.bodySize`, "select", ["", "1rem", "1.15rem", "1.3rem", "1.5rem", "1.8rem"])
  ].join("");
}

function cardFields(block, blockIndex) {
  const cards = Array.isArray(block.cards) ? block.cards : [];
  return cards
    .map(
      (card, cardIndex) => `
        <div class="wide-field card-editor">
          <h4>Kort ${cardIndex + 1}</h4>
          ${field("Rubrik", card.title, `${blockIndex}.cards.${cardIndex}.title`)}
          ${field("Text", card.text, `${blockIndex}.cards.${cardIndex}.text`, "textarea")}
          ${field("Bild-URL", card.image, `${blockIndex}.cards.${cardIndex}.image`)}
        </div>
      `
    )
    .join("");
}

function renderBlockFields(block, index) {
  if (block.type === "hero") {
    return [
      styleFields(block, index),
      field("Etikett", block.eyebrow, `${index}.eyebrow`),
      field("Rubrik", block.title, `${index}.title`),
      field("Text", block.text, `${index}.text`, "textarea"),
      field("Bild-URL", block.image, `${index}.image`),
      field("Textplacering", block.align || "left", `${index}.align`, "select", ["left", "center"]),
      field("Knapptext", block.buttonText, `${index}.buttonText`),
      field("Knapplänk", block.buttonHref, `${index}.buttonHref`)
    ].join("");
  }
  if (block.type === "text") {
    return [
      styleFields(block, index),
      field("Etikett", block.eyebrow, `${index}.eyebrow`),
      field("Rubrik", block.title, `${index}.title`),
      field("Layout", block.layout || "narrow", `${index}.layout`, "select", ["narrow", "wide"]),
      field("Text", block.text, `${index}.text`, "textarea")
    ].join("");
  }
  if (block.type === "image") {
    return [
      styleFields(block, index),
      field("Bild-URL", block.image, `${index}.image`),
      field("Alt-text", block.alt, `${index}.alt`),
      field("Layout", block.layout || "wide", `${index}.layout`, "select", ["wide", "narrow"]),
      field("Bildtext", block.caption, `${index}.caption`)
    ].join("");
  }
  if (block.type === "split") {
    return [
      styleFields(block, index),
      field("Etikett", block.eyebrow, `${index}.eyebrow`),
      field("Rubrik", block.title, `${index}.title`),
      field("Bild-URL", block.image, `${index}.image`),
      field("Bildsida", block.imageSide || "right", `${index}.imageSide`, "select", ["right", "left"]),
      field("Alt-text", block.alt, `${index}.alt`),
      field("Text", block.text, `${index}.text`, "textarea")
    ].join("");
  }
  if (block.type === "cards") {
    return [styleFields(block, index), field("Etikett", block.eyebrow, `${index}.eyebrow`), field("Rubrik", block.title, `${index}.title`), cardFields(block, index)].join("");
  }
  if (block.type === "contact") {
    return [
      styleFields(block, index),
      field("Etikett", block.eyebrow, `${index}.eyebrow`),
      field("Rubrik", block.title, `${index}.title`),
      field("E-post", block.email, `${index}.email`),
      field("Text", block.text, `${index}.text`, "textarea")
    ].join("");
  }
  return field("Text", block.text, `${index}.text`, "textarea");
}

function fillPageForm() {
  document.querySelector("#page-title").value = currentPage?.title || "";
  document.querySelector("#page-slug").value = currentPage?.slug || "";
  document.querySelector("#page-nav-label").value = currentPage?.nav_label || "";
  document.querySelector("#page-nav-order").value = currentPage?.nav_order || 0;
  document.querySelector("#page-in-menu").checked = Boolean(currentPage?.in_menu);
  document.querySelector("#page-is-home").checked = Boolean(currentPage?.is_home);
  document.querySelector("#page-status").value = currentPage?.status || "draft";
  editorTitle.textContent = currentPage?.title || "Ny sida";
  lastSaved.textContent = formatSavedAt(currentPage?.updated_at);
}

function renderPageList() {
  pageList.innerHTML = pages
    .sort((a, b) => Number(a.nav_order || 0) - Number(b.nav_order || 0))
    .map((page) => `<button class="${currentPage?.id === page.id ? "is-active" : ""}" data-page-id="${page.id}" type="button">${page.title}</button>`)
    .join("");
}

function renderBlocks() {
  const blocks = currentPage?.sections || [];
  blockList.innerHTML = blocks
    .map(
      (block, index) => `
        <article class="cms-block" data-block-index="${index}">
          <div class="block-header">
            <h3>${index + 1}. ${block.type}</h3>
            <div class="block-actions">
              <button data-move="up" type="button">Upp</button>
              <button data-move="down" type="button">Ned</button>
              <button data-delete-block type="button">Ta bort</button>
            </div>
          </div>
          <div class="block-fields">${renderBlockFields(block, index)}</div>
          <label class="wide-field upload-field">
            Ladda upp eller byt bild i blocket
            <input data-upload="${index}" type="file" accept="image/*" />
          </label>
        </article>
      `
    )
    .join("");
}

function previewBlock(block) {
  const title = escapeHtml(block.title || block.type);
  const text = escapeHtml(block.text || block.caption || "");
  const color = block.textColor ? ` style="color:${escapeAttr(block.textColor)}"` : "";
  const image = block.image
    ? `<img src="${escapeAttr(block.image)}" alt="">`
    : `<div class="preview-empty">Ingen bild vald</div>`;

  if (block.type === "hero") {
    return `<article class="preview-block preview-hero"${color}>${image}<h3>${title}</h3><p>${text}</p></article>`;
  }
  if (block.type === "image") {
    return `<article class="preview-block">${image}<p${color}>${escapeHtml(block.caption || "Bildblock")}</p></article>`;
  }
  if (block.type === "split") {
    return `<article class="preview-block preview-split"${color}><div><h3>${title}</h3><p>${text}</p></div>${image}</article>`;
  }
  if (block.type === "cards") {
    const cards = Array.isArray(block.cards) ? block.cards : [];
    return `<article class="preview-block"${color}><h3>${title}</h3><div class="preview-cards">${cards.map((card) => `<span>${escapeHtml(card.title || "Kort")}</span>`).join("")}</div></article>`;
  }
  if (block.type === "contact") {
    return `<article class="preview-block"${color}><h3>${title}</h3><p>${text}</p><strong>${escapeHtml(block.email || "Ingen e-post")}</strong></article>`;
  }
  return `<article class="preview-block"${color}><h3>${title}</h3><p>${text}</p></article>`;
}

function renderPreview() {
  if (!pagePreview || !currentPage) return;
  pagePreview.innerHTML = `
    <div class="preview-page-title">
      <strong>${escapeHtml(currentPage.title || "Ny sida")}</strong>
      <span>${escapeHtml(currentPage.status || "draft")}</span>
    </div>
    ${(currentPage.sections || []).map(previewBlock).join("")}
  `;
}

function refreshEditor() {
  fillPageForm();
  renderPageList();
  renderBlocks();
  renderPreview();
}

function setByPath(path, value) {
  const parts = path.split(".");
  let target = currentPage.sections[Number(parts.shift())];
  while (parts.length > 1) {
    target = target[parts.shift()];
  }
  target[parts[0]] = value;
}

async function loadPages() {
  const { data, error } = await db()
    .from("site_pages")
    .select("id,slug,title,nav_label,nav_order,in_menu,is_home,status,sections,updated_at")
    .order("nav_order", { ascending: true });
  if (error) throw error;
  pages = data || [];
  currentPage = pages[0] || null;
  refreshEditor();
}

function readPageForm() {
  currentPage.title = document.querySelector("#page-title").value.trim();
  currentPage.slug = slugify(document.querySelector("#page-slug").value || currentPage.title);
  currentPage.nav_label = document.querySelector("#page-nav-label").value.trim() || currentPage.title;
  currentPage.nav_order = Number(document.querySelector("#page-nav-order").value || 0);
  currentPage.in_menu = document.querySelector("#page-in-menu").checked;
  currentPage.is_home = document.querySelector("#page-is-home").checked;
  currentPage.status = document.querySelector("#page-status").value;
}

async function savePage() {
  readPageForm();
  if (currentPage.is_home) {
    pages.forEach((page) => {
      if (page.id !== currentPage.id) page.is_home = false;
    });
  }

  const payload = {
    slug: currentPage.slug,
    title: currentPage.title,
    nav_label: currentPage.nav_label,
    nav_order: currentPage.nav_order,
    in_menu: currentPage.in_menu,
    is_home: currentPage.is_home,
    status: currentPage.status,
    sections: currentPage.sections || []
  };

  const query = currentPage.id
    ? db().from("site_pages").update(payload).eq("id", currentPage.id).select().single()
    : db().from("site_pages").insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  currentPage = data;
  await loadPages();
  currentPage = pages.find((page) => page.id === data.id) || pages[0];
  refreshEditor();
  setStatus("Sparat.");
}

async function uploadImage(input, blockIndex) {
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    throw new Error("Välj en bildfil.");
  }
  setStatus("Laddar upp bild...");
  const extension = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${extension}`;

  const embedImage = async () => {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Kunde inte läsa bildfilen."));
      reader.readAsDataURL(file);
    });
    currentPage.sections[blockIndex].image = dataUrl;
    renderBlocks();
    renderPreview();
    setStatus("Supabase Storage stoppade uppladdningen, så bilden bäddades in direkt. Klicka Spara.");
  };

  try {
    const upload = await db().storage.from(config.assetBucket || "site-assets").upload(path, file, { upsert: false });
    if (upload.error) {
      await embedImage();
      return;
    }
    const { data } = db().storage.from(config.assetBucket || "site-assets").getPublicUrl(path);
    currentPage.sections[blockIndex].image = data.publicUrl;
  } catch {
    await embedImage();
    return;
  }

  renderBlocks();
  renderPreview();
  setStatus("Bild uppladdad. Klicka Spara för att publicera ändringen.");
}

async function init() {
  if (!configured()) {
    setLoginStatus("Lagg in Supabase URL och publishable/anon key i config.js for att anvanda admin.");
    return;
  }

  const { data } = await db().auth.getSession();
  if (data.session) {
    loginView.hidden = true;
    adminView.hidden = false;
    await loadPages();
  }
}

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginStatus("Loggar in...");
  const email = document.querySelector("#login-email").value;
  const password = document.querySelector("#login-password").value;
  const { error } = await db().auth.signInWithPassword({ email, password });
  if (error) {
    setLoginStatus(error.message);
    return;
  }
  loginView.hidden = true;
  adminView.hidden = false;
  await loadPages();
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  await db().auth.signOut();
  window.location.reload();
});

document.querySelector("#new-page-button").addEventListener("click", () => {
  currentPage = {
    id: null,
    title: "Ny sida",
    slug: "ny-sida",
    nav_label: "Ny sida",
    nav_order: pages.length + 1,
    in_menu: true,
    is_home: false,
    status: "draft",
    sections: [blockTemplate("hero"), blockTemplate("text")]
  };
  refreshEditor();
});

pageList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page-id]");
  if (!button) return;
  currentPage = pages.find((page) => page.id === button.dataset.pageId);
  refreshEditor();
});

document.querySelector("#page-title").addEventListener("input", (event) => {
  if (!document.querySelector("#page-slug").value) {
    document.querySelector("#page-slug").value = slugify(event.target.value);
  }
  if (currentPage) {
    currentPage.title = event.target.value;
    editorTitle.textContent = currentPage.title || "Ny sida";
    renderPreview();
  }
});

document.querySelector("#page-form").addEventListener("input", () => {
  if (!currentPage) return;
  readPageForm();
  renderPageList();
  renderPreview();
});

document.querySelector("#page-form").addEventListener("change", () => {
  if (!currentPage) return;
  readPageForm();
  renderPageList();
  renderPreview();
});

document.querySelector("#save-page-button").addEventListener("click", async () => {
  try {
    setStatus("Sparar...");
    await savePage();
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector(".block-toolbar").addEventListener("click", (event) => {
  const button = event.target.closest("[data-add-block]");
  if (!button || !currentPage) return;
  currentPage.sections = currentPage.sections || [];
  currentPage.sections.push(blockTemplate(button.dataset.addBlock));
  renderBlocks();
});

blockList.addEventListener("input", async (event) => {
  if (event.target.matches("[data-path]")) {
    setByPath(event.target.dataset.path, event.target.value);
    renderPreview();
  }
});

blockList.addEventListener("change", async (event) => {
  if (event.target.matches("[data-path]")) {
    setByPath(event.target.dataset.path, event.target.value);
    renderPreview();
  }
  if (event.target.matches("[data-upload]")) {
    try {
      await uploadImage(event.target, Number(event.target.dataset.upload));
    } catch (error) {
      setStatus(error.message);
    }
  }
});

blockList.addEventListener("click", (event) => {
  const colorButton = event.target.closest("[data-color-path]");
  if (colorButton && currentPage) {
    setByPath(colorButton.dataset.colorPath, colorButton.dataset.colorValue);
    renderBlocks();
    renderPreview();
    return;
  }

  const blockEl = event.target.closest("[data-block-index]");
  if (!blockEl || !currentPage) return;
  const index = Number(blockEl.dataset.blockIndex);
  const blocks = currentPage.sections;

  if (event.target.closest("[data-delete-block]")) {
    blocks.splice(index, 1);
  }
  if (event.target.dataset.move === "up" && index > 0) {
    [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
  }
  if (event.target.dataset.move === "down" && index < blocks.length - 1) {
    [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]];
  }
  renderBlocks();
  renderPreview();
});

init();
