import './style.css';
import html2canvas from 'html2canvas';

// --- CONSTANTS & DOM ELEMENTS ---
const POKEMON_DATA_URL = '/pokemon_data.json';
const TYPES_DATA_URL = '/types.json';

const gridContainer = document.getElementById('grid-container');
const teamBuilderContainer = document.getElementById('team-builder-container');
const overallFavoriteContainer = document.getElementById('overall-favorite-container');
const genFavoritesContainer = document.getElementById('gen-favorites-container');
const modal = document.getElementById('selection-modal');
const modalHeader = document.querySelector('.modal-header');
const modalTitle = document.getElementById('modal-title');
const modalPokemonList = document.getElementById('modal-pokemon-list');
const closeModalBtn = document.getElementById('close-modal-btn');
const exportBtn = document.getElementById('export-btn');

// --- APP STATE ---
let types = [];
let generations = [];
let pokemonData = [];
let currentCell = null;

const typeColors = {
    normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
    grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
    ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
    rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
    steel: '#B7B7CE', fairy: '#D685AD'
};

// --- INITIALIZATION ---
async function initialize() {
    try {
        const [pokemonRes, typesRes] = await Promise.all([fetch(POKEMON_DATA_URL), fetch(TYPES_DATA_URL)]);
        if (!pokemonRes.ok || !typesRes.ok) throw new Error('Failed to load data files.');
        
        pokemonData = await pokemonRes.json();
        types = Object.keys(await typesRes.json());
        generations = [...new Set(pokemonData.map(p => p.generation))].sort((a, b) => a.split('-')[1] - b.split('-')[1]);

        createGrid();
        createExtraSlots();
        loadSelections();
        updateAllDependentStates();
        setupEventListeners();
    } catch (error) {
        document.getElementById('app').innerHTML = `<p style="color: red;">Error initializing app: ${error.message}</p>`;
    }
}

// --- HELPERS ---
function hexToRgba(hex, alpha) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) { // #RGB
        r = "0x" + hex[1] + hex[1];
        g = "0x" + hex[2] + hex[2];
        b = "0x" + hex[3] + hex[3];
    } else if (hex.length === 7) { // #RRGGBB
        r = "0x" + hex[1] + hex[2];
        g = "0x" + hex[3] + hex[4];
        b = "0x" + hex[5] + hex[6];
    }
    return `rgba(${+r},${+g},${+b},${alpha})`;
}


// --- UI CREATION ---
function createGrid() {
    const gridCols = `30px repeat(${types.length}, 1fr) 1fr`;
    const gridRows = `30px repeat(${types.length}, 1fr) 1fr`;
    gridContainer.style.gridTemplateColumns = gridCols;
    gridContainer.style.gridTemplateRows = gridRows;

    // Top Row Headers
    gridContainer.innerHTML += `<div class="header-cell"></div>`;
    types.forEach(type => gridContainer.innerHTML += `<div class="header-cell" style="background-color: ${typeColors[type]}">${type.slice(0, 3).toUpperCase()}</div>`);
    gridContainer.innerHTML += `<div class="header-cell" style="background-color: #FF69B4">FAV</div>`;

    // Type Rows
    types.forEach(type1 => {
        const rowColor = hexToRgba(typeColors[type1], 0.15); // Pale row color
        gridContainer.innerHTML += `<div class="header-cell" style="background-color: ${typeColors[type1]}">${type1.slice(0, 3).toUpperCase()}</div>`;
        types.forEach(type2 => {
            const isMono = type1 === type2;
            const monoStyle = isMono ? `background-color: ${typeColors[type1]};` : '';
            gridContainer.innerHTML += `<div class="grid-cell ${isMono ? 'mono-type-cell' : ''}" style="background-color: ${rowColor}; ${monoStyle}" data-cell-type="combo" data-type1="${type1}" data-type2="${type2}" id="cell-combo-${type1}-${type2}"></div>`;
        });
        gridContainer.innerHTML += `<div class="grid-cell favorite-cell disabled" style="background-color: ${rowColor};" data-cell-type="favorite-type" data-type1="${type1}" id="cell-favorite-type-${type1}"></div>`;
    });

    // Legendary Row
    const legendaryRowColor = hexToRgba(typeColors['dragon'], 0.1); // Pale gold-ish
    gridContainer.innerHTML += `<div class="header-cell" style="background-color: #D4AF37">LEG</div>`;
    types.forEach(type => gridContainer.innerHTML += `<div class="grid-cell legendary-cell" style="background-color: ${legendaryRowColor};" data-cell-type="legendary-type" data-type1="${type}" id="cell-legendary-type-${type}"></div>`);
    gridContainer.innerHTML += `<div class="grid-cell favorite-cell disabled" style="background-color: ${legendaryRowColor};" data-cell-type="favorite-legendary" id="cell-favorite-legendary"></div>`;
}

