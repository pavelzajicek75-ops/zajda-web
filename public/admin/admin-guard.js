(function() {
    // Skip guard on login page
    if (window.location.pathname.endsWith('/login.html') || window.location.pathname === '/admin/' || window.location.pathname === '/admin') {
        return;
    }

    // Check authentication
    var auth = sessionStorage.getItem('adminAuth');
    if (auth !== '1') {
        window.location.href = '/admin/login.html';
    }
})();
