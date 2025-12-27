

function searchBar(){
    
    return '<div class="searchBar"><button type="submit">Search</button><input type="text" placeholder="What do you want to play?"/><button type="submit">Browse</button></div>';
}
const search = document.getElementById('search-bar');




if (search) {
    search.innerHTML = searchBar();
}