/**
 * A small stand-in document for driving src/app.js in Node. It reads every
 * element that carries an id, a data-action, a data-city-mode or a data-resin
 * attribute straight out of index.html, so a renamed or deleted control in the
 * real page breaks the UI tests instead of passing silently.
 */

function parseAttributes(source) {
  const attrs = {};
  const re = /([:\w-]+)(?:\s*=\s*"([^"]*)")?/g;
  let match;
  while ((match = re.exec(source))) {
    attrs[match[1]] = match[2] === undefined ? "" : match[2];
  }
  return attrs;
}

class FakeClassList {
  constructor(el) {
    this.el = el;
  }
  get set() {
    return new Set(String(this.el.className || "").split(/\s+/).filter(Boolean));
  }
  write(set) {
    this.el.className = [...set].join(" ");
  }
  add(...names) {
    const set = this.set;
    names.forEach((n) => set.add(n));
    this.write(set);
  }
  remove(...names) {
    const set = this.set;
    names.forEach((n) => set.delete(n));
    this.write(set);
  }
  toggle(name, force) {
    const set = this.set;
    const on = force === undefined ? !set.has(name) : Boolean(force);
    if (on) set.add(name);
    else set.delete(name);
    this.write(set);
    return on;
  }
  contains(name) {
    return this.set.has(name);
  }
}

export class FakeElement {
  constructor(tagName, attrs = {}) {
    this.tagName = String(tagName).toUpperCase();
    this.attributes = { ...attrs };
    this.id = attrs.id || "";
    this.className = attrs.class || "";
    this.classList = new FakeClassList(this);
    this.children = [];
    this.innerHTML = "";
    this.textContent = "";
    this.value = attrs.value || "";
    this.disabled = "disabled" in attrs;
    this.open = "open" in attrs;
    this.offsetWidth = 100;
    this.focused = false;
    this.files = null;
    this.listeners = {};
  }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "open") this.open = true;
  }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name === "open") this.open = false;
  }
  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }
  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }
  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
    }
  }
  closest(selector) {
    const m = selector.match(/^\[([\w-]+)\]$/);
    if (m && this.hasAttribute(m[1])) return this;
    return null;
  }
  focus() {
    this.focused = true;
  }
  click() {
    this.clicked = (this.clicked || 0) + 1;
  }
  scrollIntoView(options) {
    this.scrolledWith = options;
  }
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
  }
  play() {
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  }
}

export function createFakeDom(html, { hash = "", reducedMotion = false } = {}) {
  const byId = new Map();
  const all = [];
  const tagRe = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let match;
  while ((match = tagRe.exec(html))) {
    const attrs = parseAttributes(match[2]);
    if (attrs.id || "data-action" in attrs || "data-city-mode" in attrs || "data-resin" in attrs) {
      const el = new FakeElement(match[1], attrs);
      all.push(el);
      if (attrs.id) byId.set(attrs.id, el);
    }
  }

  const docListeners = {};
  const winListeners = {};
  const timers = new Map();
  const intervals = new Map();
  let timerSeq = 0;
  const body = new FakeElement("body");

  const document = {
    body,
    getElementById: (id) => byId.get(id) || null,
    querySelectorAll(selector) {
      const m = selector.match(/^\[([\w-]+)\]$/);
      if (!m) throw new Error(`fake DOM does not support selector ${selector}`);
      return all.filter((el) => el.hasAttribute(m[1]));
    },
    createElement: (tag) => new FakeElement(tag),
    addEventListener(type, fn) {
      (docListeners[type] ||= []).push(fn);
    },
    removeEventListener(type, fn) {
      docListeners[type] = (docListeners[type] || []).filter((f) => f !== fn);
    }
  };

  const history = [];
  const window = {
    location: { pathname: "/bincheck/", search: "", hash, href: `https://example.test/bincheck/${hash}` },
    history: {
      replaceState(_s, _t, url) {
        history.push(url);
      }
    },
    navigator: {
      clipboard: {
        writes: [],
        async writeText(text) {
          this.writes.push(text);
        }
      }
    },
    matchMedia: () => ({ matches: reducedMotion }),
    setTimeout(fn, ms) {
      timerSeq += 1;
      timers.set(timerSeq, { fn, ms });
      return timerSeq;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setInterval(fn, ms) {
      timerSeq += 1;
      intervals.set(timerSeq, { fn, ms });
      return timerSeq;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    performance: { now: () => 0 },
    printed: 0,
    print() {
      this.printed += 1;
      for (const fn of winListeners.afterprint || []) fn();
    },
    addEventListener(type, fn) {
      (winListeners[type] ||= []).push(fn);
    },
    removeEventListener(type, fn) {
      winListeners[type] = (winListeners[type] || []).filter((f) => f !== fn);
    }
  };

  function fire(type, event) {
    for (const fn of docListeners[type] || []) fn(event);
  }

  return {
    document,
    window,
    byId,
    all,
    history,
    timers,
    intervals,
    listenerCount: () => Object.values(docListeners).reduce((n, list) => n + list.length, 0),
    fireWindow(type, event = {}) {
      for (const fn of winListeners[type] || []) fn(event);
    },
    click(target) {
      fire("click", { target, preventDefault() {} });
    },
    input(target, value) {
      target.value = value;
      fire("input", { target });
    },
    change(target, value) {
      if (value !== undefined) target.value = value;
      fire("change", { target });
    },
    key(key, target = body, extra = {}) {
      const event = { key, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
      fire("keydown", event);
      return event;
    }
  };
}
