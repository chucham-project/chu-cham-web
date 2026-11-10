let db = { packs: [], authors: {}, works: {} };
let allCards = [], currentCard = null;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }
};
let read = store.get('cc_read', []), saved = store.get('cc_saved', []);

/* ---------- UTILS ---------- */
function removeAccents(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}
const searchMatch = (text, q) => !!text && removeAccents(text).includes(removeAccents(q));
const formatText = t => t ? t.split('\n\n').map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`).join('') : '';
const cleanSource = s => (s || '').replace(/^[\s\-–—]+|[\s\-–—]+$/g, '');
const quoteLines = q => (q || 'Đang cập nhật').split(/\s*\/\s*/).map(l => `<span class="quote-line">${esc(l)}</span>`).join('');
const nameOf = c => db.authors[c.author_slug]?.name || 'Đang cập nhật';
const workOf = c => db.works[c.work_slug]?.title || 'Đang cập nhật';

function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- THEME ---------- */
function initTheme() {
    const saved = store.get('cc_theme', null);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    updateThemeBtn(theme);
}
function updateThemeBtn(theme) {
    const btn = $('#themeToggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
    const cur = document.documentElement.dataset.theme;
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('cc_theme', next);
    updateThemeBtn(next);
    toast(next === 'dark' ? '🌙 Chế độ đêm' : '☀️ Chế độ ngày');
}

/* ---------- STREAK ---------- */
function updateStreak() {
    const today = new Date().toISOString().slice(0, 10);
    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    let streak = store.get('cc_streak', { last: null, count: 0 });
    if (streak.last === today) return streak;
    if (streak.last === yest) streak.count = (streak.count || 0) + 1;
    else streak.count = 1;
    streak.last = today;
    store.set('cc_streak', streak);
    return streak;
}
function renderStreakHTML() {
    const streak = store.get('cc_streak', { count: 0 });
    if (!streak.count || streak.count < 1) return '';
    return `<div class="streak-chip">🔥 Chuỗi ${streak.count} ngày đọc</div>`;
}

/* ---------- LOAD DATA ---------- */
async function loadData() {
    for (const url of ['./data/cards.json', './cards.json']) {
        try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { }
    }
    throw new Error('Không tải được cards.json');
}

async function init() {
    initTheme();
    try {
        db = await loadData();
        db.packs.forEach(pack => pack.cards.forEach(card => {
            Object.assign(card, { packName: pack.name, packId: pack.id, packColor: pack.color });
            allCards.push(card);
        }));
        const qs = new URLSearchParams(location.search).get('card');
        if (qs && allCards.some(c => c.slug === qs)) history.replaceState(null, '', location.pathname + '#/card/' + qs);
        renderHome();
        setupSearch();
        window.addEventListener('hashchange', router);
        router();
    } catch (e) {
        console.error(e);
        $('#app').innerHTML = `<h2 style="text-align:center;padding:50px">Lỗi tải dữ liệu. Vui lòng chạy Live Server hoặc GitHub Pages.</h2>`;
    } finally {
        const ls = $('#loadingScreen');
        if (ls) { ls.classList.add('hide'); setTimeout(() => ls.remove(), 700); }
    }
}

/* ---------- SEARCH ---------- */
function setupSearch() {
    const input = $('#globalSearch'), box = $('#searchResults');
    const group = (title, items) => items.length ? `<div class="search-group-title">${title}</div>${items.join('')}` : '';
    input.addEventListener('input', e => {
        const q = e.target.value.trim();
        if (!q) { box.hidden = true; return; }
        const packs = db.packs.filter(p => searchMatch(p.name, q) || searchMatch(p.description, q));
        const cards = allCards.filter(c => [c.title, c.subtitle, c.quote, c.introduction, nameOf(c), workOf(c)].some(t => searchMatch(t, q))).slice(0, 8);
        const authors = Object.entries(db.authors).filter(([, a]) => searchMatch(a.name, q)).slice(0, 4);
        const works = Object.entries(db.works).filter(([, w]) => searchMatch(w.title, q)).slice(0, 4);
        const html =
            group('📦 Bộ sưu tập', packs.map(p => `<a href="#/pack/${p.id}" class="search-item" style="border-left:4px solid ${p.color}"><div class="search-item-title">${esc(p.name)}</div><div class="search-item-meta">${esc(p.description)}</div></a>`)) +
            group('🎴 Thẻ bài', cards.map(c => `<a href="#/card/${c.slug}" class="search-item"><div class="search-item-title">${esc(c.title)}</div><div class="search-item-meta"><span class="search-badge" style="background:${c.packColor}">${esc(c.packName)}</span><span>${esc(nameOf(c))} · ${esc(workOf(c))}</span></div></a>`)) +
            group('🖋️ Tác giả', authors.map(([s, a]) => `<a href="#/author/${s}" class="search-item"><div class="search-item-title">${esc(a.name)}</div><div class="search-item-meta">${esc(a.years)}</div></a>`)) +
            group('📚 Tác phẩm', works.map(([s, w]) => `<a href="#/work/${s}" class="search-item"><div class="search-item-title">${esc(w.title)}</div></a>`));
        box.innerHTML = html || `<div class="search-empty">Không tìm thấy kết quả cho "${esc(q)}"</div>`;
        box.hidden = false;
    });
    box.addEventListener('click', e => { if (e.target.closest('a')) setTimeout(window.closeSearch, 50); });
    document.addEventListener('click', e => { if (!e.target.closest('.search-wrapper')) box.hidden = true; });
}
window.closeSearch = () => { $('#searchResults').hidden = true; $('#globalSearch').value = ''; };

/* ---------- ROUTER ---------- */
function router() {
    const parts = (location.hash || '#/').split('/');
    const type = parts[1] || '', slug = decodeURIComponent(parts[2] || '');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    window.closeSearch(); currentCard = null; document.title = 'Chữ Chạm — Thẻ văn học';
    $('.main-nav').classList.remove('open');
    document.body.classList.remove('zen-mode');

    let view = 'view-home';
    if (type === 'pack') {
        const pack = db.packs.find(p => p.id === slug);
        if (pack) { renderPack(pack); view = 'view-pack'; }
    } else if (type === 'card') {
        const card = allCards.find(c => c.slug === slug);
        renderCard(card); view = 'view-card';
    } else if (type === 'author' || type === 'work') {
        if ((type === 'author' ? db.authors : db.works)[slug]) { renderEntity(type, slug); view = 'view-pack'; }
    }

    $('#' + view).classList.add('active');
    if (view === 'view-home') { renderProgress(); renderStreakHTMLInline(); renderDraw(); renderConstellation(); }

    if (type === 'draw') setTimeout(() => $('#drawSection')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    else window.scrollTo(0, 0);

    observeReveal();
}

/* ---------- HOME ---------- */
function renderHome() {
    $('#homePackGrid').innerHTML = db.packs.map((p, i) => `
    <a href="#/pack/${p.id}" class="theme-card reveal" style="background-color:${p.color}15;color:${p.color}">
      <span>0${i + 1} / ${esc(p.name.toUpperCase())}</span><strong>${esc(p.description)}</strong><i>↗</i>
    </a>`).join('');
}

function renderProgress() {
    const n = read.length, total = allCards.length;
    $('#progressBox').innerHTML = `
    <div class="progress-text">Bạn đã chạm <b>${n}/${total}</b> thẻ${n === total ? ' — trọn bộ rồi! 🎉' : ''}</div>
    <div class="progress-dots">${db.packs.map(p => p.cards.map(c => `<a href="#/card/${c.slug}" title="${esc(c.title)}" class="dot ${read.includes(c.slug) ? 'on' : ''}" style="--accent:${p.color}"></a>`).join('')).join('<i></i>')}</div>
    <div id="streakSlot"></div>`;
    if (n === total && !store.get('cc_celebrated', false)) {
        launchConfetti();
        store.set('cc_celebrated', true);
        toast('🎉 Chúc mừng! Bạn đã đọc trọn bộ 21 thẻ!');
    }
}
function renderStreakHTMLInline() {
    const slot = $('#streakSlot');
    if (slot) slot.innerHTML = renderStreakHTML();
}

/* ---------- CONSTELLATION ---------- */
const STAR_POSITIONS = {
    'chanh-venh': [[12, 18], [22, 32], [18, 48], [30, 55], [15, 68], [38, 72], [42, 42]],
    'nhung-nho': [[58, 15], [68, 25], [78, 18], [85, 35], [72, 45], [88, 55], [75, 62]],
    'vo-ve': [[28, 85], [38, 92], [50, 78], [60, 88], [70, 78], [82, 82], [48, 92]]
};

function renderConstellation() {
    const map = $('#starMap');
    if (!map) return;
    const svgNS = 'http://www.w3.org/2000/svg';
    let svgLines = '';
    db.packs.forEach(pack => {
        const positions = STAR_POSITIONS[pack.id];
        if (!positions) return;
        positions.forEach((pos, i) => {
            if (i === 0) return;
            const prev = positions[i - 1];
            svgLines += `<line x1="${prev[0]}" y1="${prev[1]}" x2="${pos[0]}" y2="${pos[1]}" stroke="${pack.color}" stroke-opacity="0.35" stroke-width="0.2" vector-effect="non-scaling-stroke"/>`;
        });
    });

    let starsHTML = '';
    db.packs.forEach(pack => {
        const positions = STAR_POSITIONS[pack.id];
        if (!positions) return;
        pack.cards.forEach((card, i) => {
            const [x, y] = positions[i] || [50, 50];
            const isRead = read.includes(card.slug);
            starsHTML += `<a href="#/card/${card.slug}" class="star ${isRead ? 'is-read' : ''}" style="left:${x}%;top:${y}%;--accent:${pack.color}" title="${esc(card.title)}">
                <span class="star-label">${esc(card.title)}</span>
            </a>`;
        });
    });

    map.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${svgLines}</svg>${starsHTML}`;
}

