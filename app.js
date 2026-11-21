const products = window.catalogProducts || [];
const grid = document.querySelector('#product-grid');
const empty = document.querySelector('#empty-state');
const search = document.querySelector('#product-search');
let current = 'all';
let expanded = false;
let activeProduct = null;
let modalImageRequest = 0;
const showAll = document.querySelector('#show-all');
const showAllLabel = showAll.querySelector('.show-all-label');
const productImagePreloads = new Map();
const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

const productImageObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const image = entry.target;
    productImageObserver.unobserve(image);
    image.src = image.dataset.src;
    delete image.dataset.src;
  });
}, { rootMargin:'320px 0px' }) : null;

function observeProductImages() {
  productImageObserver?.disconnect();
  grid.querySelectorAll('img[data-src]').forEach(image => {
    if (productImageObserver) productImageObserver.observe(image);
    else {
      image.src = image.dataset.src;
      delete image.dataset.src;
    }
  });
}

const shortText = (text, length = 74) => text.length > length ? `${text.slice(0, length)}…` : text;
const galleryThumbPath = src => src.replace('catalog/products/', 'catalog/gallery-thumbs/');

function renderProducts() {
  const query = search.value.trim().toLowerCase();
  const matched = products.filter(product => {
    const searchable = `${product.name}${product.en}${product.model}`.toLowerCase();
    return (current === 'all' || product.cat === current) && searchable.includes(query);
  });
  const shown = expanded || query || current !== 'all' ? matched : matched.slice(0, 12);
  grid.innerHTML = shown.map((product, index) => `
    <article class="product-card">
      <button class="product-image" type="button" data-product="${product.id}" aria-label="查看${product.name}详情">
        <img src="${transparentPixel}" data-src="assets/${product.thumb}" alt="${product.name}白底产品图" width="500" height="400" loading="lazy" fetchpriority="low" decoding="async">
        <span>查看详情与参数</span>
      </button>
      <div class="product-body">
        <small>${product.en}</small>
        <h3>${product.name}</h3>
        <p>${shortText(product.overview)}</p>
        <button class="product-open" type="button" data-product="${product.id}">查看产品详情 <span>→</span></button>
      </div>
    </article>`).join('');
  empty.hidden = matched.length > 0;
  showAll.hidden = Boolean(query) || current !== 'all' || matched.length <= 12;
  showAllLabel.textContent = expanded ? '收起产品列表' : `查看全部 ${products.length} 个产品系列`;
  showAll.classList.toggle('is-expanded', expanded);
  showAll.setAttribute('aria-expanded', String(expanded));
  observeProductImages();
}

renderProducts();

document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  current = button.dataset.filter;
  expanded = true;
  document.querySelectorAll('[data-filter]').forEach(item => {
    item.classList.toggle('active', item === button);
    item.setAttribute('aria-selected', item === button ? 'true' : 'false');
  });
  renderProducts();
}));

search.addEventListener('input', renderProducts);
showAll.addEventListener('click', () => {
  const collapsing = expanded;
  if (collapsing) showAll.blur();
  expanded = !expanded;
  renderProducts();
  if (collapsing) {
    requestAnimationFrame(() => {
      const root = document.documentElement;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      document.querySelector('#products').scrollIntoView({ block: 'start' });
      requestAnimationFrame(() => { root.style.scrollBehavior = previousScrollBehavior; });
    });
  }
});
document.querySelectorAll('[data-jump-filter]').forEach(link => link.addEventListener('click', () => {
  const button = document.querySelector(`[data-filter="${link.dataset.jumpFilter}"]`);
  setTimeout(() => button?.click(), 80);
}));

const productModal = document.querySelector('#product-modal');
const parameterWrap = document.querySelector('#modal-parameters');
parameterWrap.addEventListener('copy', event => event.preventDefault());
parameterWrap.addEventListener('cut', event => event.preventDefault());
parameterWrap.addEventListener('dragstart', event => event.preventDefault());

function openModal(modal) {
  modal.showModal();
  document.body.classList.add('modal-open');
  syncMobileCta();
}

function closeModal(modal) {
  modal.close();
  if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
  syncMobileCta();
}

function preloadProductImage(id) {
  const product = products.find(item => item.id === id);
  if (!product?.gallery?.[0]) return;
  const src = `assets/${product.gallery[0]}`;
  if (productImagePreloads.has(src)) return;
  const loader = new Image();
  loader.decoding = 'async';
  loader.fetchPriority = 'low';
  loader.src = src;
  productImagePreloads.set(src, loader);
}

function openProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  activeProduct = product;
  const thumbs = document.querySelector('#modal-thumbs');
  thumbs.innerHTML = product.gallery.map((src, index) => `<button class="gallery-thumb${index === 0 ? ' active' : ''}" type="button" data-gallery-src="${src}" aria-label="查看${product.name}图片${index + 1}"><img src="assets/${galleryThumbPath(src)}" alt="" width="160" height="128" loading="lazy" fetchpriority="low" decoding="async"></button>`).join('');
  setModalImage(product.gallery[0], product, thumbs.querySelector('.gallery-thumb'), product.thumb);
  document.querySelector('#modal-en').textContent = product.en;
  document.querySelector('#modal-model').textContent = product.model;
  document.querySelector('#modal-page').textContent = `产品册第 ${product.page} 页`;
  document.querySelector('#modal-title').textContent = product.name;
  document.querySelector('#modal-description').textContent = product.overview;
  document.querySelector('#modal-highlights').innerHTML = product.features.map(item => `<li>${item}</li>`).join('');
  const parameterTable = product.parameterTable;
  parameterWrap.innerHTML = `
    <table aria-label="${product.name}主要技术参数">
      <thead><tr>${parameterTable.headers.map(cell => `<th scope="col">${cell}</th>`).join('')}</tr></thead>
      <tbody>${parameterTable.rows.map(row => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    ${parameterTable.note ? `<p class="parameter-note">注：${parameterTable.note}</p>` : ''}`;
  parameterWrap.querySelector('table').style.minWidth = `${Math.max(780, parameterTable.headers.length * 112)}px`;
  openModal(productModal);
}

function setModalImage(src, product, button, previewSrc = galleryThumbPath(src)) {
  const image = document.querySelector('#modal-image');
  const frame = image.closest('.modal-image');
  const request = ++modalImageRequest;
  const nextSrc = `assets/${src}`;

  frame.classList.remove('has-error');
  if (previewSrc) {
    image.src = `assets/${previewSrc}`;
    image.alt = `${product.name}产品预览图`;
    frame.classList.add('has-preview');
  }
  frame.classList.add('is-loading');
  frame.setAttribute('aria-busy', 'true');
  document.querySelectorAll('.gallery-thumb').forEach(item => item.classList.toggle('active', item === button));

  const loader = new Image();
  loader.decoding = 'async';
  loader.fetchPriority = 'high';
  loader.onload = async () => {
    try { await loader.decode(); } catch {}
    if (request !== modalImageRequest) return;
    image.src = nextSrc;
    image.alt = `${product.name}产品图`;
    image.fetchPriority = 'high';
    image.decoding = 'async';
    requestAnimationFrame(() => {
      frame.classList.remove('is-loading');
      frame.classList.remove('has-preview');
      frame.removeAttribute('aria-busy');
    });
  };
  loader.onerror = () => {
    if (request !== modalImageRequest) return;
    frame.classList.remove('is-loading');
    frame.classList.add('has-error');
    frame.removeAttribute('aria-busy');
  };
  loader.src = nextSrc;
}

grid.addEventListener('click', event => {
  const trigger = event.target.closest('[data-product]');
  if (trigger) openProduct(trigger.dataset.product);
});

['pointerover', 'focusin', 'pointerdown'].forEach(type => grid.addEventListener(type, event => {
  const trigger = event.target.closest('[data-product]');
  if (trigger) preloadProductImage(trigger.dataset.product);
}));

document.querySelector('#modal-thumbs').addEventListener('click', event => {
  const button = event.target.closest('[data-gallery-src]');
  if (button && activeProduct) setModalImage(button.dataset.gallerySrc, activeProduct, button, galleryThumbPath(button.dataset.gallerySrc));
});

const selectionMap = {
  drying:{ bench:'P09', standard:'P03', large:'P05' },
  culture:{ bench:'P18', standard:'P16', large:'P10' },
  heating:{ bench:'P36', standard:'P19', large:'P21' },
  prep:{ bench:'P26', standard:'P39', large:'P39' },
  clean:{ bench:'P40', standard:'P41', large:'P41' }
};

function getSelectionId(data) {
  const condition = data.get('condition');
  const scale = data.get('scale') || 'standard';
  if (condition === 'vacuum') return 'P08';
  if (condition === 'humidity') return 'P12';
  if (condition === 'high') return scale === 'bench' ? 'P22' : 'P20';
  if (condition === 'water') return scale === 'large' ? 'P24' : 'P23';
  return selectionMap[data.get('purpose')]?.[scale] || 'P03';
}

document.querySelector('#selection-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const id = getSelectionId(data);
  const product = products.find(item => item.id === id) || products[0];
  document.querySelector('#selection-result').innerHTML = `<span>推荐方向</span><h3>${product.name}</h3><p>${shortText(product.overview, 100)}</p><button type="button" data-selection-product="${product.id}">查看产品详情 →</button>`;
});

document.querySelector('#selection-result').addEventListener('click', event => {
  const button = event.target.closest('[data-selection-product]');
  if (button) openProduct(button.dataset.selectionProduct);
});

