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
let savedAtTimer;
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
  const savedAt = new Date(value);
  const seconds = Math.max(0, Math.floor((Date.now() - savedAt.getTime()) / 1000));
  return `Senast sparad ${savedAt.toLocaleString("sv-SE", {
    dateStyle: "short",
    timeStyle: "medium"
  })} (${seconds} sek sedan)`;
}

function updateSavedAt() {
  if (lastSaved) {
    lastSaved.textContent = formatSavedAt(currentPage?.updated_at);
  }
}

function startSavedAtTimer() {
  window.clearInterval(savedAtTimer);
  updateSavedAt();
  savedAtTimer = window.setInterval(updateSavedAt, 1000);
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
  startSavedAtTimer();
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

function styleValue(value = "") {
  const safe = String(value).trim();
  return /^[#a-zA-Z0-9(),. %/-]+$/.test(safe) ? safe : "";
}

function sectionStyle(section) {
  const styles = [];
  const textColor = styleValue(section.textColor);
  const titleSize = styleValue(section.titleSize);
  const bodySize = styleValue(section.bodySize);
  if (textColor) styles.push(`--section-text-color: ${textColor}`);
  if (titleSize) styles.push(`--section-title-size: ${titleSize}`);
  if (bodySize) styles.push(`--section-body-size: ${bodySize}`);
  return styles.length ? ` style="${styles.join("; ")}"` : "";
}

function renderPreviewHero(section) {
  const image = section.image || "";
  const customStyles = sectionStyle(section).replace(/^ style="/, "").replace(/"$/, "");
  const background = image ? `background-image: linear-gradient(rgba(31,41,51,.28), rgba(31,41,51,.34)), url('${escapeAttr(image)}')` : "";
  const styleParts = [background, customStyles].filter(Boolean).join("; ");
  const style = styleParts ? ` style="${styleParts}"` : "";
  const button = section.buttonText
    ? `<a class="button primary" href="${escapeAttr(section.buttonHref || "#")}">${escapeHtml(section.buttonText)}</a>`
    : "";

  return `
    <section class="hero cms-hero custom-text"${style}>
      <div class="hero-copy ${escapeAttr(section.align || "left")}">
        ${section.eyebrow ? `<p class="eyebrow">${escapeHtml(section.eyebrow)}</p>` : ""}
        <h1>${escapeHtml(section.title || "")}</h1>
        ${section.text ? `<p>${escapeHtml(section.text)}</p>` : ""}
        ${button ? `<div class="hero-actions">${button}</div>` : ""}
      </div>
    </section>
  `;
}

function renderPreviewText(section) {
  return `
    <section class="section text-section custom-text ${escapeAttr(section.layout || "narrow")}"${sectionStyle(section)}>
      <div class="section-heading">
        ${section.eyebrow ? `<p class="eyebrow">${escapeHtml(section.eyebrow)}</p>` : ""}
        <h2>${escapeHtml(section.title || "")}</h2>
      </div>
      ${section.text ? `<p>${escapeHtml(section.text)}</p>` : ""}
    </section>
  `;
}

function renderPreviewImage(section) {
  const image = section.image
    ? `<img src="${escapeAttr(section.image)}" alt="${escapeAttr(section.alt || "")}" loading="lazy" />`
    : `<div class="image-placeholder">Ingen bild vald</div>`;
  return `
    <section class="section image-section custom-text ${escapeAttr(section.layout || "wide")}"${sectionStyle(section)}>
      <figure>
        ${image}
        ${section.caption ? `<figcaption>${escapeHtml(section.caption)}</figcaption>` : ""}
      </figure>
    </section>
  `;
}

function renderPreviewSplit(section) {
  const image = section.image
    ? `<img src="${escapeAttr(section.image)}" alt="${escapeAttr(section.alt || "")}" loading="lazy" />`
    : `<div class="image-placeholder">Ingen bild vald</div>`;
  return `
    <section class="section split-section custom-text ${section.imageSide === "left" ? "image-left" : ""}"${sectionStyle(section)}>
      <div>
        ${section.eyebrow ? `<p class="eyebrow">${escapeHtml(section.eyebrow)}</p>` : ""}
        <h2>${escapeHtml(section.title || "")}</h2>
        ${section.text ? `<p>${escapeHtml(section.text)}</p>` : ""}
      </div>
      ${image}
    </section>
  `;
}

function renderPreviewCards(section) {
  const cards = Array.isArray(section.cards) ? section.cards : [];
  return `
    <section class="section custom-text"${sectionStyle(section)}>
      <div class="section-heading">
        ${section.eyebrow ? `<p class="eyebrow">${escapeHtml(section.eyebrow)}</p>` : ""}
        <h2>${escapeHtml(section.title || "")}</h2>
      </div>
      <div class="feature-grid">
        ${cards
          .map(
            (card, index) => `
              <article>
                <span>${String(index + 1).padStart(2, "0")}</span>
                ${card.image ? `<img class="card-image" src="${escapeAttr(card.image)}" alt="">` : ""}
                <h3>${escapeHtml(card.title || "")}</h3>
                <p>${escapeHtml(card.text || "")}</p>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderPreviewContact(section) {
  const email = escapeHtml(section.email || "");
  const emailHref = email ? `mailto:${email}` : "#";
  return `
    <section class="section contact-section custom-text"${sectionStyle(section)}>
      <div class="section-heading">
        ${section.eyebrow ? `<p class="eyebrow">${escapeHtml(section.eyebrow)}</p>` : ""}
        <h2>${escapeHtml(section.title || "Kontakt")}</h2>
        ${section.text ? `<p>${escapeHtml(section.text)}</p>` : ""}
      </div>
      <div class="contact-card">
        <p>${email || "Lägg in din e-postadress i adminpanelen."}</p>
        <div class="hero-actions">
          ${email ? `<a class="button primary" href="${emailHref}">Öppna e-post</a>` : ""}
          ${email ? `<button class="button secondary" type="button">Kopiera e-post</button>` : ""}
        </div>
        <p class="small-note">Kontaktblocket skickar inte via server. Det visar din e-post och låter besökaren kopiera den.</p>
      </div>
    </section>
  `;
}

function renderPreviewSection(section) {
  const renderers = {
    hero: renderPreviewHero,
    text: renderPreviewText,
    image: renderPreviewImage,
    split: renderPreviewSplit,
    cards: renderPreviewCards,
    contact: renderPreviewContact
  };
  return (renderers[section.type] || renderPreviewText)(section);
}

function renderPreview() {
  if (!pagePreview || !currentPage) return;
  const navLinks = pages
    .filter((page) => page.in_menu)
    .sort((a, b) => Number(a.nav_order || 0) - Number(b.nav_order || 0))
    .map((page) => `<a href="#">${escapeHtml(page.nav_label || page.title)}</a>`)
    .join("");
  const body = (currentPage.sections || []).map(renderPreviewSection).join("");
  pagePreview.srcdoc = `
    <!doctype html>
    <html lang="sv">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <base href="${escapeAttr(window.location.href.replace(/admin\.html.*$/, ""))}">
        <link rel="stylesheet" href="styles.css">
      </head>
      <body>
        <header class="site-header">
          <a class="brand" href="#">${escapeHtml(config.siteName || "Min hemsida")}</a>
          <nav aria-label="Huvudmeny">${navLinks}</nav>
        </header>
        <main>${body}</main>
        <footer><p>Byggd med GitHub, Vercel och Supabase.</p><a href="#">Admin</a></footer>
      </body>
    </html>
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
  const shouldDelete = event.target.closest("[data-delete-block]");
  const moveDirection = event.target.dataset.move;

  if (!shouldDelete && !moveDirection) {
    return;
  }

  if (shouldDelete) {
    blocks.splice(index, 1);
  }
  if (moveDirection === "up" && index > 0) {
    [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
  }
  if (moveDirection === "down" && index < blocks.length - 1) {
    [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]];
  }
  renderBlocks();
  renderPreview();
});

init();
