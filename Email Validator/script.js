(function () {
  var LOCAL_ALLOWED = /^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~.\-]+$/;
  var LABEL_OK = /^[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?$/;
  var COMMON = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "proton.me", "protonmail.com", "live.com", "rediffmail.com", "yahoo.co.in", "aol.com"];

  function split(v) {
    var parts = v.split("@");
    if (parts.length !== 2) return null;
    return { local: parts[0], domain: parts[1] };
  }

  var RULES = [
    { label: "One @ sign", test: function (v) {
        var n = v.split("@").length - 1;
        return n === 1 ? null : (n === 0 ? "No @ found." : "Found " + n + " @ signs, expected 1.");
      } },
    { label: "Local part is 1 to 64 characters", test: function (v) {
        var p = split(v); if (!p) return "Needs a single @ first.";
        if (p.local.length < 1) return "Nothing before the @.";
        if (p.local.length > 64) return "Local part is " + p.local.length + " characters.";
        return null;
      } },
    { label: "Local part uses allowed characters", test: function (v) {
        var p = split(v); if (!p || !p.local) return "Needs a local part first.";
        if (!LOCAL_ALLOWED.test(p.local)) {
          var bad = p.local.split("").filter(function (c) { return !LOCAL_ALLOWED.test(c); });
          return "Not allowed: " + Array.from(new Set(bad)).map(function (c) { return c === " " ? "space" : c; }).join(" ");
        }
        return null;
      } },
    { label: "No leading, trailing or double dots", test: function (v) {
        var p = split(v); if (!p || !p.local) return "Needs a local part first.";
        if (p.local.charAt(0) === ".") return "Starts with a dot.";
        if (p.local.charAt(p.local.length - 1) === ".") return "Ends with a dot.";
        if (p.local.indexOf("..") !== -1) return "Contains two dots in a row.";
        return null;
      } },
    { label: "Domain has at least one dot", test: function (v) {
        var p = split(v); if (!p) return "Needs a single @ first.";
        if (!p.domain) return "Nothing after the @.";
        if (p.domain.indexOf(".") === -1) return "Domain needs a dot, like example.com.";
        return null;
      } },
    { label: "Domain parts are 1 to 63 characters, letters, digits or hyphens", test: function (v) {
        var p = split(v); if (!p || !p.domain) return "Needs a domain first.";
        var labels = p.domain.split(".");
        for (var i = 0; i < labels.length; i++) {
          var l = labels[i];
          if (l.length === 0) return "Empty part in the domain (check for double or trailing dots).";
          if (l.length > 63) return "\"" + l.slice(0, 12) + "...\" is over 63 characters.";
          if (!LABEL_OK.test(l)) return "\"" + l + "\" has a bad character or a hyphen at an end.";
        }
        return null;
      } },
    { label: "Ends in a top-level domain of 2+ letters", test: function (v) {
        var p = split(v); if (!p || !p.domain) return "Needs a domain first.";
        var tld = p.domain.split(".").pop();
        if (p.domain.indexOf(".") === -1) return "No top-level domain yet.";
        if (/^xn--[A-Za-z0-9\-]+$/.test(tld)) return null;
        if (!/^[A-Za-z]{2,}$/.test(tld)) return "\"" + tld + "\" is not a valid ending.";
        return null;
      } },
    { label: "Whole address is 254 characters or fewer", test: function (v) {
        return v.length > 254 ? "Address is " + v.length + " characters." : null;
      } }
  ];

  var EXAMPLES = [
    ["harry@codewithharry.com", true],
    ["first.last+tag@sub.example.co.in", true],
    ["user@@example.com", false],
    ["no-at-sign.example.com", false],
    [".leading@example.com", false],
    ["double..dot@example.com", false],
    ["space in@example.com", false],
    ["user@-bad.com", false],
    ["user@example", false],
    ["priya@gmial.com", true]
  ];

  var el = {
    input: document.getElementById("email"),
    verdict: document.getElementById("verdict"),
    verdictText: document.getElementById("verdict-text"),
    suggest: document.getElementById("suggest"),
    parsed: document.getElementById("parsed"),
    rules: document.getElementById("rules"),
    examples: document.getElementById("examples"),
    clear: document.getElementById("clear"),
    form: document.getElementById("form")
  };

  function distance(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 0; j <= n; j++) { d[0][j] = j; }
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) {
        var c = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      }
    }
    return d[m][n];
  }

  function suggestDomain(domain) {
    var dl = domain.toLowerCase();
    if (COMMON.indexOf(dl) !== -1) return null;
    var best = null, bestD = 3;
    COMMON.forEach(function (c) {
      var dist = distance(dl, c);
      if (dist < bestD) { bestD = dist; best = c; }
    });
    return best;
  }

  function span(cls, text) {
    var s = document.createElement("span");
    s.className = cls;
    s.textContent = text;
    return s;
  }

  function renderParsed(v) {
    el.parsed.textContent = "";
    if (!v) {
      el.parsed.appendChild(span("placeholder", "The address will be split into its parts here."));
      return;
    }
    var at = v.indexOf("@");
    if (at === -1) { el.parsed.appendChild(span("local", v)); return; }
    var local = v.slice(0, at), domain = v.slice(at + 1);
    el.parsed.appendChild(span("local", local));
    el.parsed.appendChild(span("at", "@"));
    var lastDot = domain.lastIndexOf(".");
    if (lastDot === -1) {
      el.parsed.appendChild(span("domain", domain));
    } else {
      el.parsed.appendChild(span("domain", domain.slice(0, lastDot + 1)));
      el.parsed.appendChild(span("tld", domain.slice(lastDot + 1)));
    }
  }

  function renderRules(v) {
    el.rules.textContent = "";
    var failed = 0;
    RULES.forEach(function (r) {
      var li = document.createElement("li");
      var mark = document.createElement("span");
      mark.className = "mark";
      mark.setAttribute("aria-hidden", "true");
      var box = document.createElement("div");
      box.className = "rule-text";
      var title = document.createElement("span");
      title.textContent = r.label;
      box.appendChild(title);
      if (!v) {
        li.setAttribute("data-state", "idle");
        mark.textContent = "";
      } else {
        var problem = r.test(v);
        if (problem === null) {
          li.setAttribute("data-state", "pass");
          mark.textContent = "✓";
          title.insertAdjacentHTML("beforeend", '<span class="sr" style="position:absolute;left:-9999px"> passed</span>');
        } else {
          failed++;
          li.setAttribute("data-state", "fail");
          mark.textContent = "×";
          var small = document.createElement("small");
          small.textContent = problem;
          box.appendChild(small);
        }
      }
      li.appendChild(mark);
      li.appendChild(box);
      el.rules.appendChild(li);
    });
    return failed;
  }

  function setVerdict(state, text) {
    el.verdict.setAttribute("data-state", state);
    el.verdictText.textContent = text;
    el.input.classList.toggle("is-valid", state === "valid" || state === "warn");
    el.input.classList.toggle("is-invalid", state === "invalid");
  }

  function renderSuggest(v, failed) {
    el.suggest.textContent = "";
    el.suggest.hidden = true;
    if (!v || failed) return;
    var p = split(v);
    if (!p) return;
    var s = suggestDomain(p.domain);
    if (!s) return;
    var fixed = p.local + "@" + s;
    el.suggest.appendChild(document.createTextNode("Did you mean"));
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = fixed;
    b.addEventListener("click", function () { el.input.value = fixed; run(); el.input.focus(); });
    el.suggest.appendChild(b);
    el.suggest.appendChild(document.createTextNode("?"));
    el.suggest.hidden = false;
  }

  function run() {
    var raw = el.input.value;
    var v = raw.trim();
    renderParsed(v);
    var failed = renderRules(v);
    if (!v) {
      setVerdict("idle", "Start typing an address.");
      renderSuggest("", 0);
      return;
    }
    if (failed) {
      setVerdict("invalid", failed === 1 ? "Not valid. 1 rule failed." : "Not valid. " + failed + " rules failed.");
    } else {
      var p = split(v);
      var sug = suggestDomain(p.domain);
      if (sug) setVerdict("warn", "Valid format, but the domain looks like a typo.");
      else setVerdict("valid", "Valid email format.");
    }
    renderSuggest(v, failed);
  }

  EXAMPLES.forEach(function (ex) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = ex[1] ? "ok" : "no";
    var tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = ex[1] ? "OK" : "BAD";
    var txt = document.createElement("span");
    txt.textContent = ex[0];
    b.appendChild(tag);
    b.appendChild(txt);
    b.addEventListener("click", function () { el.input.value = ex[0]; run(); el.input.focus(); });
    el.examples.appendChild(b);
  });

  el.input.addEventListener("input", run);
  el.form.addEventListener("submit", function (e) { e.preventDefault(); run(); });
  el.clear.addEventListener("click", function () { el.input.value = ""; run(); el.input.focus(); });
  run();
})();