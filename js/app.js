(function () {
  "use strict";

  var DATA = window.SMO_DATA;
  var STORAGE_KEY = "smo-moon-tracker:v1";
  var ALL = "all";

  var kingdoms = DATA.kingdoms;
  var kingdomById = {};
  kingdoms.forEach(function (k) {
    kingdomById[k.id] = k;
    k.moons.forEach(function (m) {
      m.id = k.id + "-" + m.n;
      m.kingdom = k;
      m.value = m.multi ? 3 : 1; // a Multi Moon counts as 3 Power Moons
      m.haystack = (m.name + "\n" + m.how + "\n" + m.when + "\n" + k.name).toLowerCase();
    });
  });

  // ---------- Saved state ----------

  var state = { collected: new Set(), tab: kingdoms[0].id, hide: false, query: "" };

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (Array.isArray(saved.collected)) state.collected = new Set(saved.collected);
      if (saved.tab === ALL || kingdomById[saved.tab]) state.tab = saved.tab;
      state.hide = !!saved.hide;
    } catch (e) {
      /* storage unavailable or corrupt: start fresh */
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        collected: Array.from(state.collected),
        tab: state.tab,
        hide: state.hide
      }));
    } catch (e) {
      /* private mode etc. - progress just won't persist */
    }
  }

  // ---------- Helpers ----------

  var $ = function (id) { return document.getElementById(id); };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value == null || value === false) return;
        if (key === "className") node.className = value;
        else if (key === "text") node.textContent = value;
        else node.setAttribute(key, value === true ? "" : value);
      });
    }
    (children || []).forEach(function (child) {
      if (child == null) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function svg(markup) {
    var wrap = document.createElement("span");
    wrap.innerHTML = markup; // static, trusted icon markup only
    return wrap.firstChild;
  }

  var ICON_IGN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm3 4v10h2V7H7zm4 0v10h6v-5h-3v2h1v1h-2V9h4V7h-6z"/></svg>';
  var ICON_YT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15V9l5.8 3-5.8 3z"/></svg>';

  function shortName(k) {
    return k.name.replace(/ Kingdom$/, "");
  }

  function terms(query) {
    return query.toLowerCase().split(/\s+/).filter(function (w) { return w && w !== "#"; });
  }

  // "#12" means moon number 12; a bare "12" also matches text like "120 coins".
  function matches(moon, words) {
    return words.every(function (w) {
      if (/^#\d+$/.test(w)) return moon.n === Number(w.slice(1));
      return (/^\d+$/.test(w) && moon.n === Number(w)) || moon.haystack.indexOf(w) !== -1;
    });
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Text with every search word wrapped in <mark>, built without innerHTML.
  function highlighted(text, words) {
    var frag = document.createDocumentFragment();
    var lower = text.toLowerCase();
    var textWords = words.filter(function (w) { return w.charAt(0) !== "#" && lower.indexOf(w) !== -1; });
    if (!textWords.length) {
      frag.appendChild(document.createTextNode(text));
      return frag;
    }
    var re = new RegExp("(" + textWords.map(escapeRegExp).join("|") + ")", "gi");
    text.split(re).forEach(function (part, i) {
      if (!part) return;
      frag.appendChild(i % 2 ? el("mark", { text: part }) : document.createTextNode(part));
    });
    return frag;
  }

  function youtubeUrl(moon) {
    var q = "Super Mario Odyssey " + moon.kingdom.name + " Power Moon " + moon.n + " " + moon.name;
    return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q).replace(/%20/g, "+");
  }

  function tally(moons) {
    var t = { count: 0, total: moons.length, value: 0, totalValue: 0 };
    moons.forEach(function (m) {
      t.totalValue += m.value;
      if (state.collected.has(m.id)) {
        t.count++;
        t.value += m.value;
      }
    });
    return t;
  }

  function allMoons() {
    return kingdoms.reduce(function (list, k) { return list.concat(k.moons); }, []);
  }

  function pct(a, b) {
    return b ? (100 * a / b).toFixed(1) + "%" : "0%";
  }

  // ---------- Rendering ----------

  function renderOverall() {
    var t = tally(allMoons());
    $("overall-collected").textContent = t.count;
    $("overall-total").textContent = t.total;
    $("overall-bar").style.width = pct(t.count, t.total);
    $("overall-value").textContent =
      t.value + " / " + t.totalValue + " Power Moons (Multi Moons count as 3)";
  }

  function tabIds() {
    return [ALL].concat(kingdoms.map(function (k) { return k.id; }));
  }

  function renderTabs() {
    var tabs = $("tabs");
    tabs.textContent = "";
    tabIds().forEach(function (id) {
      var moons = id === ALL ? allMoons() : kingdomById[id].moons;
      var t = tally(moons);
      var selected = id === state.tab;
      var btn = el("button", {
        type: "button",
        role: "tab",
        id: "tab-" + id,
        className: "tab" + (t.count === t.total ? " complete" : ""),
        "aria-selected": selected ? "true" : "false",
        "aria-controls": "moon-list",
        tabindex: selected ? "0" : "-1",
        "data-tab": id
      }, [
        el("span", { text: id === ALL ? "All" : shortName(kingdomById[id]) }),
        el("span", { className: "tab-count", text: t.count + "/" + t.total })
      ]);
      tabs.appendChild(btn);
    });
    $("moon-list").setAttribute("aria-labelledby", "tab-" + state.tab);
  }

  function renderHead(kingdom, shownCount) {
    var head = $("kingdom-head");
    head.textContent = "";
    var moons = kingdom ? kingdom.moons : allMoons();
    var t = tally(moons);
    var meta = t.count + " of " + t.total + " collected";
    if (t.totalValue !== t.total) meta += " · " + t.value + " / " + t.totalValue + " Power Moons";
    if (state.query || state.hide) meta += " · showing " + shownCount;

    var bar = el("div", { className: "bar", "aria-hidden": "true" }, [el("span")]);
    bar.firstChild.style.width = pct(t.count, t.total);

    head.appendChild(el("div", null, [
      el("h2", { text: kingdom ? kingdom.name : "All kingdoms" }),
      el("p", { className: "meta", text: meta }),
      bar
    ]));

    var links = el("div", { className: "kingdom-links" });
    if (kingdom) {
      links.appendChild(el("a", { className: "btn", href: kingdom.wiki, target: "_blank", rel: "noopener", text: "Wiki list ↗" }));
      var ign = el("a", { className: "btn btn-ign", href: kingdom.ign, target: "_blank", rel: "noopener" }, [svg(ICON_IGN), "IGN kingdom guide ↗"]);
      links.appendChild(ign);
    }
    if (t.count) {
      links.appendChild(el("button", {
        type: "button",
        className: "btn btn-quiet",
        "data-action": "reset",
        text: kingdom ? "Reset kingdom" : "Reset all"
      }));
    }
    head.appendChild(links);
  }

  function renderMoon(moon, words, showKingdom) {
    var done = state.collected.has(moon.id);
    var checkId = "m-" + moon.id;

    var title = el("h3", { className: "moon-title" }, [
      el("span", { className: "moon-num", text: "#" + moon.n }),
      el("label", { className: "moon-name", for: checkId }, [highlighted(moon.name, words)]),
      moon.multi ? el("span", { className: "tag tag-multi", title: "Multi Moon: counts as 3 Power Moons", text: "MULTI MOON ×3" }) : null,
      showKingdom ? el("span", { className: "tag tag-kingdom", text: moon.kingdom.name }) : null
    ]);

    var how = el("p", { className: "moon-how" }, [highlighted(moon.how, words)]);
    var when = moon.when ? el("p", { className: "moon-when" }, [el("b", { text: "When: " }), highlighted(moon.when, words)]) : null;

    var actions = el("div", { className: "moon-actions" }, [
      el("a", {
        className: "btn btn-ign",
        href: moon.ign,
        target: "_blank",
        rel: "noopener",
        "aria-label": "IGN guide for " + moon.name + " (opens in new tab)"
      }, [svg(ICON_IGN), "IGN guide"]),
      el("a", {
        className: "btn btn-yt",
        href: youtubeUrl(moon),
        target: "_blank",
        rel: "noopener",
        "aria-label": "YouTube videos for " + moon.name + " (opens in new tab)"
      }, [svg(ICON_YT), "YouTube"]),
      el("a", {
        className: "btn btn-quiet",
        href: moon.wiki,
        target: "_blank",
        rel: "noopener",
        title: "Source: Super Mario Wiki",
        "aria-label": "Super Mario Wiki entry for " + moon.name + " (opens in new tab)"
      }, ["Wiki ↗"])
    ]);

    var checkbox = el("input", {
      type: "checkbox",
      className: "moon-check",
      id: checkId,
      "data-moon": moon.id,
      "aria-label": "Collected: " + moon.name
    });
    checkbox.checked = done;

    return el("li", { className: "moon" + (done ? " collected" : ""), "data-moon": moon.id }, [
      checkbox,
      el("div", { className: "moon-body" }, [title, how, when, actions])
    ]);
  }

  function visible(moons, words) {
    return moons.filter(function (m) {
      if (state.hide && state.collected.has(m.id)) return false;
      return !words.length || matches(m, words);
    });
  }

  function render() {
    var words = terms(state.query);
    var kingdom = state.tab === ALL ? null : kingdomById[state.tab];
    var pool = kingdom ? kingdom.moons : allMoons();
    var shown = visible(pool, words);

    renderOverall();
    renderTabs();
    renderHead(kingdom, shown.length);

    var list = $("moon-list");
    list.textContent = "";
    var frag = document.createDocumentFragment();
    shown.forEach(function (m) { frag.appendChild(renderMoon(m, words, !kingdom)); });
    list.appendChild(frag);

    // When searching one kingdom, point out hits in the others.
    var elsewhere = 0;
    if (kingdom && words.length) {
      elsewhere = visible(allMoons(), words).length - shown.length;
    }
    var moreBtn = elsewhere > 0
      ? el("button", { type: "button", className: "btn", "data-action": "search-all" },
          [elsewhere + " more match" + (elsewhere === 1 ? "" : "es") + " in other kingdoms — search all"])
      : null;

    var empty = $("empty");
    empty.textContent = "";
    if (!shown.length) {
      var msg;
      if (words.length) msg = "No moons match “" + state.query.trim() + "”" + (kingdom ? " in the " + kingdom.name + "." : ".");
      else if (state.hide) msg = "Every moon here is collected. Nice work!";
      else msg = "No moons here.";
      empty.appendChild(el("p", { text: msg }));
      if (moreBtn) empty.appendChild(moreBtn);
      empty.hidden = false;
    } else {
      empty.hidden = true;
      if (moreBtn) list.appendChild(el("li", { className: "more-results" }, [moreBtn]));
    }
  }

  // Update counts without rebuilding the list (keeps focus and scroll put).
  function refreshCounts() {
    renderOverall();
    renderTabs();
    var kingdom = state.tab === ALL ? null : kingdomById[state.tab];
    var pool = kingdom ? kingdom.moons : allMoons();
    renderHead(kingdom, visible(pool, terms(state.query)).length);
  }

  // ---------- Events ----------

  function selectTab(id, focus) {
    state.tab = id;
    save();
    render();
    var tab = $("tab-" + id);
    if (tab) {
      tab.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (focus) tab.focus();
    }
  }

  $("tabs").addEventListener("click", function (e) {
    var tab = e.target.closest("[data-tab]");
    if (tab) selectTab(tab.getAttribute("data-tab"));
  });

  $("tabs").addEventListener("keydown", function (e) {
    var ids = tabIds();
    var i = ids.indexOf(state.tab);
    var next = null;
    if (e.key === "ArrowRight") next = ids[(i + 1) % ids.length];
    else if (e.key === "ArrowLeft") next = ids[(i - 1 + ids.length) % ids.length];
    else if (e.key === "Home") next = ids[0];
    else if (e.key === "End") next = ids[ids.length - 1];
    if (next) {
      e.preventDefault();
      selectTab(next, true);
    }
  });

  $("moon-list").addEventListener("change", function (e) {
    var box = e.target;
    var id = box.getAttribute("data-moon");
    if (!id) return;
    if (box.checked) state.collected.add(id);
    else state.collected.delete(id);
    save();

    var item = box.closest(".moon");
    item.classList.toggle("collected", box.checked);
    if (state.hide && box.checked) {
      item.classList.add("leaving");
      setTimeout(render, 260);
    }
    refreshCounts();
  });

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var action = btn.getAttribute("data-action");
    if (action === "search-all") {
      selectTab(ALL);
    } else if (action === "reset") {
      var kingdom = state.tab === ALL ? null : kingdomById[state.tab];
      var label = kingdom ? "the " + kingdom.name : "ALL kingdoms";
      if (!window.confirm("Uncheck every moon in " + label + "?")) return;
      (kingdom ? kingdom.moons : allMoons()).forEach(function (m) { state.collected.delete(m.id); });
      save();
      render();
    }
  });

  var searchTimer;
  $("search").addEventListener("input", function (e) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.query = e.target.value;
      render();
    }, 120);
  });

  $("hide-collected").addEventListener("change", function (e) {
    state.hide = e.target.checked;
    save();
    render();
  });

  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === "/" && !typing) {
      e.preventDefault();
      $("search").focus();
    } else if (e.key === "Escape" && document.activeElement === $("search") && state.query) {
      $("search").value = "";
      state.query = "";
      render();
    }
  });

  // ---------- Start ----------

  load();
  $("hide-collected").checked = state.hide;
  if (DATA.source && DATA.source.retrieved) {
    $("retrieved").textContent = "Text retrieved " + DATA.source.retrieved + ".";
  }
  render();
})();
