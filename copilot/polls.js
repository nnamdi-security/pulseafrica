// Simple search + filter functionality
const searchInput = document.getElementById('searchPolls');
const filterSelect = document.getElementById('filterCategory');
const pollsGrid = document.getElementById('pollsGrid');
const pollCards = pollsGrid.getElementsByClassName('poll-card');

function filterPolls() {
  const searchTerm = searchInput.value.toLowerCase();
  const category = filterSelect.value;

  Array.from(pollCards).forEach(card => {
    const title = card.querySelector('h2').textContent.toLowerCase();
    const cardCategory = card.getAttribute('data-category');

    const matchesSearch = title.includes(searchTerm);
    const matchesCategory = category === "" || cardCategory === category;

    if (matchesSearch && matchesCategory) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

searchInput.addEventListener('input', filterPolls);
filterSelect.addEventListener('change', filterPolls);
