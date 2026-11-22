(function () {
  var MARKUP =
    '<i class="glow"></i><i class="shadow"></i>' +
    '<div class="lid"><i class="lid-top"></i><i class="lid-lip"></i><i class="lid-shine"></i></div>' +
    '<div class="box">' +
    '<i class="depth"></i><i class="face"></i><i class="side"></i>' +
    '<i class="band h"></i><i class="band v l"></i><i class="band v r"></i>' +
    '<i class="clasp"><i class="gem"></i></i>' +
    '<i class="foot l"></i><i class="foot r"></i>' +
    "</div>";

  function mount(el) {
    var tier = el.getAttribute("data-chest") || "rare";
    var pose = el.getAttribute("data-pose") || "shut";
    el.classList.add("vbox", "tier-" + tier, "pose-" + pose);
    el.innerHTML = MARKUP;
  }

  window.mountChests = function (root) {
    (root || document).querySelectorAll("[data-chest]").forEach(mount);
  };
  window.mountChests();
})();
