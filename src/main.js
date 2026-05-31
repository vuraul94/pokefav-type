import './style.css';
import html2canvas from 'html2canvas';

// --- CONSTANTS & DOM ELEMENTS ---
const POKEMON_DATA_URL = './pokemon_data.json'; // Relative path for GH pages
const TYPES_DATA_URL = './types.json';       // Relative path for GH pages
const localesBasePath = './locales/';      // Relative path for GH pages

// ... other DOM element getters
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
const exportSelectionBtn = document.getElementById('export-selection-btn');
const importSelectionInput = document.getElementById('import-selection-input');
const langSwitcher = document.getElementById('lang-switcher');


// --- APP STATE ---
let types = [];
let generations = [];
let pokemonData = [];
let currentCell = null;
let translations = {};
let currentLanguage = 'en';

const typeColors = {
    normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
    grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
    ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
    rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
    steel: '#B7B7CE', fairy: '#D685AD'
};

// --- I18N (Internationalization) ---
async function setLanguage(lang) {
    if (!['en', 'es'].includes(lang)) lang = 'en';
    
    try {
        const response = await fetch(`${localesBasePath}${lang}.json`);
        if (!response.ok) throw new Error('Language file not found');
        translations = await response.json();
        currentLanguage = lang;
        localStorage.setItem('pokemon-selector-lang', lang);
        
        document.documentElement.lang = lang;
        updateUIText();
        document.querySelectorAll('#lang-switcher button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
    } catch (error) {
        console.error("Failed to set language:", error);
    }
}

function updateUIText() {
    document.querySelectorAll('[data-i18n-key]').forEach(el => {
        const key = el.dataset.i18nKey;
        if (translations[key]) {
            if (el.tagName === 'TITLE') {
                el.innerText = translations[key];
            } else {
                el.textContent = translations[key];
            }
        }
    });
    // Re-create dynamic slots to update labels
    createExtraSlots();
    loadSelections();
}

// --- INITIALIZATION ---
async function initialize() {
    try {
        const savedLang = localStorage.getItem('pokemon-selector-lang') || 'en';
        await setLanguage(savedLang);

        const [pokemonRes, typesRes] = await Promise.all([fetch(POKEMON_DATA_URL), fetch(TYPES_DATA_URL)]);
        if (!pokemonRes.ok || !typesRes.ok) throw new Error('Failed to load data files.');
        
        pokemonData = await pokemonRes.json();
        types = Object.keys(await typesRes.json());
        generations = [...new Set(pokemonData.map(p => p.generation))].sort((a, b) => a.split('-')[1] - b.split('-')[1]);

        createGrid();
        createExtraSlots();
        updateEmptyCells(); // Add this call
        loadSelections();
        updateAllDependentStates();
        setupEventListeners();
    } catch (error) {
        document.getElementById('app').innerHTML = `<p style="color: red;">Error initializing app: ${error.message}</p>`;
    }
}

function updateEmptyCells() {
    document.querySelectorAll('.grid-cell[data-cell-type="combo"], .grid-cell[data-cell-type="legendary-type"]').forEach(cell => {
        const pokemonOptions = getPokemonForCell(cell);
        if (pokemonOptions.length === 0) {
            cell.classList.add('empty-cell', 'disabled');
        }
    });
}


// --- UI CREATION ---
function createGrid() {
    const gridCols = `30px repeat(${types.length}, 1fr) 1fr`;
    const gridRows = `30px repeat(${types.length}, 1fr) 1fr`;
    gridContainer.style.gridTemplateColumns = gridCols;
    gridContainer.style.gridTemplateRows = gridRows;
    gridContainer.innerHTML = ''; // Clear it

    // Top Row Headers
    gridContainer.innerHTML += `<div class="header-cell"></div>`;
    types.forEach(type => gridContainer.innerHTML += `<div class="header-cell" style="background-color: ${typeColors[type]}">${type.slice(0, 3).toUpperCase()}</div>`);
    gridContainer.innerHTML += `<div class="header-cell" style="background-color: #FF69B4" title="${translations.favoriteHeader || 'FAV'}">${translations.favoriteHeader || 'FAV'}</div>`;

    // Type Rows
    types.forEach(type1 => {
        const rowColor = hexToRgba(typeColors[type1], 0.15);
        gridContainer.innerHTML += `<div class="header-cell" style="background-color: ${typeColors[type1]}">${type1.slice(0, 3).toUpperCase()}</div>`;
        types.forEach(type2 => {
            const isMono = type1 === type2;
            gridContainer.innerHTML += `<div class="grid-cell ${isMono ? 'mono-type-cell' : ''}" style="background-color: ${rowColor}; ${isMono ? `background-color: ${typeColors[type1]}`: ''}" data-cell-type="combo" data-type1="${type1}" data-type2="${type2}" id="cell-combo-${type1}-${type2}"></div>`;
        });
        gridContainer.innerHTML += `<div class="grid-cell favorite-cell disabled" style="background-color: ${rowColor};" data-cell-type="favorite-type" data-type1="${type1}" id="cell-favorite-type-${type1}"></div>`;
    });

    // Legendary Row
    const legendaryRowColor = hexToRgba(typeColors['dragon'], 0.1);
    gridContainer.innerHTML += `<div class="header-cell" style="background-color: #D4AF37" title="${translations.legendaryRowHeader || 'LEG'}">${translations.legendaryRowHeader || 'LEG'}</div>`;
    types.forEach(type => gridContainer.innerHTML += `<div class="grid-cell legendary-cell" style="background-color: ${legendaryRowColor};" data-cell-type="legendary-type" data-type1="${type}" id="cell-legendary-type-${type}"></div>`);
    gridContainer.innerHTML += `<div class="grid-cell favorite-cell disabled" style="background-color: ${legendaryRowColor};" data-cell-type="favorite-legendary" id="cell-favorite-legendary"></div>`;
}

function createExtraSlots() {
    teamBuilderContainer.innerHTML = '';
    overallFavoriteContainer.innerHTML = '';
    genFavoritesContainer.innerHTML = '';

    for (let i = 0; i < 6; i++) teamBuilderContainer.innerHTML += `<div class="slot-cell" data-cell-type="team" data-slot-id="${i}" id="cell-team-${i}"><span class="slot-label">${translations.teamSlotLabel || 'Team'} ${i+1}</span></div>`;
    overallFavoriteContainer.innerHTML += `<div class="slot-cell" data-cell-type="favorite-overall" id="cell-favorite-overall"><span class="slot-label">${translations.overallSlotLabel || 'Overall'}</span></div>`;
    generations.forEach((gen, i) => genFavoritesContainer.innerHTML += `<div class="slot-cell" data-cell-type="favorite-gen" data-gen-name="${gen}" id="cell-favorite-gen-${i}"><span class="slot-label">${(translations.genSlotLabel || 'Gen')} ${gen.split('-')[1].toUpperCase()}</span></div>`);
}


// --- EVENT HANDLING & LOGIC ---
// ... (most of the logic from before remains the same, just needs to use `translations` object)
function setupEventListeners() {
    document.getElementById('app').addEventListener('click', (e) => {
        const cell = e.target.closest('.grid-cell, .slot-cell');
        if (cell && !cell.classList.contains('disabled')) {
            openPokemonSelection(cell);
        }
    });
    closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => e.target === modal && modal.classList.add('hidden'));
    exportBtn.addEventListener('click', exportGridAsImage);
    exportSelectionBtn.addEventListener('click', exportSelection);
    importSelectionInput.addEventListener('change', importSelection);
    langSwitcher.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            setLanguage(e.target.dataset.lang);
        }
    });
}

