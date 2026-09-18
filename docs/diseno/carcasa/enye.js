(function () {
  var ACCENT = '#f5ce3d';
  var RE = /[ñÑ]/;

  function process(root) {
    if (!root || root.nodeType !== 1) return;
    if (!root.closest || !root.closest('[data-enye-zone]')) {
      if (!root.hasAttribute || !root.hasAttribute('data-enye-zone')) {
        var zones = root.querySelectorAll ? root.querySelectorAll('[data-enye-zone]') : [];
        zones.forEach(processZone);
        return;
      }
    }
    processZone(root);
  }

  function processZone(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!RE.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        if (p && (p.hasAttribute('data-enye') || p.tagName === 'SCRIPT' || p.tagName === 'STYLE')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (textNode) {
      var parts = textNode.nodeValue.split(/([ñÑ])/);
      if (parts.length < 2) return;
      var frag = document.createDocumentFragment();
      parts.forEach(function (part) {
        if (part === 'ñ' || part === 'Ñ') {
          var span = document.createElement('span');
          span.setAttribute('data-enye', '1');
          span.style.color = ACCENT;
          span.textContent = part;
          frag.appendChild(span);
        } else if (part) {
          frag.appendChild(document.createTextNode(part));
        }
      });
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  function run() {
    process(document.body);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  var obs = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) process(node);
        else if (node.nodeType === 3 && RE.test(node.nodeValue)) process(node.parentNode);
      });
    });
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