/* ---------- DRAW ---------- */
function renderDraw() {
    $('#drawBox').innerHTML = `<button class="draw-card" id="drawBtn"><em>✦</em><strong>Chạm để rút một thẻ</strong><small>Mỗi lần rút là một cuộc gặp gỡ bất ngờ</small></button>`;
    $('#drawBtn').onclick = drawCard;
}
window.drawCard = function () {
    const unread = allCards.filter(c => !read.includes(c.slug));
    const list = unread.length ? unread : allCards;
    const c = list[Math.floor(Math.random() * list.length)];
    $('#drawBox').innerHTML = `
    <div class="draw-card revealed" style="--accent:${c.packColor}">
      <span class="eyebrow" style="color:${c.packColor}">${esc(c.packName)} · ${c.code}</span>
      <h3>${esc(c.title)}</h3><p class="draw-quote">${quoteLines(c.quote)}</p>
      <small>${esc(cleanSource(c.quote_source))}</small>
      <div class="draw-actions"><a class="btn btn-primary" href="#/card/${c.slug}">Đọc tiếp →</a><button class="btn btn-ghost" onclick="drawCard()">Rút lại</button></div>
    </div>`;
};

/* ---------- PACK / ENTITY ---------- */
const tile = (c, i) => `
  <a href="#/card/${c.slug}" class="literary-card reveal" style="--accent:${c.packColor}">
    <span class="card-number">${String(i + 1).padStart(2, '0')} / ${c.code}
      ${saved.includes(c.slug) ? '<b class="mark">♥</b>' : ''}${read.includes(c.slug) ? '<b class="mark read">✓ đã đọc</b>' : ''}</span>
    <h3>${esc(c.title)}</h3><span class="card-author">${esc(nameOf(c))}</span>
    <span class="card-work" style="color:${c.packColor}">${esc(workOf(c))}</span>
  </a>`;

