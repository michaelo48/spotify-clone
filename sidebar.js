function sideBav() {
    return '<div class="sidenav"><a href="#">Open Library</a><a href="#">Create Playlist</a><a href="#">Add Playlists Here</a></div>';
}

const sideNav = document.getElementById('side-nav');

if (sideNav) {
    console.log('sidebar loaded');
    sideNav.innerHTML = sideBav();
}

const toggleBtn = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidenav');
const mainWrapper = document.querySelector('.main-wrapper');
const footer = document.querySelector('footer');

toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainWrapper.classList.toggle('expanded');
    footer.classList.toggle('expanded');
});