let db = { packs: [], authors: {}, works: {} };
let allCards = [];

function removeAccents(str) {
    if (!str) return '';
    return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase();
}

function searchMatch(text, query) {
    if (!text) return false;
    return removeAccents(text).includes(removeAccents(query));
}

function formatText(text) {
    if (!text) return '';
    return text.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('');
}

async function init() {
    try {
        const res = await fetch('./data/cards.json');
        db = await res.json();

        db.packs.forEach(pack => {
            pack.cards.forEach(card => {
                card.packName = pack.name;
                card.packId = pack.id;
                card.packColor = pack.color;
                allCards.push(card);
            });
        });

        renderHome();
        setupSearch();
        window.addEventListener('hashchange', router);
        router();
    } catch (e) {
        console.error(e);
        document.getElementById('app').innerHTML = `<h2 style="text-align:center; padding: 50px;">Lỗi tải dữ liệu. Vui lòng chạy qua Live Server.</h2>`;
    }
}

function setupSearch() {
    const searchInput = document.getElementById('globalSearch');
    const searchResults = document.getElementById('searchResults');

    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        if (!q) {
            searchResults.hidden = true;
            return;
        }

        const matchedPacks = db.packs.filter(p => searchMatch(p.name, q) || searchMatch(p.description, q));
        const matchedCards = allCards.filter(c => searchMatch(c.title, q) || searchMatch(c.subtitle, q));
        const matchedAuthors = Object.entries(db.authors).filter(([slug, a]) => searchMatch(a.name, q));
        const matchedWorks = Object.entries(db.works).filter(([slug, w]) => searchMatch(w.title, q));

        let html = '';

        if (matchedPacks.length > 0) {
            html += `<div class="search-group-title">📦 Bộ sưu tập (Pack)</div>`;
            html += matchedPacks.map(p => `
        <a href="#/pack/${p.id}" class="search-item" style="border-left: 4px solid ${p.color}">
          <div class="search-item-title">${p.name}</div>
          <div class="search-item-meta">${p.description}</div>
        </a>
      `).join('');
        }
        if (matchedCards.length > 0) {
            html += `<div class="search-group-title">🎴 Thẻ bài (Card)</div>`;
            html += matchedCards.map(c => `
        <a href="#/card/${c.slug}" class="search-item">
          <div class="search-item-title">${c.title}</div>
          <div class="search-item-meta">
            <span class="search-badge" style="background-color: ${c.packColor}">${c.packName}</span>
            <span>Tác giả: ${db.authors[c.author_slug]?.name || 'Đang cập nhật'}</span>
          </div>
        </a>
      `).join('');
        }
        if (matchedAuthors.length > 0) {
            html += `<div class="search-group-title">🖋️ Tác giả (Author)</div>`;
            html += matchedAuthors.map(([slug, a]) => `
        <a href="#/author/${slug}" class="search-item">
          <div class="search-item-title">${a.name}</div>
          <div class="search-item-meta">${a.years}</div>
        </a>
      `).join('');
        }
        if (matchedWorks.length > 0) {
            html += `<div class="search-group-title">📚 Tác phẩm (Work)</div>`;
            html += matchedWorks.map(([slug, w]) => `
        <a href="#/work/${slug}" class="search-item">
          <div class="search-item-title">${w.title}</div>
        </a>
      `).join('');
        }

        if (html === '') {
            html = `<div class="search-empty">Không tìm thấy kết quả cho "${q}"</div>`;
        }

        searchResults.innerHTML = html;
        searchResults.hidden = false;
    });

    searchResults.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
            setTimeout(() => { window.closeSearch(); }, 50);
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            searchResults.hidden = true;
        }
    });
}

window.closeSearch = function () {
    const searchResults = document.getElementById('searchResults');
    const searchInput = document.getElementById('globalSearch');
    if (searchResults) searchResults.hidden = true;
    if (searchInput) searchInput.value = '';
};

function router() {
    const hash = window.location.hash || '#/';
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    window.scrollTo(0, 0);

    window.closeSearch();

    if (hash === '#/') {
        document.getElementById('view-home').classList.add('active');
    } else if (hash.startsWith('#/pack/')) {
        const packId = hash.split('/')[2];
        const pack = db.packs.find(p => p.id === packId);
        if (pack) { renderPack(pack); document.getElementById('view-pack').classList.add('active'); }
    } else if (hash.startsWith('#/card/')) {
        const slug = hash.split('/')[2];
        const card = allCards.find(c => c.slug === slug);
        if (card) { renderCard(card); document.getElementById('view-card').classList.add('active'); }
    } else if (hash.startsWith('#/author/')) {
        const slug = hash.split('/')[2];
        const author = db.authors[slug];
        if (author) { renderAuthor(author); document.getElementById('view-author').classList.add('active'); }
    } else if (hash.startsWith('#/work/')) {
        const slug = hash.split('/')[2];
        const work = db.works[slug];
        if (work) { renderWork(work); document.getElementById('view-work').classList.add('active'); }
    }
}