function renderPack(pack) {
    $('#packHeader').innerHTML = `<p class="eyebrow" style="color:${pack.color}">BỘ SƯU TẬP</p><h1 style="color:${pack.color}">${esc(pack.name)}</h1><p>${esc(pack.description)}</p>`;
    $('#packCardGrid').innerHTML = pack.cards.map(tile).join('');
}
function renderEntity(type, slug) {
    const e = (type === 'author' ? db.authors : db.works)[slug];
    const cards = allCards.filter(c => c[type + '_slug'] === slug);
    $('#packHeader').innerHTML = `<p class="eyebrow">${type === 'author' ? 'TÁC GIẢ' : 'TÁC PHẨM'}</p><h1>${esc(e.name || e.title)}</h1>
      ${e.years ? `<p>${esc(e.years)}</p>` : ''}<div class="entity-bio text-content">${formatText(e.content)}</div>
      <p class="eyebrow" style="margin-top:40px">XUẤT HIỆN TRONG ${cards.length} THẺ</p>`;
    $('#packCardGrid').innerHTML = cards.map(tile).join('');
}

/* ---------- CARD DETAIL ---------- */
window.toggleAccordion = btn => btn.parentElement.classList.toggle('active');
window.toggleSave = slug => {
    saved = saved.includes(slug) ? saved.filter(s => s !== slug) : [...saved, slug];
    store.set('cc_saved', saved);
    const b = $('#saveBtn'); b.classList.toggle('on', saved.includes(slug));
    toast(saved.includes(slug) ? 'Đã lưu thẻ ♥' : 'Đã bỏ lưu');
};
window.copyLink = slug => {
    const url = location.origin + location.pathname + '#/card/' + slug;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Đã sao chép liên kết'), () => prompt('Sao chép liên kết:', url));
};
window.randomCard = () => { const o = allCards.filter(c => c.slug !== currentCard?.slug); location.hash = '#/card/' + o[Math.floor(Math.random() * o.length)].slug; };

