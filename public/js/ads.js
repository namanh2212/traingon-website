// /public/js/ads.js — dán nguyên SNIPPET ExoClick vào các backtick là chạy
(() => {
  const p = location.pathname;
  const isHome = p === "/" || p.endsWith("/index.html");
  const isVideo = p.startsWith("/watch"); // sửa nếu route khác

  // ====== DÁN 1 SNIPPET cho TRANG CHỦ (index) vào đây ======
  const HOME_SNIPPETS = [
    /*`<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script> 
 <ins class="eas6a97888e20" data-zoneid="5716740"></ins> 
 <script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>`
    `<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script> 
 <ins class="eas6a97888e10" data-zoneid="5700524"></ins> 
 <script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>`,
   `<script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script> 
 <ins class="eas6a97888e10" data-zoneid="5700524"></ins> 
 <script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>`*/
  ];

  // ====== DÁN 2 SNIPPET cho TRANG VIDEO vào đây ======
  const VIDEO_SNIPPETS = [
    `<script type="application/javascript">
    var ad_idzone = "5711248",
    ad_popup_fallback = false,
    ad_popup_force = true,
    ad_chrome_enabled = true,
    ad_new_tab = true,
    ad_frequency_period = 10,
    ad_frequency_count = 1,
    ad_trigger_method = 1,
    ad_trigger_delay = 0,
    ad_capping_enabled = false; 
</script>
<script type="application/javascript" src="https://a.pemsrv.com/popunder1000.js"></script>`,
  ];

  function inject(html) {
    const box = document.createElement("div");
    box.className = "ads-slot";
    document.body.appendChild(box);
    box.insertAdjacentHTML("beforeend", html);

    // kích hoạt lại <script> khi chèn bằng HTML
    box.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      if (old.src) {
        s.src = old.src;
        s.async = true;
      } else {
        s.text = old.textContent;
      }
      old.replaceWith(s);
    });
  }

  if (isHome) HOME_SNIPPETS.forEach((sn) => inject(String(sn)));
  if (isVideo) VIDEO_SNIPPETS.forEach((sn) => inject(String(sn)));
})();