function createExtraSlots() {
    for (let i = 0; i < 6; i++) teamBuilderContainer.innerHTML += `<div class="slot-cell" data-cell-type="team" data-slot-id="${i}" id="cell-team-${i}"><span class="slot-label">Team ${i+1}</span></div>`;
    overallFavoriteContainer.innerHTML += `<div class="slot-cell" data-cell-type="favorite-overall" id="cell-favorite-overall"><span class="slot-label">Overall</span></div>`;
    generations.forEach((gen, i) => genFavoritesContainer.innerHTML += `<div class="slot-cell" data-cell-type="favorite-gen" data-gen-name="${gen}" id="cell-favorite-gen-${i}"><span class="slot-label">${gen.replace('generation-','Gen ').toUpperCase()}</span></div>`);
}

// --- EVENT HANDLING ---
function setupEventListeners() {
    document.getElementById('app').addEventListener('click', (e) => {
        const cell = e.target.closest('.grid-cell, .slot-cell');
        if (!cell) return;

        if (cell.querySelector('img')) {
            toggleShiny(cell);
        } else if (!cell.classList.contains('disabled')) {
            openPokemonSelection(cell);
        }
    });
    closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => e.target === modal && modal.classList.add('hidden'));
    exportBtn.addEventListener('click', exportGridAsImage);
}

// --- MODAL & SELECTION LOGIC ---
function getPokemonForCell(cell) {
    const { cellType, type1, type2, genName } = cell.dataset;
    const allSelected = getAllSelectedPokemon();

    switch (cellType) {
        case 'combo':
            const isMono = type1 === type2;
            return pokemonData.filter(p => {
                const primaryType = p.types.find(t => t.slot === 1)?.name;
                const secondaryType = p.types.find(t => t.slot === 2)?.name;
                return isMono ? (primaryType === type1 && !secondaryType) : (primaryType === type1 && secondaryType === type2);
            });
        case 'legendary-type':
            return pokemonData.filter(p => (p.is_legendary || p.is_mythical) && p.types.includes(p.types.find(t => t.name === type1)));
        case 'favorite-type':
            return getRowSelections(type1, false);
        case 'favorite-legendary':
            return getRowSelections('legendary', true);
        case 'team':
        case 'favorite-overall':
            return allSelected;
        case 'favorite-gen':
            return allSelected.filter(p => p.generation === genName);
        default: return [];
    }
}

function openPokemonSelection(cell) {
    currentCell = cell;
    const matchingPokemon = getPokemonForCell(cell);
    
    const existingClearBtn = modalHeader.querySelector('.clear-btn');
    if (existingClearBtn) existingClearBtn.remove();
    if (cell.querySelector('img')) {
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear';
        clearBtn.className = 'clear-btn';
        clearBtn.onclick = clearSelection;
        modalHeader.insertBefore(clearBtn, closeModalBtn);
    }
    
    modalTitle.textContent = 'Select Pokémon';
    modalPokemonList.innerHTML = matchingPokemon.length > 0 ? '' : '<p>No Pokémon match this selection.</p>';
    matchingPokemon.forEach(p => {
        const card = document.createElement('div');
        card.className = 'pokemon-card';
        card.addEventListener('click', () => selectPokemon(p));
        card.innerHTML = `<img src="${p.sprite.normal || ''}" alt="${p.name}"><p>${p.name}</p>`;
        modalPokemonList.appendChild(card);
    });
    modal.classList.remove('hidden');
}