let heroIndex = 0;
let heroTimer;
let heroRequest = 0;
const hero = document.querySelector('.hero');
const track = document.querySelector('#hero-track');
const dots = [...document.querySelectorAll('.hero-dot')];
const heroSlides = [...document.querySelectorAll('.hero-slide')];
const heroLoads = new Map();
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const heroMessages = [
  { kicker:'TIANTAI INSTRUMENT', title:'天泰仪器', accent:'让每一次实验稳定可控', lead:'从样品干燥、恒温培养到加热处理与洁净操作，为实验室提供可靠的设备支持。' },
  { kicker:'DRYING · 101 SERIES', title:'恒温干燥', accent:'让热处理更可重复', lead:'天泰干燥设备服务于样品干燥、烘焙与热处理，兼顾温度控制和日常操作效率。' },
  { kicker:'CLIMATE · HSP SERIES', title:'温湿协同', accent:'培养条件稳定可控', lead:'天泰 HSP 恒温恒湿培养箱，为药物、食品与材料稳定性试验提供可控环境。' },
  { kicker:'CLEAN WORK · CJ SERIES', title:'洁净操作', accent:'从稳定工作区开始', lead:'天泰 CJ 净化工作台，为生物制药、生物化学与环境监测提供局部洁净环境。' }
];

function loadHeroSlide(index) {
  if (heroLoads.has(index)) return heroLoads.get(index);
  const slide = heroSlides[index];
  const image = slide?.querySelector('img[data-src]');
  if (!image) return Promise.resolve();
  const source = slide.querySelector('source[data-srcset]');
  if (source) {
    source.srcset = source.dataset.srcset;
    delete source.dataset.srcset;
  }
  image.src = image.dataset.src;
  delete image.dataset.src;
  const ready = typeof image.decode === 'function'
    ? image.decode().catch(() => {})
    : new Promise(resolve => image.addEventListener('load', resolve, { once:true }));
  heroLoads.set(index, ready);
  return ready;
}

async function showHero(index) {
  const nextIndex = (index + dots.length) % dots.length;
  const request = ++heroRequest;
  await loadHeroSlide(nextIndex);
  if (request !== heroRequest) return;
  heroIndex = nextIndex;
  const message = heroMessages[heroIndex];
  track.style.transform = `translateX(-${heroIndex * (100 / dots.length)}%)`;
  document.querySelector('#hero-kicker').textContent = message.kicker;
  document.querySelector('#hero-title-main').textContent = message.title;
  document.querySelector('#hero-title-accent').innerHTML = message.accent;
  document.querySelector('#hero-lead').textContent = message.lead;
  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle('active', dotIndex === heroIndex);
    dot.setAttribute('aria-current', dotIndex === heroIndex ? 'true' : 'false');
  });
  if (heroIndex > 0) {
    const nextSlide = (heroIndex + 1) % dots.length;
    setTimeout(() => loadHeroSlide(nextSlide), 250);
  }
}

function startHero() {
  clearTimeout(heroTimer);
  if (!reduceMotion.matches) heroTimer = setTimeout(async () => {
    await showHero(heroIndex + 1);
    startHero();
  }, 2500);
}

async function selectHero(index) {
  clearTimeout(heroTimer);
  await showHero(index);
  startHero();
}

document.querySelector('#hero-prev').addEventListener('click', () => selectHero(heroIndex - 1));
document.querySelector('#hero-next').addEventListener('click', () => selectHero(heroIndex + 1));
dots.forEach(dot => dot.addEventListener('click', () => selectHero(Number(dot.dataset.heroSlide))));
hero.addEventListener('mouseenter', () => clearTimeout(heroTimer));
hero.addEventListener('mouseleave', startHero);
hero.addEventListener('focusin', () => clearTimeout(heroTimer));
hero.addEventListener('focusout', startHero);
document.addEventListener('visibilitychange', () => document.hidden ? clearTimeout(heroTimer) : startHero());
showHero(0);
if (document.readyState === 'complete') startHero();
else window.addEventListener('load', startHero, { once:true });

const warmHeroSlides = async () => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const limitedConnection = connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '');
  if (!limitedConnection) await loadHeroSlide(1);
};
const scheduleHeroWarmup = () => {
  if ('requestIdleCallback' in window) requestIdleCallback(warmHeroSlides, { timeout:1200 });
  else setTimeout(warmHeroSlides, 350);
};
if (document.readyState === 'complete') scheduleHeroWarmup();
else window.addEventListener('load', scheduleHeroWarmup, { once:true });

const inquiry = document.querySelector('#inquiry-modal');
const inquiryNeed = document.querySelector('#inquiry-form textarea[name="need"]');
inquiryNeed.addEventListener('input', () => delete inquiryNeed.dataset.autofilled);

