(function () {
  var PAGES = { confirmation: 'booking-confirmation', manage: 'booking-manage', cancel: 'booking-cancel' };
  var SETTINGS = { member_login: 'booking-member-login' };
  var COLLECTIONS = { bookables: 'bookable' };

  function register() {
    if (!window.stommeRegisterFramePage) return false;
    [ PAGES, SETTINGS, COLLECTIONS ].forEach(function (table) {
      Object.keys(table).forEach(function (name) {
        window.stommeRegisterFramePage(name, table[name]);
      });
    });
    return true;
  }

  if (!register()) window.addEventListener('DOMContentLoaded', register);
})();
