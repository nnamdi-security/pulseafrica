/* ============================================================
   Live ticker — load after api.js on every page:
     <script src="api.js"></script>
     <script src="ticker.js"></script>
   Replaces the neutral placeholder items in <div data-ticker>
   with figures from GET /api/stats and GET /api/polls. If the
   API can't be reached, the placeholder stays: the ticker never
   shows numbers it didn't get from the server.

   Also exposes window.PulseLive so a page (index.html) can reuse
   the same requests and headline maths.
   ============================================================ */
(function () {
  const CATEGORIES = [
    ['presidency', 'Presidency'], ['governors', 'Governors'], ['economy', 'Economy'],
    ['security', 'Security'], ['education', 'Education'], ['healthcare', 'Healthcare'],
    ['governance', 'Governance']
  ];
  const SCROLL_PX_PER_SECOND = 45;

  /* Headline figure for a poll's first question, from the preview in GET /api/polls.
     Options are grouped by position as on the other pages: the first half lean
     positive, so the headline is the share choosing one of them. */
  function headline(poll) {
    const options = poll.preview || [];
    const half = Math.floor(options.length / 2);
    const total = options.reduce(function (s, o) { return s + o.count; }, 0);
    if (!half || !total) return null;
    const positive = options.slice(0, half);
    const count = positive.reduce(function (s, o) { return s + o.count; }, 0);
    return {
      percent: 100 * count / total,
      label: positive[positive.length - 1].text,        /* "Approve", "Managing", … */
      approval: options.some(function (o) { return /\bapprove\b/i.test(o.text); }),
      total: total
    };
  }

  /* The live poll with the most responses in each category that has one */
  function leadersByCategory(polls) {
    return CATEGORIES.map(function (c) {
      const live = polls.filter(function (p) { return p.status === 'active' && p.category === c[0] && p.responseCount; });
      if (!live.length) return null;
      const poll = live.reduce(function (a, b) { return b.responseCount > a.responseCount ? b : a; });
      const h = headline(poll);
      return h ? { key: c[0], name: c[1], poll: poll, headline: h } : null;
    }).filter(Boolean);
  }

  function shortTitle(title) {
    return title.split(' — ')[0];
  }

  const stats = PulseAPI.getStats();
  const polls = PulseAPI.listPolls();

  window.PulseLive = {
    stats: stats,
    polls: polls,
    headline: headline,
    leadersByCategory: leadersByCategory,
    shortTitle: shortTitle,
    categoryName: function (key) {
      const c = CATEGORIES.find(function (x) { return x[0] === key; });
      return c ? c[1] : 'Poll';
    }
  };

  const inner = document.querySelector('[data-ticker]');
  if (!inner) return;

  function itemHTML(item, hidden) {
    const div = document.createElement('div');
    div.className = 'tick-item';
    if (hidden) div.setAttribute('aria-hidden', 'true');
    div.innerHTML = '<span class="tick-dot' + (item.warn ? ' warn' : '') + '"></span>' +
      '<span class="tick-label"></span><span class="tick-val"></span>';
    div.querySelector('.tick-label').textContent = item.label;
    div.querySelector('.tick-val').textContent = item.value;
    return div.outerHTML;
  }

  /* The strip scrolls by exactly half its width (style.css), so the items appear
     twice. A short list is repeated first so that one half is wider than the
     screen and no gap shows at the seam. The copies are hidden from screen readers. */
  function render(items) {
    const once = items.map(function (it) { return itemHTML(it, false); }).join('');
    inner.innerHTML = once;
    const setWidth = inner.scrollWidth || 1;
    const repeats = Math.max(1, Math.ceil(window.innerWidth / setWidth));
    const copy = items.map(function (it) { return itemHTML(it, true); }).join('');
    let html = once;
    for (let i = 1; i < repeats * 2; i++) html += copy;
    inner.innerHTML = html;
    /* Same speed whatever the content length */
    inner.style.animationDuration = Math.round(setWidth * repeats / SCROLL_PX_PER_SECOND) + 's';
  }

  function placeholderItems() {
    return Array.prototype.map.call(inner.querySelectorAll('.tick-item:not([aria-hidden])'), function (el) {
      return {
        label: el.querySelector('.tick-label').textContent,
        value: el.querySelector('.tick-val').textContent,
        warn: el.querySelector('.tick-dot').classList.contains('warn')
      };
    });
  }

  const fallback = placeholderItems();
  render(fallback);

  Promise.all([stats, polls]).then(function (data) {
    const s = data[0];
    const list = data[1];
    const leaders = leadersByCategory(list);
    const trending = list.find(function (p) { return p.id === s.trendingPollId; });

    const categoryItems = leaders.map(function (l) {
      return {
        label: l.headline.approval ? l.name + ' approval' : l.name + ' · ' + l.headline.label,
        value: l.headline.percent.toFixed(1) + '%',
        warn: l.headline.percent < 50
      };
    });
    const statItems = [
      { label: 'Active polls', value: s.activePolls.toLocaleString(), warn: true },
      { label: 'Total responses', value: s.totalResponses.toLocaleString() },
      { label: 'This week', value: s.responsesLast7Days.toLocaleString() + ' responses', warn: true },
      { label: 'Registered voices', value: s.registeredUsers.toLocaleString() }
    ];
    if (trending) statItems.splice(2, 0, { label: 'Trending poll', value: shortTitle(trending.title), warn: true });

    /* Alternate headline results with platform figures */
    const items = [];
    const longest = Math.max(categoryItems.length, statItems.length);
    for (let i = 0; i < longest; i++) {
      if (categoryItems[i]) items.push(categoryItems[i]);
      if (statItems[i]) items.push(statItems[i]);
    }
    render(items);
    inner.closest('.ticker').setAttribute('aria-label', 'Live platform figures');
  }).catch(function () {
    /* Keep the neutral placeholder rather than show stale or invented numbers */
  });
})();