function renderHome() {
    const grid = document.getElementById('homePackGrid');
    grid.innerHTML = db.packs.map((p, i) => `
    <a href="#/pack/${p.id}" class="theme-card" style="background-color: ${p.color}15; color: ${p.color}">
      <span>0${i + 1} / ${p.name.toUpperCase()}</span>
      <strong>${p.description}</strong>
      <i>↗</i>
    </a>
  `).join('');
}

function renderPack(pack) {
    document.getElementById('packHeader').innerHTML = `
    <p class="eyebrow" style="color:${pack.color}">BỘ SƯU TẬP</p>
    <h1 style="color:${pack.color}">${pack.name}</h1>
    <p>${pack.description}</p>
  `;
    document.getElementById('packCardGrid').innerHTML = pack.cards.map((c, i) => `
    <a href="#/card/${c.slug}" class="literary-card" style="border-top: 4px solid ${pack.color}">
      <span class="card-number">${String(i + 1).padStart(2, '0')} / ${c.code}</span>
      <h3>${c.title}</h3>
      <span class="card-author">${db.authors[c.author_slug]?.name || 'Đang cập nhật'}</span>
      <span class="card-work" style="color: ${pack.color}">${db.works[c.work_slug]?.title || 'Đang cập nhật'}</span>
    </a>
  `).join('');
}

// HÀM MỚI: Xử lý đóng/mở Accordion
window.toggleAccordion = function (btn) {
    const item = btn.parentElement;
    item.classList.toggle('active');
}

function renderCard(card) {
    const authorObj = db.authors[card.author_slug] || {};
    const workObj = db.works[card.work_slug] || {};
    const authorName = authorObj.name || 'Đang cập nhật';
    const workTitle = workObj.title || 'Đang cập nhật';

    document.getElementById('cardDetailContainer').innerHTML = `
    <a href="#/pack/${card.packId}" class="back-btn">← Trở về ${card.packName}</a>
    
    <div class="card-detail-header">
      <p class="eyebrow" style="color: ${card.packColor}">${card.packName.toUpperCase()} · ${card.code}</p>
      <h1>${card.title}</h1>
      <p class="card-detail-subtitle">${card.subtitle || ''}</p>
    </div>

    <div class="card-section">
      <h3>Lời dẫn</h3>
      <div class="text-content">${formatText(card.introduction) || '<p>Nội dung đang cập nhật.</p>'}</div>
    </div>

    <div class="quote-box">
      <p>“${card.quote || 'Đang cập nhật'}”</p>
      <div class="quote-source">${card.quote_source || ''}</div>
    </div>

    <div class="card-section">
      <h3>Gợi mở & Phân tích</h3>
      <div class="text-content">${formatText(card.analysis) || '<p>Nội dung đang cập nhật.</p>'}</div>
    </div>

    <!-- KHU VỰC ACCORDION MỚI -->
    <div class="accordion-list">
      <div class="accordion-item">
        <button class="accordion-header" onclick="toggleAccordion(this)">
          <span>Đôi nét về Tác giả: <strong>${authorName}</strong></span>
          <span class="accordion-icon">+</span>
        </button>
        <div class="accordion-content">
          <div class="accordion-content-inner">
             <div class="text-content">${formatText(authorObj.content) || '<p>Thông tin đang cập nhật.</p>'}</div>
          </div>
        </div>
      </div>
      
      <div class="accordion-item">
        <button class="accordion-header" onclick="toggleAccordion(this)">
          <span>Khám phá Tác phẩm: <strong>${workTitle}</strong></span>
          <span class="accordion-icon">+</span>
        </button>
        <div class="accordion-content">
          <div class="accordion-content-inner">
             <div class="text-content">${formatText(workObj.content) || '<p>Thông tin đang cập nhật.</p>'}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAuthor(author) {
    document.getElementById('authorContainer').innerHTML = `
    <a href="javascript:history.back()" class="back-btn">← Quay lại</a>
    <div class="page-header">
      <p class="eyebrow">CHÂN DUNG TÁC GIẢ</p>
      <h1>${author.name}</h1>
      <p>${author.years}</p>
    </div>
    <div class="text-content">
      ${formatText(author.content)}
    </div>
  `;
}

function renderWork(work) {
    document.getElementById('workContainer').innerHTML = `
    <a href="javascript:history.back()" class="back-btn">← Quay lại</a>
    <div class="page-header">
      <p class="eyebrow">TÁC PHẨM VĂN HỌC</p>
      <h1>${work.title}</h1>
    </div>
    <div class="text-content">
      ${formatText(work.content)}
    </div>
  `;
}

document.getElementById('menuToggle').addEventListener('click', () => document.querySelector('.main-nav').classList.toggle('open'));
document.getElementById('year').textContent = new Date().getFullYear();
init();