function openPokemonSelection(cell) {
    currentCell = cell;
    const matchingPokemon = getPokemonForCell(cell);
    
    const existingClearBtn = modalHeader.querySelector('.clear-btn');
    if (existingClearBtn) existingClearBtn.remove();
    if (cell.querySelector('img')) {
        const clearBtn = document.createElement('button');
        clearBtn.textContent = translations.modalClearButton || 'Clear';
        clearBtn.className = 'clear-btn';
        clearBtn.onclick = clearSelection;
        modalHeader.insertBefore(clearBtn, closeModalBtn);
    }
    
    modalTitle.textContent = translations.modalSelectTitle || 'Select Pokémon';
    modalPokemonList.innerHTML = matchingPokemon.length > 0 ? '' : `<p>${translations.modalNoPokemon || 'No Pokémon match this selection.'}</p>`;
    
    matchingPokemon.forEach(p => {
        const card = document.createElement('div');
        card.className = 'pokemon-card';
        card.dataset.shiny = 'false';

        const sprite = p.sprite.normal || p.sprite.shiny || '';
        const shinySprite = p.sprite.shiny || p.sprite.normal || '';

        card.innerHTML = `
            <img src="${sprite}" alt="${p.name}" class="pokemon-sprite">
            <p>${p.name}</p>
            <div class="card-controls">
                <button class="shiny-btn">Shiny</button>
            </div>
        `;

        const img = card.querySelector('.pokemon-sprite');
        const shinyBtn = card.querySelector('.shiny-btn');

        shinyBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click from firing
            const isShiny = card.dataset.shiny === 'true';
            card.dataset.shiny = !isShiny;
            img.src = !isShiny ? shinySprite : sprite;
        });

        img.addEventListener('click', () => {
            const isShiny = card.dataset.shiny === 'true';
            selectPokemon(p, isShiny);
        });

        modalPokemonList.appendChild(card);
    });
    modal.classList.remove('hidden');
}

