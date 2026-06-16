const header = document.querySelector(".site-header");
const root = document.querySelector("#site-root");
const nav = document.querySelector("#site-nav");
const brand = document.querySelector("#site-brand");
const config = window.SITE_CONFIG || {};

window.addEventListener("scroll", () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 8);
});

function hasSupabaseConfig() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
}

function client() {
  return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function pageHref(slug) {
  return slug === "hem" ? "/" : `/?page=${encodeURIComponent(slug)}`;
}

function fallbackPage() {
  return {
    title: "Min hemsida",
    slug: "hem",
    sections: [
      {
        type: "hero",
        eyebrow: "GitHub + Vercel + Supabase",
        title: "En redigerbar hemsida som ar redo for admin.",
        text: "Koppla Supabase i config.js for att styra sidor, meny, text, layout och bilder fran adminpanelen.",
        image:
          "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=80",
        buttonText: "Oppna admin",
        buttonHref: "/admin.html"
      },
      {
        type: "cards",
        eyebrow: "CMS",
        title: "Det har kan du redigera",
        cards: [
          { title: "Sidor", text: "Skapa nya sidor och publicera dem i menyn." },
          { title: "Innehall", text: "Byt rubriker, texter och bilder i block." },
          { title: "Layout", text: "Flytta block och byt mellan enkla layouttyper." }
        ]
      }
    ]
  };
}

function renderNav(pages, activeSlug) {
  const menuPages = pages
    .filter((page) => page.in_menu)
    .sort((a, b) => Number(a.nav_order || 0) - Number(b.nav_order || 0));

  nav.innerHTML = menuPages
    .map((page) => {
      const label = escapeHtml(page.nav_label || page.title);
      const active = page.slug === activeSlug ? ' aria-current="page"' : "";
      return `<a href="${pageHref(page.slug)}"${active}>${label}</a>`;
    })
    .join("");
}

function renderHero(section) {
  const image = section.image || "";
  const customStyles = sectionStyle(section).replace(/^ style="/, "").replace(/"$/, "");
  const background = image ? `background-image: linear-gradient(rgba(31,41,51,.28), rgba(31,41,51,.34)), url('${escapeHtml(image)}')` : "";
  const styleParts = [background, customStyles].filter(Boolean).join("; ");
  const style = styleParts ? ` style="${styleParts}"` : "";
  const button = section.buttonText
    ? `<a class="button primary" href="${escapeHtml(section.buttonHref || "#")}">${escapeHtml(section.buttonText)}</a>`
    : "";

  return `
    <section class="hero cms-hero custom-text"${style}>
      <div class="hero-copy ${escapeHtml(section.align || "left")}">
        ${section.eyebrow ? `<p class="eyebrow">${escapeHtml(section.eyebrow)}</p>` : ""}
        <h1>${escapeHtml(section.title || "")}</h1>
        ${section.text ? `<p>${escapeHtml(section.text)}</p>` : ""}
        ${button ? `<div class="hero-actions">${button}</div>` : ""}
      </div>
    </section>
  `;
}

function renderText(section) {
  return `
    <section class="section text-section custom-text ${escapeHtml(section.layout || "narrow")}"${sectionStyle(section)}>
      <div class="section-heading">
        ${section.eyebrow ? `<p class="eyebrow">${escapeHtml(section.eyebrow)}</p>` : ""}
        <h2>${escapeHtml(section.title || "")}</h2>
      </div>
      ${section.text ? `<p>${escapeHtml(section.text)}</p>` : ""}
    </section>
  `;
}

function renderImage(section) {
  const image = section.image
    ? `<img src="${escapeHtml(section.image)}" alt="${escapeHtml(section.alt || "")}" loading="lazy" />`
    : `<div class="image-placeholder">Ingen bild vald</div>`;
  return `
    <section class="section image-section custom-text ${escapeHtml(section.layout || "wide")}"${sectionStyle(section)}>
      <figure>
        ${image}
        ${section.caption ? `<figcaption>${escapeHtml(section.caption)}</figcaption>` : ""}
      </figure>
    </section>
  `;
}

function renderSplit(section) {
  const image = section.image
    ? `<img src="${escapeHtml(section.image)}" alt="${escapeHtml(section.alt || "")}" loading="lazy" />`
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

function renderCards(section) {
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
                ${card.image ? `<img class="card-image" src="${escapeHtml(card.image)}" alt="">` : ""}
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

function renderContact(section) {
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
          ${email ? `<button class="button secondary" data-copy-email="${email}" type="button">Kopiera e-post</button>` : ""}
        </div>
        <p class="small-note">Kontaktblocket skickar inte via server. Det visar din e-post och låter besökaren kopiera den.</p>
      </div>
    </section>
  `;
}

function renderSection(section) {
  const renderers = {
    hero: renderHero,
    text: renderText,
    image: renderImage,
    split: renderSplit,
    cards: renderCards,
    contact: renderContact
  };
  return (renderers[section.type] || renderText)(section);
}

async function loadPages() {
  if (!hasSupabaseConfig()) {
    const page = fallbackPage();
    return [{ ...page, title: config.siteName || page.title, nav_label: "Hem", nav_order: 0, in_menu: true, is_home: true, status: "published" }];
  }

  const { data, error } = await client()
    .from("site_pages")
    .select("id,slug,title,nav_label,nav_order,in_menu,is_home,status,sections")
    .eq("status", "published")
    .order("nav_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function init() {
  brand.textContent = config.siteName || "Min hemsida";

  try {
    const pages = await loadPages();
    const requestedSlug = new URLSearchParams(window.location.search).get("page");
    const home = pages.find((page) => page.is_home) || pages[0] || fallbackPage();
    const activePage = pages.find((page) => page.slug === requestedSlug) || home;

    document.title = `${activePage.title} | ${config.siteName || "Min hemsida"}`;
    renderNav(pages, activePage.slug);
    root.innerHTML = (activePage.sections || []).map(renderSection).join("");
  } catch (error) {
    root.innerHTML = `
      <section class="section">
        <div class="section-heading">
          <p class="eyebrow">Setup</p>
          <h2>Kunde inte lasa innehall.</h2>
        </div>
        <p>${escapeHtml(error.message || "Kontrollera Supabase-installningen i config.js och SQL-schemat.")}</p>
      </section>
    `;
  }
}

init();

root.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-email]");
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.dataset.copyEmail);
    button.textContent = "Kopierad";
  } catch {
    button.textContent = button.dataset.copyEmail;
  }
});
