const config = window.SITE_CONFIG || {};
const statusEl = document.querySelector("#admin-status");
const loginStatus = document.querySelector("#login-status");
const loginView = document.querySelector("#login-view");
const adminView = document.querySelector("#admin-view");
const pageList = document.querySelector("#page-list");
const blockList = document.querySelector("#block-list");
const editorTitle = document.querySelector("#editor-title");

let supabaseClient;
let pages = [];
let currentPage = null;

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

function blockTemplate(type) {
  const templates = {
    hero: { type, eyebrow: "Ny sektion", title: "Stor rubrik", text: "Skriv din text har.", image: "", align: "left", buttonText: "", buttonHref: "" },
    text: { type, eyebrow: "", title: "Rubrik", text: "Skriv din text har.", layout: "narrow" },
    image: { type, image: "", alt: "", caption: "", layout: "wide" },
    split: { type, eyebrow: "", title: "Rubrik", text: "Skriv din text har.", image: "", alt: "", imageSide: "right" },
    cards: { type, eyebrow: "", title: "Kortsektion", cards: [{ title: "Kort 1", text: "Text" }, { title: "Kort 2", text: "Text" }, { title: "Kort 3", text: "Text" }] },
    contact: { type, eyebrow: "Kontakt", title: "Kontakta mig", text: "Skriv en kort introduktion.", email: "din-epost@example.com" }
  };
  return templates[type] || templates.text;
}

function field(label, value, path, kind = "input", options = []) {
  const encoded = String(value || "").replaceAll('"', "&quot;");
  if (kind === "textarea") {
    return `<label class="wide-field">${label}<textarea data-path="${path}" rows="4">${value || ""}</textarea></label>`;
  }
  if (kind === "select") {
    return `
      <label>${label}
        <select data-path="${path}">
          ${options.map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option}</option>`).join("")}
        </select>
      </label>
    `;
  }
  return `<label>${label}<input data-path="${path}" value="${encoded}" /></label>`;
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
      field("Etikett", block.eyebrow, `${index}.eyebrow`),
      field("Rubrik", block.title, `${index}.title`),
      field("Text", block.text, `${index}.text`, "textarea"),
      field("Bild-URL", block.image, `${index}.image`),
      field("Textplacering", block.align || "left", `${index}.align`, "select", ["left", "center"]),
      field("Knapptext", block.buttonText, `${index}.buttonText`),
      field("Knapplank", block.buttonHref, `${index}.buttonHref`)
    ].join("");
  }
  if (block.type === "text") {
    return [
      field("Etikett", block.eyebrow, `${index}.eyebrow`),
      field("Rubrik", block.title, `${index}.title`),
      field("Layout", block.layout || "narrow", `${index}.layout`, "select", ["narrow", "wide"]),
      field("Text", block.text, `${index}.text`, "textarea")
    ].join("");
  }
  if (block.type === "image") {
    return [
      field("Bild-URL", block.image, `${index}.image`),
      field("Alt-text", block.alt, `${index}.alt`),
      field("Layout", block.layout || "wide", `${index}.layout`, "select", ["wide", "narrow"]),
      field("Bildtext", block.caption, `${index}.caption`)
    ].join("");
  }
  if (block.type === "split") {
    return [
      field("Etikett", block.eyebrow, `${index}.eyebrow`),
      field("Rubrik", block.title, `${index}.title`),
      field("Bild-URL", block.image, `${index}.image`),
      field("Bildsida", block.imageSide || "right", `${index}.imageSide`, "select", ["right", "left"]),
      field("Alt-text", block.alt, `${index}.alt`),
      field("Text", block.text, `${index}.text`, "textarea")
    ].join("");
  }
  if (block.type === "cards") {
    return [field("Etikett", block.eyebrow, `${index}.eyebrow`), field("Rubrik", block.title, `${index}.title`), cardFields(block, index)].join("");
  }
  if (block.type === "contact") {
    return [
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
            Ladda upp bild till blocket
            <input data-upload="${index}" type="file" accept="image/*" />
          </label>
        </article>
      `
    )
    .join("");
}

function refreshEditor() {
  fillPageForm();
  renderPageList();
  renderBlocks();
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
    .select("id,slug,title,nav_label,nav_order,in_menu,is_home,status,sections")
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
  setStatus("Laddar upp bild...");
  const extension = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await db().storage.from(config.assetBucket || "site-assets").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = db().storage.from(config.assetBucket || "site-assets").getPublicUrl(path);
  currentPage.sections[blockIndex].image = data.publicUrl;
  renderBlocks();
  setStatus("Bild uppladdad. Klicka Spara for att publicera andringen.");
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
});

init();