// --- IMPORT/EXPORT ---
function exportSelection() {
    const selectionData = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('selection-')) {
            selectionData[key] = localStorage.getItem(key);
        }
    }
    const blob = new Blob([JSON.stringify(selectionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pokemon-favorites.json';
    link.click();
    URL.revokeObjectURL(url);
}

function importSelection(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            // Clear existing selections before import
            Object.keys(localStorage)
                  .filter(k => k.startsWith('selection-'))
                  .forEach(k => localStorage.removeItem(k));
            
            for (const key in importedData) {
                if (key.startsWith('selection-')) {
                    localStorage.setItem(key, importedData[key]);
                }
            }
            loadSelections();
            updateAllDependentStates();
        } catch (error) {
            alert('Failed to import file. Make sure it is a valid selection file.');
            console.error(error);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}


// --- The rest of the functions (getPokemonForCell, selectPokemon, clearSelection, toggleShiny, getCellKey, loadSelections, renderCell, getRowSelections, getAllSelectedPokemon, updateAllDependentStates, exportGridAsImage, hexToRgba) are mostly the same as before ---
// Minor tweaks might be needed if they contain hardcoded strings, which have been addressed above.
// For brevity, I will paste the rest of the functions without modification, as the core changes are in initialization and UI creation/updating.

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
            return pokemonData.filter(p => (p.is_legendary || p.is_mythical) && p.types.some(t => t.name === type1));
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

function selectPokemon(pokemon, isShiny) {
    if (!currentCell) return;
    const key = getCellKey(currentCell);
    const selection = { id: pokemon.id, shiny: isShiny };
    localStorage.setItem(key, JSON.stringify(selection));
    renderCell(currentCell, pokemon, isShiny);
    modal.classList.add('hidden');
    updateAllDependentStates();
}

function clearSelection() {
    if (!currentCell) return;
    const key = getCellKey(currentCell);
    localStorage.removeItem(key);
    // Restore label if it's a slot cell
    const labelSpan = document.createElement('span');
    labelSpan.className = 'slot-label';
    let labelText = '';
    const { cellType, slotId, genName } = currentCell.dataset;
    if(cellType === 'team') labelText = `${translations.teamSlotLabel || 'Team'} ${parseInt(slotId)+1}`;
    else if (cellType === 'favorite-overall') labelText = translations.overallSlotLabel || 'Overall';
    else if (cellType === 'favorite-gen') labelText = `${translations.genSlotLabel || 'Gen'} ${genName.split('-')[1].toUpperCase()}`;
    
    currentCell.innerHTML = '';
    if(labelText) {
        labelSpan.textContent = labelText;
        currentCell.appendChild(labelSpan);
    }
    
    modal.classList.add('hidden');
    updateAllDependentStates();
}



function getCellKey(cell) { return `selection-${cell.id}`; }

function loadSelections() {
    document.querySelectorAll('.grid-cell, .slot-cell').forEach(cell => {
        const key = getCellKey(cell);
        const selection = JSON.parse(localStorage.getItem(key));
        if (cell.querySelector('img')) {
            cell.innerHTML = cell.querySelector('.slot-label')?.outerHTML || '';
        }
        if (selection) {
            const pokemon = pokemonData.find(p => p.id === selection.id);
            if (pokemon) renderCell(cell, pokemon, selection.shiny);
        }
    });
}

function renderCell(cell, pokemon, isShiny) {
    const sprite = isShiny ? (pokemon.sprite.shiny || pokemon.sprite.normal) : pokemon.sprite.normal;
    cell.innerHTML = sprite ? `<img src="${sprite}" alt="${pokemon.name}">` : '';
    const label = cell.querySelector('.slot-label');
    if (label) cell.appendChild(label);
}

function getRowSelections(type1, isLegendaryRow) {
    const selected = new Set();
    const keys = isLegendaryRow 
        ? types.map(t2 => `selection-cell-legendary-type-${t2}`)
        : types.map(t2 => `selection-cell-combo-${type1}-${t2}`);
    
    keys.forEach(key => {
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
        if(favTypeCell) getRowSelections(type1, false).length > 0 ? favTypeCell.classList.remove('disabled') : favTypeCell.classList.add('disabled');
    });
    const favLegendaryCell = document.getElementById('cell-favorite-legendary');
    if(favLegendaryCell) getRowSelections('legendary', true).length > 0 ? favLegendaryCell.classList.remove('disabled') : favLegendaryCell.classList.add('disabled');
}

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

function hexToRgba(hex, alpha) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) { r = "0x" + hex[1] + hex[1]; g = "0x" + hex[2] + hex[2]; b = "0x" + hex[3] + hex[3]; } 
    else if (hex.length === 7) { r = "0x" + hex[1] + hex[2]; g = "0x" + hex[3] + hex[4]; b = "0x" + hex[5] + hex[6]; }
    return `rgba(${+r},${+g},${+b},${alpha})`;
}

initialize();
