/* ============================================================
   Signed-in state in the main nav — load after api.js on every page:
     <script src="api.js"></script>
     <script src="nav-auth.js"></script>
   Turns the nav's <li data-nav-auth> "Sign in" link into the
   user's first name (a link to dashboard.html) + a Sign out button
   while signed in, plus an "Admin" link (admin.html) for admins. Signing out fires a "pulse:signedout" event on
   document so the current page can react.
   ============================================================ */
(function () {
  const slot = document.querySelector('[data-nav-auth]');
  if (!slot) return;

  // Keep the page's original "Sign in" link so signing out can restore it
  const signedOutHTML = slot.innerHTML;

  function renderSignedOut() {
    slot.classList.remove('nav-auth-in');
    slot.innerHTML = signedOutHTML;
  }

  function renderSignedIn(user) {
    const firstName = user.fullName.trim().split(/\s+/)[0];
    slot.classList.add('nav-auth-in');
    slot.innerHTML =
      (user.role === 'admin' ? '<a class="nav-admin" href="admin.html">Admin</a>' : '') +
      '<a class="nav-user" href="dashboard.html"></a>' +
      '<button type="button" class="nav-signout">Sign out</button>';

    const name = slot.querySelector('.nav-user');
    name.title = 'Signed in as ' + user.email + ' — your dashboard';
    name.innerHTML = '<i class="ti ti-user-circle" aria-hidden="true"></i><span class="sr-only">Your dashboard, signed in as </span>';
    name.appendChild(document.createTextNode(firstName));
    if (/(^|\/)dashboard\.html$/.test(location.pathname)) {
      name.classList.add('active');
      name.setAttribute('aria-current', 'page');
    }
    const adminLink = slot.querySelector('.nav-admin');
    if (adminLink && /(^|\/)admin\.html$/.test(location.pathname)) {
      adminLink.classList.add('active');
      adminLink.setAttribute('aria-current', 'page');
    }

    slot.querySelector('.nav-signout').addEventListener('click', function () {
      PulseAPI.logout();
      renderSignedOut();
      slot.querySelector('a').focus();
      document.dispatchEvent(new CustomEvent('pulse:signedout'));
    });
  }

  function refresh() {
    if (!PulseAPI.getToken()) {
      renderSignedOut();
      return;
    }
    // Show the remembered name straight away, then confirm the token is still valid
    const cached = PulseAPI.getCachedUser();
    if (cached) renderSignedIn(cached);
    PulseAPI.me().then(renderSignedIn, function (err) {
      // 401 = expired or invalid token (api.js has already cleared it).
      // If the server is just unreachable, keep showing the cached name.
      if (err.status === 401 || !cached) renderSignedOut();
    });
  }

  // Lets a page update the nav right after signing in (see login.html)
  window.PulseNav = { refresh: refresh, showUser: renderSignedIn };

  refresh();
})();