window.toggleZen = () => {
    document.body.classList.toggle('zen-mode');
    const isZen = document.body.classList.contains('zen-mode');
    toast(isZen ? '🧘 Chế độ tập trung bật' : 'Đã thoát chế độ tập trung');
    const btn = $('#zenExit');
    if (btn) btn.style.display = isZen ? 'block' : 'none';
};

window.downloadCardImage = async (slug) => {
    const card = allCards.find(c => c.slug === slug);
    if (!card) return;
    toast('Đang tạo ảnh thẻ...');
    await new Promise(r => setTimeout(r, 100));
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext('2d');

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#f9f6f0');
    grad.addColorStop(1, card.packColor + '30');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative circle
    ctx.fillStyle = card.packColor + '18';
    ctx.beginPath();
    ctx.arc(canvas.width - 120, 120, 320, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.arc(120, canvas.height - 120, 280, 0, Math.PI * 2); ctx.fill();

    // Border
    ctx.strokeStyle = card.packColor; ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, canvas.width - 120, canvas.height - 120);

    // Eyebrow
    ctx.fillStyle = card.packColor; ctx.font = 'bold 28px Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`${card.packName.toUpperCase()} · ${card.code}`, canvas.width / 2, 180);

    // Title
    ctx.fillStyle = '#2b2825'; ctx.font = 'bold 110px "Playfair Display", Georgia, serif';
    ctx.fillText(card.title, canvas.width / 2, 360);

    // Subtitle
    ctx.fillStyle = '#756e64'; ctx.font = 'italic 32px "Lora", Georgia, serif';
    wrapText(ctx, card.subtitle || '', canvas.width / 2, 430, 900, 46);

    // Divider
    ctx.strokeStyle = card.packColor; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(canvas.width / 2 - 50, 530); ctx.lineTo(canvas.width / 2 + 50, 530); ctx.stroke();

    // Quote lines
    ctx.fillStyle = '#3a3630'; ctx.font = 'italic 46px "Lora", Georgia, serif';
    const qLines = (card.quote || '').split('/').map(s => s.trim()).filter(Boolean).slice(0, 4);
    let yPos = 630;
    qLines.forEach(line => {
        ctx.fillText(`“${line}”`, canvas.width / 2, yPos);
        yPos += 68;
    });

    // Source
    ctx.fillStyle = '#756e64'; ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillText(cleanSource(card.quote_source), canvas.width / 2, canvas.height - 220);

    // Logo
    ctx.fillStyle = card.packColor; ctx.font = 'bold 40px Arial, sans-serif';
    ctx.fillText('CHỮ CHẠM.', canvas.width / 2, canvas.height - 110);

    const link = document.createElement('a');
    link.download = `chu-cham-${card.slug}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('✓ Đã tải ảnh thẻ về máy');
};

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' '); let line = ''; let currentY = y;
    for (let n = 0; n < words.length; n++) {
        const test = line + words[n] + ' ';
        if (ctx.measureText(test).width > maxWidth && n > 0) {
            ctx.fillText(line.trim(), x, currentY);
            line = words[n] + ' ';
            currentY += lineHeight;
        } else { line = test; }
    }
    ctx.fillText(line.trim(), x, currentY);
}

let quoteObserver;
function renderCard(card) {
    const box = $('#cardDetailContainer');
    if (!card) {
        box.innerHTML = `<div class="not-found"><h1>Chưa tìm thấy thẻ này</h1><p>Đường dẫn có thể đã thay đổi. Hãy thử rút một thẻ khác nhé.</p><a class="btn btn-primary" href="#/draw">✦ Rút một thẻ</a></div>`;
        return;
    }
    currentCard = card;
    document.title = `${card.title} — Chữ Chạm`;
    if (!read.includes(card.slug)) { read.push(card.slug); store.set('cc_read', read); }
    updateStreak();

    const author = db.authors[card.author_slug] || {}, work = db.works[card.work_slug] || {};
    const pack = db.packs.find(p => p.id === card.packId), i = pack.cards.indexOf(card), n = pack.cards.length;
    const prev = pack.cards[(i - 1 + n) % n], next = pack.cards[(i + 1) % n];
    const more = [1, 2, 3].map(k => pack.cards[(i + k + 1) % n]).filter(c => c !== card && c !== next);

    box.style.setProperty('--accent', card.packColor);
    box.innerHTML = `
    <button class="zen-exit" id="zenExit" onclick="toggleZen()">✕ Thoát tập trung</button>
    <a href="#/pack/${card.packId}" class="back-btn">← Trở về ${esc(card.packName)}</a>
    <div class="card-detail-header">
      <p class="eyebrow" style="color:${card.packColor}">${esc(card.packName.toUpperCase())} · ${card.code}</p>
      <h1>${esc(card.title)}</h1><p class="card-detail-subtitle">${esc(card.subtitle || '')}</p>
      <div class="card-actions">
        <button class="chip ${saved.includes(card.slug) ? 'on' : ''}" id="saveBtn" onclick="toggleSave('${card.slug}')">♥ Lưu</button>
        <button class="chip" onclick="copyLink('${card.slug}')">🔗 Chia sẻ</button>
        <button class="chip" onclick="downloadCardImage('${card.slug}')">🖼️ Tải ảnh</button>
        <button class="chip" onclick="toggleZen()">🧘 Tập trung</button>
        <button class="chip" onclick="randomCard()">✦ Ngẫu nhiên</button>
      </div>
    </div>
    <div class="card-section"><h3>Lời dẫn</h3><div class="text-content">${formatText(card.introduction) || '<p>Nội dung đang cập nhật.</p>'}</div></div>
    <div class="quote-box"><p>“${quoteLines(card.quote)}”</p><div class="quote-source">${esc(cleanSource(card.quote_source))}</div></div>
    <div class="card-section"><h3>Gợi mở & Phân tích</h3><div class="text-content">${formatText(card.analysis) || '<p>Nội dung đang cập nhật.</p>'}</div></div>
    <div class="accordion-list">
      <div class="accordion-item"><button class="accordion-header" onclick="toggleAccordion(this)"><span>Đôi nét về Tác giả: <strong>${esc(author.name || 'Đang cập nhật')}</strong></span><span class="accordion-icon">+</span></button>
        <div class="accordion-content"><div class="accordion-content-inner"><div class="text-content">${formatText(author.content) || '<p>Thông tin đang cập nhật.</p>'}</div>
        ${author.name ? `<a class="more-link" href="#/author/${card.author_slug}">Xem các thẻ của ${esc(author.name)} →</a>` : ''}</div></div></div>
      <div class="accordion-item"><button class="accordion-header" onclick="toggleAccordion(this)"><span>Khám phá Tác phẩm: <strong>${esc(work.title || 'Đang cập nhật')}</strong></span><span class="accordion-icon">+</span></button>
        <div class="accordion-content"><div class="accordion-content-inner"><div class="text-content">${formatText(work.content) || '<p>Thông tin đang cập nhật.</p>'}</div></div></div></div>
    </div>
    <nav class="card-nav">
      <a href="#/card/${prev.slug}"><small>← Thẻ trước</small><strong>${esc(prev.title)}</strong></a>
      <a href="#/card/${next.slug}" class="next"><small>Thẻ tiếp theo →</small><strong>${esc(next.title)}</strong></a>
    </nav>
    <div class="related"><p class="eyebrow">CÓ THỂ BẠN CŨNG MUỐN ĐỌC</p><div class="related-grid">
      ${more.map(c => `<a href="#/card/${c.slug}" style="--accent:${c.packColor}"><span>${c.code}</span><strong>${esc(c.title)}</strong></a>`).join('')}</div></div>`;

    if (!quoteObserver) {
        quoteObserver = new IntersectionObserver(entries => {
            entries.forEach(e => e.target.classList.toggle('in-view', e.isIntersecting));
        }, { threshold: 0.5 });
    }
    document.querySelectorAll('.quote-box').forEach(q => quoteObserver.observe(q));

    // Confetti nếu hoàn thành 21 thẻ
    if (read.length === allCards.length && !store.get('cc_celebrated', false)) {
        launchConfetti();
        store.set('cc_celebrated', true);
        toast('🎉 Chúc mừng! Bạn đã đọc trọn bộ 21 thẻ!');
    }
}

/* ---------- CONFETTI ---------- */
function launchConfetti() {
    const container = $('#confetti');
    if (!container) return;
    const colors = ['#B55F46', '#967A97', '#557B5E', '#c9a86a', '#e8b9a8', '#f0e9dd'];
    for (let i = 0; i < 80; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = (Math.random() * 0.6) + 's';
        piece.style.animationDuration = (2 + Math.random() * 2) + 's';
        piece.style.width = (6 + Math.random() * 8) + 'px';
        piece.style.height = (6 + Math.random() * 8) + 'px';
        container.appendChild(piece);
        setTimeout(() => piece.remove(), 5500);
    }
}

/* ---------- FX ---------- */
let io;
function observeReveal() {
    io ||= new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    document.querySelectorAll('.reveal:not(.in)').forEach((el, i) => { el.style.transitionDelay = (i % 7) * 60 + 'ms'; io.observe(el); });
}
window.addEventListener('scroll', () => {
    const h = document.documentElement;
    $('#readProgress').style.width = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight) * 100) + '%';
}, { passive: true });

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('zen-mode')) { toggleZen(); return; }
    if (!currentCard || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const cards = db.packs.find(p => p.id === currentCard.packId).cards, i = cards.indexOf(currentCard);
    if (e.key === 'ArrowRight') location.hash = '#/card/' + cards[(i + 1) % cards.length].slug;
    if (e.key === 'ArrowLeft') location.hash = '#/card/' + cards[(i - 1 + cards.length) % cards.length].slug;
});

$('#themeToggle').addEventListener('click', toggleTheme);
$('#menuToggle').addEventListener('click', () => $('.main-nav').classList.toggle('open'));
$('#year').textContent = new Date().getFullYear();
init();
/* ========== HELP / ONBOARDING ========== */
function openHelp() {
    const modal = document.getElementById('helpModal');
    if (modal) modal.classList.add('active');
}

function closeHelp() {
    const modal = document.getElementById('helpModal');
    if (modal) modal.classList.remove('active');
}

// Chạy trực tiếp (không cần chờ DOMContentLoaded vì script đã ở cuối body)
(function setupHelp() {
    const helpFab = document.getElementById('helpFab');
    const helpCloseBtn = document.getElementById('helpCloseBtn');
    const helpStartBtn = document.getElementById('helpStartBtn');
    const modal = document.getElementById('helpModal');

    if (helpFab) helpFab.addEventListener('click', openHelp);
    if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeHelp);
    if (helpStartBtn) helpStartBtn.addEventListener('click', closeHelp);

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeHelp();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeHelp();
    });

    // Tự động mở hướng dẫn MỖI LẦN truy cập trang chủ
    setTimeout(() => {
        // Kiểm tra nếu đang ở trang chủ (không phải đang xem thẻ nào)
        if (!currentCard && (location.hash === '' || location.hash === '#/' || location.hash === '#')) {
            openHelp();
        }
    }, 1000); // Chờ 1 giây cho web load xong hiệu ứng rồi mới hiện
})();