function selectPokemon(pokemon) {
    if (!currentCell) return;
    const key = getCellKey(currentCell);
    const selection = { id: pokemon.id, shiny: false };
    localStorage.setItem(key, JSON.stringify(selection));
    renderCell(currentCell, pokemon, false);
    modal.classList.add('hidden');
    updateAllDependentStates();
}

function clearSelection() {
    if (!currentCell) return;
    const key = getCellKey(currentCell);
    localStorage.removeItem(key);
    currentCell.innerHTML = currentCell.dataset.cellType.includes('favorite-gen') ? `<span class="slot-label">${currentCell.querySelector('.slot-label').textContent}</span>` : '';
    modal.classList.add('hidden');
    updateAllDependentStates();
}

function toggleShiny(cell) {
    const key = getCellKey(cell);
    const selection = JSON.parse(localStorage.getItem(key));
    if (!selection) return;

    selection.shiny = !selection.shiny;
    localStorage.setItem(key, JSON.stringify(selection));
    const pokemon = pokemonData.find(p => p.id === selection.id);
    renderCell(cell, pokemon, selection.shiny);
}


// --- STATE & STORAGE ---
function getCellKey(cell) { return `selection-${cell.id}`; }

function loadSelections() {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('selection-')) {
            const cellId = key.replace('selection-', '');
            const cell = document.getElementById(cellId);
            const selection = JSON.parse(localStorage.getItem(key));
            if (cell && selection) {
                const pokemon = pokemonData.find(p => p.id === selection.id);
                if (pokemon) renderCell(cell, pokemon, selection.shiny);
            }
        }
    }
}

function renderCell(cell, pokemon, isShiny) {
    const sprite = isShiny ? pokemon.sprite.shiny : pokemon.sprite.normal;
    cell.innerHTML = sprite ? `<img src="${sprite}" alt="${pokemon.name}">` : '';
    if(cell.classList.contains('slot-cell') && cell.querySelector('.slot-label')) {
        cell.appendChild(cell.querySelector('.slot-label'));
    }
}

function getRowSelections(type1, isLegendaryRow) {
    const selected = new Set();
    types.forEach(type2 => {
        const key = isLegendaryRow ? `selection-cell-legendary-type-${type2}` : `selection-cell-combo-${type1}-${type2}`;
        const selection = JSON.parse(localStorage.getItem(key));
        if (selection) selected.add(selection.id);
    });
    return pokemonData.filter(p => selected.has(p.id));
}

function getAllSelectedPokemon() {
    const selected = new Set();
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('selection-cell-combo') || key.startsWith('selection-cell-legendary-type')) {
            const selection = JSON.parse(localStorage.getItem(key));
            if (selection) selected.add(selection.id);
        }
    }
    return pokemonData.filter(p => selected.has(p.id));
}

function updateAllDependentStates() {
    types.forEach(type1 => {
        const favTypeCell = document.getElementById(`cell-favorite-type-${type1}`);
        getRowSelections(type1, false).length > 0 ? favTypeCell.classList.remove('disabled') : favTypeCell.classList.add('disabled');
    });
    const favLegendaryCell = document.getElementById('cell-favorite-legendary');
    getRowSelections('legendary', true).length > 0 ? favLegendaryCell.classList.remove('disabled') : favLegendaryCell.classList.add('disabled');
}

// --- EXPORT ---
function exportGridAsImage() {
    gridContainer.classList.add('exporting');
    requestAnimationFrame(() => {
        html2canvas(gridContainer, { useCORS: true, backgroundColor: getComputedStyle(document.body).backgroundColor })
        .then(canvas => {
            const link = document.createElement('a');
            link.download = 'pokemon-favorites.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => console.error("Failed to export image:", err))
        .finally(() => gridContainer.classList.remove('exporting'));
    });
}

// --- RUN ---
initialize();
