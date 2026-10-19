/* ============================================================
   PulseAfrica API client — shared by every page that talks to
   the backend (see backend/README.md for the endpoints).
   Load it before the page's own <script>:
     <script src="api.js"></script>
   ============================================================ */
(function () {
  // Where the FastAPI backend runs. Override by setting
  // window.PULSE_API_BASE before this file loads (e.g. for production).
  const API_BASE = window.PULSE_API_BASE || 'http://localhost:8000/api';
  const TOKEN_KEY = 'pulseafrica.token';
  // The last /auth/me result, kept next to the token so pages can show
  // the user's name immediately while the token is re-checked
  const USER_KEY = 'pulseafrica.user';

  /* ---------- Token storage ----------
     "Keep me signed in" → localStorage (survives closing the browser).
     Otherwise → sessionStorage (cleared when the tab closes). */
  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  // Whichever storage holds the token (null when signed out)
  function tokenStore() {
    try {
      if (localStorage.getItem(TOKEN_KEY)) return localStorage;
      if (sessionStorage.getItem(TOKEN_KEY)) return sessionStorage;
    } catch (e) { /* storage blocked */ }
    return null;
  }

  function getCachedUser() {
    const store = tokenStore();
    try {
      return store ? JSON.parse(store.getItem(USER_KEY)) : null;
    } catch (e) {
      return null;
    }
  }

  function cacheUser(user) {
    const store = tokenStore();
    try {
      if (store) store.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) { /* storage blocked */ }
  }

  function saveToken(token, remember) {
    try {
      clearToken();
      (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch (e) {
      // Storage blocked (private mode etc.): the user stays signed in for this page only.
    }
  }

  function clearToken() {
    try {
      [localStorage, sessionStorage].forEach(function (store) {
        store.removeItem(TOKEN_KEY);
        store.removeItem(USER_KEY);
      });
    } catch (e) { /* nothing to clear */ }
  }

  /* ---------- Errors ----------
     Every failed request rejects with an ApiError:
       status  — HTTP status, or 0 if the server could not be reached
       message — a sentence that is safe to show to the user
       fields  — { camelCaseFieldName: message } for validation errors (422) */
  function ApiError(status, message, fields) {
    this.name = 'ApiError';
    this.status = status;
    this.message = message;
    this.fields = fields || {};
  }
  ApiError.prototype = Object.create(Error.prototype);

  // FastAPI sends errors as { detail: "text" } or, for validation errors,
  // { detail: [{ loc: ["body", "email"], msg: "..." }, ...] }
  function toApiError(status, body) {
    const detail = body && body.detail;
    if (typeof detail === 'string') return new ApiError(status, detail);
    if (Array.isArray(detail)) {
      const fields = {};
      detail.forEach(function (d) {
        const field = d.loc && d.loc.length > 1 ? d.loc[d.loc.length - 1] : '_form';
        fields[field] = (d.msg || 'Invalid value').replace(/^Value error, /, '');
      });
      return new ApiError(status, 'Some details need fixing.', fields);
    }
    return new ApiError(status, 'Something went wrong on our side. Please try again.');
  }

  /* ---------- Request helper ---------- */
  function request(method, path, body, opts) {
    const headers = { 'Accept': 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = (opts && opts.token) || getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    return fetch(API_BASE + path, {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    }).catch(function () {
      throw new ApiError(0, 'We couldn’t reach the PulseAfrica server. Check your connection and try again.');
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) throw toApiError(res.status, data);
        return data;
      });
    });
  }

  window.PulseAPI = {
    ApiError: ApiError,
    getToken: getToken,
    clearToken: clearToken,
    getCachedUser: getCachedUser,

    // → { accessToken, tokenType }; stores the token
    login: function (email, password, remember) {
      return request('POST', '/auth/login', { email: email, password: password }).then(function (data) {
        saveToken(data.accessToken, remember);
        return data;
      });
    },

    // payload: { fullName, email, state, ageRange, password, confirmPassword, terms } → user
    register: function (payload) {
      return request('POST', '/auth/register', payload);
    },

    // → the signed-in user, or rejects with status 401.
    // Caches the user on success; signs out locally if the token was rejected.
    me: function () {
      return request('GET', '/auth/me').then(function (user) {
        cacheUser(user);
        return user;
      }, function (err) {
        if (err.status === 401) clearToken();
        throw err;
      });
    },

    logout: clearToken,

    // query: { category, status, search } → list of polls
    listPolls: function (query) {
      const params = new URLSearchParams();
      Object.keys(query || {}).forEach(function (k) {
        if (query[k]) params.set(k, query[k]);
      });
      const qs = params.toString();
      return request('GET', '/polls' + (qs ? '?' + qs : ''));
    },

    // → poll with questions, responseCount and hasResponded (null when signed out)
    getPoll: function (id) {
      return request('GET', '/polls/' + encodeURIComponent(id));
    },

    // payload: { pollId, ageRange, gender, state, education?, occupation?,
    //            answers: [{ questionId, optionId }] }
    submitResponse: function (payload) {
      return request('POST', '/responses', payload);
    },

    // → counts and percentages, overall and by state / age range / gender
    getResults: function (pollId) {
      return request('GET', '/results/' + encodeURIComponent(pollId));
    }
  };
})();