function prepareInquiry(prefix = '', label = '咨询方向') {
  if (productModal.open) closeModal(productModal);
  if (prefix) {
    inquiryNeed.value = `${label}：${prefix}\n样品 / 应用：\n目标条件：\n单次处理量：`;
    inquiryNeed.dataset.autofilled = 'true';
  } else if (inquiryNeed.dataset.autofilled === 'true') {
    inquiryNeed.value = '';
    delete inquiryNeed.dataset.autofilled;
  }
  document.querySelector('#form-note').textContent = '';
  openModal(inquiry);
}

document.querySelectorAll('.js-inquiry').forEach(button => button.addEventListener('click', () => {
  const productName = button.closest('#product-modal') && activeProduct ? activeProduct.name : '';
  prepareInquiry(productName, '咨询产品');
}));
document.querySelectorAll('.js-quick-inquiry').forEach(button => button.addEventListener('click', () => prepareInquiry(button.dataset.quick)));
document.querySelectorAll('.modal-close').forEach(button => button.addEventListener('click', () => closeModal(button.closest('dialog'))));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) closeModal(dialog); }));

document.querySelector('#inquiry-form').addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const text = `天泰仪器咨询需求\n称呼：${data.get('name') || '未填写'}\n电话：${data.get('phone') || '未填写'}\n需求类型：${data.get('category')}\n关键条件：${data.get('condition') || '未填写'}\n需求说明：${data.get('need') || '请协助产品选型'}`;
  const note = document.querySelector('#form-note');
  try {
    await navigator.clipboard.writeText(text);
    note.textContent = '需求信息已复制，可通过电话或 QQ 发送给我们。';
  } catch {
    note.textContent = '请复制需求内容，并拨打 022-63324885 与我们联系。';
  }
});

const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.primary-nav');

function closeMobileNav() {
  if (!nav.classList.contains('open')) return;
  nav.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
  syncMobileCta();
}

toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  syncMobileCta();
});
nav.querySelectorAll('a, button').forEach(link => link.addEventListener('click', () => {
  closeMobileNav();
}));

document.addEventListener('pointerdown', event => {
  if (!nav.classList.contains('open')) return;
  if (nav.contains(event.target) || toggle.contains(event.target)) return;
  closeMobileNav();
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !nav.classList.contains('open')) return;
  closeMobileNav();
  toggle.focus();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 960) {
    closeMobileNav();
  }
  syncMobileCta();
});

const mobileCta = document.querySelector('.mobile-cta');
const mobileViewport = window.matchMedia('(max-width:640px)');
let mobileHeroVisible = true;
let mobileContactVisible = false;

function syncMobileCta() {
  if (!mobileCta) return;
  const shouldShow = mobileViewport.matches
    && !mobileHeroVisible
    && !mobileContactVisible
    && !document.body.classList.contains('modal-open')
    && !nav.classList.contains('open');
  mobileCta.classList.toggle('is-visible', shouldShow);
  mobileCta.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
  mobileCta.toggleAttribute('inert', !shouldShow);
}

const mobileHeroObserver = new IntersectionObserver(([entry]) => {
  mobileHeroVisible = entry.isIntersecting;
  syncMobileCta();
}, { threshold:0, rootMargin:'-68px 0px 0px' });

const mobileContactObserver = new IntersectionObserver(([entry]) => {
  mobileContactVisible = entry.isIntersecting;
  syncMobileCta();
}, { threshold:.05 });

mobileHeroObserver.observe(hero);
mobileContactObserver.observe(document.querySelector('#contact'));
if (typeof mobileViewport.addEventListener === 'function') mobileViewport.addEventListener('change', syncMobileCta);
else mobileViewport.addListener(syncMobileCta);
syncMobileCta();

const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) {
    entry.target.classList.add('visible');
    observer.unobserve(entry.target);
  }
}), { threshold:.08 });
document.querySelectorAll('.reveal').forEach(item => observer.observe(item));

const sceneObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  const element = entry.target;
  sceneObserver.unobserve(element);
  const loader = new Image();
  element._sceneLoader = loader;
  loader.decoding = 'async';
  loader.fetchPriority = 'low';
  loader.onload = async () => {
    try { await loader.decode(); } catch {}
    if (element.classList.contains('solution-card')) {
      element.style.setProperty('--scene-image', `url("${element.dataset.scene}")`);
    } else {
      element.style.backgroundImage = `linear-gradient(rgba(0,58,64,.08),rgba(0,58,64,.12)),url("${element.dataset.scene}")`;
    }
    element.classList.add('scene-loaded');
    delete element._sceneLoader;
  };
  loader.src = element.dataset.scene;
}), { rootMargin:'250px 0px' });
document.querySelectorAll('[data-scene]').forEach(item => sceneObserver.observe(item));

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    document.body.classList.remove('modal-open');
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    syncMobileCta();
  }
});
